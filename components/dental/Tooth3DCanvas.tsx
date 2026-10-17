"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { ToothCondition } from "@/types/dental.type";
import { CONDITION_COLOR } from "./SurfaceBox";

export type ToothShape3D = "incisor" | "canine" | "premolar" | "molar";

interface Props {
  shape: ToothShape3D;
  isUpper: boolean;
  conditions: ToothCondition[];
  surfaces?: string[];
  width?: number;
  height?: number;
  cameraView?: { view: string; ver: number };
}

const PRIORITY: ToothCondition[] = [
  "Missing","BridgePontic","Implant","Crown","ExtractionIndicated",
  "RCT","Caries","Filled","Fracture","BridgeAbutment",
  "Watch","Attrition","Abrasion","Erosion","Calculus",
];

function getOverlayHex(conditions: ToothCondition[]): string | null {
  for (const c of PRIORITY) {
    if (conditions.includes(c)) return (CONDITION_COLOR as Record<string, string>)[c] ?? null;
  }
  return null;
}

type Profile = [number, number][];

// Crown profiles — anatomically correct cervical constriction:
//   y=0 is the CEJ (narrow), tooth WIDENS above it to max convexity,
//   then gradually narrows toward the occlusal surface.
//   This is what makes a tooth look like a tooth, not a cone.
const CROWN_PROFILE: Record<ToothShape3D, Profile> = {
  incisor:  [
    [1.3,0],  // CEJ — narrowest
    [1.7,0.5],[1.9,1.2],[1.8,2.5],[1.7,4.0],[1.4,5.5],[1.0,6.5],[0.5,7.2],[0.15,7.8],
  ],
  canine:   [
    [1.4,0],
    [1.8,0.6],[2.0,1.5],[1.9,3.0],[1.7,5.0],[1.3,7.0],[0.6,8.8],[0.1,9.5],
  ],
  premolar: [
    [1.6,0],
    [2.1,0.7],[2.3,1.8],[2.2,3.2],[2.1,4.8],[1.8,6.2],[1.2,7.3],[0.5,8.0],
  ],
  molar:    [
    [2.0,0],  // CEJ
    [3.0,0.8],[3.4,1.8],[3.3,3.2],[3.0,5.0],[2.6,6.5],[2.0,7.8],[1.2,8.3],
  ],
};

// Mesio-distal (X) and bucco-lingual (Z) scale multipliers
const SX: Record<ToothShape3D, number> = { incisor:2.0, canine:2.0, premolar:1.85, molar:1.85 };
const SZ: Record<ToothShape3D, number> = { incisor:0.72, canine:1.05, premolar:1.95, molar:2.35 };

// Cusp spheres [cx, cy, cz, radius] — PRE-scale offsets
// Placed so the sphere centre sits at ~crown top, sphere bottom at ~crown top-1.5
const CUSPS: Record<ToothShape3D, [number, number, number, number][]> = {
  incisor:  [],
  canine:   [],
  premolar: [
    [ 0, 8.2, +0.32, 0.90],  // buccal cusp
    [ 0, 7.8, -0.32, 0.78],  // lingual cusp (lower)
  ],
  molar: [
    [-0.55, 9.2, +0.55, 1.55],  // mesiobuccal — wider separation, bigger
    [ 0.55, 9.2, +0.55, 1.45],  // distobuccal
    [-0.55, 8.8, -0.55, 1.45],  // mesiolingual
    [ 0.55, 8.8, -0.55, 1.35],  // distolingual
  ],
};

// Root profile — starts at same width as crown CEJ, tapers to apex
const ROOT_PTS: Profile = [
  [1.8,0],[1.5,-1.0],[1.2,-2.5],[0.8,-4.5],[0.4,-6.5],[0.15,-8.0],[0.04,-9.5],
];

const VIEW_ROT: Record<string, [number, number]> = {
  buccal:   [0, 0],
  lingual:  [Math.PI, 0],
  mesial:   [-Math.PI / 2, 0],
  distal:   [ Math.PI / 2, 0],
  occlusal: [0, Math.PI / 2],
};

function buildToothGroup(shape: ToothShape3D, _isUpper: boolean, overlayHex: string | null): THREE.Group {
  const group = new THREE.Group();

  // Enamel — off-white with clearcoat + subtle transmission for translucency
  const enamel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf2e8d5),
    roughness: 0.18,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.10,
    transmission: 0.08,
    thickness: 2.0,
    ior: 1.62,
  });

  // Cementum/dentin — yellowish-tan, matte
  const dentin = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xc2924a),
    roughness: 0.65,
    metalness: 0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.4,
  });

  const overlayMat = overlayHex ? new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(overlayHex),
    transparent: true,
    opacity: 0.42,
    roughness: 0.3,
    depthWrite: false,
  }) : null;

  // ── Crown ──────────────────────────────────────────────────────────────────
  const crownPts = CROWN_PROFILE[shape].map(([r, y]) => new THREE.Vector2(r, y));

  function makeCrown(mat: THREE.Material) {
    const g = new THREE.LatheGeometry(crownPts, 64);  // 64 segments = smooth
    g.scale(SX[shape], 1, SZ[shape]);
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }

  const crown = makeCrown(enamel);
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);

  if (overlayMat) {
    const ov = makeCrown(overlayMat);
    ov.scale.set(1.01, 1.01, 1.01);
    group.add(ov);
  }

  // ── Cusps ──────────────────────────────────────────────────────────────────
  CUSPS[shape].forEach(([cx, cy, cz, cr]) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(cr, 28, 22),
      enamel,
    );
    m.position.set(cx * SX[shape], cy, cz * SZ[shape]);
    m.castShadow = true;
    group.add(m);

    if (overlayMat) {
      const ov = new THREE.Mesh(new THREE.SphereGeometry(cr * 1.01, 28, 22), overlayMat);
      ov.position.copy(m.position);
      group.add(ov);
    }
  });

  // ── Roots ──────────────────────────────────────────────────────────────────
  const rPts = ROOT_PTS.map(([r, y]) => new THREE.Vector2(r, y));
  // Root radius scale — roots are ~55% of crown width
  const brx = SX[shape] * 0.52, brz = SZ[shape] * 0.50;

  function makeRoot(ox: number, oz: number, rx: number, rz: number, tilt = 0) {
    const g = new THREE.LatheGeometry(rPts, 28);
    g.scale(rx, 1, rz);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, dentin);
    m.position.set(ox, 0, oz);
    m.rotation.z = tilt;
    m.castShadow = true;
    group.add(m);
  }

  if (shape === "incisor" || shape === "canine") {
    makeRoot(0, 0, brx, brz);
  } else if (shape === "premolar") {
    makeRoot(-SX[shape] * 0.85, 0, brx * 0.80, brz * 0.68,  0.10);
    makeRoot( SX[shape] * 0.85, 0, brx * 0.80, brz * 0.68, -0.10);
  } else {
    // Molar: mesial root and distal root, well separated
    makeRoot(-SX[shape] * 1.05, 0, brx * 0.88, brz * 0.60,  0.12);
    makeRoot( SX[shape] * 1.05, 0, brx * 0.88, brz * 0.60, -0.12);
  }

  // Vertical centering — use the actual geometric top (including cusp spheres, which
  // extend above the last crown profile point) so tall cusps don't get clipped.
  const crownProfTop = CROWN_PROFILE[shape].at(-1)![1];
  const cuspTop = CUSPS[shape].length > 0
    ? Math.max(...CUSPS[shape].map(([, cy, , cr]) => cy + cr))
    : crownProfTop;
  const geoTop = Math.max(crownProfTop, cuspTop);
  group.position.y = -(geoTop - 9.5) / 2;

  return group;
}

export default function Tooth3DCanvas({
  shape, isUpper, conditions,
  width = 240, height = 280,
  cameraView,
}: Props) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const groupRef  = useRef<THREE.Group | null>(null);
  const sceneRef  = useRef<THREE.Scene | null>(null);

  const dragging = useRef(false);
  const lastX    = useRef(0);
  const lastY    = useRef(0);

  // ── Init Three.js scene ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = "block";
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 200);
    camera.position.set(0, 0, 34);
    camera.lookAt(0, 0, 0);

    // Warm ambient
    scene.add(new THREE.AmbientLight(0xfff4e8, 0.70));

    // Key light — upper-front-right, warm white
    const key = new THREE.DirectionalLight(0xfffcf5, 2.0);
    key.position.set(10, 20, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 60;
    scene.add(key);

    // Fill light — left, cool blue (simulates skylight bounce)
    const fill = new THREE.DirectionalLight(0xb8d4f8, 0.55);
    fill.position.set(-12, 6, -8);
    scene.add(fill);

    // Rim / backlight — lower rear, subtle warm
    const rim = new THREE.DirectionalLight(0xffe0b0, 0.35);
    rim.position.set(0, -12, -16);
    scene.add(rim);

    // Under-fill (simulates reflected light from below)
    const under = new THREE.DirectionalLight(0xfff8f0, 0.20);
    under.position.set(0, -8, 10);
    scene.add(under);

    const tooth = buildToothGroup(shape, isUpper, getOverlayHex(conditions));
    scene.add(tooth);
    groupRef.current = tooth;

    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); renderer.render(scene, camera); };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      groupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, isUpper, width, height]);

  // ── Rebuild overlay on condition change ──────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !groupRef.current) return;
    const old = groupRef.current;
    const rx = old.rotation.x, ry = old.rotation.y, rz = old.rotation.z;
    const py = old.position.y;
    scene.remove(old);
    const neo = buildToothGroup(shape, isUpper, getOverlayHex(conditions));
    neo.rotation.set(rx, ry, rz);
    neo.position.y = py;
    scene.add(neo);
    groupRef.current = neo;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions]);

  // ── Snap to named view ───────────────────────────────────────────────────
  // cameraView is an object {view, ver} so every button click (including the same
  // view clicked twice) produces a new reference and re-runs this effect.
  useEffect(() => {
    if (!cameraView || !groupRef.current) return;
    const g = groupRef.current;
    const [ty, tx] = VIEW_ROT[cameraView.view] ?? [0, 0];
    const sy = g.rotation.y, sx = g.rotation.x;
    const t0 = performance.now(), dur = 380;
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const step = () => {
      const et = ease(Math.min((performance.now() - t0) / dur, 1));
      if (groupRef.current) {
        groupRef.current.rotation.y = sy + (ty - sy) * et;
        groupRef.current.rotation.x = sx + (tx - sx) * et;
      }
      if (et < 1) requestAnimationFrame(step);
    };
    step();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraView]);

  // ── Pointer drag handlers ────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !groupRef.current) return;
    const dx = e.clientX - lastX.current;
    const dy = e.clientY - lastY.current;
    lastX.current = e.clientX;
    lastY.current = e.clientY;
    groupRef.current.rotation.y -= dx * 0.016;
    groupRef.current.rotation.x = Math.max(
      -Math.PI * 0.75,
      Math.min(Math.PI * 0.75, groupRef.current.rotation.x + dy * 0.012),
    );
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    e.currentTarget.style.cursor = "grab";
  }, []);

  return (
    <div
      style={{ width, height, position: "relative" }}
      className="rounded-xl overflow-hidden bg-gradient-to-b from-slate-100/80 to-slate-200/80 dark:from-slate-800/60 dark:to-slate-700/60"
    >
      <div ref={mountRef} style={{ width, height }} />
      <div
        style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none", zIndex: 1 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
