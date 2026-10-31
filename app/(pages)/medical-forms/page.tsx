"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, Pencil, Plus, RotateCcw } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import { FormTemplateService } from "@/services/medicalForm.service";
import { FormTemplateType, MedicalFormField, MedicalFormRow, MedicalFormValues, normalizeRows } from "@/types/medicalForm.type";
import { notifySaveStatus } from "@/lib/saveStatus";
import { buildInitialValues, PlaceholderContext } from "@/lib/medicalForm";
import FormBuilderCanvas from "@/components/medicalForms/FormBuilderCanvas";
import MedicalFormRenderer from "@/components/medicalForms/MedicalFormRenderer";
import DepartmentSpecialtyMapper from "@/components/medicalForms/DepartmentSpecialtyMapper";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { usePlaceholderCatalog } from "@/hooks/usePlaceholderCatalog";

// Admin builder (Configuration -> Medical Forms). List + full-page editor, the same
// list-then-detail-view swap appointments/page.tsx uses for its doctor-slots view - a modal
// would be too small once a template has more than a couple of fields in it.
export default function MedicalFormsPage() {
  const [templates, setTemplates] = useState<FormTemplateType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [name, setName] = useState("");
  const [rows, setRows] = useState<MedicalFormRow[]>([]);
  const [supportsHandover, setSupportsHandover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [mappingDeptIds, setMappingDeptIds] = useState<string[]>([]);
  const [mappingSpecIds, setMappingSpecIds] = useState<string[]>([]);

  // The preview can be filled in to try the form out - no patient here, so placeholders show
  // as labelled chips. It starts over whenever the design itself changes.
  const catalog = usePlaceholderCatalog();
  const previewPlaceholders = useMemo<PlaceholderContext>(() => ({ catalog, values: null }), [catalog]);
  const [previewValues, setPreviewValues] = useState<MedicalFormValues>({});
  const resetPreview = () => setPreviewValues(buildInitialValues(rows, previewPlaceholders));
  useEffect(resetPreview, [rows, previewPlaceholders]);

  const fetchTemplates = () => {
    setIsLoading(true);
    FormTemplateService.getAll()
      .then((res) => setTemplates(res.data ?? []))
      .catch(() => toast.error("Failed to load form templates"))
      .finally(() => setIsLoading(false));
  };

  useEffect(fetchTemplates, []);
  useSignalRRefetch(["formTemplateCreated", "formTemplateUpdated", "formTemplateDeleted"], fetchTemplates);

  const openNew = () => {
    setName("");
    setRows([]);
    setSupportsHandover(false);
    setSavedTemplateId(null);
    setMappingDeptIds([]);
    setMappingSpecIds([]);
    setIsEditorOpen(true);
  };

  const openEdit = (template: FormTemplateType) => {
    setName(template.name);
    try {
      setRows(normalizeRows(JSON.parse(template.fieldsJson || "[]")));
    } catch {
      setRows([]);
    }
    setSupportsHandover(template.supportsHandover);
    setSavedTemplateId(template.formTemplateId);
    setMappingDeptIds(template.departmentIds);
    setMappingSpecIds(template.specializationIds);
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Enter a form name");
      return;
    }
    notifySaveStatus("saving");
    setIsSaving(true);
    try {
      const payload = { name: name.trim(), fieldsJson: JSON.stringify(rows), supportsHandover };
      if (savedTemplateId) {
        const data = await FormTemplateService.update(savedTemplateId, payload);
        toast.success("Form template updated");
        setTemplates((prev) => prev.map((t) => (t.formTemplateId === savedTemplateId ? data.data : t)));
      } else {
        const data = await FormTemplateService.create(payload);
        setSavedTemplateId(data.data.formTemplateId);
        setTemplates((prev) => [...prev, data.data]);
        toast.success("New form has been created", {
          description:
            "Kindly assign it to departments below - only those departments will see this form. If no department is assigned, it shows for all departments.",
          duration: 8000,
        });
        setTimeout(() => document.getElementById("form-template-mapping")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
      notifySaveStatus("saved");
    } catch {
      notifySaveStatus("error");
      toast.error("Failed to save form template");
    } finally {
      setIsSaving(false);
    }
  };

  // From the live preview only (an image field's resize handle) - patches the field's own
  // schema (e.g. imageWidth), not a per-fill value, so it's saved as part of the template.
  const updateFieldConfig = (fieldId: string, patch: Partial<MedicalFormField>) => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        fields: row.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
      }))
    );
  };

  const handleToggleActive = async (template: FormTemplateType) => {
    notifySaveStatus("saving");
    try {
      await FormTemplateService.setActive(template.formTemplateId, !template.isActive);
      setTemplates((prev) =>
        prev.map((t) => (t.formTemplateId === template.formTemplateId ? { ...t, isActive: !t.isActive } : t))
      );
      notifySaveStatus("saved");
    } catch {
      notifySaveStatus("error");
      toast.error("Failed to update form template");
    }
  };

  if (isEditorOpen) {
    return (
      <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditorOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-2xl font-semibold text-foreground">
              {savedTemplateId ? "Edit form template" : "New form template"}
            </h1>
          </div>

          <div className="card flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-foreground/90">Form name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wound Assessment"
                className="h-11 max-w-md text-base"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={supportsHandover}
                onChange={(e) => setSupportsHandover(e.target.checked)}
                className="h-4 w-4"
              />
              Allow this form to be handed over to another user (coming soon)
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Fields</h2>
              <FormBuilderCanvas rows={rows} onChange={setRows} />
            </div>

            <div className="card p-5 xl:sticky xl:top-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">Live preview</h2>
                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={resetPreview}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                )}
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                How this form will look to the doctor or nurse filling it in - try it out here, including adding and
                removing copies of repeatable rows. Patient data shows as a label until the form is opened for a real
                patient. Drag an image field&apos;s bottom-right corner to resize it.
              </p>
              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Add fields on the left to see a preview here.
                </p>
              ) : (
                <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-border p-4">
                  <MedicalFormRenderer
                    rows={rows}
                    mode="fill"
                    values={previewValues}
                    onChange={(key, value) => setPreviewValues((prev) => ({ ...prev, [key]: value }))}
                    onFieldConfigChange={updateFieldConfig}
                    placeholders={previewPlaceholders}
                  />
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-fit rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? "Saving..." : savedTemplateId ? "Save changes" : "Create template"}
          </button>

          {savedTemplateId && (
            <div id="form-template-mapping" className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Department &amp; specialty mapping</h2>
              <DepartmentSpecialtyMapper
                formTemplateId={savedTemplateId}
                selectedDepartmentIds={mappingDeptIds}
                selectedSpecializationIds={mappingSpecIds}
                onSaved={(deptIds, specIds) => {
                  setMappingDeptIds(deptIds);
                  setMappingSpecIds(specIds);
                  setTemplates((prev) =>
                    prev.map((t) =>
                      t.formTemplateId === savedTemplateId
                        ? { ...t, departmentIds: deptIds, specializationIds: specIds }
                        : t
                    )
                  );
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-3 text-4xl font-semibold text-foreground">
            <ClipboardList className="text-primary" /> Medical Forms
          </h1>
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus size={16} /> New template
          </button>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : templates.length === 0 ? (
          <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
            <ClipboardList className="text-muted-foreground/50" size={42} />
            <h2 className="mt-4 text-xl font-semibold text-foreground">No form templates yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Create your first template to make it available in the Doctor and Nurse workbenches.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((t) => (
              <div key={t.formTemplateId} className="card flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardList size={20} />
                    </span>
                    <h3 className="truncate text-base font-semibold text-foreground">{t.name}</h3>
                  </div>
                  <ToggleButton checked={t.isActive} onChange={() => handleToggleActive(t)} />
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Used</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{t.usageCount}</p>
                </div>
                <button
                  onClick={() => openEdit(t)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Pencil size={14} /> Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
