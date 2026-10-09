"use client";

import { useEffect, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { format } from "date-fns";
import { ArrowLeft, Download, Eye, Printer, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { backendAssetUrl } from "@/lib/backendAsset";
import { getRecentAccounts } from "@/lib/recentAccounts";
import DatePicker from "@/components/DatePicker";
import LoadingSpinner from "@/components/LoadingSpinner";
import PasswordInput from "@/components/PasswordInput";
import { toDateInputValue } from "@/lib/date";

// ---- Types (mirror API DTOs) ----

interface EmrConsultationTile {
  encounterId: string;
  doctorName: string;
  specializationName?: string;
  chiefComplaint?: string;
  status?: string;
  createdAt: string;
}

interface EmrRos {
  constitutional?: string;
  eyeEarNoseMouthThroat?: string;
  cardiovascular?: string;
  respiratory?: string;
  gastroenterology?: string;
  genitourinary?: string;
  musculoskeletal?: string;
  neurological?: string;
  psychiatric?: string;
  endocrine?: string;
  hematologic?: string;
  allergicImmunologic?: string;
  integumentary?: string;
}

interface EmrMedication {
  medicationId?: string;
  drugName?: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  instructions?: string;
  durationDays?: number;
  status?: string;
  doctorName?: string;
}

interface EmrNurseNote {
  nurseNoteId?: string;
  nurseName?: string;
  contentHtml: string;
  createdAt: string;
}

interface EmrTriage {
  triageId?: string;
  nurseName?: string;
  chiefComplaint?: string;
  priorityLevel?: number | string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  temperature?: number;
  tempSite?: string;
  heartRate?: number;
  bPSystolic?: number;
  bPDiastolic?: number;
  respiratory?: number;
  oxygenSaturation?: number;
  bloodSugar?: number;
  actionDateTime?: string;
}

interface EmrTestResult {
  testResultId?: string;
  category?: string;
  testName?: string;
  priority?: string;
  status?: string;
  doctorName?: string;
  requestedDate?: string;
  completedDate?: string;
  hasResultFile?: boolean;
  resultFilePath?: string;
}

interface EmrEncounterDetail {
  encounterId?: string;
  doctorName?: string;
  specializationName?: string;
  createdAt: string;
  chiefComplaint?: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
  examinationNotes?: string;
  clinicalExamination?: string;
  plannedProcedures?: string;
  reviewOfSystems?: EmrRos;
  medications: EmrMedication[];
  nurseNotes: EmrNurseNote[];
  triage?: EmrTriage;
  testResults: EmrTestResult[];
}

// ---- Helpers ----

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function verifyPassword(password: string): Promise<boolean> {
  try {
    const userDetail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const accounts = getRecentAccounts();
    const myAccount = accounts.find((a) => a.userId === userDetail.userId);
    if (!myAccount?.identifier) return false;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrUserName: myAccount.identifier, password }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.body?.token) localStorage.setItem("yoton_token", data.body.token);
    }
    return res.ok;
  } catch {
    return false;
  }
}

function printEncounterHtml(
  detail: EmrEncounterDetail,
  patientName: string,
  includeDoctorEntries: boolean,
  includeNurseEntries: boolean,
) {
  const sections: string[] = [];

  sections.push(`<h1 style="font-size:18px;margin:0 0 4px">Electronic Medical Record</h1>`);
  sections.push(`<p style="margin:0 0 2px"><b>Patient:</b> ${patientName}</p>`);
  sections.push(`<p style="margin:0 0 2px"><b>Doctor:</b> ${detail.doctorName ?? "—"}</p>`);
  if (detail.specializationName)
    sections.push(`<p style="margin:0 0 2px"><b>Specialization:</b> ${detail.specializationName}</p>`);
  sections.push(
    `<p style="margin:0 0 12px"><b>Visit Date:</b> ${format(new Date(detail.createdAt), "dd MMM yyyy")}</p>`,
  );
  sections.push(`<hr/>`);

  if (includeDoctorEntries) {
    sections.push(`<h2 style="font-size:14px;margin:12px 0 6px">Doctor&apos;s Entries</h2>`);
    if (detail.chiefComplaint) sections.push(`<p><b>Chief Complaint:</b> ${detail.chiefComplaint}</p>`);
    if (detail.diagnosisDescription) sections.push(`<p><b>Diagnosis:</b> ${detail.diagnosisDescription}</p>`);
    if (detail.diagnosisCode) sections.push(`<p><b>Diagnosis Code:</b> ${detail.diagnosisCode}</p>`);
    if (detail.clinicalExamination) sections.push(`<p><b>Clinical Examination:</b> ${detail.clinicalExamination}</p>`);
    if (detail.examinationNotes) sections.push(`<p><b>Examination Notes:</b> ${detail.examinationNotes}</p>`);
    if (detail.plannedProcedures) sections.push(`<p><b>Treatment Plan:</b> ${detail.plannedProcedures}</p>`);

    const ros = detail.reviewOfSystems;
    if (ros) {
      const pairs: [string, string | undefined][] = [
        ["Constitutional", ros.constitutional],
        ["Eye/Ear/Nose/Mouth/Throat", ros.eyeEarNoseMouthThroat],
        ["Cardiovascular", ros.cardiovascular],
        ["Respiratory", ros.respiratory],
        ["Gastroenterology", ros.gastroenterology],
        ["Genitourinary", ros.genitourinary],
        ["Musculoskeletal", ros.musculoskeletal],
        ["Neurological", ros.neurological],
        ["Psychiatric", ros.psychiatric],
        ["Endocrine", ros.endocrine],
        ["Hematologic", ros.hematologic],
        ["Allergic/Immunologic", ros.allergicImmunologic],
        ["Integumentary", ros.integumentary],
      ];
      const filled = pairs.filter(([, v]) => v);
      if (filled.length > 0) {
        sections.push(`<h3 style="font-size:13px;margin:10px 0 4px">Review of Systems</h3>`);
        sections.push(filled.map(([k, v]) => `<p style="margin:0 0 2px"><b>${k}:</b> ${v}</p>`).join(""));
      }
    }

    if (detail.medications.length > 0) {
      sections.push(`<h3 style="font-size:13px;margin:10px 0 4px">Medications Prescribed</h3>`);
      sections.push(
        detail.medications
          .map(
            (m) =>
              `<p style="margin:0 0 2px">• <b>${m.drugName}</b>${m.dosage ? ` ${m.dosage}` : ""} — ${m.frequency ?? "as directed"}</p>`,
          )
          .join(""),
      );
    }
  }

  if (includeNurseEntries) {
    const t = detail.triage;
    if (t) {
      sections.push(`<h2 style="font-size:14px;margin:12px 0 6px">Nurse&apos;s Entries — Triage</h2>`);
      if (t.nurseName) sections.push(`<p><b>Nurse:</b> ${t.nurseName}</p>`);
      if (t.chiefComplaint) sections.push(`<p><b>Chief Complaint:</b> ${t.chiefComplaint}</p>`);
      if (t.priorityLevel != null) sections.push(`<p><b>Priority Level:</b> ${t.priorityLevel}</p>`);
      if (t.bPSystolic && t.bPDiastolic)
        sections.push(`<p><b>Blood Pressure:</b> ${t.bPSystolic}/${t.bPDiastolic} mmHg</p>`);
      if (t.heartRate) sections.push(`<p><b>Heart Rate:</b> ${t.heartRate} bpm</p>`);
      if (t.temperature)
        sections.push(`<p><b>Temperature:</b> ${t.temperature}°C${t.tempSite ? ` (${t.tempSite})` : ""}</p>`);
      if (t.oxygenSaturation) sections.push(`<p><b>O₂ Saturation:</b> ${t.oxygenSaturation}%</p>`);
      if (t.heightCm) sections.push(`<p><b>Height:</b> ${t.heightCm} cm</p>`);
      if (t.weightKg) sections.push(`<p><b>Weight:</b> ${t.weightKg} kg</p>`);
      if (t.bmi) sections.push(`<p><b>BMI:</b> ${t.bmi.toFixed(1)}</p>`);
      if (t.bloodSugar) sections.push(`<p><b>Blood Sugar:</b> ${t.bloodSugar} mmol/L</p>`);
    }
    if (detail.nurseNotes.length > 0) {
      if (!t) sections.push(`<h2 style="font-size:14px;margin:12px 0 6px">Nurse&apos;s Entries</h2>`);
      detail.nurseNotes.forEach((n) => {
        sections.push(
          `<p style="margin:10px 0 2px"><b>[${n.nurseName ?? "Nurse"} — ${format(new Date(n.createdAt), "dd MMM yyyy")}]</b></p>`,
        );
        sections.push(`<p>${stripHtml(n.contentHtml)}</p>`);
      });
    }
  }

  sections.push(`<hr/><p style="font-size:11px;color:#666;margin-top:8px">Generated by Yoton Health</p>`);

  const html = `<!DOCTYPE html><html><head><title>Medical Record</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;padding:20px;color:#111}p{margin:0 0 4px}hr{margin:8px 0;border:none;border-top:1px solid #ccc}</style>
</head><body>${sections.join("")}</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up blocked. Allow pop-ups and try again."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

// ---- Component ----

interface Props {
  patientId: string;
  patientName: string;
  isOpen: boolean;
  onClose: () => void;
}

type View = "list" | "detail";
type PrintStep = "idle" | "selecting" | "authenticating";
type DownloadTarget = EmrTestResult | null;

export default function PatientEmrModal({ patientId, patientName, isOpen, onClose }: Props) {
  const defaults = defaultDateRange();
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);

  const [tiles, setTiles] = useState<EmrConsultationTile[]>([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);

  const [view, setView] = useState<View>("list");
  const [detail, setDetail] = useState<EmrEncounterDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [printStep, setPrintStep] = useState<PrintStep>("idle");
  const [includeDoctorEntries, setIncludeDoctorEntries] = useState(true);
  const [includeNurseEntries, setIncludeNurseEntries] = useState(true);
  const [printPassword, setPrintPassword] = useState("");
  const [printPasswordError, setPrintPasswordError] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget>(null);
  const [downloadPassword, setDownloadPassword] = useState("");
  const [downloadPasswordError, setDownloadPasswordError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const loadingRef = useRef(false);

  const loadConsultations = async (from: string, to: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoadingTiles(true);
    try {
      const res = await api.get<{ data?: EmrConsultationTile[] }>(
        ENDPOINTS.RECEPTION.GET_PATIENT_EMR_CONSULTATIONS(patientId, from, to),
      );
      setTiles(res.data?.data ?? []);
    } catch {
      toast.error("Failed to load EMR records");
      setTiles([]);
    } finally {
      loadingRef.current = false;
      setIsLoadingTiles(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setView("list");
      setDetail(null);
      setTiles([]);
      const d = defaultDateRange();
      setFromDate(d.from);
      setToDate(d.to);
      void loadConsultations(d.from, d.to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patientId]);

  const applyDates = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    void loadConsultations(from, to);
  };

  const openDetail = async (encounterId: string) => {
    setIsLoadingDetail(true);
    setView("detail");
    try {
      const res = await api.get<{ data?: EmrEncounterDetail }>(
        ENDPOINTS.RECEPTION.GET_PATIENT_EMR_ENCOUNTER(patientId, encounterId),
      );
      setDetail(res.data?.data ?? null);
    } catch {
      toast.error("Failed to load encounter details");
      setDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handlePrint = async () => {
    if (!detail) return;
    setIsPrinting(true);
    setPrintPasswordError("");
    try {
      const ok = await verifyPassword(printPassword);
      if (!ok) {
        setPrintPasswordError("Incorrect password. Please try again.");
        return;
      }
      printEncounterHtml(detail, patientName, includeDoctorEntries, includeNurseEntries);
      setPrintStep("idle");
      setPrintPassword("");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadTarget) return;
    const url = backendAssetUrl(downloadTarget.resultFilePath);
    if (!url) { toast.error("No file available"); return; }
    setIsDownloading(true);
    setDownloadPasswordError("");
    try {
      const ok = await verifyPassword(downloadPassword);
      if (!ok) {
        setDownloadPasswordError("Incorrect password. Please try again.");
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(downloadTarget.testName ?? "result").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadTarget(null);
      setDownloadPassword("");
      toast.success("Download started");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              {view === "detail" && (
                <button
                  onClick={() => { setView("list"); setDetail(null); setPrintStep("idle"); }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                  title="Back to list"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div>
                <h2 className="text-lg font-semibold text-foreground">Electronic Medical Record</h2>
                <p className="text-xs text-muted-foreground">{patientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {view === "detail" && detail && printStep === "idle" && (
                <button
                  onClick={() => { setPrintStep("selecting"); setPrintPassword(""); setPrintPasswordError(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-semibold text-foreground transition-colors"
                  title="Print"
                >
                  <Printer size={15} /> Print
                </button>
              )}
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* List view */}
          {view === "list" && (
            <>
              {/* Date filter */}
              <div className="px-6 py-3 border-b border-border shrink-0 flex items-center justify-end gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">From</label>
                  <DatePicker
                    value={fromDate}
                    onChange={(v) => v && applyDates(v, toDate)}
                    max={toDate}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-9 w-32 items-center justify-between gap-2 rounded-lg border border-border bg-muted px-2 text-left text-xs text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">To</label>
                  <DatePicker
                    value={toDate}
                    onChange={(v) => v && applyDates(fromDate, v)}
                    min={fromDate}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-9 w-32 items-center justify-between gap-2 rounded-lg border border-border bg-muted px-2 text-left text-xs text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {/* Tiles */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingTiles ? (
                  <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
                ) : tiles.length === 0 ? (
                  <EmptyState
                    illustration="visits"
                    title="No visits in this period"
                    description="Try widening the date range."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {tiles.map((tile) => (
                      <button
                        key={tile.encounterId}
                        onClick={() => void openDetail(tile.encounterId)}
                        className="card p-4 text-left hover:shadow-md transition-shadow flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-foreground text-sm leading-snug">{tile.doctorName}</p>
                          {tile.specializationName && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                              {tile.specializationName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tile.createdAt), "dd MMM yyyy")}
                        </p>
                        {tile.chiefComplaint && (
                          <p className="text-xs text-foreground/80 line-clamp-2">{tile.chiefComplaint}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Detail view */}
          {view === "detail" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
              ) : !detail ? (
                <p className="py-16 text-center text-muted-foreground text-sm">Failed to load details.</p>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(detail.createdAt), "dd MMM yyyy")}
                    {detail.specializationName && <span className="ml-2">· {detail.specializationName}</span>}
                  </div>

                  {/* Doctor entries */}
                  <Section title="Doctor's Entries">
                    {detail.chiefComplaint && <Field label="Chief Complaint" value={detail.chiefComplaint} />}
                    {detail.diagnosisDescription && <Field label="Diagnosis" value={detail.diagnosisDescription} />}
                    {detail.diagnosisCode && <Field label="Diagnosis Code" value={detail.diagnosisCode} />}
                    {detail.clinicalExamination && <Field label="Clinical Examination" value={detail.clinicalExamination} />}
                    {detail.examinationNotes && <Field label="Examination Notes" value={detail.examinationNotes} />}
                    {detail.plannedProcedures && <Field label="Treatment Plan" value={detail.plannedProcedures} />}

                    {detail.reviewOfSystems && (() => {
                      const ros = detail.reviewOfSystems;
                      const pairs: [string, string | undefined][] = [
                        ["Constitutional", ros.constitutional],
                        ["Eye/Ear/Nose/Mouth/Throat", ros.eyeEarNoseMouthThroat],
                        ["Cardiovascular", ros.cardiovascular],
                        ["Respiratory", ros.respiratory],
                        ["Gastroenterology", ros.gastroenterology],
                        ["Genitourinary", ros.genitourinary],
                        ["Musculoskeletal", ros.musculoskeletal],
                        ["Neurological", ros.neurological],
                        ["Psychiatric", ros.psychiatric],
                        ["Endocrine", ros.endocrine],
                        ["Hematologic", ros.hematologic],
                        ["Allergic/Immunologic", ros.allergicImmunologic],
                        ["Integumentary", ros.integumentary],
                      ];
                      const filled = pairs.filter(([, v]) => v);
                      if (filled.length === 0) return null;
                      return (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Review of Systems</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                            {filled.map(([k, v]) => <Field key={k} label={k} value={v!} small />)}
                          </div>
                        </div>
                      );
                    })()}

                    {detail.medications.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Medications</p>
                        <div className="space-y-2">
                          {detail.medications.map((m, i) => (
                            <div key={m.medicationId ?? i} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs flex items-center justify-between gap-2">
                              <div>
                                <span className="font-semibold text-foreground">{m.drugName}</span>
                                {m.dosage && <span className="ml-1 text-muted-foreground">{m.dosage}</span>}
                                {m.frequency && <span className="ml-1 text-muted-foreground">· {m.frequency}</span>}
                              </div>
                              {m.status && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary shrink-0">
                                  {m.status}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Section>

                  {/* Nurse entries */}
                  {(detail.triage || detail.nurseNotes.length > 0) && (
                    <Section title="Nurse's Entries">
                      {detail.triage && (() => {
                        const t = detail.triage!;
                        return (
                          <>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Triage Vitals</p>
                            {t.nurseName && <Field label="Nurse" value={t.nurseName} />}
                            {t.chiefComplaint && <Field label="Chief Complaint" value={t.chiefComplaint} />}
                            {t.priorityLevel != null && <Field label="Priority" value={String(t.priorityLevel)} />}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-2">
                              {t.bPSystolic && t.bPDiastolic && <Field label="BP" value={`${t.bPSystolic}/${t.bPDiastolic} mmHg`} small />}
                              {t.heartRate && <Field label="Heart Rate" value={`${t.heartRate} bpm`} small />}
                              {t.temperature && <Field label="Temperature" value={`${t.temperature}°C${t.tempSite ? ` (${t.tempSite})` : ""}`} small />}
                              {t.respiratory && <Field label="Respiratory" value={`${t.respiratory} breaths/min`} small />}
                              {t.oxygenSaturation && <Field label="O₂ Sat" value={`${t.oxygenSaturation}%`} small />}
                              {t.heightCm && <Field label="Height" value={`${t.heightCm} cm`} small />}
                              {t.weightKg && <Field label="Weight" value={`${t.weightKg} kg`} small />}
                              {t.bmi && <Field label="BMI" value={t.bmi.toFixed(1)} small />}
                              {t.bloodSugar && <Field label="Blood Sugar" value={`${t.bloodSugar} mmol/L`} small />}
                            </div>
                          </>
                        );
                      })()}
                      {detail.nurseNotes.map((n, i) => (
                        <div key={n.nurseNoteId ?? i} className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            {n.nurseName ?? "Nurse"} · {format(new Date(n.createdAt), "dd MMM yyyy")}
                          </p>
                          <p className="text-foreground/90 whitespace-pre-wrap">{stripHtml(n.contentHtml)}</p>
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Test results */}
                  {detail.testResults.length > 0 && (
                    <Section title="Lab & Radiology">
                      <div className="space-y-2">
                        {detail.testResults.map((r, i) => (
                          <div key={r.testResultId ?? i} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{r.testName}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.category} · {r.status}
                                {r.requestedDate && ` · ${format(new Date(r.requestedDate), "dd MMM yyyy")}`}
                              </p>
                            </div>
                            {r.hasResultFile && r.resultFilePath && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => {
                                    const url = backendAssetUrl(r.resultFilePath);
                                    if (url) window.open(url, "_blank");
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                  title="Preview PDF"
                                >
                                  <Eye size={12} /> Preview
                                </button>
                                <button
                                  onClick={() => {
                                    setDownloadTarget(r);
                                    setDownloadPassword("");
                                    setDownloadPasswordError("");
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                  title="Download PDF"
                                >
                                  <Download size={12} /> Download
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Print: section selection overlay */}
      {printStep === "selecting" && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center p-4">
          <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Select sections to print</h3>
            <p className="text-sm text-muted-foreground mb-4">Choose which sections to include in the printout.</p>
            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDoctorEntries}
                onChange={(e) => setIncludeDoctorEntries(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-foreground">Doctor&apos;s entries</span>
            </label>
            <label className="flex items-center gap-3 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNurseEntries}
                onChange={(e) => setIncludeNurseEntries(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-foreground">Nurse&apos;s entries</span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setPrintStep("idle")}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!includeDoctorEntries && !includeNurseEntries}
                onClick={() => { setPrintStep("authenticating"); setPrintPasswordError(""); }}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print: password auth overlay */}
      {printStep === "authenticating" && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Confirm your identity</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your password to authorise printing this medical record.
            </p>
            <PasswordInput
              autoFocus
              autoComplete="current-password"
              value={printPassword}
              onChange={(e) => { setPrintPassword(e.target.value); setPrintPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && void handlePrint()}
              placeholder="Your password"
            />
            {printPasswordError && (
              <p className="mt-2 text-xs text-red-500">{printPasswordError}</p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setPrintStep("selecting"); setPrintPassword(""); setPrintPasswordError(""); }}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => void handlePrint()}
                disabled={isPrinting || !printPassword.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {isPrinting ? "Verifying…" : <><Printer size={14} /> Print</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download: password auth overlay */}
      {downloadTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Confirm your identity</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your password to download <b>{downloadTarget.testName}</b>.
            </p>
            <PasswordInput
              autoFocus
              autoComplete="current-password"
              value={downloadPassword}
              onChange={(e) => { setDownloadPassword(e.target.value); setDownloadPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && void handleDownload()}
              placeholder="Your password"
            />
            {downloadPasswordError && (
              <p className="mt-2 text-xs text-red-500">{downloadPasswordError}</p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setDownloadTarget(null); setDownloadPassword(""); setDownloadPasswordError(""); }}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDownload()}
                disabled={isDownloading || !downloadPassword.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {isDownloading ? "Verifying…" : <><Download size={14} /> Download</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3 pb-1 border-b border-border">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={small ? "flex gap-1 text-xs" : "flex gap-2 text-sm"}>
      <span className="font-semibold text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
