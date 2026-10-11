"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Pencil, Trash2, Users } from "lucide-react";
import { ConfigListService } from "@/services/configList.service";
import { EmrService } from "@/services/emr.service";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { FamilyHistoryType } from "@/types/emr.type";
import { ListItemType } from "@/types/configList.type";
import CorrectedFromNote from "@/components/CorrectedFromNote";
import EmptyState from "@/components/EmptyState";
import SearchableSelect, { standaloneSelectClass } from "@/components/SearchableSelect";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const STATUSES = ["Active", "Inactive"];

const emptyForm = { relation: "", history: "", remarks: "", status: "Active" };

interface FamilyHistorySectionProps {
  patientId: string;
  familyHistory: FamilyHistoryType[];
  // Already-resolved acting-doctor id (admin acting on a specific doctor's behalf) - the
  // caller works out its own page's rule for this (see doctorIdParam on the doctor
  // workbench, isAdmin ? selectedDoctorId : undefined on the nurse workbench).
  doctorId?: string;
  // Optional pre-submit gate (e.g. nursing's "select a doctor first" check) - returning
  // false should itself show whatever toast is appropriate; this component just won't submit.
  requireAttribution?: () => boolean;
  // Called after a successful add/correct/delete so the caller can refetch the patient
  // summary - this component holds no server state of its own beyond the option lists.
  onSaved: () => void | Promise<void>;
}

// Admin-configurable "who" (Relation, e.g. Father/Mother/Sibling) + "what" (History, e.g. a
// condition) pair recorded against a patient, shared verbatim between the doctor and nurse
// workbenches - see ConfigListController ListType=FamilyRelation/FamilyHistoryCondition for
// how admin curates the two dropdowns' options from the Configurable Lists page.
export default function FamilyHistorySection({ patientId, familyHistory, doctorId, requireAttribution, onSaved }: FamilyHistorySectionProps) {
  const [relations, setRelations] = useState<ListItemType[]>([]);
  const [conditions, setConditions] = useState<ListItemType[]>([]);

  useEffect(() => {
    (async () => {
      const [relationRes, conditionRes] = await Promise.all([
        ConfigListService.get("FamilyRelation").catch(() => ({ data: [] })),
        ConfigListService.get("FamilyHistoryCondition").catch(() => ({ data: [] })),
      ]);
      setRelations(relationRes.data || []);
      setConditions(conditionRes.data || []);
    })();
  }, []);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // "Correct" on a row far down the list jumps back up to the form at the top of this
  // card and keeps its border blinking - up to 15s, or until the user clicks or types
  // anywhere, whichever comes first - same pattern as the nurse workbench's allergy
  // section, so the prefilled form is unmistakable even once it's scrolled into view.
  const formRef = useRef<HTMLDivElement>(null);
  const [formFlash, setFormFlash] = useState(false);

  useEffect(() => {
    if (!formFlash) return;
    const stop = () => setFormFlash(false);
    document.addEventListener("mousedown", stop);
    document.addEventListener("keydown", stop);
    const timer = setTimeout(stop, 15000);
    return () => {
      document.removeEventListener("mousedown", stop);
      document.removeEventListener("keydown", stop);
      clearTimeout(timer);
    };
  }, [formFlash]);

  const startEdit = (f: FamilyHistoryType) => {
    setEditingId(f.familyHistoryId);
    setForm({ relation: f.relation, history: f.history, remarks: f.remarks || "", status: f.status || "Active" });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFormFlash(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.relation) {
      toast.error("Relation is required");
      return;
    }
    if (!form.history) {
      toast.error("History is required");
      return;
    }
    if (requireAttribution && !requireAttribution()) return;

    const payload = {
      relation: form.relation,
      history: form.history,
      status: form.status,
      remarks: form.remarks.trim() || undefined,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await EmrService.updateFamilyHistory(editingId, payload, doctorId);
        toast.success("Family history corrected");
      } else {
        await EmrService.addFamilyHistory(patientId, payload, doctorId);
        toast.success("Family history added");
      }
      setForm(emptyForm);
      setEditingId(null);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, editingId ? "Failed to correct family history" : "Failed to add family history"));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = (f: FamilyHistoryType) => {
    confirmDeleteToast(
      <span>Delete family history <b className="text-red-500 ml-1">{f.relation} — {f.history}</b>?</span>,
      async () => {
        try {
          await EmrService.removeFamilyHistory(f.familyHistoryId, doctorId);
          toast.success("Family history removed");
          await onSaved();
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove family history"));
        }
      }
    );
  };

  return (
    <div className="card p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Users size={18} className="text-primary" /> Family History
      </h2>

      <div
        ref={formRef}
        className={`rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-3 ${formFlash ? "animate-section-flash" : ""}`}
      >
        <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
          {editingId ? "Correct Family History Entry" : "Add Family History"}
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1 grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Relation <span className="text-destructive">*</span></label>
              <SearchableSelect
                value={form.relation}
                onChange={(v) => setForm((p) => ({ ...p, relation: v }))}
                options={relations.map((r) => ({ value: r.name, label: r.name }))}
                placeholder="--Select--"
                className={standaloneSelectClass + " h-9 text-sm"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">History <span className="text-destructive">*</span></label>
              <SearchableSelect
                value={form.history}
                onChange={(v) => setForm((p) => ({ ...p, history: v }))}
                options={conditions.map((c) => ({ value: c.name, label: c.name }))}
                placeholder="--Select--"
                className={standaloneSelectClass + " h-9 text-sm"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Remarks</label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                className="min-h-16 text-sm rounded-lg border border-border bg-background px-2 py-1.5 resize-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status <span className="text-destructive">*</span></label>
              <SearchableSelect
                value={form.status}
                onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
                className={standaloneSelectClass + " h-9 text-sm"}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={isSaving}
              className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {isSaving ? "Saving…" : editingId ? "Save Correction" : "+ Add"}
            </button>
            {editingId && (
              <button onClick={cancelEdit} className="text-sm font-semibold text-muted-foreground hover:underline whitespace-nowrap">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {familyHistory.length > 0 ? (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Relation</th>
                <th>History</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Entered By/Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {familyHistory.map((f) => (
                <tr key={f.familyHistoryId} className="group">
                  <td className="font-semibold">{f.relation}</td>
                  <td>{f.history}</td>
                  <td>{f.status || "Active"}</td>
                  <td className="text-xs text-muted-foreground max-w-48 truncate">{f.remarks || "—"}</td>
                  <td className="text-xs text-muted-foreground whitespace-nowrap">
                    {f.recordedByName || "—"} - {formatDateTime(f.createdAt)}
                  </td>
                  <td>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(f)} title="Correct" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => remove(f)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {f.correctedFrom && (
                      <CorrectedFromNote>
                        <p>Previous: {f.correctedFrom.relation} — {f.correctedFrom.history}{f.correctedFrom.remarks ? ` · ${f.correctedFrom.remarks}` : ""}</p>
                      </CorrectedFromNote>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState size="compact" illustration="users" title="No family history recorded" />
      )}
    </div>
  );
}
