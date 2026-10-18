import * as THREE from "three";
import type { ToothCondition, ToothRecord, ToothSurface } from "@/types/dental.type";
import type { ToothInfo } from "./toothCatalog";
import { isAnterior } from "./toothCatalog";
import { CONDITION_COLOR, surfaceCondition, wholeToothCondition } from "./surfaceFindings";

// Tooth-local frame used throughout (millimetres): y = 0 is the cemento-enamel junction,
// the crown points to +Y and the roots to -Y; +X is mesial, +Z is buccal/labial. Placing a
// tooth in the mouth is just a matter of mapping these three axes (see dentalArch.ts), so
// every surface stays where it belongs however the tooth is turned.

export const SURFACE_ORDER: ToothSurface[] = ["M", "D", "B", "L", "O"];

export type Detail = "low" | "high";

const RES: Record<Detail, { seg: number; side: number; cap: number; rootSeg: number; rootRings: number }> = {
  low: { seg: 40, side: 12, cap: 9, rootSeg: 16, rootRings: 12 },
  high: { seg: 96, side: 30, cap: 22, rootSeg: 40, rootRings: 28 },
};

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const gauss2 = (dx: number, dz: number, s: number) => Math.exp(-(dx * dx + dz * dz) / (2 * s * s));

function superellipse(theta: number, a: number, b: number, p: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / p;
  return [a * Math.sign(c) * Math.pow(Math.abs(c), e), b * Math.sign(s) * Math.pow(Math.abs(s), e)];
}

// Width along the crown: cervical width at the CEJ, widest at the height of contour (tc),
// then converging towards the occlusal table / incisal edge.
function profile(t: number, cerv: number, max: number, top: number, tc: number) {
  if (t <= tc) return cerv + (max - cerv) * Math.sin((t / tc) * (Math.PI / 2));
  const u = (t - tc) / (1 - tc);
  return max - (max - top) * u * u;
}

type Cusp = [x: number, z: number, h: number, sigma: number];

// Cusp tips in normalised occlusal coordinates (x mesial+, z buccal+, both -1..1).
function cuspsFor(info: ToothInfo): Cusp[] {
  const { kind, isUpper, position, primary } = info;
  const k = primary ? 0.7 : 1;
  const scale = (list: Cusp[]): Cusp[] => list.map(([x, z, h, s]) => [x, z, h * k, s]);
  if (kind === "molar") {
    if (isUpper) return scale([[0.48, 0.5, 2.0, 0.34], [-0.5, 0.5, 1.8, 0.32], [0.42, -0.45, 2.2, 0.38], [-0.52, -0.52, 1.4, 0.3]]);
    // Lower first molars (and primary second molars) carry a fifth, distobuccal cusp.
    const fiveCusp = (!primary && position === 6) || (primary && position === 5);
    return scale(fiveCusp
      ? [[0.55, 0.5, 1.9, 0.3], [0.0, 0.56, 1.8, 0.28], [-0.62, 0.34, 1.4, 0.26], [0.5, -0.5, 2.2, 0.32], [-0.4, -0.5, 2.0, 0.32]]
      : [[0.5, 0.5, 1.9, 0.34], [-0.5, 0.5, 1.7, 0.33], [0.5, -0.5, 2.1, 0.34], [-0.5, -0.5, 1.9, 0.33]]);
  }
  if (kind === "premolar") {
    if (isUpper) return scale([[0, 0.46, 2.4, 0.36], [0, -0.46, 2.0, 0.34]]);
    return scale(position === 4
      ? [[0, 0.4, 2.6, 0.38], [0, -0.52, 1.0, 0.26]]
      : [[0, 0.45, 2.0, 0.36], [0.42, -0.45, 1.6, 0.28], [-0.42, -0.45, 1.2, 0.26]]);
  }
  if (kind === "canine") return scale([[0, 0.12, 2.6, 0.5]]);
  return scale([[-0.55, 0, 0.3, 0.2], [0, 0, 0.35, 0.2], [0.55, 0, 0.3, 0.2]]);
}

interface CrownShape {
  sideTop: number; // where the side walls end and the occlusal relief starts
  exponent: number; // superellipse exponent of the cross-section (higher = boxier)
  half: (t: number) => [number, number]; // mesiodistal and buccolingual half-widths
  rise: (xn: number, zn: number, rho: number) => number; // occlusal relief above sideTop
  shovel: boolean; // incisor lingual fossa + cingulum
  occlusal: (level: number) => boolean; // whether a face at this level is occlusal/incisal
}

function crownShape(info: ToothInfo): CrownShape {
  const { kind, crownH, md, bl, cervMd, cervBl } = info;
  const cusps = cuspsFor(info);
  const tallest = Math.max(...cusps.map((c) => c[2]));

  if (kind === "incisor") {
    return {
      sideTop: crownH - 0.3,
      exponent: 2.3,
      half: (t) => [profile(t, cervMd / 2, md / 2, (md / 2) * 0.96, 0.78), profile(t, cervBl / 2, bl / 2, (bl / 2) * 0.16, 0.22)],
      rise: (xn, zn, rho) => {
        let r = 0;
        for (const [cx, cz, h, s] of cusps) r = Math.max(r, h * gauss2(xn - cx, zn - cz, s));
        return r * (1 - smoothstep(0.7, 1, rho));
      },
      shovel: true,
      occlusal: (level) => level >= 0.9,
    };
  }

  if (kind === "canine") {
    const tip = cusps[0];
    return {
      sideTop: crownH - tip[2],
      exponent: 2.1,
      half: (t) => [profile(t, cervMd / 2, md / 2, (md / 2) * 0.62, 0.62), profile(t, cervBl / 2, bl / 2, (bl / 2) * 0.42, 0.28)],
      rise: (xn, zn, rho) => {
        const r = Math.hypot(xn - tip[0], (zn - tip[1]) * 1.15);
        return tip[2] * Math.pow(Math.max(0, 1 - r), 1.25) * (1 - smoothstep(0.85, 1, rho));
      },
      shovel: false,
      occlusal: (level) => level > 1 && 2 - level <= 0.8,
    };
  }

  const molar = kind === "molar";
  return {
    sideTop: crownH - tallest,
    exponent: molar ? 2.7 : 2.25,
    half: (t) => [
      profile(t, cervMd / 2, md / 2, (md / 2) * 0.9, molar ? 0.6 : 0.62),
      profile(t, cervBl / 2, bl / 2, (bl / 2) * (molar ? 0.7 : 0.66), molar ? 0.32 : 0.3),
    ],
    rise: (xn, zn, rho) => {
      const rim = 1 - smoothstep(0.8, 1, rho);
      const marginal = 0.55 * Math.exp(-((rho - 0.86) ** 2) / (2 * 0.05 ** 2));
      // p-norm "soft max" so neighbouring cusps stay distinct instead of merging into one lump
      let acc = 0;
      for (const [cx, cz, h, s] of cusps) acc += (h * gauss2(xn - cx, zn - cz, s)) ** 4;
      const cuspRise = Math.pow(acc, 0.25);
      const fossa = 0.9 * gauss2(xn, zn, 0.2);
      const centralGroove = 0.45 * Math.exp(-(zn * zn) / (2 * 0.05 * 0.05)) * (1 - smoothstep(0.55, 0.85, Math.abs(xn)));
      const crossGroove = molar
        ? 0.35 * Math.exp(-(xn * xn) / (2 * 0.05 * 0.05)) * (1 - smoothstep(0.7, 0.95, Math.abs(zn)))
        : 0;
      return Math.max(-0.6, rim * (cuspRise + marginal) - fossa - centralGroove - crossGroove);
    },
    shovel: false,
    occlusal: (level) => level > 1 && 2 - level <= 0.78,
  };
}

// Lingual fossa (concave) bounded by a cingulum bulge near the cervix - the "shovel" of an incisor.
function shovelFactor(t: number, theta: number) {
  const lingual = Math.abs(Math.sin(theta));
  const fossa = 0.35 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.25) / 0.7))) * lingual ** 3;
  const cingulum = 0.1 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.05) / 0.3))) * lingual ** 2;
  return 1 - fossa + cingulum;
}

function sectorSurface(theta: number): number {
  const t = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (t < Math.PI / 4 || t >= (7 * Math.PI) / 4) return 0; // M
  if (t < (3 * Math.PI) / 4) return 2; // B
  if (t < (5 * Math.PI) / 4) return 1; // D
  return 3; // L
}

export interface SurfaceAnchor {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

interface CrownBuild {
  geometry: THREE.BufferGeometry;
  surfaceIds: Uint8Array; // per (non-indexed) vertex, index into SURFACE_ORDER
  anchors: Record<ToothSurface, SurfaceAnchor>;
  shape: CrownShape;
}

function buildCrown(info: ToothInfo, detail: Detail): CrownBuild {
  const { seg, side, cap } = RES[detail];
  const shape = crownShape(info);
  const positions: number[] = [];
  const thetas: number[] = [];
  // Side wall: t in [0, 1]. Occlusal cap: 1 + (1 - rho), so (1, 2]. CEJ disc: -1.
  const levels: number[] = [];
  const ring = (r: number, s: number) => r * seg + (s % seg);

  for (let k = 0; k <= side; k++) {
    const t = k / side;
    const [a, b] = shape.half(t);
    for (let s = 0; s < seg; s++) {
      const th = (s / seg) * Math.PI * 2;
      const [x, z0] = superellipse(th, a, b, shape.exponent);
      const z = shape.shovel && z0 < 0 ? z0 * shovelFactor(t, th) : z0;
      positions.push(x, t * shape.sideTop, z);
      thetas.push(th);
      levels.push(t);
    }
  }

  const [a1, b1] = shape.half(1);
  for (let j = 1; j < cap; j++) {
    const rho = 1 - j / cap;
    for (let s = 0; s < seg; s++) {
      const th = (s / seg) * Math.PI * 2;
      const [x, z0] = superellipse(th, a1 * rho, b1 * rho, shape.exponent);
      const z = shape.shovel && z0 < 0 ? z0 * shovelFactor(1, th) : z0;
      positions.push(x, shape.sideTop + shape.rise(x / a1, z / b1, rho), z);
      thetas.push(th);
      levels.push(2 - rho);
    }
  }

  const top = positions.length / 3;
  positions.push(0, shape.sideTop + shape.rise(0, 0, 0), 0);
  thetas.push(Number.NaN);
  levels.push(2);
  const bottom = top + 1;
  positions.push(0, 0, 0);
  thetas.push(Number.NaN);
  levels.push(-1);

  const rings = side + 1 + (cap - 1);
  const indices: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < seg; s++) {
      const a = ring(r, s), b = ring(r + 1, s), c = ring(r + 1, s + 1), d = ring(r, s + 1);
      indices.push(a, b, c, a, c, d);
    }
  }
  for (let s = 0; s < seg; s++) indices.push(ring(rings - 1, s), top, ring(rings - 1, s + 1));
  for (let s = 0; s < seg; s++) indices.push(ring(0, s + 1), bottom, ring(0, s));

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  indexed.computeVertexNormals();

  // One surface per face (not per vertex) so borders between charted surfaces stay crisp.
  const faceCount = indices.length / 3;
  const faceSurface = new Uint8Array(faceCount);
  for (let f = 0; f < faceCount; f++) {
    let cx = 0, sx = 0, n = 0, level = 0;
    for (let v = 0; v < 3; v++) {
      const i = indices[f * 3 + v];
      level += levels[i];
      if (!Number.isNaN(thetas[i])) {
        cx += Math.cos(thetas[i]);
        sx += Math.sin(thetas[i]);
        n++;
      }
    }
    level /= 3;
    const theta = n > 0 ? Math.atan2(sx, cx) : 0;
    faceSurface[f] = level > -0.5 && shape.occlusal(level) ? 4 : sectorSurface(theta);
  }

  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  const surfaceIds = new Uint8Array(faceCount * 3);
  for (let f = 0; f < faceCount; f++) surfaceIds.fill(faceSurface[f], f * 3, f * 3 + 3);
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(faceCount * 9).fill(1), 3));

  const wall = (th: number, t: number, out: number): THREE.Vector3 => {
    const [a, b] = shape.half(t);
    const [x, z] = superellipse(th, a, b, shape.exponent);
    return new THREE.Vector3(x, t * shape.sideTop, shape.shovel && z < 0 ? z * shovelFactor(t, th) : z).addScaledVector(
      new THREE.Vector3(Math.cos(th), 0, Math.sin(th)),
      out,
    );
  };
  const occlusalY = shape.sideTop + Math.max(0, shape.rise(0, 0, 0));
  const anchors: Record<ToothSurface, SurfaceAnchor> = {
    M: { position: wall(0, 0.6, 0), normal: new THREE.Vector3(1, 0, 0) },
    D: { position: wall(Math.PI, 0.6, 0), normal: new THREE.Vector3(-1, 0, 0) },
    B: { position: wall(Math.PI / 2, 0.5, 0), normal: new THREE.Vector3(0, 0, 1) },
    L: { position: wall((3 * Math.PI) / 2, 0.5, 0), normal: new THREE.Vector3(0, 0, -1) },
    O: { position: new THREE.Vector3(0, occlusalY, 0), normal: new THREE.Vector3(0, 1, 0) },
  };

  return { geometry, surfaceIds, anchors, shape };
}

interface RootSpec {
  x: number; z: number; rx: number; rz: number;
  len: number; // apex depth below the CEJ
  top: number; // where this root starts (inside the crown or trunk)
  bendX: number; bendZ: number; // apical curvature, as a fraction of len
  exponent: number;
}

function rootSpecs(info: ToothInfo): RootSpec[] {
  const { cervMd, cervBl, rootLen: L, rootCount, isUpper, kind, primary } = info;
  const flare = primary ? 1.8 : 1;
  if (rootCount === 1) {
    return [{ x: 0, z: 0, rx: (cervMd / 2) * 0.98, rz: (cervBl / 2) * 0.98, len: L, top: 0.35, bendX: -0.05, bendZ: 0, exponent: kind === "molar" ? 2.4 : 2.1 }];
  }
  if (rootCount === 2 && isUpper) {
    return [
      { x: 0, z: cervBl * 0.22, rx: (cervMd / 2) * 0.78, rz: cervBl * 0.24, len: L, top: -1.2, bendX: -0.04, bendZ: 0.05 * flare, exponent: 2.1 },
      { x: 0, z: -cervBl * 0.22, rx: (cervMd / 2) * 0.78, rz: cervBl * 0.24, len: L * 0.95, top: -1.2, bendX: -0.04, bendZ: -0.06 * flare, exponent: 2.1 },
    ];
  }
  if (rootCount === 2) {
    return [
      { x: cervMd * 0.25, z: 0, rx: cervMd * 0.2, rz: (cervBl / 2) * 0.86, len: L, top: -1.6, bendX: -0.08 + 0.06 * (flare - 1), bendZ: 0, exponent: 2.3 },
      { x: -cervMd * 0.25, z: 0, rx: cervMd * 0.18, rz: (cervBl / 2) * 0.8, len: L * 0.92, top: -1.6, bendX: -0.06 * flare, bendZ: 0, exponent: 2.3 },
    ];
  }
  return [
    { x: cervMd * 0.22, z: cervBl * 0.2, rx: cervMd * 0.2, rz: cervBl * 0.22, len: L * 0.95, top: -1.5, bendX: -0.05, bendZ: 0.05 * flare, exponent: 2.2 },
    { x: -cervMd * 0.24, z: cervBl * 0.2, rx: cervMd * 0.17, rz: cervBl * 0.19, len: L * 0.88, top: -1.5, bendX: -0.07 * flare, bendZ: 0.04 * flare, exponent: 2.2 },
    { x: 0, z: -cervBl * 0.22, rx: cervMd * 0.21, rz: cervBl * 0.21, len: L, top: -1.5, bendX: 0, bendZ: -0.1 * flare, exponent: 2.2 },
  ];
}

const rootCentre = (spec: RootSpec, s: number) =>
  new THREE.Vector3(spec.x + spec.bendX * spec.len * s * s, spec.top + (-spec.len - spec.top) * s, spec.z + spec.bendZ * spec.len * s * s);

// A tapering tube from `top` down to a closed apex. `width` scales the cross-section along
// the way (1 at the top, 0 at the apex).
function buildTaperedTube(spec: RootSpec, detail: Detail, width: (s: number) => number): THREE.BufferGeometry {
  const { rootSeg: seg, rootRings: rings } = RES[detail];
  const positions: number[] = [];
  for (let k = 0; k < rings; k++) {
    const s = k / rings;
    const c = rootCentre(spec, s);
    const w = width(s);
    for (let i = 0; i < seg; i++) {
      const [x, z] = superellipse((i / seg) * Math.PI * 2, spec.rx * w, spec.rz * w, spec.exponent);
      positions.push(c.x + x, c.y, c.z + z);
    }
  }
  const apex = rootCentre(spec, 1);
  positions.push(apex.x, apex.y, apex.z);
  const apexIndex = rings * seg;
  const idx = (r: number, i: number) => r * seg + (i % seg);
  const indices: number[] = [];
  // Rings run downwards here, so the winding is the mirror of the crown's.
  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = idx(r, i), b = idx(r + 1, i), c = idx(r + 1, i + 1), d = idx(r, i + 1);
      indices.push(a, c, b, a, d, c);
    }
  }
  for (let i = 0; i < seg; i++) indices.push(idx(rings - 1, i), idx(rings - 1, i + 1), apexIndex);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const ENAMEL = new THREE.Color("#efe6d3");
const PAINT_MIX = 0.82; // how strongly a charted surface shows its condition colour
const HOVER_LIFT = 0.3;
const HIGHLIGHT = new THREE.Color("#2563eb");

function baseCrownColour(whole: ToothCondition | null): THREE.Color {
  switch (whole) {
    case "Crown": return new THREE.Color("#d9a441");
    case "BridgeAbutment": return new THREE.Color("#c8902f");
    case "BridgePontic": return new THREE.Color("#f2d98c");
    case "Implant": return new THREE.Color("#f4f2ec");
    case "ExtractionIndicated": return ENAMEL.clone().lerp(new THREE.Color(CONDITION_COLOR.ExtractionIndicated), 0.45);
    default: return ENAMEL.clone();
  }
}

export type Highlight = "none" | "hover" | "selected";

// One tooth: crown (coloured per surface), roots, and the extra pieces some conditions
// need - an implant fixture, root canals / pulp for the X-ray view, an RCT access filling.
export class ToothVisual {
  readonly group = new THREE.Group();
  readonly crown: THREE.Mesh;
  readonly anchors: Record<ToothSurface, SurfaceAnchor>;
  private readonly crownMaterial: THREE.MeshPhysicalMaterial;
  private readonly ghostMaterial: THREE.MeshBasicMaterial;
  private readonly rootMaterial: THREE.MeshStandardMaterial;
  private readonly roots = new THREE.Group();
  private readonly implant: THREE.Group;
  private readonly pulp = new THREE.Group();
  private readonly pulpMaterial: THREE.MeshStandardMaterial;
  private readonly access: THREE.Mesh;
  private readonly surfaceIds: Uint8Array;
  private readonly colours: THREE.BufferAttribute;
  private record: ToothRecord;
  private hoverSurface: ToothSurface | null = null;
  private highlight: Highlight = "none";
  private xray = false;

  constructor(readonly info: ToothInfo, detail: Detail) {
    const crown = buildCrown(info, detail);
    this.surfaceIds = crown.surfaceIds;
    this.anchors = crown.anchors;
    this.colours = crown.geometry.getAttribute("color") as THREE.BufferAttribute;

    this.crownMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
      emissive: HIGHLIGHT,
      emissiveIntensity: 0,
    });
    this.ghostMaterial = new THREE.MeshBasicMaterial({ color: "#94a3b8", transparent: true, opacity: 0.16, depthWrite: false });
    this.crown = new THREE.Mesh(crown.geometry, this.crownMaterial);
    this.group.add(this.crown);

    this.rootMaterial = new THREE.MeshStandardMaterial({ color: "#d8bf8e", roughness: 0.62, emissive: HIGHLIGHT, emissiveIntensity: 0 });
    const specs = rootSpecs(info);
    if (specs.length > 1) {
      const trunkLen = info.kind === "molar" ? 2.8 : 2.2;
      const trunk: RootSpec = {
        x: 0, z: 0, rx: (info.cervMd / 2) * 0.99, rz: (info.cervBl / 2) * 0.99,
        len: trunkLen, top: 0.35, bendX: 0, bendZ: 0, exponent: info.kind === "molar" ? 2.6 : 2.2,
      };
      // Narrows from the CEJ and closes off in a dome where the roots split, so the roots
      // read as growing out of it rather than hanging off a flat collar.
      this.roots.add(new THREE.Mesh(buildTaperedTube(trunk, detail, (s) => (s < 0.6 ? 1 - 0.22 * s : 0.868 * Math.sqrt(Math.max(0, 1 - ((s - 0.6) / 0.4) ** 2)))), this.rootMaterial));
    }
    for (const spec of specs) {
      this.roots.add(new THREE.Mesh(buildTaperedTube(spec, detail, (s) => Math.pow(Math.max(0, 1 - Math.pow(s, 2.2)), 0.6)), this.rootMaterial));
    }
    this.group.add(this.roots);

    this.implant = buildImplant(info, detail);
    this.group.add(this.implant);

    this.pulpMaterial = new THREE.MeshStandardMaterial({ color: "#f43f5e", roughness: 0.5 });
    const chamber = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.pulpMaterial);
    chamber.scale.set(info.cervMd * 0.2, info.crownH * 0.2, info.cervBl * 0.2);
    chamber.position.y = info.crownH * 0.3;
    this.pulp.add(chamber);
    for (const spec of specs) {
      const points = [new THREE.Vector3(spec.x * 0.4, info.crownH * 0.25, spec.z * 0.4)];
      for (let s = 0; s <= 0.95; s += 0.05) points.push(rootCentre(spec, s));
      this.pulp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.32, 8), this.pulpMaterial));
    }
    this.group.add(this.pulp);

    // RCT access filling: on the occlusal fossa of back teeth, the lingual side of front teeth.
    this.access = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: CONDITION_COLOR.RCT, roughness: 0.35 }));
    if (isAnterior(info.kind)) {
      const [, b] = crown.shape.half(0.55);
      this.access.position.set(0, crown.shape.sideTop * 0.55, -b * 0.82);
      this.access.scale.set(info.md * 0.13, info.crownH * 0.12, 0.45);
    } else {
      const [a1, b1] = crown.shape.half(1);
      this.access.position.set(0, crown.shape.sideTop + crown.shape.rise(0, 0, 0) + 0.15, 0);
      this.access.scale.set(a1 * 0.32, 0.4, b1 * 0.32);
    }
    this.group.add(this.access);

    this.record = { toothNumber: info.number, conditions: [], surfaces: [] };
    this.refresh();
  }

  get pickables(): THREE.Object3D[] {
    return [this.crown, ...this.roots.children, ...this.implant.children];
  }

  applyRecord(record: ToothRecord) {
    this.record = record;
    this.refresh();
  }

  setHighlight(level: Highlight) {
    if (level === this.highlight) return;
    this.highlight = level;
    // Kept low so a charted surface still reads as its condition colour when selected.
    const intensity = level === "selected" ? 0.16 : level === "hover" ? 0.08 : 0;
    this.crownMaterial.emissiveIntensity = intensity;
    this.rootMaterial.emissiveIntensity = intensity;
    // A missing tooth is only a ghost outline, which has no emissive - tint it instead.
    this.ghostMaterial.color.set(level === "none" ? "#94a3b8" : "#3b82f6");
    this.ghostMaterial.opacity = level === "selected" ? 0.42 : level === "hover" ? 0.3 : 0.16;
  }

  setHoverSurface(surface: ToothSurface | null) {
    if (surface === this.hoverSurface) return;
    this.hoverSurface = surface;
    this.paint();
  }

  setXray(on: boolean) {
    if (on === this.xray) return;
    this.xray = on;
    this.refresh();
  }

  surfaceOf(hit: THREE.Intersection): ToothSurface | null {
    if (hit.object !== this.crown || !hit.face) return null;
    return SURFACE_ORDER[this.surfaceIds[hit.face.a]] ?? null;
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => m.dispose());
      }
    });
    this.crownMaterial.dispose();
    this.ghostMaterial.dispose();
  }

  private refresh() {
    const whole = wholeToothCondition(this.record.conditions);
    const missing = whole === "Missing";
    const noRoots = missing || whole === "BridgePontic" || whole === "Implant";
    const rct = this.record.conditions.includes("RCT") && !missing && whole !== "Implant";

    this.crown.material = missing ? this.ghostMaterial : this.crownMaterial;
    const metal = whole === "Crown" || whole === "BridgeAbutment";
    this.crownMaterial.metalness = metal ? 0.6 : 0;
    this.crownMaterial.roughness = metal ? 0.26 : 0.32;

    const extraction = whole === "ExtractionIndicated";
    this.rootMaterial.color.set(extraction ? "#e7a7a0" : "#d8bf8e");

    // X-ray: the tooth turns see-through so pulp, canals and root fillings show.
    for (const m of [this.crownMaterial, this.rootMaterial]) {
      m.transparent = this.xray;
      m.opacity = this.xray ? 0.32 : 1;
      m.depthWrite = !this.xray;
      m.needsUpdate = true;
    }
    this.roots.visible = !noRoots;
    this.implant.visible = whole === "Implant";
    this.pulp.visible = this.xray && !noRoots;
    this.pulpMaterial.color.set(rct ? CONDITION_COLOR.RCT : "#f43f5e");
    this.access.visible = rct;
    this.paint();
  }

  private paint() {
    const whole = wholeToothCondition(this.record.conditions);
    const noSurfaces = whole === "Missing" || whole === "BridgePontic" || whole === "Implant";
    const base = baseCrownColour(whole);
    const colours = SURFACE_ORDER.map((s) => {
      const condition = noSurfaces ? null : surfaceCondition(this.record, s);
      const c = condition ? base.clone().lerp(new THREE.Color(CONDITION_COLOR[condition]), PAINT_MIX) : base.clone();
      return s === this.hoverSurface ? c.lerp(new THREE.Color("#ffffff"), HOVER_LIFT) : c;
    });
    for (let i = 0; i < this.surfaceIds.length; i++) {
      const c = colours[this.surfaceIds[i]];
      this.colours.setXYZ(i, c.r, c.g, c.b);
    }
    this.colours.needsUpdate = true;
  }
}

// Titanium fixture with thread rings plus a short abutment collar up into the crown.
function buildImplant(info: ToothInfo, detail: Detail): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: "#9aa4b2", metalness: 0.85, roughness: 0.3 });
  const r = Math.min(info.cervMd, info.cervBl) * 0.24;
  const len = info.rootLen * 0.78;
  const radial = detail === "high" ? 40 : 18;
  const body = new THREE.CylinderGeometry(r, r * 0.8, len, radial);
  body.translate(0, -len / 2 - 0.6, 0);
  group.add(new THREE.Mesh(body, material));
  const collar = new THREE.CylinderGeometry(r * 1.15, r * 1.05, 1.4, radial);
  collar.translate(0, 0.1, 0);
  group.add(new THREE.Mesh(collar, material));
  const pitch = 0.9;
  for (let y = -1.4; y > -len; y -= pitch) {
    const radius = r * (1 - 0.2 * ((-y - 1.4) / len)) * 1.04;
    const thread = new THREE.TorusGeometry(radius, r * 0.14, 6, radial);
    thread.rotateX(Math.PI / 2);
    thread.translate(0, y, 0);
    group.add(new THREE.Mesh(thread, material));
  }
  return group;
}
