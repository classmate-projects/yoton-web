"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ToothRecord, ToothSurface } from "@/types/dental.type";
import { createViewport, type Viewport } from "./viewport3d";
import { SURFACE_ORDER, ToothVisual } from "./toothGeometry";
import { surfaceName, toothInfo } from "./toothCatalog";
import { CONDITION_COLOR, surfaceCondition } from "./surfaceFindings";

export type DetailView = "buccal" | "lingual" | "mesial" | "distal" | "occlusal" | "reset";

interface Props {
  toothNumber: string;
  record: ToothRecord;
  onSurfaceClick?: (surface: ToothSurface) => void;
  // {name, ver} so asking for the same view twice still moves the camera back to it.
  view?: { name: DetailView; ver: number };
  xray?: boolean;
  height?: number;
}

// A three-quarter view from the buccal-mesial side, tilted towards the crown.
const defaultDirection = (isUpper: boolean) => new THREE.Vector3(0.5, isUpper ? -0.28 : 0.28, 0.82).normalize();

export default function ToothDetail3D({ toothNumber, record, onSurfaceClick, view, xray = false, height = 340 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const visualRef = useRef<ToothVisual | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const distanceRef = useRef(60);
  const recordRef = useRef(record);
  const xrayRef = useRef(xray);
  const labelsRef = useRef(new Map<ToothSurface, HTMLDivElement>());
  const pointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const hoverFrameRef = useRef(0);
  const [hovered, setHovered] = useState<ToothSurface | null>(null);

  const info = toothInfo(toothNumber);

  useEffect(() => {
    recordRef.current = record;
    xrayRef.current = xray;
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const viewport = createViewport(el, { fov: 30, minDistance: 18, maxDistance: 140, enablePan: false });
    viewportRef.current = viewport;

    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    viewport.onRender(() => {
      const visual = visualRef.current;
      if (!visual) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      visual.group.updateWorldMatrix(true, false);
      labelsRef.current.forEach((label, surface) => {
        const anchor = visual.anchors[surface];
        normal.copy(anchor.normal).transformDirection(visual.group.matrixWorld);
        position.copy(anchor.position).applyMatrix4(visual.group.matrixWorld).addScaledVector(normal, 2.4);
        toCamera.copy(viewport.camera.position).sub(position).normalize();
        // Only label surfaces that face the viewer - a label floating over the far side
        // of the tooth would point at the wrong surface.
        const facing = normal.dot(toCamera);
        position.project(viewport.camera);
        if (facing < 0.15 || position.z > 1) {
          label.style.opacity = "0";
          return;
        }
        label.style.opacity = String(Math.min(1, (facing - 0.15) * 3));
        label.style.transform = `translate(${(position.x * 0.5 + 0.5) * w}px, ${(-position.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      });
    });

    return () => {
      cancelAnimationFrame(hoverFrameRef.current);
      visualRef.current?.dispose();
      visualRef.current = null;
      viewport.dispose();
      viewportRef.current = null;
    };
  }, []);

  // ── Build the selected tooth ────────────────────────────────────────────────
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (pivotRef.current) viewport.scene.remove(pivotRef.current);
    visualRef.current?.dispose();

    const tooth = toothInfo(toothNumber);
    const visual = new ToothVisual(tooth, "high");
    visual.applyRecord(recordRef.current);
    visual.setXray(xrayRef.current);
    // Shown as it sits in the mouth: upper teeth crown-down. Mirroring only Y keeps mesial
    // on +X and buccal on +Z, so the snap views mean the same thing for every tooth.
    const pivot = new THREE.Group();
    if (tooth.isUpper) pivot.scale.y = -1;
    pivot.add(visual.group);
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(visual.group);
    pivot.position.sub(box.getCenter(new THREE.Vector3()));
    viewport.scene.add(pivot);
    pivotRef.current = pivot;
    visualRef.current = visual;

    const size = box.getSize(new THREE.Vector3());
    const fit = Math.max(size.x, size.y, size.z) / (2 * Math.tan(THREE.MathUtils.degToRad(viewport.camera.fov / 2)));
    distanceRef.current = fit * 1.12;
    viewport.camera.position.copy(defaultDirection(tooth.isUpper)).multiplyScalar(distanceRef.current);
    viewport.controls.target.set(0, 0, 0);
    viewport.controls.update();
    viewport.requestRender();
    setHovered(null);
  }, [toothNumber]);

  useEffect(() => {
    visualRef.current?.applyRecord(record);
    viewportRef.current?.requestRender();
  }, [record]);

  useEffect(() => {
    visualRef.current?.setXray(xray);
    viewportRef.current?.requestRender();
  }, [xray]);

  useEffect(() => {
    visualRef.current?.setHoverSurface(hovered);
    viewportRef.current?.requestRender();
  }, [hovered]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!view || !viewport) return;
    const d = distanceRef.current;
    const occlusalY = info.isUpper ? -1 : 1;
    const directions: Record<DetailView, THREE.Vector3> = {
      buccal: new THREE.Vector3(0, 0.05, 1),
      lingual: new THREE.Vector3(0, 0.05, -1),
      mesial: new THREE.Vector3(1, 0.05, 0),
      distal: new THREE.Vector3(-1, 0.05, 0),
      occlusal: new THREE.Vector3(0, occlusalY, 0.02),
      reset: defaultDirection(info.isUpper),
    };
    viewport.flyTo(directions[view.name].normalize().multiplyScalar(d), new THREE.Vector3(), 480);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const surfaceAt = (clientX: number, clientY: number): ToothSurface | null => {
    const viewport = viewportRef.current;
    const visual = visualRef.current;
    if (!viewport || !visual) return null;
    const hit = viewport.pick(clientX, clientY, [visual.crown]);
    return hit ? visual.surfaceOf(hit) : null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 0) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(hoverFrameRef.current);
    hoverFrameRef.current = requestAnimationFrame(() => {
      const surface = surfaceAt(clientX, clientY);
      setHovered(surface);
      if (mountRef.current) mountRef.current.style.cursor = surface && onSurfaceClick ? "pointer" : "grab";
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const down = pointerRef.current;
    pointerRef.current = null;
    if (!down || e.button !== 0 || !onSurfaceClick) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || performance.now() - down.t > 700) return;
    const surface = surfaceAt(e.clientX, e.clientY);
    if (surface) onSurfaceClick(surface);
  };

  const hoveredCondition = hovered ? surfaceCondition(record, hovered) : null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-border bg-gradient-to-b from-slate-100 to-slate-300 dark:from-slate-800 dark:to-slate-950"
      style={{ height }}
    >
      <div
        ref={mountRef}
        className="absolute inset-0"
        style={{ cursor: "grab" }}
        onPointerDown={(e) => (pointerRef.current = { x: e.clientX, y: e.clientY, t: performance.now() })}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHovered(null)}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {SURFACE_ORDER.map((surface) => {
          const condition = surfaceCondition(record, surface);
          return (
            <div
              key={surface}
              ref={(el) => {
                if (el) labelsRef.current.set(surface, el);
                else labelsRef.current.delete(surface);
              }}
              title={surfaceName(surface, info)}
              className={`absolute left-0 top-0 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold shadow transition-opacity ${
                surface === hovered ? "bg-blue-600 text-white" : "bg-white/90 text-slate-700 dark:bg-slate-900/85 dark:text-slate-100"
              }`}
              style={{ opacity: 0 }}
            >
              {surface}
              {condition && <span className="h-2 w-2 rounded-full ring-1 ring-white/70" style={{ backgroundColor: CONDITION_COLOR[condition] }} />}
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/85 px-2.5 py-1 text-xs shadow-sm backdrop-blur dark:bg-slate-900/85">
        {hovered ? (
          <>
            <span className="font-semibold text-foreground">{surfaceName(hovered, info)} ({hovered})</span>
            <span className="text-muted-foreground">
              {" "}· {hoveredCondition ?? "not charted"}
              {onSurfaceClick ? " · click to mark" : ""}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Drag to rotate · Scroll to zoom{onSurfaceClick ? " · Click a surface to mark it" : ""}</span>
        )}
      </div>
    </div>
  );
}
