import * as THREE from "three";
import { toothInfo, type ToothInfo } from "./toothCatalog";
import { ToothVisual, type Detail } from "./toothGeometry";

export type ArchFilter = "both" | "upper" | "lower";

// Half an arch (patient's right side, x < 0), midline to the back, in mm - the shape only;
// it's scaled to the actual teeth so they sit edge to edge along it.
const HALF_ARCH: Record<"adultUpper" | "adultLower" | "primaryUpper" | "primaryLower", [number, number][]> = {
  adultUpper: [[0, 22], [-8, 20.5], [-15, 15.5], [-20, 8], [-23.5, 0], [-26, -10], [-27.5, -22]],
  adultLower: [[0, 18], [-6, 17], [-12, 13], [-16.5, 6], [-19.5, -2.5], [-21.5, -13], [-22.5, -25]],
  primaryUpper: [[0, 15], [-6, 13.5], [-11, 9], [-14, 2.5], [-15.5, -5], [-16.5, -12]],
  primaryLower: [[0, 12.5], [-5, 11.5], [-9.5, 7.8], [-12.5, 2], [-14, -5], [-15, -12]],
};

const OCCLUSAL_GAP = 0.35; // each arch stops this short of the occlusal plane
const CONTACT_GAP = 0.15; // between neighbouring teeth
const HINGE = new THREE.Vector3(0, 18, -55); // roughly where the condyles sit

interface Placed {
  info: ToothInfo;
  s0: number; // signed arc distance from the midline (patient's right negative)
  s1: number;
  cejY: number;
}

export interface ArchScene {
  readonly group: THREE.Group;
  readonly teeth: Map<string, ToothVisual>;
  readonly pickables: THREE.Object3D[];
  readonly center: THREE.Vector3;
  setJawOpen(radians: number): void;
  setGumsVisible(on: boolean): void;
  setArchVisible(filter: ArchFilter): void;
  // World position for a tooth's number label (on the gum, buccal side); false if the tooth
  // is hidden or faces away from `viewer` (its label would float over the near side).
  labelPosition(toothNumber: string, out: THREE.Vector3, viewer: THREE.Vector3): boolean;
  dispose(): void;
}

function fullArchCurve(half: [number, number][], needed: number): THREE.CatmullRomCurve3 {
  const raw = new THREE.CatmullRomCurve3(half.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const k = needed / (raw.getLength() * 0.96);
  const right = half.map(([x, z]) => new THREE.Vector3(x * k, 0, z * k));
  const left = right.slice(1).map((p) => new THREE.Vector3(-p.x, 0, p.z));
  // Back-right → front → back-left, so the midline sits exactly halfway along the curve.
  return new THREE.CatmullRomCurve3([...right.reverse(), ...left], false, "centripetal");
}

const outward = (tangent: THREE.Vector3) => new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

export function buildArchScene(teeth: string[], detail: Detail = "low"): ArchScene {
  const group = new THREE.Group();
  const upper = new THREE.Group();
  const lowerHinge = new THREE.Group();
  const lowerArch = new THREE.Group();
  lowerHinge.position.copy(HINGE);
  const lowerOffset = new THREE.Group();
  lowerOffset.position.copy(HINGE).negate();
  lowerOffset.add(lowerArch);
  lowerHinge.add(lowerOffset);
  group.add(upper, lowerHinge);

  const visuals = new Map<string, ToothVisual>();
  const pickables: THREE.Object3D[] = [];
  const gums: THREE.Mesh[] = [];
  const gumMaterial = new THREE.MeshPhysicalMaterial({
    color: "#d4777f",
    roughness: 0.5,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    sheen: 0.35,
    sheenColor: new THREE.Color("#ffc0c4"),
    sheenRoughness: 0.6,
  });

  const infos = teeth.map(toothInfo);
  const midlineZ: Partial<Record<"upper" | "lower", { z: number; bl: number }>> = {};

  for (const isUpper of [true, false]) {
    const jaw = infos.filter((i) => i.isUpper === isUpper);
    if (jaw.length === 0) continue;
    const parent = isUpper ? upper : lowerArch;
    const bySide = (side: "right" | "left") => jaw.filter((i) => i.side === side).sort((a, b) => a.position - b.position);
    const sides = { right: bySide("right"), left: bySide("left") };
    const width = (list: ToothInfo[]) => list.reduce((sum, i) => sum + i.md + CONTACT_GAP, 0);
    const primary = jaw.some((i) => i.primary);
    const shapeKey = `${primary ? "primary" : "adult"}${isUpper ? "Upper" : "Lower"}` as keyof typeof HALF_ARCH;
    const curve = fullArchCurve(HALF_ARCH[shapeKey], Math.max(width(sides.right), width(sides.left)));
    const length = curve.getLength();
    const placed: Placed[] = [];

    for (const side of ["right", "left"] as const) {
      const sign = side === "right" ? -1 : 1;
      let s = CONTACT_GAP / 2;
      for (const info of sides[side]) {
        const start = s;
        const end = s + info.md;
        s = end + CONTACT_GAP;
        const mid = (start + end) / 2;
        const u = 0.5 + (sign * mid) / length;
        const point = curve.getPointAt(u);
        const tangent = curve.getTangentAt(u);
        const buccal = outward(tangent);
        const mesial = (sign < 0 ? tangent.clone() : tangent.clone().negate()).setY(0).normalize();
        const occlusal = new THREE.Vector3(0, isUpper ? -1 : 1, 0);
        const cejY = isUpper ? info.crownH + OCCLUSAL_GAP : -(info.crownH + OCCLUSAL_GAP);

        const visual = new ToothVisual(info, detail);
        visual.group.matrixAutoUpdate = false;
        visual.group.matrix.makeBasis(mesial, occlusal, buccal).setPosition(point.x, cejY, point.z);
        visual.pickables.forEach((o) => (o.userData.toothNumber = info.number));
        pickables.push(...visual.pickables);
        parent.add(visual.group);
        visuals.set(info.number, visual);
        placed.push({ info, s0: sign < 0 ? -end : start, s1: sign < 0 ? -start : end, cejY });
      }
    }

    const central = placed.find((p) => p.info.position === 1);
    if (central) midlineZ[isUpper ? "upper" : "lower"] = { z: curve.getPointAt(0.5).z, bl: central.info.bl };

    const gum = buildGum(curve, length, placed, isUpper, detail, gumMaterial);
    parent.add(gum);
    gums.push(gum);
  }

  // Lower incisors sit just behind the upper ones.
  if (midlineZ.upper && midlineZ.lower) {
    lowerArch.position.z = midlineZ.upper.z - midlineZ.upper.bl / 2 - 0.6 - (midlineZ.lower.z + midlineZ.lower.bl / 2);
  }

  const buccalDirection = new THREE.Vector3();
  const toViewer = new THREE.Vector3();

  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  visuals.forEach((v) => box.expandByObject(v.crown));
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());

  return {
    group,
    teeth: visuals,
    pickables,
    center,
    setJawOpen(radians) {
      lowerHinge.rotation.x = radians;
    },
    setGumsVisible(on) {
      gums.forEach((g) => (g.visible = on));
    },
    setArchVisible(filter) {
      upper.visible = filter !== "lower";
      lowerHinge.visible = filter !== "upper";
    },
    labelPosition(toothNumber, out, viewer) {
      const visual = visuals.get(toothNumber);
      if (!visual) return false;
      for (let o: THREE.Object3D | null = visual.group; o; o = o.parent) if (!o.visible) return false;
      out.set(0, -2.6, visual.info.bl / 2 + 1.6).applyMatrix4(visual.group.matrixWorld);
      buccalDirection.set(0, 0, 1).transformDirection(visual.group.matrixWorld);
      toViewer.copy(viewer).sub(out).normalize();
      return buccalDirection.dot(toViewer) > -0.25;
    },
    dispose() {
      visuals.forEach((v) => v.dispose());
      gums.forEach((g) => g.geometry.dispose());
      gumMaterial.dispose();
    },
  };
}

// The gum: a rounded band swept along the arch that holds the roots, its margin following
// each tooth's CEJ and rising into a papilla between neighbouring teeth.
function buildGum(
  curve: THREE.CatmullRomCurve3,
  length: number,
  placed: Placed[],
  isUpper: boolean,
  detail: Detail,
  material: THREE.Material,
): THREE.Mesh {
  const samples = detail === "high" ? 260 : 150;
  const profile = 28;
  const byCentre = [...placed].sort((a, b) => a.s0 + a.s1 - (b.s0 + b.s1));
  const centre = (p: Placed) => (p.s0 + p.s1) / 2;
  const sMin = Math.min(...placed.map((p) => p.s0)) - 1.5;
  const sMax = Math.max(...placed.map((p) => p.s1)) + 1.5;

  // Width, CEJ height and depth blend smoothly between neighbouring tooth centres.
  const sampleTeeth = (s: number) => {
    if (s <= centre(byCentre[0])) return { a: byCentre[0], b: byCentre[0], t: 0 };
    for (let i = 0; i < byCentre.length - 1; i++) {
      const a = byCentre[i];
      const b = byCentre[i + 1];
      if (s <= centre(b)) return { a, b, t: (s - centre(a)) / (centre(b) - centre(a)) };
    }
    const last = byCentre[byCentre.length - 1];
    return { a: last, b: last, t: 0 };
  };
  const papilla = (s: number) => {
    const tooth = placed.find((p) => s >= p.s0 - CONTACT_GAP / 2 && s <= p.s1 + CONTACT_GAP / 2);
    if (!tooth) return 0.6;
    const frac = Math.min(1, Math.max(0, (s - tooth.s0) / (tooth.s1 - tooth.s0)));
    return 1 - Math.sin(Math.PI * frac);
  };

  const positions: number[] = [];
  const point = new THREE.Vector3();
  for (let i = 0; i <= samples; i++) {
    const s = sMin + ((sMax - sMin) * i) / samples;
    const u = Math.min(1, Math.max(0, 0.5 + s / length));
    curve.getPointAt(u, point);
    const normal = outward(curve.getTangentAt(u));
    const { a, b, t } = sampleTeeth(s);
    const lerp = (x: number, y: number) => x + (y - x) * t;
    const width = lerp(a.info.bl, b.info.bl) + 3.2;
    const cej = lerp(a.cejY, b.cejY);
    const depth = lerp(a.info.rootLen, b.info.rootLen) + 2.5;
    const margin = 0.8 + 1.4 * papilla(s);
    const coronal = isUpper ? cej - margin : cej + margin;
    const apical = isUpper ? cej + depth : cej - depth;
    const vc = (coronal + apical) / 2;
    const half = Math.abs(coronal - apical) / 2;
    for (let k = 0; k < profile; k++) {
      const phi = (k / profile) * Math.PI * 2;
      const c = Math.cos(phi);
      const sn = Math.sin(phi);
      const n = (width / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.4);
      const v = half * Math.sign(sn) * Math.pow(Math.abs(sn), 0.4);
      positions.push(point.x + normal.x * n, vc + v, point.z + normal.z * n);
    }
  }

  const idx = (i: number, k: number) => i * profile + (k % profile);
  const indices: number[] = [];
  for (let i = 0; i < samples; i++) {
    for (let k = 0; k < profile; k++) {
      const a = idx(i, k), b = idx(i + 1, k), c = idx(i + 1, k + 1), d = idx(i, k + 1);
      indices.push(a, b, c, a, c, d);
    }
  }
  // Flat end caps get their own vertices so their normals don't soften the band's edge.
  for (const [ring, flip] of [[0, false], [samples, true]] as const) {
    const base = positions.length / 3;
    const cx = new THREE.Vector3();
    for (let k = 0; k < profile; k++) {
      const p = new THREE.Vector3().fromArray(positions, idx(ring, k) * 3);
      positions.push(p.x, p.y, p.z);
      cx.add(p);
    }
    cx.divideScalar(profile);
    positions.push(cx.x, cx.y, cx.z);
    const centreIndex = base + profile;
    for (let k = 0; k < profile; k++) {
      const p0 = base + k;
      const p1 = base + ((k + 1) % profile);
      indices.push(...(flip ? [centreIndex, p1, p0] : [centreIndex, p0, p1]));
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}
