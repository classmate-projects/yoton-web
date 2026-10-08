"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Lock, Pencil, Save, Trash2 } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import RichTextEditor from "@/components/RichTextEditor";
import { EmrService } from "@/services/emr.service";
import { NursingService } from "@/services/nursing.service";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { notifySaveStatus } from "@/lib/saveStatus";
import { EmrPatientListItem } from "@/types/emr.type";
import { ConfidentialNoteType } from "@/types/nursing.type";
import SearchableSelect from "@/components/SearchableSelect";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

// Nurse-only — no admin route, matching the backend, which hard-filters these to the
// creator and refuses even admin access. See NursingController's confidential-note
// endpoints for the enforcement this page relies on.
export default function ConfidentialNotesPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [patients, setPatients] = useState<EmrPatientListItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState<ConfidentialNoteType[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const role = (detail.role || "").toLowerCase();
    if (role !== "nurse") {
      router.replace("/");
      return;
    }
    setCheckedAuth(true);
  }, [router]);

  const fetchNotes = () => {
    setIsLoadingNotes(true);
    NursingService.getConfidentialNotes()
      .then((res) => setNotes(res.data || []))
      .catch((error) => toast.error(errorMessage(error, "Failed to load confidential notes")))
      .finally(() => setIsLoadingNotes(false));
  };

  useEffect(() => {
    if (!checkedAuth) return;
    EmrService.getPatients().then((res) => setPatients(res.data || [])).catch(() => {});
    fetchNotes();
  }, [checkedAuth]);

  const saveNote = async () => {
    if (!editingNoteId && !selectedPatientId) {
      toast.error("Select a patient first");
      return;
    }
    if (!contentHtml.trim() || contentHtml === "<p></p>") {
      toast.error("Note content is required");
      return;
    }
    notifySaveStatus("saving");
    try {
      setSaving(true);
      const payload = { contentHtml, isConfidential: true };
      if (editingNoteId) {
        await NursingService.updateConfidentialNote(editingNoteId, payload);
        toast.success("Confidential note updated");
      } else {
        await NursingService.addConfidentialNote(selectedPatientId, payload);
        toast.success("Confidential note saved — visible only to you");
      }
      notifySaveStatus("saved");
      setContentHtml("");
      setEditingNoteId(null);
      fetchNotes();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to save confidential note"));
    } finally {
      setSaving(false);
    }
  };

  const startEditNote = (n: ConfidentialNoteType) => {
    setEditingNoteId(n.confidentialNoteId);
    setContentHtml(n.contentHtml);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setContentHtml("");
  };

  const removeNote = (n: ConfidentialNoteType) => {
    confirmDeleteToast(<span>Delete this confidential note?</span>, async () => {
      try {
        await NursingService.removeConfidentialNote(n.confidentialNoteId);
        toast.success("Confidential note removed");
        fetchNotes();
      } catch (error) {
        toast.error(errorMessage(error, "Failed to remove confidential note"));
      }
    });
  };

  if (!checkedAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground mb-1">
        <Lock className="text-primary" /> Confidential Notes
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Visible only to you — never shown on the doctor case sheet or any shared clinical document.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">{editingNoteId ? "Edit Confidential Note" : "New Confidential Note"}</h2>
          <SearchableSelect
            value={selectedPatientId}
            onChange={setSelectedPatientId}
            disabled={!!editingNoteId}
            options={[
              { value: "", label: "Select patient..." },
              ...patients.map((p) => ({ value: p.opId, label: `${p.name} (${p.opNumber || p.opId})` })),
            ]}
          />
          <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="Confidential note..." />
          <div className="flex items-center gap-3">
            <button onClick={saveNote} disabled={saving} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <Save size={15} /> {editingNoteId ? "Save Changes" : "Save Confidentially"}
            </button>
            {editingNoteId && (
              <button onClick={cancelEditNote} className="text-sm font-semibold text-muted-foreground hover:underline">
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="card p-6 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">My Confidential Notes</h2>
          {isLoadingNotes ? (
            <LoadingSpinner />
          ) : notes.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-[32rem] overflow-y-auto">
              {notes.map((n) => (
                <div key={n.confidentialNoteId} className="group rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground mb-1">{n.patientName || "Unknown patient"}</p>
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: n.contentHtml }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditNote(n)} title="Edit" className="p-1 hover:bg-primary/10 rounded-full text-primary">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => removeNote(n)} title="Delete" className="p-1 hover:bg-destructive/10 rounded-full text-destructive">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No confidential notes yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
