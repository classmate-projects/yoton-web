"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Pencil, Plus, Printer, RefreshCw, Search, Send, X } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { FormTemplateService, SavedMedicalFormService } from "@/services/medicalForm.service";
import { UserService } from "@/services/user.service";
import {
  AvailableFormTemplatesType,
  FormTemplateType,
  MedicalFormRow,
  MedicalFormValues,
  normalizeRows,
  SavedMedicalFormType,
} from "@/types/medicalForm.type";
import { UserType } from "@/types/user.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import MedicalFormRenderer from "./MedicalFormRenderer";
import MedicalFormPrintout from "./MedicalFormPrintout";

const currentUserId = (): string | undefined => {
  try {
    return JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").userId ?? undefined;
  } catch {
    return undefined;
  }
};

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const parseRows = (fieldsJson: string): MedicalFormRow[] => {
  try {
    return normalizeRows(JSON.parse(fieldsJson || "[]"));
  } catch {
    return [];
  }
};

const parseValues = (valuesJson: string): MedicalFormValues => {
  try {
    return JSON.parse(valuesJson || "{}");
  } catch {
    return {};
  }
};

// Shared by Doctor Workbench, Nurse Workbench and (read-only) the EMR case-sheet - the exact
// same "which templates can I fill, what's already saved for this patient" logic either way,
// only the patient/visit context differs. There's no shared "Patient Medical Record" component
// elsewhere in this codebase to slot into (each workbench is its own long page of inline
// sections) but this one piece is identical enough between the two live workbenches that
// duplicating it inline would just be ~250 lines of copy-paste drift waiting to happen.
export default function PatientMedicalFormsSection({
  patientId,
  visitId,
  readOnly = false,
  patientName = "Patient",
  patientNumber,
}: {
  patientId: string | null;
  visitId: string | null;
  // The EMR case-sheet only ever shows what's already been saved, never a fill/edit surface.
  readOnly?: boolean;
  // Printout header only - purely cosmetic, so callers that don't already have this in scope
  // can safely leave it out rather than fetching it specially just for this section.
  patientName?: string;
  patientNumber?: string;
}) {
  const [available, setAvailable] = useState<AvailableFormTemplatesType>({ mostUsed: [], allForms: [] });
  const [savedForms, setSavedForms] = useState<SavedMedicalFormType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [printingSaved, setPrintingSaved] = useState<SavedMedicalFormType | null>(null);

  const [fillingTemplate, setFillingTemplate] = useState<FormTemplateType | null>(null);
  const [fillingValues, setFillingValues] = useState<MedicalFormValues>({});
  const [isSavingFill, setIsSavingFill] = useState(false);

  const [viewingSaved, setViewingSaved] = useState<SavedMedicalFormType | null>(null);
  const [editValues, setEditValues] = useState<MedicalFormValues>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deleteLock, setDeleteLock] = useState<SavedMedicalFormType | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [handoverCandidates, setHandoverCandidates] = useState<UserType[]>([]);
  const [showHandoverPicker, setShowHandoverPicker] = useState(false);
  const [handoverTargetId, setHandoverTargetId] = useState("");
  const [isHandingOver, setIsHandingOver] = useState(false);
  const [isAcknowledgingHandover, setIsAcknowledgingHandover] = useState(false);
  const myUserId = currentUserId();

  const fetchAll = () => {
    if (!patientId) {
      setAvailable({ mostUsed: [], allForms: [] });
      setSavedForms([]);
      return;
    }
    setIsLoading(true);
    Promise.all([
      readOnly ? Promise.resolve({ data: { mostUsed: [], allForms: [] } }) : FormTemplateService.getAvailable(),
      SavedMedicalFormService.getByPatient(patientId),
    ])
      .then(([availableRes, savedRes]) => {
        setAvailable(availableRes.data ?? { mostUsed: [], allForms: [] });
        setSavedForms(savedRes.data ?? []);
      })
      .catch(() => toast.error("Failed to load medical forms"))
      .finally(() => setIsLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchAll, [patientId]);
  useSignalRRefetch(
    ["formTemplateCreated", "formTemplateUpdated", "savedMedicalFormAdded", "savedMedicalFormUpdated", "savedMedicalFormRemoved"],
    fetchAll
  );

  const openFill = (template: FormTemplateType) => {
    setFillingTemplate(template);
    setFillingValues({});
  };

  // Looks up the CURRENT template definition for a saved form's own row - used to offer
  // "Fill your own" straight from an already-saved entry someone else filled. Deliberately the
  // live template (from `available`), not the saved row's own fieldsJson snapshot, so a new
  // fill always starts from whatever the template looks like now, not whatever it looked like
  // when that other person filled it. Returns undefined (hiding the button) if the template
  // was deactivated since, or isn't visible to this viewer's own department/specialty.
  const findAvailableTemplate = (formTemplateId: string): FormTemplateType | undefined =>
    available.allForms.find((t) => t.formTemplateId === formTemplateId);

  const submitFill = async () => {
    if (!patientId || !visitId || !fillingTemplate) {
      toast.error("This patient has no active visit to attach the form to");
      return;
    }
    setIsSavingFill(true);
    try {
      await SavedMedicalFormService.create({
        patientId,
        visitId,
        formTemplateId: fillingTemplate.formTemplateId,
        valuesJson: JSON.stringify(fillingValues),
      });
      toast.success("Form saved");
      setFillingTemplate(null);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save form"));
    } finally {
      setIsSavingFill(false);
    }
  };

  const openSaved = (saved: SavedMedicalFormType) => {
    setViewingSaved(saved);
    setEditValues(parseValues(saved.valuesJson));
    setShowHandoverPicker(false);
    setHandoverTargetId("");
  };

  const submitEdit = async () => {
    if (!viewingSaved) return;
    setIsSavingEdit(true);
    try {
      await SavedMedicalFormService.update(viewingSaved.savedMedicalFormId, JSON.stringify(editValues));
      toast.success("Form updated");
      setViewingSaved(null);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update form"));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openHandoverPicker = () => {
    setShowHandoverPicker(true);
    if (handoverCandidates.length === 0) {
      // Doctor + Nurse only - the two roles this section is embedded for, matching who could
      // actually go fill/continue a medical form.
      Promise.all([UserService.getAllByRole("doctor"), UserService.getAllByRole("nurse")])
        .then(([doctors, nurses]) => {
          const candidates = [...(doctors.data ?? []), ...(nurses.data ?? [])].filter(
            (u: UserType) => u.isActive && u.id !== myUserId
          );
          setHandoverCandidates(candidates);
        })
        .catch(() => toast.error("Failed to load users to hand over to"));
    }
  };

  const submitHandover = async () => {
    if (!viewingSaved || !handoverTargetId) return;
    setIsHandingOver(true);
    try {
      await SavedMedicalFormService.handover(viewingSaved.savedMedicalFormId, handoverTargetId);
      toast.success("Form handed over");
      setViewingSaved(null);
      setShowHandoverPicker(false);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to hand over form"));
    } finally {
      setIsHandingOver(false);
    }
  };

  const acknowledgeCurrentHandover = async () => {
    if (!viewingSaved) return;
    setIsAcknowledgingHandover(true);
    try {
      await SavedMedicalFormService.acknowledgeHandover(viewingSaved.savedMedicalFormId);
      toast.success("Handover acknowledged");
      setViewingSaved(null);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to acknowledge handover"));
    } finally {
      setIsAcknowledgingHandover(false);
    }
  };

  const attemptDelete = async (saved: SavedMedicalFormType, password?: string) => {
    setIsDeleting(true);
    try {
      await SavedMedicalFormService.remove(saved.savedMedicalFormId, password);
      toast.success("Form removed");
      setDeleteLock(null);
      setDeletePassword("");
      setViewingSaved(null);
      fetchAll();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 423) {
        setDeleteLock(saved);
        return;
      }
      toast.error(errorMessage(error, "Failed to remove form"));
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDelete = (saved: SavedMedicalFormType) => {
    confirmDeleteToast(<span>Remove this saved form?</span>, () => attemptDelete(saved));
  };

  // One search box covers both lists - which templates can still be filled, and what's
  // already been saved for this patient - so a long history (or a large template catalog)
  // stays easy to scan without needing two separate filter inputs.
  const query = searchTerm.trim().toLowerCase();
  const filteredMostUsed = query ? available.mostUsed.filter((t) => t.name.toLowerCase().includes(query)) : available.mostUsed;
  const filteredAllForms = query ? available.allForms.filter((t) => t.name.toLowerCase().includes(query)) : available.allForms;
  const filteredSavedForms = query
    ? savedForms.filter(
        (f) => f.formTemplateName.toLowerCase().includes(query) || (f.createdByName ?? "").toLowerCase().includes(query)
      )
    : savedForms;

  if (!patientId) return null;

  return (
    <div className="card flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <ClipboardList className="text-primary" size={20} /> Medical Forms
        </h2>
        <button
          onClick={fetchAll}
          title="Refresh"
          aria-label="Refresh"
          className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {(available.allForms.length > 0 || savedForms.length > 0) && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search medical forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full text-sm pl-9"
          />
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {!readOnly && (filteredMostUsed.length > 0 || filteredAllForms.length > 0) && (
            <div className="flex flex-col gap-2">
              {filteredMostUsed.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Most used</p>
                  <div className="flex flex-wrap gap-2">
                    {filteredMostUsed.map((t) => (
                      <button
                        key={t.formTemplateId}
                        onClick={() => openFill(t)}
                        className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {filteredAllForms.length > 0 && (
                <>
                  <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">All forms</p>
                  <div className="flex flex-wrap gap-2">
                    {filteredAllForms.map((t) => (
                      <button
                        key={t.formTemplateId}
                        onClick={() => openFill(t)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {filteredSavedForms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {savedForms.length === 0 ? "No medical forms saved for this patient yet." : "No saved forms match your search."}
            </p>
          ) : (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {filteredSavedForms.map((f) => (
                <div
                  key={f.savedMedicalFormId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted/50"
                >
                  <button onClick={() => openSaved(f)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      {f.formTemplateName}
                      {f.hasAbnormalValue && (
                        <span
                          title="This form has a value outside its normal range"
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                        >
                          <AlertTriangle size={11} /> Abnormal
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.createdByName ?? "Unknown"} · {new Date(f.createdAt).toLocaleString()}
                      {f.totalScore !== null && ` · Score: ${f.totalScore}`}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {!readOnly && f.canEdit && (
                      <button
                        onClick={() => openSaved(f)}
                        title="Edit this form"
                        aria-label="Edit this form"
                        className="flex items-center gap-1.5 rounded-full border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    )}
                    {!f.canEdit && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        View only
                      </span>
                    )}
                    {!readOnly &&
                      !f.canEdit &&
                      (() => {
                        const template = findAvailableTemplate(f.formTemplateId);
                        return template ? (
                          <button
                            onClick={() => openFill(template)}
                            title="Fill your own copy of this form for this patient"
                            aria-label="Fill your own copy of this form for this patient"
                            className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                          >
                            <Plus size={13} /> Fill your own
                          </button>
                        ) : null;
                      })()}
                    <button
                      onClick={() => setPrintingSaved(f)}
                      title="Print this form"
                      aria-label="Print this form"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <Printer size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------------- Fill a new form ---------------- */}
      {/* Header/footer live outside the scrolling body (`.card` itself sets overflow-hidden
          for its rounded corners, which silently wins over an overflow-y-auto placed on the
          same element - the actual scrolling needs its own plain, unclassed inner div) so a
          tall form's Cancel/Save stay reachable and its title stays visible while scrolling. */}
      {fillingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md">
          <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border shadow-2xl">
            <div className="flex items-center justify-between gap-4 p-6 pb-4">
              <h3 className="text-lg font-semibold text-foreground">{fillingTemplate.name}</h3>
              <button onClick={() => setFillingTemplate(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <MedicalFormRenderer
                rows={parseRows(fillingTemplate.fieldsJson)}
                mode="fill"
                values={fillingValues}
                onChange={(fieldId, value) => setFillingValues((prev) => ({ ...prev, [fieldId]: value }))}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-6 pt-4">
              <button
                onClick={() => setFillingTemplate(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={submitFill}
                disabled={isSavingFill}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {isSavingFill ? "Saving..." : "Save form"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- View / edit a saved form ---------------- */}
      {viewingSaved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md">
          <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border shadow-2xl">
            <div className="flex items-center justify-between gap-4 p-6 pb-4">
              <div>
                <h3 className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
                  {viewingSaved.formTemplateName}
                  {viewingSaved.hasAbnormalValue && (
                    <span
                      title="This form has a value outside its normal range"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                    >
                      <AlertTriangle size={11} /> Abnormal
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {viewingSaved.createdByName ?? "Unknown"} · {new Date(viewingSaved.createdAt).toLocaleString()}
                  {viewingSaved.totalScore !== null && ` · Score: ${viewingSaved.totalScore}`}
                </p>
                {viewingSaved.handoverStatus === "Pending" && (
                  <p className="mt-1 text-xs font-semibold text-amber-600">
                    Handed to {viewingSaved.handoverToName ?? "another user"} · awaiting their response
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setPrintingSaved(viewingSaved)}
                  title="Print this form"
                  aria-label="Print this form"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <Printer size={16} />
                </button>
                <button onClick={() => setViewingSaved(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6">
              <MedicalFormRenderer
                rows={parseRows(viewingSaved.fieldsJson)}
                mode={!readOnly && viewingSaved.canEdit ? "fill" : "view"}
                values={editValues}
                onChange={(fieldId, value) => setEditValues((prev) => ({ ...prev, [fieldId]: value }))}
              />

              {!readOnly && showHandoverPicker && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <span className="text-xs font-semibold text-muted-foreground">Hand over to</span>
                  <div className="flex items-center gap-2">
                    <select value={handoverTargetId} onChange={(e) => setHandoverTargetId(e.target.value)} className="h-9 flex-1 text-sm">
                      <option value="">Select a user...</option>
                      {handoverCandidates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={submitHandover}
                      disabled={isHandingOver || !handoverTargetId}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <Send size={13} /> {isHandingOver ? "Sending..." : "Send"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHandoverPicker(false)}
                      className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!readOnly && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-6 pt-4">
                <button
                  onClick={() => requestDelete(viewingSaved)}
                  disabled={isDeleting}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
                <div className="flex items-center gap-3">
                  {viewingSaved.supportsHandover &&
                    viewingSaved.handoverStatus !== "Pending" &&
                    (viewingSaved.canEdit || viewingSaved.handoverToUserId === myUserId) &&
                    !showHandoverPicker && (
                      <button
                        onClick={openHandoverPicker}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        <Send size={14} /> Hand over
                      </button>
                    )}
                  {viewingSaved.handoverStatus === "Pending" && viewingSaved.handoverToUserId === myUserId && (
                    <button
                      onClick={acknowledgeCurrentHandover}
                      disabled={isAcknowledgingHandover}
                      className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                    >
                      {isAcknowledgingHandover ? "..." : "Acknowledge"}
                    </button>
                  )}
                  {viewingSaved.canEdit && (
                    <button
                      onClick={submitEdit}
                      disabled={isSavingEdit}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {isSavingEdit ? "Saving..." : "Save changes"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Password re-auth to delete someone else's saved form ---------------- */}
      {deleteLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="card mx-4 w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">Enter your password</h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              This form was filled by another user. Enter your password to remove it.
            </p>
            <input
              type="password"
              autoFocus
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && attemptDelete(deleteLock, deletePassword)}
              placeholder="Your password"
              className="h-10 w-full text-sm"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteLock(null);
                  setDeletePassword("");
                }}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => attemptDelete(deleteLock, deletePassword)}
                disabled={isDeleting || !deletePassword.trim()}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {isDeleting ? "Verifying..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Print a saved form ---------------- */}
      {printingSaved && (
        <MedicalFormPrintout
          formTemplateName={printingSaved.formTemplateName}
          patientName={patientName}
          patientNumber={patientNumber || patientId}
          createdByName={printingSaved.createdByName}
          createdAt={printingSaved.createdAt}
          totalScore={printingSaved.totalScore}
          hasAbnormalValue={printingSaved.hasAbnormalValue}
          rows={parseRows(printingSaved.fieldsJson)}
          values={parseValues(printingSaved.valuesJson)}
          onClose={() => setPrintingSaved(null)}
          canEdit={!readOnly && printingSaved.canEdit}
          onEdit={() => {
            setPrintingSaved(null);
            openSaved(printingSaved);
          }}
        />
      )}
    </div>
  );
}
