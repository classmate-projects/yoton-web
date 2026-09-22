"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Circle, Highlighter, MousePointer2, Trash2, Type } from "lucide-react";
import { backendAssetUrl } from "@/lib/backendAsset";
import { ImageMarking, MarkingShapeType } from "@/types/medicalForm.type";

type Tool = "select" | MarkingShapeType;

let uid = 0;
const nextMarkingId = () => `mk-${Date.now().toString(36)}-${(uid++).toString(36)}`;

const TOOLS: { tool: Tool; label: string; icon: typeof Circle }[] = [
  { tool: "select", label: "Select", icon: MousePointer2 },
  { tool: "circle", label: "Circle", icon: Circle },
  { tool: "arrow", label: "Arrow", icon: ArrowUpRight },
  { tool: "highlight", label: "Highlight", icon: Highlighter },
  { tool: "text", label: "Text", icon: Type },
];

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const headLength = 10;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

// Hand-rolled <canvas> overlay rather than pulling in konva/fabric - only three shapes plus a
// text pin, well within what plain canvas drawing handles cleanly, matching this codebase's
// existing preference for hand-built UI over a new dependency (see DatePicker.tsx). Markings
// are stored as normalized 0-1 x/y (fractions of the image's own rendered width/height, not
// pixels) precisely so they still line up correctly regardless of what size the image renders
// at - editable on reopen (spec 2.3) works the same way fill does, just starting from
// whatever markings are already in `value`.
export default function ImageAnnotationCanvas({
  imagePath,
  value,
  mode,
  onChange,
  width,
  onResizeWidth,
}: {
  imagePath: string | undefined;
  value: ImageMarking[];
  mode: "fill" | "view";
  onChange: (markings: ImageMarking[]) => void;
  // Persisted display width in px (unset = natural size, capped to the container). Only ever
  // read/written from the builder's live preview - see onResizeWidth below.
  width?: number;
  // Present only when this render is the builder's own live preview (never on the end-user
  // fill view or a saved form's read-only view, where resizing the template's image would be
  // meaningless) - its presence is what turns the resize handle on.
  onResizeWidth?: (width: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#ef4444");
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const disabled = mode === "view";

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onResizeWidth) return;

    const startX = e.clientX;
    const startWidth = imgRef.current?.clientWidth ?? width ?? 200;
    setIsResizing(true);

    const handleMove = (ev: PointerEvent) => {
      onResizeWidth(Math.max(80, Math.round(startWidth + (ev.clientX - startX))));
    };
    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const updateSize = () => setSize({ width: img.clientWidth, height: img.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(img);
    return () => observer.disconnect();
  }, [imagePath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawShape = (m: ImageMarking, isSelected: boolean) => {
      ctx.strokeStyle = m.color;
      ctx.fillStyle = m.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      const px = m.x * size.width;
      const py = m.y * size.height;

      if (m.type === "circle") {
        const r = (m.radius ?? 0.05) * size.width;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (m.type === "arrow") {
        drawArrow(ctx, px, py, (m.x2 ?? m.x) * size.width, (m.y2 ?? m.y) * size.height);
      } else if (m.type === "highlight") {
        const px2 = (m.x2 ?? m.x) * size.width;
        const py2 = (m.y2 ?? m.y) * size.height;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(Math.min(px, px2), Math.min(py, py2), Math.abs(px2 - px), Math.abs(py2 - py));
        ctx.globalAlpha = 1;
      } else if (m.type === "text") {
        ctx.font = "600 13px sans-serif";
        ctx.fillText(m.text ?? "", px, py);
      }

      if (isSelected) {
        ctx.setLineDash([4, 2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 8, py - 8, 16, 16);
        ctx.setLineDash([]);
      }
    };

    value.forEach((m) => drawShape(m, m.id === selectedId));

    if (drawing && tool !== "select" && tool !== "text") {
      drawShape(
        {
          id: "draft",
          type: tool,
          color,
          x: drawing.startX / size.width,
          y: drawing.startY / size.height,
          x2: drawing.x / size.width,
          y2: drawing.y / size.height,
          radius: tool === "circle" ? Math.hypot(drawing.x - drawing.startX, drawing.y - drawing.startY) / size.width : undefined,
        },
        false
      );
    }
  }, [value, size, selectedId, drawing, tool, color]);

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const { x, y } = getPoint(e);

    if (tool === "select") {
      const hit = value.find((m) => Math.hypot(m.x * size.width - x, m.y * size.height - y) < 16);
      setSelectedId(hit?.id ?? null);
      return;
    }
    if (tool === "text") {
      setTextDraft({ x, y, value: "" });
      return;
    }
    setDrawing({ startX: x, startY: y, x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const { x, y } = getPoint(e);
    setDrawing((prev) => (prev ? { ...prev, x, y } : prev));
  };

  const handleMouseUp = () => {
    if (!drawing) return;
    const { startX, startY, x, y } = drawing;
    setDrawing(null);
    if (Math.hypot(x - startX, y - startY) < 4) return; // ignore an accidental click-without-drag

    onChange([
      ...value,
      {
        id: nextMarkingId(),
        type: tool as MarkingShapeType,
        color,
        x: startX / size.width,
        y: startY / size.height,
        x2: x / size.width,
        y2: y / size.height,
        radius: tool === "circle" ? Math.hypot(x - startX, y - startY) / size.width : undefined,
      },
    ]);
  };

  const commitTextDraft = () => {
    if (!textDraft || !textDraft.value.trim()) {
      setTextDraft(null);
      return;
    }
    onChange([
      ...value,
      { id: nextMarkingId(), type: "text", color, x: textDraft.x / size.width, y: textDraft.y / size.height, text: textDraft.value.trim() },
    ]);
    setTextDraft(null);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    onChange(value.filter((m) => m.id !== selectedId));
    setSelectedId(null);
  };

  if (!imagePath) {
    return <p className="text-sm text-muted-foreground">No image uploaded for this field.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          {TOOLS.map(({ tool: t, label, icon: Icon }) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTool(t);
                setSelectedId(null);
              }}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                tool === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-9 cursor-pointer rounded-md border border-border p-1"
          />
          {selectedId && (
            <button
              type="button"
              onClick={removeSelected}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600"
            >
              <Trash2 size={14} /> Remove marking
            </button>
          )}
        </div>
      )}
      <div className="relative w-fit max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- server-uploaded diagram of unknown/varied dimensions, not eligible for next/image's static-size optimization */}
        <img
          ref={imgRef}
          src={backendAssetUrl(imagePath) ?? ""}
          alt=""
          style={width ? { width, height: "auto" } : undefined}
          className="max-w-full rounded-lg border border-border"
          onLoad={() => imgRef.current && setSize({ width: imgRef.current.clientWidth, height: imgRef.current.clientHeight })}
        />
        <canvas
          ref={canvasRef}
          className={`absolute left-0 top-0 ${disabled ? "" : tool === "select" ? "cursor-pointer" : "cursor-crosshair"}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        {onResizeWidth && (
          <div
            onPointerDown={handleResizePointerDown}
            title="Drag to resize"
            className={`absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-card bg-primary shadow transition-transform ${isResizing ? "scale-125" : "hover:scale-110"}`}
          />
        )}
        {textDraft && (
          <input
            autoFocus
            value={textDraft.value}
            onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
            onBlur={commitTextDraft}
            onKeyDown={(e) => e.key === "Enter" && commitTextDraft()}
            style={{ left: textDraft.x, top: textDraft.y }}
            className="absolute z-10 h-7 w-32 rounded border border-primary bg-card px-1.5 text-xs"
          />
        )}
      </div>
    </div>
  );
}
