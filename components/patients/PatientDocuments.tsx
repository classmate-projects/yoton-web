"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Eye, Paperclip, Trash2, Upload, X } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import SearchableSelect from "@/components/SearchableSelect";
import { backendAssetUrl } from "@/lib/backendAsset";
import { apiErrorMessage } from "@/lib/apiError";
import { ReceptionService } from "@/services/reception.service";

export const PATIENT_DOCUMENT_TYPES: Record<string, string> = {
  ExternalLabReport: "External Lab Report",
  ExternalRadiologyReport: "External Radiology Report",
  InsuranceEligibility: "Insurance Eligibility",
  Other: "Other",
};

const PREVIEWABLE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "pdf"];

type PatientDocItem = {
  patientDocumentId: string;
  documentType: string;
  filePath: string | null;
  createdAt: string;
  visitId: string | null;
};

interface PanelProps {
  patientId: string;
  // Where the list and the upload row sit - e.g. the popup scrolls the list and pins the
  // upload row as a footer.
  listClassName?: string;
  uploadClassName?: string;
}

// A patient's attached documents - the list (view / download / delete) and an "Add document"
// upload row. Shared by Patient Entry's edit form and the Attachments popup.
export default function PatientDocumentsPanel({
  patientId,
  listClassName = "",
  uploadClassName = "pt-2 border-t border-border",
}: PanelProps) {
  const [docs, setDocs] = useState<PatientDocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadType, setUploadType] = useState("Other");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setDocs([]);
    setUploadFile(null);
    setUploadType("Other");
    setIsLoading(true);
    ReceptionService.getPatientDocuments(patientId)
      .then((res) => setDocs(res.data ?? []))
      .catch(() => toast.error("Failed to load attachments"))
      .finally(() => setIsLoading(false));
  }, [patientId]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      await ReceptionService.uploadDocument(patientId, { documentType: uploadType, file: uploadFile });
      // Re-fetched rather than appending the upload's response - that's the raw entity, not
      // the list endpoint's shape.
      const res = await ReceptionService.getPatientDocuments(patientId);
      setDocs(res.data ?? []);
      setUploadFile(null);
      toast.success("Document uploaded");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Upload failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: PatientDocItem) => {
    setDeletingId(doc.patientDocumentId);
    try {
      await ReceptionService.deletePatientDocument(patientId, doc.patientDocumentId);
      setDocs((prev) => prev.filter((d) => d.patientDocumentId !== doc.patientDocumentId));
      toast.success("Document deleted");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Failed to delete document"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className={`flex flex-col gap-2 ${listClassName}`}>
        {isLoading ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No documents attached yet.</p>
        ) : (
          docs.map((doc) => {
            const fileUrl = backendAssetUrl(doc.filePath);
            const ext = doc.filePath?.split(".").pop()?.toLowerCase() ?? "";
            const canPreview = PREVIEWABLE_EXTS.includes(ext);
            return (
              <div key={doc.patientDocumentId} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <Paperclip size={14} className="shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {PATIENT_DOCUMENT_TYPES[doc.documentType] ?? doc.documentType}
                  </p>
                  <p className="text-xs text-muted-foreground">{format(new Date(doc.createdAt), "dd MMM yyyy, h:mm a")}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {fileUrl && (
                    <a
                      href={fileUrl}
                      {...(canPreview ? { target: "_blank", rel: "noopener noreferrer" } : { download: true })}
                      title={canPreview ? "View" : "Download"}
                      className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                    >
                      <Eye size={13} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.patientDocumentId}
                    title="Delete"
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`flex flex-col gap-2 ${uploadClassName}`}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add document</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="sm:w-52 shrink-0">
            <SearchableSelect
              value={uploadType}
              onChange={setUploadType}
              options={Object.entries(PATIENT_DOCUMENT_TYPES).map(([value, label]) => ({ value, label }))}
              className="flex h-9 w-full items-center justify-between gap-1 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground transition-colors hover:border-primary/60"
            />
          </div>
          <label className="flex-1 flex items-center gap-2 h-9 min-w-0 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/50 px-3 text-sm text-muted-foreground cursor-pointer transition-colors">
            <Upload size={14} className="shrink-0" />
            <span className="truncate">{uploadFile ? uploadFile.name : "Choose file…"}</span>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!uploadFile || isUploading}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </>
  );
}

// The Attachments popup - the panel above with a header naming the patient.
export function PatientDocumentsModal({ patient, onClose }: { patient: { id: string; name: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Paperclip size={16} className="text-primary" /> Attachments
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{patient.name}</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded-full hover:bg-muted transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <PatientDocumentsPanel
          patientId={patient.id}
          listClassName="flex-1 min-h-0 overflow-y-auto px-5 py-4"
          uploadClassName="border-t border-border px-5 py-4 shrink-0"
        />
      </div>
    </div>
  );
}
