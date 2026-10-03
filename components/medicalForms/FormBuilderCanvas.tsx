"use client";

import { Fragment, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  Circle,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Hash,
  Image as ImageIcon,
  ListPlus,
  Pilcrow,
  PenLine,
  Trash2,
  Type,
} from "lucide-react";
import { DEFAULT_FORMATTING, MedicalFormField, MedicalFormFieldType, MedicalFormRow } from "@/types/medicalForm.type";
import FieldEditorPanel from "./FieldEditorPanel";
import SimpleFieldListEditor from "./SimpleFieldListEditor";

const FIELD_PALETTE: { type: MedicalFormFieldType; label: string; icon: typeof Type }[] = [
  { type: "heading", label: "Heading", icon: Heading1 },
  { type: "subheading", label: "Subheading", icon: Heading2 },
  { type: "paragraph", label: "Paragraph", icon: Pilcrow },
  { type: "text", label: "Text input", icon: Type },
  { type: "textarea", label: "Text area", icon: Copy },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "radio", label: "Radio button", icon: Circle },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "number", label: "Number", icon: Hash },
  { type: "date", label: "Date", icon: Calendar },
  { type: "datetime", label: "Date & time", icon: CalendarClock },
  { type: "group", label: "Repeatable section", icon: ListPlus },
  { type: "image", label: "Image / diagram", icon: ImageIcon },
  { type: "signature", label: "Signature", icon: PenLine },
];

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

function createDefaultField(type: MedicalFormFieldType): MedicalFormField {
  const base: MedicalFormField = {
    id: nextId("fld"),
    type,
    label: FIELD_PALETTE.find((f) => f.type === type)?.label ?? "Field",
    required: false,
    formatting: { ...DEFAULT_FORMATTING },
  };
  if (type === "heading") base.headingLevel = "h2";
  if (["checkbox", "radio", "dropdown"].includes(type)) base.options = ["Option 1", "Option 2"];
  if (type === "group") base.childFields = [];
  return base;
}

const findField = (rows: MedicalFormRow[], fieldId: string): MedicalFormField | null => {
  for (const row of rows) {
    const found = row.fields.find((f) => f.id === fieldId);
    if (found) return found;
  }
  return null;
};

// Drops the field wherever it currently lives, and prunes any row left with zero fields -
// used both when moving an existing field (remove from its old spot before re-inserting at
// the drop target) and when deleting one outright.
const removeField = (rows: MedicalFormRow[], fieldId: string): MedicalFormRow[] =>
  rows.map((row) => ({ ...row, fields: row.fields.filter((f) => f.id !== fieldId) })).filter((row) => row.fields.length > 0);

// The builder canvas: an ordered list of rows, each holding 1+ fields side by side as
// columns. Fields are added by clicking a palette item (appends a new one-field row, same as
// before) or by dragging one - dragging supports dropping between existing rows (becomes its
// own new row there) or onto either side of a field within a row (becomes a new column next
// to it), which is also how an *existing* field gets moved/promoted into a column. A group's
// own childFields stay a flat list (SimpleFieldListEditor) - see that file's own comment for
// why nesting rows/columns there isn't worth it.
export default function FormBuilderCanvas({
  rows,
  onChange,
}: {
  rows: MedicalFormRow[];
  onChange: (rows: MedicalFormRow[]) => void;
}) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const addFieldFromPalette = (type: MedicalFormFieldType) => {
    const field = createDefaultField(type);
    onChange([...rows, { id: nextId("row"), fields: [field] }]);
    setSelectedFieldId(field.id);
  };

  const updateField = (updated: MedicalFormField) => {
    onChange(rows.map((row) => ({ ...row, fields: row.fields.map((f) => (f.id === updated.id ? updated : f)) })));
  };

  const deleteField = (fieldId: string) => {
    onChange(removeField(rows, fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    let workingRows = rows;
    let draggedField: MedicalFormField | null = null;

    if (activeId.startsWith("palette__")) {
      draggedField = createDefaultField(activeId.replace("palette__", "") as MedicalFormFieldType);
    } else if (activeId.startsWith("field__")) {
      const fieldId = activeId.replace("field__", "");
      draggedField = findField(rows, fieldId);
      if (!draggedField) return;
      workingRows = removeField(rows, fieldId);
    }
    if (!draggedField) return;

    if (overId.startsWith("row-gap__")) {
      const index = Number(overId.replace("row-gap__", ""));
      const next = [...workingRows];
      next.splice(index, 0, { id: nextId("row"), fields: [draggedField] });
      onChange(next);
      setSelectedFieldId(draggedField.id);
      return;
    }

    if (overId.startsWith("col-gap__")) {
      const [, rowId, colIndexStr] = overId.split("__");
      const colIndex = Number(colIndexStr);
      onChange(
        workingRows.map((row) => {
          if (row.id !== rowId) return row;
          const fields = [...row.fields];
          fields.splice(colIndex, 0, draggedField!);
          return { ...row, fields };
        })
      );
      setSelectedFieldId(draggedField.id);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Tool palette - grouped into its own raised panel (distinct surface + shadow) so it
            reads as a toolbox rather than blending into the plain field cards on the canvas.
            Left column, two per row, pinned in place (sticky) so it never scrolls out of
            reach while the canvas on the right is being filled with fields. */}
        <div className="shrink-0 rounded-xl border border-border bg-muted/40 p-3 shadow-lg shadow-black/10 sm:sticky sm:top-4 sm:w-56 sm:self-start">
          <p className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add a field</p>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_PALETTE.map(({ type, label, icon: Icon }) => (
              <PaletteButton key={type} type={type} label={label} icon={Icon} onClick={() => addFieldFromPalette(type)} />
            ))}
          </div>
        </div>

        {/* Canvas - right column, its own bounded, independently scrolling area so a long
            form never balloons the whole page (and pushes the palette away with it). */}
        <div className="min-w-0 flex-1 max-h-[70vh] overflow-y-auto rounded-lg border border-dashed border-border/60 p-3">
          <div className="flex flex-col">
            <RowGap index={0} />
            {rows.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Click a field on the left to add it, or drag it onto the canvas to place it precisely.
              </p>
            )}
            {rows.map((row, rowIndex) => (
              <Fragment key={row.id}>
                <RowView row={row} selectedFieldId={selectedFieldId} onSelectField={setSelectedFieldId} onUpdateField={updateField} onDeleteField={deleteField} />
                <RowGap index={rowIndex + 1} />
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragId ? <DragPreview id={activeDragId} rows={rows} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function PaletteButton({ type, label, icon: Icon, onClick }: { type: MedicalFormFieldType; label: string; icon: typeof Type; onClick: () => void }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `palette__${type}` });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onClick}
      title={label}
      className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-2.5 text-center text-[11px] font-semibold leading-tight text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow-md active:translate-y-0 active:cursor-grabbing active:shadow-sm"
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

// A thin strip between rows (and before the first / after the last) - widens and highlights
// while something is dragged over it, dropping there inserts a brand new row at that index.
function RowGap({ index }: { index: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `row-gap__${index}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded transition-all ${isOver ? "my-1 h-10 border-2 border-dashed border-primary bg-primary/10" : "h-2"}`}
    />
  );
}

// Same idea as RowGap, but horizontal and scoped to one row - dropping here inserts the
// dragged field as a new column at that position within the row.
function ColGap({ rowId, index }: { rowId: string; index: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-gap__${rowId}__${index}` });
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 self-stretch rounded transition-all ${isOver ? "mx-1 w-10 border-2 border-dashed border-primary bg-primary/10" : "w-2"}`}
    />
  );
}

function RowView({
  row,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onDeleteField,
}: {
  row: MedicalFormRow;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  onUpdateField: (field: MedicalFormField) => void;
  onDeleteField: (id: string) => void;
}) {
  return (
    <div className="flex items-stretch">
      <ColGap rowId={row.id} index={0} />
      {row.fields.map((field, colIndex) => (
        <Fragment key={field.id}>
          <div className="min-w-0 flex-1">
            <FieldCard
              field={field}
              isSelected={selectedFieldId === field.id}
              onSelect={() => onSelectField(selectedFieldId === field.id ? null : field.id)}
              onChange={onUpdateField}
              onRemove={() => onDeleteField(field.id)}
            />
          </div>
          <ColGap rowId={row.id} index={colIndex + 1} />
        </Fragment>
      ))}
    </div>
  );
}

function FieldCard({
  field,
  isSelected,
  onSelect,
  onChange,
  onRemove,
}: {
  field: MedicalFormField;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (field: MedicalFormField) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `field__${field.id}` });

  return (
    <div ref={setNodeRef} className={`rounded-lg border border-border bg-card ${isDragging ? "opacity-30" : ""}`}>
      <div
        onClick={onSelect}
        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer ${isSelected ? "bg-primary/10" : "hover:bg-muted/50"}`}
      >
        <span
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          title="Drag to move"
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{field.label || "(untitled)"}</p>
          <p className="text-xs text-muted-foreground">{FIELD_PALETTE.find((f) => f.type === field.type)?.label}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {isSelected && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <FieldEditorPanel field={field} onChange={onChange} />
          {field.type === "group" && (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">Fields inside each row</p>
              <SimpleFieldListEditor fields={field.childFields ?? []} onChange={(childFields) => onChange({ ...field, childFields })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DragPreview({ id, rows }: { id: string; rows: MedicalFormRow[] }) {
  const label = id.startsWith("palette__")
    ? FIELD_PALETTE.find((f) => f.type === id.replace("palette__", ""))?.label
    : id.startsWith("field__")
      ? findField(rows, id.replace("field__", ""))?.label
      : null;
  if (!label) return null;
  return <div className="rounded-lg border border-primary bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-lg">{label}</div>;
}
