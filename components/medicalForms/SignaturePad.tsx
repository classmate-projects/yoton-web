"use client";

import { useEffect, useRef } from "react";
import SignaturePadLib from "signature_pad";
import { RotateCcw } from "lucide-react";

// The one field type genuinely worth a small dependency instead of hand-rolling - capturing
// smooth pressure-free strokes with correct high-DPI scaling is fiddly to get right, unlike
// the circle/arrow/highlight/text shapes ImageAnnotationCanvas draws itself. Value is a plain
// base64 PNG data URL - a signature is captured once per fill, not edited stroke-by-stroke
// like an image marking, so there's no need to store vector stroke data.
export default function SignaturePad({
  value,
  mode,
  onChange,
}: {
  value: string | null;
  mode: "fill" | "view";
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const disabled = mode === "view";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Match the canvas's backing resolution to its displayed size (device pixel ratio-aware)
    // so strokes aren't blurry on high-DPI screens - signature_pad's own recommended setup.
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);

    const pad = new SignaturePadLib(canvas, { penColor: "#1f2937", backgroundColor: "#ffffff" });
    padRef.current = pad;
    if (value) pad.fromDataURL(value);
    if (disabled) pad.off();

    const handleEnd = () => onChange(pad.isEmpty() ? null : pad.toDataURL());
    pad.addEventListener("endStroke", handleEnd);

    return () => {
      pad.removeEventListener("endStroke", handleEnd);
      pad.off();
    };
    // Deliberately only re-runs on disabled/mode changing, not on every `value` change from
    // the parent - re-initializing on our own onChange would fight the user's in-progress
    // stroke. Same "uncontrolled after mount" convention DatePicker's typed-text mirror uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const clear = () => {
    padRef.current?.clear();
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={canvasRef} className="h-40 w-full touch-none rounded-lg border border-border bg-white" />
      {!disabled && (
        <button
          type="button"
          onClick={clear}
          className="flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600"
        >
          <RotateCcw size={14} /> Clear
        </button>
      )}
    </div>
  );
}
