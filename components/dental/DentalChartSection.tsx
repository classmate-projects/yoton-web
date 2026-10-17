"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Save, RefreshCw, X } from "lucide-react";
import dynamic from "next/dynamic";
import SurfaceBox, { CONDITION_COLOR } from "./SurfaceBox";
import ToothCaseSheet from "./ToothCaseSheet";
import { DentalService } from "@/services/dental.service";

const Tooth3DCanvas = dynamic(() => import("./Tooth3DCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-xl bg-muted/30 text-xs text-muted-foreground"
      style={{ width: 240, height: 280 }}>
      Loading 3D…
    </div>
  ),
});
import { ToothRecord, PerioRecord, DentalChartType, ToothCondition, ToothSurface } from "@/types/dental.type";

// ─── Universal (US) adult numbering & alphabetic pediatric ───────────────────
// Adult: 1-16 upper (patient right→left), 32-17 lower (patient right→left)
// Pediatric: a-j upper, t-k lower (patient right→left)
const ADULT_UPPER = ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"];
const ADULT_LOWER = ["32","31","30","29","28","27","26","25","24","23","22","21","20","19","18","17"];
const PEDO_UPPER  = ["a","b","c","d","e","f","g","h","i","j"];
const PEDO_LOWER  = ["t","s","r","q","p","o","n","m","l","k"];

type ToothShape = "incisor" | "canine" | "premolar" | "molar";

// Shape lookup by Universal number / pediatric letter
const TOOTH_SHAPE_MAP: Record<string, ToothShape> = {
  // Adult upper
  "1":"molar","2":"molar","3":"molar","4":"premolar","5":"premolar",
  "6":"canine","7":"incisor","8":"incisor","9":"incisor","10":"incisor",
  "11":"canine","12":"premolar","13":"premolar","14":"molar","15":"molar","16":"molar",
  // Adult lower
  "17":"molar","18":"molar","19":"molar","20":"premolar","21":"premolar",
  "22":"canine","23":"incisor","24":"incisor","25":"incisor","26":"incisor",
  "27":"canine","28":"premolar","29":"premolar","30":"molar","31":"molar","32":"molar",
  // Pediatric upper  (a=upper-right 2nd molar … e=upper-right central; f=upper-left central … j=upper-left 2nd molar)
  "a":"molar","b":"molar","c":"canine","d":"incisor","e":"incisor",
  "f":"incisor","g":"incisor","h":"canine","i":"molar","j":"molar",
  // Pediatric lower  (t=lower-right 2nd molar … p=lower-right central; o=lower-left central … k=lower-left 2nd molar)
  "t":"molar","s":"molar","r":"canine","q":"incisor","p":"incisor",
  "o":"incisor","n":"incisor","m":"canine","l":"molar","k":"molar",
};

function toothShape(n: string): ToothShape {
  return TOOTH_SHAPE_MAP[n] ?? "incisor";
}

type ToothView = "Buccal" | "Lingual" | "Mesial" | "Distal" | "Occlusal";
const ROTATE_VIEWS: ToothView[] = ["Mesial", "Buccal", "Distal", "Lingual"];

// ─── Dominant condition colour for 3D overlays ───────────────────────────────
const CONDITION_PRIORITY: ToothCondition[] = [
  "Missing","BridgePontic","Implant","Crown","ExtractionIndicated",
  "RCT","Caries","Filled","Fracture","BridgeAbutment",
  "Watch","Attrition","Abrasion","Erosion","Calculus",
];
const WHOLE_TOOTH: ToothCondition[] = ["Missing","BridgePontic","Implant","Crown","ExtractionIndicated","BridgeAbutment"];

function dominantColor(conditions: ToothCondition[]): string | null {
  for (const c of CONDITION_PRIORITY) {
    if (conditions.includes(c)) return (CONDITION_COLOR as Record<string, string>)[c] ?? null;
  }
  return null;
}

// ─── High-quality anatomical buccal-view SVG ─────────────────────────────────
// Renders a clinically accurate buccal (side) view of each tooth class with:
//   • Per-shape anatomically distinct crown profiles
//   • Realistic root anatomy (bifurcated premolar, trifurcated molar)
//   • Multi-layer gradients for convincing 3D depth
//   • Pulp chamber + canal outline, incisal translucency, groove details
//   • Drop-shadow for depth
// Coordinate system: crown at y=0 (incisal/occlusal), root apex at y=totalH.
// For lower teeth the caller wraps in a CSS scale(-1) so no coordinate change needed.
function ToothAnatomySVG({ shape, isUpper, w = 40, conditions = [], surfaces = [] }: {
  shape: ToothShape; isUpper: boolean; w?: number;
  conditions?: ToothCondition[]; surfaces?: ToothSurface[];
}) {
  const cH  = w * 0.72;   // crown height
  const rH  = w * 0.95;   // root zone height
  const tH  = cH + rH;    // total SVG height

  const flip      = !isUpper;
  const translateY = flip ? tH : 0;
  const scaleY     = flip ? -1 : 1;

  // Shared gradient IDs per shape (last-writer-wins for identical defs)
  const gid = `ta-${shape[0]}`;

  // ── Crown paths (buccal view, crown-top = y=0) ──────────────────────────────
  // Each path is shaped to match the typical buccal silhouette of that tooth class.
  const crown: Record<ToothShape, string> = {
    // Incisor: wide trapezoidal crown; incisal edge flat with slight mamelon bumps;
    //          mesial surface nearly vertical, distal slightly curved.
    incisor: [
      `M${w*.24},0`,
      `Q${w*.38},${-cH*.04} ${w*.5},0`,   // incisal edge mesial hump (mamelon)
      `Q${w*.62},${-cH*.04} ${w*.76},0`,  // incisal edge distal hump
      `Q${w*.84},${cH*.06}  ${w*.82},${cH*.45}`,   // distal surface
      `Q${w*.80},${cH}      ${w*.5},${cH}`,         // distal-cervical curve to mid
      `Q${w*.20},${cH}      ${w*.18},${cH*.45}`,    // mesial-cervical
      `Q${w*.16},${cH*.06}  ${w*.24},0 Z`,
    ].join(" "),

    // Canine: pentagonal; prominent sharp cusp tip; long mesial slope, shorter distal;
    //         maximum convexity at cervical third.
    canine: [
      `M${w*.26},0`,
      `L${w*.74},0`,
      `Q${w*.88},${cH*.12} ${w*.78},${cH*.52}`,  // distal slope
      `Q${w*.72},${cH}     ${w*.5},${cH}`,
      `Q${w*.28},${cH}     ${w*.22},${cH*.52}`,   // mesial slope
      `Q${w*.12},${cH*.12} ${w*.26},0 Z`,
    ].join(" "),

    // Premolar: two-cusp crown; buccal cusp higher (left), lingual cusp lower (right);
    //           buccal groove runs from between cusps downward.
    premolar: [
      `M${w*.16},0`,
      `Q${w*.30},${-cH*.06} ${w*.38},0`,          // buccal cusp tip
      `L${w*.5},${cH*.18}`,                         // buccal groove depth
      `Q${w*.60},${-cH*.02} ${w*.72},${cH*.08}`,  // lingual cusp (shorter)
      `Q${w*.86},${cH*.22} ${w*.84},${cH*.5}`,
      `Q${w*.80},${cH}     ${w*.5},${cH}`,
      `Q${w*.20},${cH}     ${w*.16},${cH*.5}`,
      `Q${w*.14},${cH*.22} ${w*.16},0 Z`,
    ].join(" "),

    // Molar: broad multi-cusp crown; 2–3 buccal cusps separated by buccal grooves;
    //        strong cervical convexity; wide at occlusal, slight taper at cervical.
    molar: [
      `M${w*.06},0`,
      `Q${w*.22},${-cH*.08} ${w*.36},0`,          // mesio-buccal cusp
      `L${w*.44},${cH*.15}`,                        // buccal groove
      `Q${w*.58},${-cH*.05} ${w*.72},${cH*.04}`,  // disto-buccal cusp
      `Q${w*.92},${cH*.14} ${w*.92},${cH*.38}`,
      `Q${w*.90},${cH}     ${w*.5},${cH}`,
      `Q${w*.10},${cH}     ${w*.08},${cH*.38}`,
      `Q${w*.06},${cH*.14} ${w*.06},0 Z`,
    ].join(" "),
  };

  // ── Root paths ───────────────────────────────────────────────────────────────
  // Incisor/canine: single tapered root with slight distal curvature.
  // Premolar:       bifurcated — mesial root (buccal) + distal root (lingual).
  // Molar:          two buccal roots visible (trifurcated hint).
  const roots: Record<ToothShape, React.ReactNode> = {
    incisor: (
      <path
        d={[
          `M${w*.28},${cH}`,
          `Q${w*.68},${cH}    ${w*.72},${cH}`,
          `Q${w*.70},${cH+rH*.55} ${w*.54},${tH}`,   // apex (slight distal lean)
          `Q${w*.46},${tH}   ${w*.30},${tH}`,
          `Q${w*.24},${cH+rH*.55} ${w*.28},${cH} Z`,
        ].join(" ")}
        fill={`url(#rg-${gid})`} stroke="#9a7a52" strokeWidth={0.8}
      />
    ),
    canine: (
      <path
        d={[
          `M${w*.26},${cH}`,
          `L${w*.74},${cH}`,
          `Q${w*.74},${cH+rH*.60} ${w*.56},${tH}`,   // long apex
          `Q${w*.44},${tH}   ${w*.30},${tH}`,
          `Q${w*.22},${cH+rH*.60} ${w*.26},${cH} Z`,
        ].join(" ")}
        fill={`url(#rg-${gid})`} stroke="#9a7a52" strokeWidth={0.8}
      />
    ),
    premolar: (
      <>
        {/* Buccal (left) root */}
        <path
          d={[
            `M${w*.16},${cH}`,
            `L${w*.50},${cH}`,
            `Q${w*.50},${cH+rH*.30} ${w*.44},${cH+rH*.44}`,  // bifurcation
            `Q${w*.36},${tH-.5}     ${w*.28},${tH}`,
            `Q${w*.18},${tH-.5}     ${w*.14},${cH+rH*.44}`,
            `Q${w*.12},${cH+rH*.30} ${w*.16},${cH} Z`,
          ].join(" ")}
          fill={`url(#rg-${gid})`} stroke="#9a7a52" strokeWidth={0.75}
        />
        {/* Lingual (right) root */}
        <path
          d={[
            `M${w*.50},${cH}`,
            `L${w*.84},${cH}`,
            `Q${w*.86},${cH+rH*.28} ${w*.80},${cH+rH*.42}`,
            `Q${w*.72},${tH-.5}     ${w*.64},${tH}`,
            `Q${w*.54},${tH-.5}     ${w*.52},${cH+rH*.42}`,
            `Q${w*.48},${cH+rH*.28} ${w*.50},${cH} Z`,
          ].join(" ")}
          fill={`url(#rg-${gid})`} stroke="#9a7a52" strokeWidth={0.75}
        />
      </>
    ),
    molar: (
      <>
        {/* Mesial root (left, wider) */}
        <path
          d={[
            `M${w*.08},${cH}`,
            `L${w*.50},${cH}`,
            `Q${w*.48},${cH+rH*.30} ${w*.42},${cH+rH*.44}`,
            `Q${w*.34},${tH-.5}     ${w*.24},${tH}`,
            `Q${w*.12},${tH-.5}     ${w*.08},${cH+rH*.44}`,
            `Q${w*.04},${cH+rH*.28} ${w*.08},${cH} Z`,
          ].join(" ")}
          fill={`url(#rg-${gid})`} stroke="#9a7a52" strokeWidth={0.8}
        />
        {/* Distal root (right) */}
        <path
          d={[
            `M${w*.50},${cH}`,
            `L${w*.92},${cH}`,
            `Q${w*.94},${cH+rH*.26} ${w*.90},${cH+rH*.42}`,
            `Q${w*.82},${tH-.5}     ${w*.74},${tH}`,
            `Q${w*.62},${tH-.5}     ${w*.58},${cH+rH*.42}`,
            `Q${w*.52},${cH+rH*.26} ${w*.50},${cH} Z`,
          ].join(" ")}
          fill={`url(#rg-${gid})`} stroke="#9a7a52" strokeWidth={0.8}
        />
      </>
    ),
  };

  // ── Pulp chamber outline (inner, lighter fill behind crown) ──────────────────
  const pulpChamber: Record<ToothShape, string> = {
    incisor:  `M${w*.40},${cH*.08} L${w*.60},${cH*.08} L${w*.62},${cH*.58} L${w*.38},${cH*.58} Z`,
    canine:   `M${w*.42},${cH*.10} L${w*.58},${cH*.10} Q${w*.60},${cH*.50} ${w*.50},${cH*.62} Q${w*.40},${cH*.50} ${w*.42},${cH*.10} Z`,
    premolar: `M${w*.38},${cH*.06} Q${w*.50},${cH*.10} ${w*.62},${cH*.06} L${w*.64},${cH*.52} L${w*.36},${cH*.52} Z`,
    molar:    `M${w*.28},${cH*.08} Q${w*.50},${cH*.12} ${w*.72},${cH*.08} L${w*.70},${cH*.52} L${w*.30},${cH*.52} Z`,
  };

  return (
    <svg
      width={w}
      height={tH}
      viewBox={`0 0 ${w} ${tH}`}
      style={{ display: "block", overflow: "visible", filter: "drop-shadow(0px 1.5px 3px rgba(0,0,0,0.28))" }}
    >
      <defs>
        {/* Enamel: radial — bright ivory off-centre highlight, warm amber at rim */}
        <radialGradient id={`cg-${gid}`} gradientUnits="objectBoundingBox"
          cx="0.36" cy="0.18" r="0.72">
          <stop offset="0%"   stopColor="#fefdf9" />
          <stop offset="42%"  stopColor="#f3ebdb" />
          <stop offset="78%"  stopColor="#dfc8a4" />
          <stop offset="100%" stopColor="#c2a074" />
        </radialGradient>

        {/* Enamel ambient occlusion: transparent centre → dark rim */}
        <radialGradient id={`ca-${gid}`} gradientUnits="objectBoundingBox"
          cx="0.50" cy="0.50" r="0.55">
          <stop offset="40%"  stopColor="#1a0e04" stopOpacity="0" />
          <stop offset="80%"  stopColor="#1a0e04" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#1a0e04" stopOpacity="0.24" />
        </radialGradient>

        {/* Crown specular (buccal convexity highlight) */}
        <radialGradient id={`cs-${gid}`} gradientUnits="objectBoundingBox"
          cx="0.36" cy="0.22" r="0.40">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.68" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Pulp chamber: lighter creamy dentin */}
        <radialGradient id={`pc-${gid}`} gradientUnits="objectBoundingBox"
          cx="0.5" cy="0.3" r="0.6">
          <stop offset="0%"   stopColor="#fff8e8" stopOpacity="0.70" />
          <stop offset="100%" stopColor="#f0ddb0" stopOpacity="0.20" />
        </radialGradient>

        {/* Root dentin: linear — pale at cervical, deep amber at apex */}
        <linearGradient id={`rg-${gid}`} gradientUnits="objectBoundingBox" x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0%"   stopColor="#e0d0b0" />
          <stop offset="40%"  stopColor="#c8a97a" />
          <stop offset="100%" stopColor="#9a7040" />
        </linearGradient>

        {/* Root specular highlight (buccal side of root) */}
        <radialGradient id={`rs-${gid}`} gradientUnits="objectBoundingBox"
          cx="0.30" cy="0.18" r="0.55">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Incisal translucency (for incisors/canines) */}
        <linearGradient id={`it-${gid}`} gradientUnits="objectBoundingBox" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor="#d4eef8" stopOpacity="0" />
          <stop offset="100%" stopColor="#d4eef8" stopOpacity="0.38" />
        </linearGradient>
      </defs>

      <g transform={`translate(0,${translateY}) scale(1,${scaleY})`}>

        {/* ── ROOTS ── */}
        {roots[shape]}
        {/* Root specular */}
        <path
          d={shape === "molar"
            ? `M${w*.08},${cH} L${w*.92},${cH} Q${w*.90},${cH+rH*.38} ${w*.50},${tH} Q${w*.10},${cH+rH*.38} ${w*.08},${cH} Z`
            : `M${w*.26},${cH} L${w*.74},${cH} Q${w*.68},${cH+rH*.56} ${w*.50},${tH} Q${w*.32},${cH+rH*.56} ${w*.26},${cH} Z`}
          fill={`url(#rs-${gid})`}
          opacity={0.55}
        />

        {/* ── CROWN BASE FILL ── */}
        <path d={crown[shape]} fill={`url(#cg-${gid})`} stroke="#8a7060" strokeWidth={0.9} />

        {/* ── PULP CHAMBER (subtle inner tint) ── */}
        <path d={pulpChamber[shape]} fill={`url(#pc-${gid})`} />

        {/* ── INCISAL TRANSLUCENCY (incisors and canines) ── */}
        {(shape === "incisor" || shape === "canine") && (
          <path d={crown[shape]} fill={`url(#it-${gid})`} />
        )}

        {/* ── GROOVE DETAIL ── */}
        {shape === "molar" && (
          <>
            {/* Mesio-buccal groove */}
            <line x1={w*.44} y1={cH*.03} x2={w*.44} y2={cH*.62}
              stroke="#9a8060" strokeWidth={0.80} strokeLinecap="round" opacity={0.70} />
            {/* Disto-buccal groove (shorter) */}
            <line x1={w*.68} y1={cH*.08} x2={w*.64} y2={cH*.52}
              stroke="#9a8060" strokeWidth={0.65} strokeLinecap="round" opacity={0.60} />
          </>
        )}
        {shape === "premolar" && (
          <line x1={w*.5} y1={cH*.02} x2={w*.5} y2={cH*.56}
            stroke="#9a8060" strokeWidth={0.75} strokeLinecap="round" opacity={0.65} />
        )}
        {shape === "canine" && (
          <line x1={w*.50} y1={cH*.04} x2={w*.50} y2={cH*.44}
            stroke="#9a8060" strokeWidth={0.65} strokeLinecap="round" opacity={0.55} />
        )}

        {/* ── CROWN SPECULAR HIGHLIGHT (buccal convexity) ── */}
        <path d={crown[shape]} fill={`url(#cs-${gid})`} />

        {/* ── CROWN AMBIENT OCCLUSION (rim darkening for 3D) ── */}
        <path d={crown[shape]} fill={`url(#ca-${gid})`} />

        {/* ── CROWN OUTLINE (crisp edge) ── */}
        <path d={crown[shape]} fill="none" stroke="#7a6050" strokeWidth={0.85} />

        {/* ── CEMENTO-ENAMEL JUNCTION ── */}
        <line
          x1={shape === "molar" ? w*.09 : w*.22}
          y1={cH}
          x2={shape === "molar" ? w*.91 : w*.78}
          y2={cH}
          stroke="#9a8060" strokeWidth={0.6} opacity={0.55}
        />

        {/* ── CERVICAL CONSTRICTION SHADOW ── */}
        <ellipse
          cx={w*.5} cy={cH}
          rx={shape === "molar" ? w*.42 : w*.28} ry={w*.04}
          fill="#5a3820" fillOpacity={0.18}
        />

        {/* ── CONDITION / SURFACE OVERLAYS (buccal view: B, M edge, D edge) ── */}
        {(() => {
          const col = dominantColor(conditions);
          if (!col) return null;
          const isWhole = conditions.some(c => WHOLE_TOOTH.includes(c));
          const hasB = surfaces.includes("B") || isWhole;
          const hasM = surfaces.includes("M") && !isWhole;
          const hasD = surfaces.includes("D") && !isWhole;
          return (
            <>
              <defs>
                <clipPath id={`ov-${gid}`}><path d={crown[shape]} /></clipPath>
              </defs>
              {hasB && <path d={crown[shape]} fill={col} fillOpacity={0.38} />}
              {hasM && <rect x={0} y={0} width={w*.36} height={cH}
                fill={col} fillOpacity={0.42} clipPath={`url(#ov-${gid})`} />}
              {hasD && <rect x={w*.64} y={0} width={w*.36} height={cH}
                fill={col} fillOpacity={0.42} clipPath={`url(#ov-${gid})`} />}
            </>
          );
        })()}

      </g>
    </svg>
  );
}

// ─── Lingual-view SVG ────────────────────────────────────────────────────────
function ToothLingualSVG({ shape, isUpper, w = 120, conditions = [], surfaces = [] }: {
  shape: ToothShape; isUpper: boolean; w?: number;
  conditions?: ToothCondition[]; surfaces?: ToothSurface[];
}) {
  const cH = w * 0.72, rH = w * 0.95, tH = cH + rH;
  const translateY = !isUpper ? tH : 0, scaleY = !isUpper ? -1 : 1;
  const gid = `tl-${shape[0]}`;

  const crown: Record<ToothShape, string> = {
    incisor: [`M${w*.30},0`,`L${w*.70},0`,`Q${w*.82},${cH*.08} ${w*.78},${cH*.40}`,
      `Q${w*.72},${cH*.68} ${w*.58},${cH*.84}`,`Q${w*.54},${cH} ${w*.50},${cH}`,
      `Q${w*.46},${cH} ${w*.42},${cH*.84}`,`Q${w*.28},${cH*.68} ${w*.22},${cH*.40}`,
      `Q${w*.18},${cH*.08} ${w*.30},0 Z`].join(" "),
    canine: [`M${w*.32},0`,`L${w*.68},0`,`Q${w*.84},${cH*.12} ${w*.76},${cH*.50}`,
      `Q${w*.68},${cH*.72} ${w*.58},${cH*.86}`,`Q${w*.54},${cH} ${w*.50},${cH}`,
      `Q${w*.46},${cH} ${w*.42},${cH*.86}`,`Q${w*.32},${cH*.72} ${w*.24},${cH*.50}`,
      `Q${w*.16},${cH*.12} ${w*.32},0 Z`].join(" "),
    premolar: [`M${w*.22},0`,`Q${w*.36},${-cH*.06} ${w*.44},0`,`L${w*.50},${cH*.16}`,
      `Q${w*.62},${-cH*.01} ${w*.70},${cH*.07}`,`Q${w*.82},${cH*.22} ${w*.82},${cH*.5}`,
      `Q${w*.80},${cH} ${w*.50},${cH}`,`Q${w*.20},${cH} ${w*.18},${cH*.5}`,
      `Q${w*.16},${cH*.22} ${w*.22},0 Z`].join(" "),
    molar: [`M${w*.08},0`,`Q${w*.24},${-cH*.07} ${w*.38},0`,`L${w*.46},${cH*.14}`,
      `Q${w*.60},${-cH*.04} ${w*.72},${cH*.03}`,`Q${w*.90},${cH*.14} ${w*.90},${cH*.38}`,
      `Q${w*.88},${cH} ${w*.50},${cH}`,`Q${w*.12},${cH} ${w*.10},${cH*.38}`,
      `Q${w*.08},${cH*.14} ${w*.08},0 Z`].join(" "),
  };

  return (
    <svg width={w} height={tH} viewBox={`0 0 ${w} ${tH}`}
      style={{ display:"block", overflow:"visible", filter:"drop-shadow(0px 1.5px 3px rgba(0,0,0,0.28))" }}>
      <defs>
        <radialGradient id={`lg-${gid}`} gradientUnits="objectBoundingBox" cx="0.62" cy="0.20" r="0.68">
          <stop offset="0%"   stopColor="#faf6ee" /><stop offset="45%" stopColor="#e8d8be" />
          <stop offset="78%"  stopColor="#cfa87c" /><stop offset="100%" stopColor="#a87848" />
        </radialGradient>
        <radialGradient id={`la-${gid}`} gradientUnits="objectBoundingBox" cx="0.50" cy="0.50" r="0.52">
          <stop offset="40%" stopColor="#1a0e04" stopOpacity="0" />
          <stop offset="100%" stopColor="#1a0e04" stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id={`ls-${gid}`} gradientUnits="objectBoundingBox" cx="0.62" cy="0.24" r="0.38">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`lrg-${gid}`} gradientUnits="objectBoundingBox" x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0%"   stopColor="#e0d0b0" /><stop offset="100%" stopColor="#9a7040" />
        </linearGradient>
      </defs>
      <g transform={`translate(0,${translateY}) scale(1,${scaleY})`}>
        <path
          d={shape==="molar"
            ?[`M${w*.10},${cH}`,`L${w*.90},${cH}`,`Q${w*.88},${cH+rH*.44} ${w*.72},${tH}`,`Q${w*.50},${tH+4} ${w*.30},${tH}`,`Q${w*.12},${cH+rH*.44} ${w*.10},${cH} Z`].join(" ")
            :[`M${w*.26},${cH}`,`L${w*.74},${cH}`,`Q${w*.72},${cH+rH*.60} ${w*.54},${tH}`,`Q${w*.44},${tH} ${w*.28},${tH}`,`Q${w*.22},${cH+rH*.60} ${w*.26},${cH} Z`].join(" ")}
          fill={`url(#lrg-${gid})`} stroke="#9a7a52" strokeWidth={0.8}
        />
        <path d={crown[shape]} fill={`url(#lg-${gid})`} stroke="#7a6050" strokeWidth={0.9} />
        {(shape==="incisor"||shape==="canine") && (
          <ellipse cx={w*.50} cy={cH*.82} rx={w*.16} ry={cH*.08} fill="#e8c890" fillOpacity={0.55} />
        )}
        {(shape==="premolar"||shape==="molar") && (
          <line x1={w*.50} y1={0} x2={w*.50} y2={cH*.55}
            stroke="#9a8060" strokeWidth={0.75} strokeLinecap="round" opacity={0.65} />
        )}
        <path d={crown[shape]} fill={`url(#ls-${gid})`} />
        <path d={crown[shape]} fill={`url(#la-${gid})`} />
        <path d={crown[shape]} fill="none" stroke="#7a6050" strokeWidth={0.85} />
        <line x1={shape==="molar"?w*.11:w*.24} y1={cH} x2={shape==="molar"?w*.89:w*.76} y2={cH}
          stroke="#9a8060" strokeWidth={0.6} opacity={0.55} />
        <ellipse cx={w*.5} cy={cH} rx={shape==="molar"?w*.40:w*.26} ry={w*.04}
          fill="#5a3820" fillOpacity={0.18} />
        {/* Condition overlay — lingual view shows L surface */}
        {(() => {
          const col = dominantColor(conditions);
          if (!col) return null;
          const isWhole = conditions.some(c => WHOLE_TOOTH.includes(c));
          if (!surfaces.includes("L") && !isWhole) return null;
          return <path d={crown[shape]} fill={col} fillOpacity={0.38} />;
        })()}
      </g>
    </svg>
  );
}

// ─── Proximal-view SVG (mesial or distal) ─────────────────────────────────────
function ToothProximalSVG({ shape, isUpper, w = 120, proximalSide = "M", conditions = [], surfaces = [] }: {
  shape: ToothShape; isUpper: boolean; w?: number;
  proximalSide?: "M" | "D"; conditions?: ToothCondition[]; surfaces?: ToothSurface[];
}) {
  const cH = w * 0.72, rH = w * 0.95, tH = cH + rH;
  const translateY = !isUpper ? tH : 0, scaleY = !isUpper ? -1 : 1;
  const gid = `tp-${shape[0]}`;

  const crown: Record<ToothShape, string> = {
    incisor: [`M${w*.38},0`,`L${w*.62},0`,
      `Q${w*.72},${cH*.25} ${w*.70},${cH*.65}`,`Q${w*.68},${cH} ${w*.50},${cH}`,
      `Q${w*.32},${cH} ${w*.30},${cH*.65}`,`Q${w*.28},${cH*.25} ${w*.38},0 Z`].join(" "),
    canine: [`M${w*.34},0`,`L${w*.66},0`,
      `Q${w*.76},${cH*.26} ${w*.72},${cH*.62}`,`Q${w*.68},${cH} ${w*.50},${cH}`,
      `Q${w*.32},${cH} ${w*.28},${cH*.62}`,`Q${w*.24},${cH*.26} ${w*.34},0 Z`].join(" "),
    premolar: [`M${w*.30},0`,`Q${w*.46},${-cH*.04} ${w*.58},${cH*.02}`,
      `Q${w*.78},${cH*.18} ${w*.76},${cH*.58}`,`Q${w*.72},${cH} ${w*.50},${cH}`,
      `Q${w*.28},${cH} ${w*.24},${cH*.58}`,`Q${w*.22},${cH*.18} ${w*.30},0 Z`].join(" "),
    molar: [`M${w*.22},0`,`Q${w*.36},${-cH*.06} ${w*.52},${cH*.02}`,
      `Q${w*.66},${-cH*.04} ${w*.72},${cH*.10}`,`Q${w*.84},${cH*.22} ${w*.82},${cH*.54}`,
      `Q${w*.78},${cH} ${w*.50},${cH}`,`Q${w*.22},${cH} ${w*.18},${cH*.54}`,
      `Q${w*.16},${cH*.22} ${w*.22},0 Z`].join(" "),
  };

  return (
    <svg width={w} height={tH} viewBox={`0 0 ${w} ${tH}`}
      style={{ display:"block", overflow:"visible", filter:"drop-shadow(0px 1.5px 3px rgba(0,0,0,0.28))" }}>
      <defs>
        <radialGradient id={`pg-${gid}`} gradientUnits="objectBoundingBox" cx="0.64" cy="0.20" r="0.70">
          <stop offset="0%"   stopColor="#fefdf9" /><stop offset="42%" stopColor="#f0e4ce" />
          <stop offset="78%"  stopColor="#d8bc90" /><stop offset="100%" stopColor="#b88c58" />
        </radialGradient>
        <radialGradient id={`pa-${gid}`} gradientUnits="objectBoundingBox" cx="0.50" cy="0.50" r="0.55">
          <stop offset="40%" stopColor="#1a0e04" stopOpacity="0" />
          <stop offset="100%" stopColor="#1a0e04" stopOpacity="0.26" />
        </radialGradient>
        <radialGradient id={`ps-${gid}`} gradientUnits="objectBoundingBox" cx="0.62" cy="0.22" r="0.38">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.60" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`prg-${gid}`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d8c8a0" /><stop offset="100%" stopColor="#906830" />
        </linearGradient>
      </defs>
      <g transform={`translate(0,${translateY}) scale(1,${scaleY})`}>
        <path
          d={[`M${w*.32},${cH}`,`L${w*.68},${cH}`,`Q${w*.66},${cH+rH*.56} ${w*.54},${tH}`,
            `Q${w*.44},${tH} ${w*.34},${tH}`,`Q${w*.24},${cH+rH*.56} ${w*.32},${cH} Z`].join(" ")}
          fill={`url(#prg-${gid})`} stroke="#9a7a52" strokeWidth={0.8}
        />
        <path d={crown[shape]} fill={`url(#pg-${gid})`} stroke="#7a6050" strokeWidth={0.9} />
        <ellipse cx={w*.50} cy={cH*.22} rx={w*.06} ry={cH*.04}
          fill="#8a6030" fillOpacity={0.35} />
        <path d={crown[shape]} fill={`url(#ps-${gid})`} />
        <path d={crown[shape]} fill={`url(#pa-${gid})`} />
        <path d={crown[shape]} fill="none" stroke="#7a6050" strokeWidth={0.85} />
        <text x={w*.70} y={cH*.32} fontSize={w*.08} fill="#9a8060" opacity={0.80} textAnchor="middle">B</text>
        <text x={w*.30} y={cH*.32} fontSize={w*.08} fill="#9a8060" opacity={0.80} textAnchor="middle">L</text>
        <line x1={w*.32} y1={cH} x2={w*.68} y2={cH}
          stroke="#9a8060" strokeWidth={0.6} opacity={0.55} />
        <ellipse cx={w*.5} cy={cH} rx={w*.18} ry={w*.03}
          fill="#5a3820" fillOpacity={0.18} />
        {/* Condition overlay — proximal view shows M or D surface */}
        {(() => {
          const col = dominantColor(conditions);
          if (!col) return null;
          const isWhole = conditions.some(c => WHOLE_TOOTH.includes(c));
          if (!surfaces.includes(proximalSide) && !isWhole) return null;
          return <path d={crown[shape]} fill={col} fillOpacity={0.38} />;
        })()}
      </g>
    </svg>
  );
}

// ─── 3D tooth viewer (WebGL via Three.js) ────────────────────────────────────
function Tooth3DViewer({ toothNumber, shape, isUpper, record, onChange }: {
  toothNumber: string;
  shape: ToothShape;
  isUpper: boolean;
  record: ToothRecord;
  onChange?: (r: ToothRecord) => void;
}) {
  // Use {view, ver} so clicking the same snap button twice still re-triggers the animation.
  const [snap, setSnap] = useState<{ view: string; ver: number } | undefined>(undefined);

  const toggleSurface = (s: ToothSurface) => {
    if (!onChange) return;
    const has = record.surfaces.includes(s);
    onChange({ ...record, surfaces: has ? record.surfaces.filter(x => x !== s) : [...record.surfaces, s] });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Tooth {toothNumber}</span>
          <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-muted">{shape}</span>
        </div>
        <span className="text-[10px] text-muted-foreground italic hidden sm:block">Drag to rotate · Scroll to zoom</span>
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        {/* True WebGL 3D tooth */}
        <Tooth3DCanvas
          shape={shape}
          isUpper={isUpper}
          conditions={record.conditions}
          surfaces={record.surfaces}
          width={240}
          height={280}
          cameraView={snap}
        />

        {/* View snap buttons + surface map */}
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Snap View</p>
            {(["Buccal","Lingual","Mesial","Distal","Occlusal"] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setSnap(s => ({ view: v.toLowerCase(), ver: (s?.ver ?? 0) + 1 }))}
                className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors text-left min-w-[80px]"
              >
                {v}
              </button>
            ))}
          </div>

          {/* Surface map — occlusal diagram showing affected surfaces */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Surface Map</p>
            <SurfaceBox
              conditions={record.conditions}
              surfaces={record.surfaces}
              shape={shape}
              size={80}
              onClick={() => {}}
              onSurfaceClick={onChange ? toggleSurface : undefined}
            />
            <p className="text-[9px] text-muted-foreground/60 text-center">
              {onChange ? "Click surface to toggle" : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Per-tooth BOP indicator (single toggle per tooth) ───────────────────────
function BopDot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const on = value === "1";
  return (
    <button
      type="button"
      onClick={() => onChange(on ? "0" : "1")}
      className={`w-4 h-4 rounded-full border text-[8px] font-bold transition-colors ${
        on
          ? "bg-red-500 border-red-600 text-white"
          : "border-border/50 bg-background/60 text-transparent hover:border-border"
      }`}
      title={on ? "BOP positive" : "BOP negative"}
    />
  );
}

// ─── Perio depth input (for periodontal tab) ──────────────────────────────────
function DepthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Number(value);
  return (
    <input
      type="number" min={0} max={20} value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-[22px] h-[22px] text-center text-[10px] border rounded-sm p-0 bg-transparent
        ${n >= 4 ? "text-red-500 font-bold border-red-400" : "border-border/60 text-muted-foreground"}`}
    />
  );
}

// ─── Perio BOP toggle (for periodontal tab) ───────────────────────────────────
function BopToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const on = value === "1";
  return (
    <button type="button" onClick={() => onChange(on ? "0" : "1")}
      className={`w-[22px] h-[22px] rounded-sm border text-[11px] font-bold transition-colors
        ${on ? "bg-red-500 text-white border-red-600" : "border-border/60 text-muted-foreground/40"}`}>
      {on ? "+" : "·"}
    </button>
  );
}

// ─── Full-width perio row (stretches to fill container width) ────────────────
type PerioField = keyof PerioRecord;

function PerioRowFull({
  teeth, records, field, label, isBop, onUpdate,
}: {
  teeth: string[];
  records: Map<string, PerioRecord>;
  field: PerioField;
  label: string;
  isBop?: boolean;
  onUpdate: (tooth: string, field: PerioField, value: string) => void;
}) {
  const half = teeth.length / 2;

  function parseSites(csv: string | undefined): [string, string, string] {
    const p = (csv ?? "").split(",");
    return [p[0] ?? "", p[1] ?? "", p[2] ?? ""];
  }
  function setSite(csv: string | undefined, idx: number, val: string) {
    const p = parseSites(csv);
    p[idx] = val;
    return p.join(",");
  }

  function ToothCells({ t }: { t: string }) {
    const csv = records.get(t)?.[field] as string | undefined;
    const sites = parseSites(csv);
    return (
      <div className="w-[106px] shrink-0 flex items-center justify-center gap-[2px] py-1.5">
        {sites.map((v, i) =>
          isBop ? (
            <button
              key={i} type="button"
              onClick={() => onUpdate(t, field, setSite(csv, i, v === "1" ? "0" : "1"))}
              className={`w-[34px] h-[34px] shrink-0 rounded-sm border-2 text-xs font-bold transition-colors ${
                v === "1" ? "bg-red-500 text-white border-red-600" : "border-border text-muted-foreground/50"
              }`}
            >
              {v === "1" ? "+" : "·"}
            </button>
          ) : (
            <input
              key={i} type="number" min={0} max={20} value={v}
              onChange={e => onUpdate(t, field, setSite(csv, i, e.target.value))}
              className={`w-[34px] h-[34px] shrink-0 text-center text-xs border-2 rounded-sm p-0 bg-transparent ${
                Number(v) >= 4 ? "text-red-500 font-bold border-red-400" : "border-border text-muted-foreground"
              }`}
            />
          )
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full items-center h-[52px] border-b border-border/20">
      <div className="w-[84px] shrink-0 text-right pr-3 text-[10px] text-muted-foreground leading-none">{label}</div>
      <div className="flex border-r border-border/30">
        {teeth.slice(0, half).map(t => <ToothCells key={t} t={t} />)}
      </div>
      <div className="w-5 shrink-0" />
      <div className="flex border-l border-border/30">
        {teeth.slice(half).map(t => <ToothCells key={t} t={t} />)}
      </div>
    </div>
  );
}

// ─── Tooth number strip for perio tab ────────────────────────────────────────
function PerioToothNumbers({ teeth }: { teeth: string[] }) {
  const half = teeth.length / 2;
  return (
    <div className="flex w-full items-center py-3">
      <div className="w-[84px] shrink-0" />
      <div className="flex border-r border-border/30">
        {teeth.slice(0, half).map(n => (
          <div key={n} className="w-[106px] text-[11px] text-red-500 font-semibold text-center">{n}</div>
        ))}
      </div>
      <div className="w-5 shrink-0 flex items-center justify-center">
        <div className="w-px h-4 bg-border/40" />
      </div>
      <div className="flex border-l border-border/30">
        {teeth.slice(half).map(n => (
          <div key={n} className="w-[106px] text-[11px] text-red-500 font-semibold text-center">{n}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Tooth number + anatomy + surface box column ──────────────────────────────
function ToothCol({
  n, isUpper, isRightQuadrant, isSelected, record, bopValue, onToothClick, onBopChange, TOOTH_W,
}: {
  n: string;
  isUpper: boolean;
  // true for the right half of each arch (teeth whose mesial faces right on screen),
  // false for the left half (mesial faces left). Left-quadrant images are scaleX(-1)
  // so that mesial always points toward the midline, matching clinical convention.
  isRightQuadrant: boolean;
  isSelected: boolean;
  record: ToothRecord;
  bopValue: string;
  onToothClick: () => void;
  onBopChange: (v: string) => void;
  TOOTH_W: number;
}) {
  const shape = toothShape(n);
  const anatomyW = TOOTH_W - 4;
  // Left-quadrant teeth are mirrored so their mesial side always faces the midline.
  const mirrorStyle = isRightQuadrant ? undefined : { transform: "scaleX(-1)" };

  return (
    <div className="flex flex-col items-center" style={{ width: TOOTH_W }}>
      {isUpper && (
        <>
          {/* BOP indicator — above upper arch */}
          <div className="flex justify-center h-5 items-center">
            <BopDot value={bopValue} onChange={onBopChange} />
          </div>
          {/* FDI number */}
          <span className="text-[9px] font-semibold text-red-500 leading-none my-0.5">{n}</span>
          {/* Crown anatomy — mirrored for left-quadrant teeth */}
          <div style={mirrorStyle}>
            <ToothAnatomySVG shape={shape} isUpper w={anatomyW} />
          </div>
          {/* Surface odontogram — mirrored for left-quadrant teeth */}
          <div className="mt-0.5" style={mirrorStyle}>
            <SurfaceBox
              conditions={record.conditions}
              surfaces={record.surfaces}
              isSelected={isSelected}
              onClick={onToothClick}
              size={TOOTH_W - 4}
              shape={shape}
            />
          </div>
        </>
      )}
      {!isUpper && (
        <>
          {/* Surface odontogram — mirrored for left-quadrant teeth */}
          <div style={mirrorStyle}>
            <SurfaceBox
              conditions={record.conditions}
              surfaces={record.surfaces}
              isSelected={isSelected}
              onClick={onToothClick}
              size={TOOTH_W - 4}
              shape={shape}
            />
          </div>
          {/* Crown anatomy — mirrored for left-quadrant teeth */}
          <div className="mt-0.5" style={mirrorStyle}>
            <ToothAnatomySVG shape={shape} isUpper={false} w={anatomyW} />
          </div>
          {/* FDI number */}
          <span className="text-[9px] font-semibold text-red-500 leading-none my-0.5">{n}</span>
          {/* BOP indicator — below lower arch */}
          <div className="flex justify-center h-5 items-center">
            <BopDot value={bopValue} onChange={onBopChange} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Full arch row ────────────────────────────────────────────────────────────
function ArchRow({
  teeth, isUpper, selectedTooth, toothRecords, perioRecords, onToothClick, onBopChange, TOOTH_W,
}: {
  teeth: string[];
  isUpper: boolean;
  selectedTooth: string | null;
  toothRecords: Map<string, ToothRecord>;
  perioRecords: Map<string, PerioRecord>;
  onToothClick: (n: string) => void;
  onBopChange: (tooth: string, v: string) => void;
  TOOTH_W: number;
}) {
  const half = teeth.length / 2;
  const emptyRec = (n: string): ToothRecord => ({ toothNumber: n, conditions: [], surfaces: [] });

  const getBopValue = (n: string): string => {
    const csv = perioRecords.get(n)?.buccalBop ?? "";
    return csv.split(",")[1] ?? "";
  };

  return (
    <div className="flex" style={{ minWidth: teeth.length * TOOTH_W + 12 }}>
      {/* Right quadrant — mesial faces right (toward midline) */}
      <div className="flex">
        {teeth.slice(0, half).map(n => (
          <ToothCol
            key={n} n={n} isUpper={isUpper}
            isRightQuadrant
            isSelected={selectedTooth === n}
            record={toothRecords.get(n) ?? emptyRec(n)}
            bopValue={getBopValue(n)}
            onToothClick={() => onToothClick(n)}
            onBopChange={v => onBopChange(n, v)}
            TOOTH_W={TOOTH_W}
          />
        ))}
      </div>
      {/* Midline divider */}
      <div className="w-3 shrink-0 self-stretch flex items-center justify-center">
        <div className="w-px h-full bg-border/60" />
      </div>
      {/* Left quadrant — tooth images mirrored so mesial faces left (toward midline) */}
      <div className="flex">
        {teeth.slice(half).map(n => (
          <ToothCol
            key={n} n={n} isUpper={isUpper}
            isRightQuadrant={false}
            isSelected={selectedTooth === n}
            record={toothRecords.get(n) ?? emptyRec(n)}
            bopValue={getBopValue(n)}
            onToothClick={() => onToothClick(n)}
            onBopChange={v => onBopChange(n, v)}
            TOOTH_W={TOOTH_W}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Arch label strip ─────────────────────────────────────────────────────────
function ArchLabel({ label, teeth, TOOTH_W }: { label: string; teeth: string[]; TOOTH_W: number }) {
  return (
    <div className="flex items-center my-1" style={{ minWidth: teeth.length * TOOTH_W + 12 }}>
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase px-2">{label}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ─── Furcation row (single dropdown per tooth, not 3-site) ───────────────────
function FurcationRow({
  teeth, records, onUpdate,
}: {
  teeth: string[];
  records: Map<string, PerioRecord>;
  onUpdate: (tooth: string, field: PerioField, value: string) => void;
}) {
  const half = teeth.length / 2;

  function furcColor(v: string) {
    if (v === "I")   return "text-yellow-600 border-yellow-400";
    if (v === "II")  return "text-orange-600 border-orange-400";
    if (v === "III") return "text-red-600 border-red-400";
    return "border-border text-muted-foreground";
  }

  function Cell({ t }: { t: string }) {
    const val = records.get(t)?.furcation ?? "";
    return (
      <div className="w-[106px] shrink-0 flex items-center justify-center py-1.5">
        <select
          value={val}
          onChange={e => onUpdate(t, "furcation", e.target.value)}
          className={`text-xs border rounded px-1 py-0.5 bg-background w-[76px] ${furcColor(val)}`}
        >
          <option value="">—</option>
          <option value="None">None</option>
          <option value="I">Class I</option>
          <option value="II">Class II</option>
          <option value="III">Class III</option>
        </select>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center h-[52px] border-b border-border/20">
      <div className="w-[84px] shrink-0 text-right pr-3 text-[10px] text-muted-foreground leading-none">Furcation</div>
      <div className="flex border-r border-border/30">
        {teeth.slice(0, half).map(t => <Cell key={t} t={t} />)}
      </div>
      <div className="w-5 shrink-0" />
      <div className="flex border-l border-border/30">
        {teeth.slice(half).map(t => <Cell key={t} t={t} />)}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emptyPerio(toothNumber: string): PerioRecord { return { toothNumber }; }

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { encounterId: string; patientId: string; }
type TabId = "chart" | "perio" | "details" | "history";

export default function DentalChartSection({ encounterId, patientId }: Props) {
  const [chartType, setChartType]         = useState<"Adult" | "Pediatric">("Adult");
  const [tab, setTab]                     = useState<TabId>("chart");
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [isSaving, setIsSaving]           = useState(false);
  const [isLoading, setIsLoading]         = useState(true);
  const [savedChart, setSavedChart]       = useState<DentalChartType | null>(null);

  const [generalNotes,         setGeneralNotes]         = useState("");
  const [occlusionNotes,       setOcclusionNotes]       = useState("");
  const [softTissueNotes,      setSoftTissueNotes]      = useState("");
  const [radioGraphicFindings, setRadioGraphicFindings] = useState("");

  const [toothRecords, setToothRecords] = useState<Map<string, ToothRecord>>(new Map());
  const [perioRecords, setPerioRecords] = useState<Map<string, PerioRecord>>(new Map());
  // When a new encounter has no chart yet, the previous visit's chart is pre-loaded so
  // the doctor can see the patient's last-known dental state and update it. This banner
  // date drives a visible callout so the doctor knows the data isn't yet saved for THIS visit.
  const [preFillDate, setPreFillDate] = useState<string | null>(null);

  const upperTeeth = chartType === "Adult" ? ADULT_UPPER : PEDO_UPPER;
  const lowerTeeth = chartType === "Adult" ? ADULT_LOWER : PEDO_LOWER;
  const TOOTH_W    = chartType === "Adult" ? 58 : 72;

  // ─── Load ─────────────────────────────────────────────────────────────────
  function applyChartData(data: DentalChartType) {
    setGeneralNotes(data.generalNotes ?? "");
    setOcclusionNotes(data.occlusionNotes ?? "");
    setSoftTissueNotes(data.softTissueNotes ?? "");
    setRadioGraphicFindings(data.radioGraphicFindings ?? "");
    const tm = new Map<string, ToothRecord>();
    data.toothRecords.forEach(r => tm.set(r.toothNumber, r));
    setToothRecords(tm);
    const pm = new Map<string, PerioRecord>();
    data.periodontalRecords.forEach(r => pm.set(r.toothNumber, r));
    setPerioRecords(pm);
  }

  const loadChart = useCallback(async () => {
    setIsLoading(true);
    setPreFillDate(null);
    try {
      const data = await DentalService.getChart(encounterId, chartType);
      setSavedChart(data);
      if (data) {
        applyChartData(data);
      } else {
        // No chart for this encounter yet — pre-fill from the patient's most recent
        // past chart so the doctor can see the patient's last-known dental state.
        const previous = await DentalService.getPreviousChart(patientId, chartType, encounterId);
        if (previous) {
          applyChartData(previous);
          setPreFillDate(previous.updatedAt);
        }
      }
    } catch { /* leave blank */ }
    finally { setIsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, patientId, chartType]);

  useEffect(() => { loadChart(); }, [loadChart]);

  // ─── Perio update ─────────────────────────────────────────────────────────
  const updatePerio = (tooth: string, field: PerioField, value: string) => {
    setPerioRecords(prev => {
      const m = new Map(prev);
      m.set(tooth, { ...(m.get(tooth) ?? emptyPerio(tooth)), [field]: value });
      return m;
    });
  };

  // Quick BOP toggle used on main chart (writes to buccalBop middle site)
  const handleBopChange = (tooth: string, v: string) => {
    setPerioRecords(prev => {
      const m = new Map(prev);
      const rec = m.get(tooth) ?? emptyPerio(tooth);
      const parts = (rec.buccalBop ?? ",,").split(",");
      parts[1] = v;
      m.set(tooth, { ...rec, buccalBop: parts.join(",") });
      return m;
    });
  };

  // ─── Tooth update ─────────────────────────────────────────────────────────
  const updateTooth = (updated: ToothRecord) =>
    setToothRecords(prev => new Map(prev).set(updated.toothNumber, updated));

  const handleToothClick = (n: string) =>
    setSelectedTooth(prev => prev === n ? null : n);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await DentalService.saveChart({
        encounterId, patientId, chartType,
        generalNotes, occlusionNotes, softTissueNotes, radioGraphicFindings,
        toothRecords: Array.from(toothRecords.values()),
        periodontalRecords: Array.from(perioRecords.values()),
      });
      setSavedChart(result);
      setPreFillDate(null);
      toast.success("Dental chart saved");
    } catch { toast.error("Failed to save dental chart"); }
    finally { setIsSaving(false); }
  };

  const allTeeth    = [...upperTeeth, ...lowerTeeth];
  const filledTeeth = allTeeth.filter(n => {
    const r = toothRecords.get(n);
    return r && (r.conditions.length > 0 || r.surfaces.length > 0 || r.examination || r.diagnosisText);
  });

  const perioPropArgs = { records: perioRecords, onUpdate: updatePerio };

  const TABS: { id: TabId; label: string }[] = [
    { id: "chart",   label: "Tooth Chart" },
    { id: "perio",   label: "Periodontal" },
    { id: "details", label: "Dental Details" },
    { id: "history", label: "Dental History" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full border border-border rounded-lg bg-card">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pl-4 pr-6 py-2 border-b border-border bg-muted/40 rounded-t-lg">
        <div className="flex gap-0.5">
          {TABS.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-border text-xs">
            {(["Adult", "Pediatric"] as const).map(ct => (
              <button key={ct} type="button"
                onClick={() => { setChartType(ct); setSelectedTooth(null); }}
                className={`px-3 py-1.5 transition-colors ${
                  chartType === ct ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}>
                {ct}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
            <Save size={13} /> {isSaving ? "Saving…" : "Save Chart"}
          </button>
        </div>
      </div>

      {/* Pre-fill banner — only shown when this encounter has no saved chart yet
          and the data was copied forward from a previous visit. Disappears once
          the doctor saves, which creates a real chart for this encounter. */}
      {!isLoading && preFillDate && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
          <span className="shrink-0 text-base">⚕</span>
          <span>
            <strong>Pre-filled from previous visit</strong> ({new Date(preFillDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}).
            Review the chart and click <strong>Save Chart</strong> to record findings for this visit.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading chart…
        </div>
      ) : (
        <>
          {/* ════════════════ TOOTH CHART TAB ════════════════ */}
          {tab === "chart" && (
            <div className="p-4">
              <div className="overflow-x-auto">
                <div className="flex gap-4 w-fit mx-auto items-stretch">

                  {/* ── Left legend sidebar ── */}
                  <div className="flex flex-col items-start justify-center gap-3 shrink-0 pr-3 border-r border-border/40">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="w-3.5 h-3.5 rounded-full bg-red-500 shrink-0" />
                      <span>BOP positive</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-border shrink-0" />
                      <span>BOP negative</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/50 leading-tight mt-1">
                      Click a tooth<br />to open<br />case sheet
                    </div>
                  </div>

                  {/* ── Chart ── */}
                  <div className="flex flex-col items-start gap-0">

                  {/* ── UPPER ARCH ── */}
                  <ArchLabel label="Upper" teeth={upperTeeth} TOOTH_W={TOOTH_W} />
                  <ArchRow
                    teeth={upperTeeth} isUpper
                    selectedTooth={selectedTooth}
                    toothRecords={toothRecords}
                    perioRecords={perioRecords}
                    onToothClick={handleToothClick}
                    onBopChange={handleBopChange}
                    TOOTH_W={TOOTH_W}
                  />

                  {/* ── MIDLINE ── */}
                  <div style={{ height: 8 }} />
                  <div className="flex items-center w-full" style={{ minWidth: upperTeeth.length * TOOTH_W + 12 }}>
                    <div className="flex-1 h-0.5 bg-border/40" />
                    <span className="text-[9px] font-semibold text-muted-foreground/60 tracking-widest uppercase px-2">Midline</span>
                    <div className="flex-1 h-0.5 bg-border/40" />
                  </div>
                  <div style={{ height: 8 }} />

                  {/* ── LOWER ARCH ── */}
                  <ArchRow
                    teeth={lowerTeeth} isUpper={false}
                    selectedTooth={selectedTooth}
                    toothRecords={toothRecords}
                    perioRecords={perioRecords}
                    onToothClick={handleToothClick}
                    onBopChange={handleBopChange}
                    TOOTH_W={TOOTH_W}
                  />
                  <ArchLabel label="Lower" teeth={lowerTeeth} TOOTH_W={TOOTH_W} />

                  </div>{/* end chart column */}
                </div>{/* end flex gap-4 */}
              </div>

              {/* ── Inline case sheet + 3D viewer when tooth selected ── */}
              {selectedTooth && (
                <div className="mt-4 border border-border rounded-lg bg-background relative">
                  <button type="button" onClick={() => setSelectedTooth(null)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors z-10">
                    <X size={16} />
                  </button>
                  {/* 3D anatomy viewer */}
                  <div className="p-4 border-b border-border">
                    <Tooth3DViewer
                      toothNumber={selectedTooth}
                      shape={toothShape(selectedTooth)}
                      isUpper={upperTeeth.includes(selectedTooth)}
                      record={toothRecords.get(selectedTooth) ?? { toothNumber: selectedTooth, conditions: [], surfaces: [] }}
                      onChange={updateTooth}
                    />
                  </div>
                  <ToothCaseSheet
                    toothNumber={selectedTooth}
                    record={toothRecords.get(selectedTooth) ?? { toothNumber: selectedTooth, conditions: [], surfaces: [] }}
                    onChange={updateTooth}
                  />
                </div>
              )}

              {/* ── General notes ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 mt-4 border-t border-border">
                {([
                  ["General Notes",         generalNotes,         setGeneralNotes],
                  ["Occlusion Notes",       occlusionNotes,       setOcclusionNotes],
                  ["Soft Tissue Notes",     softTissueNotes,      setSoftTissueNotes],
                  ["Radiographic Findings", radioGraphicFindings, setRadioGraphicFindings],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                    <textarea
                      value={val}
                      onChange={e => setter(e.target.value)}
                      rows={2}
                      className="w-full text-sm border border-border rounded px-2 py-1.5 resize-none bg-background"
                      placeholder={label + "…"}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════ PERIODONTAL TAB ════════════════ */}
          {tab === "perio" && (
            <div className="overflow-x-auto">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-3 pl-[84px]">
                3-site measurements per tooth (MB · B · DB). Values ≥ 4 mm highlighted in red.
              </p>

              {/* ── UPPER ARCH ── */}
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-2 mb-2 pl-[84px]">
                Upper — Buccal
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={upperTeeth} field="buccalProbing"   label="Probing"   {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="buccalBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="buccalRecession" label="Recession" {...perioPropArgs} />
              </div>

              <PerioToothNumbers teeth={upperTeeth} />

              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 pl-[84px]">
                Upper — Lingual / Palatal
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={upperTeeth} field="lingualRecession" label="Recession" {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="lingualBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={upperTeeth} field="lingualProbing"   label="Probing"   {...perioPropArgs} />
              </div>

              <div className="rounded border border-border/30 overflow-hidden mt-1">
                <FurcationRow teeth={upperTeeth} records={perioRecords} onUpdate={updatePerio} />
              </div>

              {/* ── SEPARATOR ── */}
              <div className="border-t-2 border-border my-6" />

              {/* ── LOWER ARCH ── */}
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 pl-[84px]">
                Lower — Lingual
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={lowerTeeth} field="lingualProbing"   label="Probing"   {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="lingualBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="lingualRecession" label="Recession" {...perioPropArgs} />
              </div>

              <PerioToothNumbers teeth={lowerTeeth} />

              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 pl-[84px]">
                Lower — Buccal
              </div>
              <div className="rounded border border-border/30 overflow-hidden">
                <PerioRowFull teeth={lowerTeeth} field="buccalRecession" label="Recession" {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="buccalBop"       label="BOP"       isBop {...perioPropArgs} />
                <PerioRowFull teeth={lowerTeeth} field="buccalProbing"   label="Probing"   {...perioPropArgs} />
              </div>

              <div className="rounded border border-border/30 overflow-hidden mt-1">
                <FurcationRow teeth={lowerTeeth} records={perioRecords} onUpdate={updatePerio} />
              </div>
            </div>
            </div>
          )}

          {/* ════════════════ DENTAL DETAILS TAB ════════════════ */}
          {tab === "details" && (
            <div className="p-4">
              {filledTeeth.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tooth findings recorded yet. Click a tooth in the chart to add details.
                </p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Tooth</th>
                      <th className="py-2 pr-3 font-medium">Conditions</th>
                      <th className="py-2 pr-3 font-medium">Surfaces</th>
                      <th className="py-2 pr-3 font-medium">Complexity</th>
                      <th className="py-2 font-medium">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledTeeth.map(n => {
                      const r = toothRecords.get(n)!;
                      return (
                        <tr key={n}
                          className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                          onClick={() => { setTab("chart"); setSelectedTooth(n); }}>
                          <td className="py-2 pr-3 font-semibold text-red-500">{n}</td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {r.conditions.map(c => (
                                <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-muted">{c}</span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-3">{r.surfaces.join(", ") || "—"}</td>
                          <td className="py-2 pr-3 text-xs">
                            {r.complexity?.replace(/([A-Z])/g, " $1").trim() ?? "—"}
                          </td>
                          <td className="py-2 text-muted-foreground max-w-xs truncate">{r.diagnosisText || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ════════════════ DENTAL HISTORY TAB ════════════════ */}
          {tab === "history" && (
            <div className="p-4">
              {savedChart ? (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <span className="text-xs text-muted-foreground">Chart Type</span>
                      <p className="font-medium">{savedChart.chartType}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Last Updated</span>
                      <p className="font-medium">{new Date(savedChart.updatedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Created</span>
                      <p className="font-medium">{new Date(savedChart.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Teeth with findings</span>
                      <p className="font-medium">{savedChart.toothRecords.length}</p>
                    </div>
                  </div>
                  {savedChart.generalNotes && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">General Notes</p>
                      <p className="mt-0.5">{savedChart.generalNotes}</p>
                    </div>
                  )}
                  {savedChart.radioGraphicFindings && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Radiographic Findings</p>
                      <p className="mt-0.5">{savedChart.radioGraphicFindings}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No saved chart found for this encounter.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
