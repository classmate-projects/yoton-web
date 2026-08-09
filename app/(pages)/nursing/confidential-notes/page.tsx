"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Lock, Save } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import RichTextEditor from "@/components/RichTextEditor";
import { EmrService } from "@/services/emr.service";
import { NursingService } from "@/services/nursing.service";
import { EmrPatientListItem } from "@/types/emr.type";
import { ConfidentialNoteType } from "@/types/nursing.type";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth]);

  const saveNote = async () => {
    if (!selectedPatientId) {
      toast.error("Select a patient first");
      return;
    }
    if (!contentHtml.trim() || contentHtml === "<p></p>") {
      toast.error("Note content is required");
      return;
    }
    try {
      setSaving(true);
      await NursingService.addConfidentialNote(selectedPatientId, {
        contentHtml,
        isConfidential: true,
      });
      toast.success("Confidential note saved — visible only to you");
      setContentHtml("");
      fetchNotes();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save confidential note"));
    } finally {
      setSaving(false);
    }
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
          <h2 className="text-lg font-semibold text-foreground">New Confidential Note</h2>
          <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} className="h-10 text-sm">
            <option value="">Select patient...</option>
            {patients.map((p) => (
              <option key={p.opId} value={p.opId}>{p.name} (#{p.opId})</option>
            ))}
          </select>
          <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="Confidential note..." />
          <button onClick={saveNote} disabled={saving} className="self-start flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Save size={15} /> Save Confidentially
          </button>
        </div>

        <div className="card p-6 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">My Confidential Notes</h2>
          {isLoadingNotes ? (
            <LoadingSpinner />
          ) : notes.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-[32rem] overflow-y-auto">
              {notes.map((n) => (
                <div key={n.confidentialNoteId} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground mb-1">{n.patientName || "Unknown patient"}</p>
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: n.contentHtml }} />
                  <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
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
