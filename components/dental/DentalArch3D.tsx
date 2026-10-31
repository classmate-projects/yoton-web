"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ToothCondition, ToothRecord } from "@/types/dental.type";
import { createViewport, type Viewport } from "./viewport3d";
import { buildArchScene, type ArchFilter, type ArchScene } from "./dentalArch";
import { toothInfo } from "./toothCatalog";
import { CONDITION_COLOR, surfaceSummary } from "./surfaceFindings";

interface Props {
  teeth: string[]; // every tooth on the chart, upper and lower
  records: Map<string, ToothRecord>;
  selectedTooth: string | null;
  onSelectTooth: (toothNumber: string) => void;
  height?: number;
}

type Preset = "front" | "left" | "right" | "upper" | "lower";

const DEFAULT_JAW = 0.22;
const emptyRecord = (n: string): ToothRecord => ({ toothNumber: n, conditions: [], surfaces: [] });

function findings(record: ToothRecord | undefined): string {
  if (!record) return "No findings recorded";
  const conditions = record.conditions.filter((c) => c !== "Healthy");
  const surfaces = surfaceSummary(record);
  if (conditions.length === 0 && !surfaces) return record.conditions.includes("Healthy") ? "Healthy" : "No findings recorded";
  return [conditions.join(", "), surfaces && `Surfaces: ${surfaces}`].filter(Boolean).join(" · ");
}

export default function DentalArch3D({ teeth, records, selectedTooth, onSelectTooth, height = 480 }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const archRef = useRef<ArchScene | null>(null);
  const labelsRef = useRef(new Map<string, HTMLDivElement>());
  const recordsRef = useRef(records);
  const labelStateRef = useRef({ numbers: true, hovered: null as string | null, selected: selectedTooth });
  const pointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const hoverFrameRef = useRef(0);

  const [hovered, setHovered] = useState<string | null>(null);
  const [filter, setFilter] = useState<ArchFilter>("both");
  const [gums, setGums] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [jaw, setJaw] = useState(DEFAULT_JAW);

  const teethKey = teeth.join(",");

  useEffect(() => {
    recordsRef.current = records;
    labelStateRef.current = { numbers, hovered, selected: selectedTooth };
  });

  // ── Renderer / camera / controls (once) ─────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const viewport = createViewport(el, { fov: 32, minDistance: 40, maxDistance: 320 });
    viewportRef.current = viewport;

    const projected = new THREE.Vector3();
    viewport.onRender(() => {
      const arch = archRef.current;
      if (!arch) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const { numbers: all, hovered: hover, selected } = labelStateRef.current;
      labelsRef.current.forEach((label, n) => {
        const wanted = all || n === hover || n === selected;
        if (!wanted || !arch.labelPosition(n, projected, viewport.camera.position)) {
          label.style.display = "none";
          return;
        }
        projected.project(viewport.camera);
        if (projected.z > 1) {
          label.style.display = "none";
          return;
        }
        label.style.display = "block";
        label.style.transform = `translate(${(projected.x * 0.5 + 0.5) * w}px, ${(-projected.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      });
    });

    return () => {
      cancelAnimationFrame(hoverFrameRef.current);
      archRef.current?.dispose();
      archRef.current = null;
      viewport.dispose();
      viewportRef.current = null;
    };
  }, []);

  // ── Build the mouth whenever the set of teeth changes (adult ↔ primary) ─────
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (archRef.current) {
      viewport.scene.remove(archRef.current.group);
      archRef.current.dispose();
    }
    const arch = buildArchScene(teethKey.split(","));
    arch.teeth.forEach((visual, n) => visual.applyRecord(recordsRef.current.get(n) ?? emptyRecord(n)));
    viewport.scene.add(arch.group);
    archRef.current = arch;

    const c = arch.center;
    viewport.camera.position.set(c.x, c.y + 10, c.z + 150);
    viewport.controls.target.copy(c);
    viewport.controls.update();
    viewport.requestRender();
  }, [teethKey]);

  // ── Findings → colours (cheap: only vertex colours are rewritten) ───────────
  useEffect(() => {
    const arch = archRef.current;
    if (!arch) return;
    arch.teeth.forEach((visual, n) => visual.applyRecord(records.get(n) ?? emptyRecord(n)));
    viewportRef.current?.requestRender();
  }, [records]);

  useEffect(() => {
    const arch = archRef.current;
    if (!arch) return;
    arch.teeth.forEach((visual, n) => visual.setHighlight(n === selectedTooth ? "selected" : n === hovered ? "hover" : "none"));
    viewportRef.current?.requestRender();
  }, [selectedTooth, hovered, teethKey]);

  useEffect(() => {
    const arch = archRef.current;
    if (!arch) return;
    arch.setGumsVisible(gums);
    arch.setArchVisible(filter);
    arch.setJawOpen(jaw);
    viewportRef.current?.requestRender();
  }, [gums, filter, jaw, teethKey]);

  useEffect(() => {
    viewportRef.current?.requestRender();
  }, [numbers]);

  const flyTo = (preset: Preset) => {
    const viewport = viewportRef.current;
    const arch = archRef.current;
    if (!viewport || !arch) return;
    const c = arch.center;
    const d = 150;
    const positions: Record<Preset, [number, number, number]> = {
      front: [c.x, c.y + 10, c.z + d],
      left: [c.x + d, c.y + 8, c.z], // patient's left
      right: [c.x - d, c.y + 8, c.z],
      upper: [c.x, c.y - d, c.z + 25],
      lower: [c.x, c.y + d, c.z + 25],
    };
    setFilter(preset === "upper" ? "upper" : preset === "lower" ? "lower" : "both");
    viewport.flyTo(new THREE.Vector3(...positions[preset]), c.clone());
  };

  const reset = () => {
    setJaw(DEFAULT_JAW);
    setGums(true);
    flyTo("front");
  };

  const toothAt = (clientX: number, clientY: number): string | null => {
    const viewport = viewportRef.current;
    const arch = archRef.current;
    if (!viewport || !arch) return null;
    return (viewport.pick(clientX, clientY, arch.pickables)?.object.userData.toothNumber as string | undefined) ?? null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 0) return; // dragging - leave the hover as it was
    const { clientX, clientY } = e;
    cancelAnimationFrame(hoverFrameRef.current);
    hoverFrameRef.current = requestAnimationFrame(() => {
      const n = toothAt(clientX, clientY);
      setHovered(n);
      if (mountRef.current) mountRef.current.style.cursor = n ? "pointer" : "grab";
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const down = pointerRef.current;
    pointerRef.current = null;
    if (!down || e.button !== 0) return;
    // A click, not the end of a drag.
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || performance.now() - down.t > 700) return;
    const n = toothAt(e.clientX, e.clientY);
    if (n) onSelectTooth(n);
  };

  const presentConditions = Array.from(
    new Set(Array.from(records.values()).flatMap((r) => r.conditions.filter((c) => c !== "Healthy"))),
  ) as ToothCondition[];
  const focus = hovered ?? selectedTooth;
  const focusInfo = focus ? toothInfo(focus) : null;

  const button = "rounded-md px-2.5 py-1 text-xs font-medium transition-colors";
  const idle = "bg-white/80 text-slate-700 hover:bg-white dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700";
  const active = "bg-primary text-primary-foreground";

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-gradient-to-b from-slate-100 to-slate-300 dark:from-slate-800 dark:to-slate-950"
        style={{ height }}
      >
        <div
          ref={mountRef}
          className="absolute inset-0"
          style={{ cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHovered(null)}
        />

        {/* Tooth numbers, positioned every frame from the 3D scene */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {teeth.map((n) => (
            <div
              key={n}
              ref={(el) => {
                if (el) labelsRef.current.set(n, el);
                else labelsRef.current.delete(n);
              }}
              className={`absolute left-0 top-0 hidden rounded px-1 text-[10px] font-bold leading-4 shadow-sm ${
                n === selectedTooth
                  ? "bg-blue-600 text-white"
                  : n === hovered
                    ? "bg-blue-100 text-blue-700"
                    : "bg-white/85 text-red-600 dark:bg-slate-900/80"
              }`}
            >
              {n}
            </div>
          ))}
        </div>

        {/* View presets */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1 rounded-lg bg-black/5 p-1 backdrop-blur dark:bg-white/5">
          {(
            [
              ["front", "Front"],
              ["right", "Right"],
              ["left", "Left"],
              ["upper", "Upper occlusal"],
              ["lower", "Lower occlusal"],
            ] as [Preset, string][]
          ).map(([preset, label]) => (
            <button key={preset} type="button" onClick={() => flyTo(preset)} className={`${button} ${idle}`}>
              {label}
            </button>
          ))}
          <button type="button" onClick={reset} className={`${button} ${idle}`}>
            Reset
          </button>
        </div>

        {/* Display toggles */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          <div className="flex gap-1 rounded-lg bg-black/5 p-1 backdrop-blur dark:bg-white/5">
            {(["both", "upper", "lower"] as ArchFilter[]).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`${button} ${filter === f ? active : idle}`}>
                {f === "both" ? "Both arches" : f === "upper" ? "Upper" : "Lower"}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-black/5 p-1 backdrop-blur dark:bg-white/5">
            <button type="button" onClick={() => setGums((g) => !g)} className={`${button} ${gums ? active : idle}`}>
              Gums
            </button>
            <button type="button" onClick={() => setNumbers((v) => !v)} className={`${button} ${numbers ? active : idle}`}>
              Numbers
            </button>
          </div>
        </div>

        {/* Jaw opening */}
        <label className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur dark:bg-slate-800/80 dark:text-slate-200">
          Bite
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={jaw}
            onChange={(e) => setJaw(Number(e.target.value))}
            className="w-28 accent-primary"
            aria-label="Open or close the jaw"
          />
          Open
        </label>

        {/* Hovered / selected tooth */}
        {focusInfo && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[60%] -translate-x-1/2 rounded-lg bg-white/90 px-3 py-1.5 text-center text-xs shadow backdrop-blur dark:bg-slate-900/90">
            <span className="font-semibold text-foreground">
              Tooth {focusInfo.number} · {focusInfo.name}
            </span>
            <span className="block text-muted-foreground">{findings(records.get(focusInfo.number))}</span>
          </div>
        )}

        <p className="pointer-events-none absolute bottom-3 right-3 hidden rounded bg-white/70 px-2 py-1 text-[10px] text-slate-600 sm:block dark:bg-slate-900/70 dark:text-slate-300">
          Drag to rotate · Scroll to zoom · Right-drag to pan · Click a tooth to open it
        </p>
      </div>

      {presentConditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide">On this chart:</span>
          {presentConditions.map((c) => (
            <span key={c} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: CONDITION_COLOR[c] }} />
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
