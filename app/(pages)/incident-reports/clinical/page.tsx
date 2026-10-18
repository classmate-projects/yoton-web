"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { AlertTriangle, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ClinicalIncidentService } from "@/services/clinicalIncident.service";
import { DepartmentSerivce } from "@/services/department.service";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { notifySaveStatus } from "@/lib/saveStatus";
import { ClinicalIncidentCategory, ClinicalIncidentCreatePayload, ClinicalIncidentType } from "@/types/clinicalIncident.type";
import { PatientSummaryType } from "@/types/patient.type";
import PatientPicker, { patientFromOrder } from "@/components/patients/PatientPicker";
import { DepartmentTypes } from "@/types/department.type";
import SearchableSelect from "@/components/SearchableSelect";
import DateTimePicker from "@/components/DateTimePicker";

const CATEGORIES: { value: ClinicalIncidentCategory; label: string }[] = [
  { value: "SentinelEvent", label: "Sentinel Event" },
  { value: "MedicationError", label: "Medication Error" },
  { value: "DentalError", label: "Dental Error" },
];

const STAFF_CATEGORY_MED = [
  { code: "1", label: "Doctor" },
  { code: "2", label: "Nurse" },
  { code: "3", label: "Pharmacist" },
  { code: "4", label: "Pharmacist asst" },
  { code: "5", label: "Others" },
];

const STAFF_CATEGORY_DENTAL = [
  { code: "1", label: "Dentist" },
  { code: "2", label: "Dental Hygienist" },
  { code: "3", label: "Dental Assistant" },
];

const ERROR_STAGE = [
  { code: "1", label: "Procurement / Supply" },
  { code: "2", label: "Storage / Handling" },
  { code: "3", label: "Prescribing / Transcribing" },
  { code: "4", label: "Preparing and Dispensing" },
  { code: "5", label: "Medication Administration" },
  { code: "6", label: "Monitoring" },
];

const ERROR_TYPE_BY_STAGE: Record<string, { code: string; label: string }[]> = {
  "1": [
    { code: "1", label: "Delay from supplier" },
    { code: "2", label: "Failure of recall" },
    { code: "3", label: "Labels in unfamiliar language / Narcotics manufactural defects" },
    { code: "4", label: "Medication rejected" },
    { code: "5", label: "Product defect" },
    { code: "6", label: "Out of stock" },
    { code: "7", label: "Wrong medication supply" },
  ],
  "2": [
    { code: "1", label: "Count discrepancy" },
    { code: "2", label: "Damaged / broken medication" },
    { code: "3", label: "Expired / outdated medication" },
    { code: "4", label: "Failure of storage monitoring" },
    { code: "5", label: "Improper storage condition" },
    { code: "6", label: "Incorrect disposal" },
    { code: "7", label: "Lost medication" },
    { code: "19", label: "Transportation issues" },
    { code: "20", label: "Unsecured medication" },
    { code: "21", label: "Wrong / missing discard date" },
    { code: "22", label: "Wrong / missing labeling" },
    { code: "23", label: "Wrong storage location" },
  ],
  "3": [
    { code: "1", label: "Drug allergy / contraindication" },
    { code: "2", label: "Drug interaction" },
    { code: "3", label: "Incomplete order" },
    { code: "4", label: "Medication omission" },
    { code: "6", label: "Therapeutic duplication" },
    { code: "7", label: "Unauthorised prescriber" },
    { code: "8", label: "Wrong / inappropriate medication" },
    { code: "9", label: "Wrong / missing indication" },
    { code: "10", label: "Wrong concentration / strength" },
    { code: "11", label: "Wrong dosage form" },
    { code: "12", label: "Wrong dose" },
    { code: "13", label: "Wrong duration" },
    { code: "14", label: "Wrong frequency" },
    { code: "15", label: "Wrong patient" },
    { code: "16", label: "Wrong rate" },
    { code: "17", label: "Wrong route" },
    { code: "18", label: "Wrong time" },
  ],
  "4": [
    { code: "1", label: "Compounding issue" },
    { code: "2", label: "Missing / delay in dispensing" },
    { code: "3", label: "Wrong concentration or strength" },
    { code: "4", label: "Wrong dosage form" },
    { code: "5", label: "Wrong dose" },
    { code: "6", label: "Wrong medication" },
    { code: "7", label: "Wrong patient" },
    { code: "8", label: "Wrong quantity" },
    { code: "9", label: "Wrong / missing label" },
  ],
  "5": [
    { code: "1", label: "Dose omission" },
    { code: "2", label: "MAR charting error" },
    { code: "3", label: "Patient refusal" },
    { code: "4", label: "Wrong administration technique" },
    { code: "5", label: "Wrong concentration or strength" },
    { code: "6", label: "Wrong dosage form" },
    { code: "7", label: "Wrong dose" },
    { code: "8", label: "Wrong duration" },
    { code: "9", label: "Wrong frequency" },
    { code: "10", label: "Wrong or expired medication" },
    { code: "11", label: "Wrong patient" },
    { code: "12", label: "Wrong preparation technique" },
    { code: "13", label: "Wrong rate" },
    { code: "14", label: "Wrong route" },
    { code: "15", label: "Wrong site" },
    { code: "16", label: "Wrong time" },
    { code: "17", label: "Wrong / missing label" },
  ],
  "6": [
    { code: "1", label: "Allergy identified" },
    { code: "2", label: "Failure of monitoring" },
    { code: "3", label: "Lack of compliance by the patient" },
  ],
};

const LEVEL_OF_HARM_MED = [
  { code: "1", label: "1 - Temporary harm, required intervention" },
  { code: "2", label: "2 - Temporary harm, required initial/prolonged hospitalization" },
  { code: "3", label: "3 - Permanent patient harm" },
  { code: "4", label: "4 - Intervention required to sustain life" },
  { code: "5", label: "5 - Patient death" },
  { code: "6", label: "6 - Circumstances/events with capacity to cause error" },
  { code: "7", label: "7 - Error that did not reach the patient" },
  { code: "8", label: "8 - Error reached patient, no harm" },
  { code: "9", label: "9 - Error reached patient, required monitoring/intervention to confirm no harm" },
];

const LEVEL_OF_HARM_DENTAL = [
  { code: "1", label: "1 - Temporary harm, required intervention" },
  { code: "2", label: "2 - Temporary harm, required initial/prolonged hospitalization" },
  { code: "3", label: "3 - Permanent patient harm" },
  { code: "4", label: "4 - Intervention required to sustain life" },
  { code: "5", label: "5 - Patient death" },
  { code: "6", label: "6 - Error that did not reach the patient" },
  { code: "7", label: "7 - Error reached patient, no harm" },
  { code: "8", label: "8 - Error reached patient, required monitoring/intervention to confirm no harm" },
];

const CONTRIBUTING_FACTOR = [
  { code: "1", label: "Inexperienced personnel" },
  { code: "2", label: "Failure to adhere to work procedure" },
  { code: "3", label: "Look alike/packaging" },
  { code: "4", label: "Peak hours" },
  { code: "5", label: "Unavailable/inaccurate patient information" },
  { code: "6", label: "Illegible prescription" },
  { code: "7", label: "Others" },
];

const DENTAL_STAGE = [
  { code: "1", label: "Before procedure" },
  { code: "2", label: "During procedure" },
  { code: "3", label: "After procedure" },
  { code: "4", label: "Other" },
];

const STATUS_OPTIONS = ["Open", "UnderInvestigation", "Closed"];

const emptyForm = {
  category: "SentinelEvent" as ClinicalIncidentCategory,
  patientId: "",
  departmentId: "",
  eventDateTime: "",
  description: "",
  rootCauseAnalysis: "",
  correctiveActions: "",
  proximateFactors: "",
  systemsAndProcesses: "",
  locationText: "",
  drugName: "",
  staffCategoryCode: "",
  staffCategoryOtherText: "",
  errorStageCode: "",
  errorTypeCode: "",
  errorTypeOtherText: "",
  levelOfHarmCode: "",
  contributingFactorCode: "",
  contributingFactorOtherText: "",
  errorProneAbbreviationCode: "",
  stageCode: "",
  stageOtherText: "",
  errorTypeText: "",
};

export default function ClinicalIncidentsPage() {
  const [reports, setReports] = useState<ClinicalIncidentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<ClinicalIncidentCategory | "">("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<PatientSummaryType | null>(null);
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);
  // Set while correcting an existing not-Closed report - reuses the same form as filing a
  // new one, matching every other add-form-doubles-as-edit-form in this feature.
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  const fetchReports = async (category?: string) => {
    setLoading(true);
    try {
      const res = await ClinicalIncidentService.getAll(category || undefined);
      setReports(res.data ?? []);
    } catch {
      toast.error("Failed to load clinical incident reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(filterCategory || undefined);
  }, [filterCategory]);

  useEffect(() => {
    DepartmentSerivce.getAll().then((data) => setDepartments((data || []).filter((d: DepartmentTypes) => d.isActive))).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedPatient(null);
    setEditingReportId(null);
  };

  const startEditReport = (r: ClinicalIncidentType) => {
    setForm({
      category: r.category,
      patientId: r.patientId || "",
      departmentId: r.departmentId || "",
      eventDateTime: r.eventDateTime ? r.eventDateTime.slice(0, 16) : "",
      description: r.description || "",
      rootCauseAnalysis: r.rootCauseAnalysis || "",
      correctiveActions: r.correctiveActions || "",
      proximateFactors: r.proximateFactors || "",
      systemsAndProcesses: r.systemsAndProcesses || "",
      locationText: r.locationText || "",
      drugName: r.drugName || "",
      staffCategoryCode: r.staffCategoryCode || "",
      staffCategoryOtherText: r.staffCategoryOtherText || "",
      errorStageCode: r.errorStageCode || "",
      errorTypeCode: r.errorTypeCode || "",
      errorTypeOtherText: r.errorTypeOtherText || "",
      levelOfHarmCode: r.levelOfHarmCode || "",
      contributingFactorCode: r.contributingFactorCode || "",
      contributingFactorOtherText: r.contributingFactorOtherText || "",
      errorProneAbbreviationCode: r.errorProneAbbreviationCode || "",
      stageCode: r.stageCode || "",
      stageOtherText: r.stageOtherText || "",
      errorTypeText: r.errorTypeText || "",
    });
    setSelectedPatient(patientFromOrder({ patientId: r.patientId, patientName: r.patientName ?? "Patient" }));
    setEditingReportId(r.clinicalIncidentReportId);
    setShowForm(true);
  };

  const removeReport = (r: ClinicalIncidentType) => {
    confirmDeleteToast(
      <span>Delete this {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category} report?</span>,
      async () => {
        try {
          await ClinicalIncidentService.remove(r.clinicalIncidentReportId);
          toast.success("Incident report removed");
          await fetchReports(filterCategory || undefined);
        } catch {
          toast.error("Failed to remove incident report");
        }
      }
    );
  };

  const reopenReport = async (r: ClinicalIncidentType) => {
    try {
      await ClinicalIncidentService.reopen(r.clinicalIncidentReportId);
      toast.success("Report reopened");
      await fetchReports(filterCategory || undefined);
    } catch {
      toast.error("Failed to reopen report");
    }
  };

  const submitReport = async () => {
    if (!form.eventDateTime) {
      toast.error("Event date/time is required");
      return;
    }
    const payload: ClinicalIncidentCreatePayload = {
      category: form.category,
      patientId: form.patientId || undefined,
      departmentId: form.departmentId || undefined,
      eventDateTime: form.eventDateTime,
      description: form.description || undefined,
      rootCauseAnalysis: form.rootCauseAnalysis || undefined,
      correctiveActions: form.correctiveActions || undefined,
    };

    if (form.category === "SentinelEvent") {
      payload.proximateFactors = form.proximateFactors || undefined;
      payload.systemsAndProcesses = form.systemsAndProcesses || undefined;
    } else if (form.category === "MedicationError") {
      payload.locationText = form.locationText || undefined;
      payload.drugName = form.drugName || undefined;
      payload.staffCategoryCode = form.staffCategoryCode || undefined;
      payload.staffCategoryOtherText = form.staffCategoryOtherText || undefined;
      payload.errorStageCode = form.errorStageCode || undefined;
      payload.errorTypeCode = form.errorTypeCode || undefined;
      payload.errorTypeOtherText = form.errorTypeOtherText || undefined;
      payload.levelOfHarmCode = form.levelOfHarmCode || undefined;
      payload.contributingFactorCode = form.contributingFactorCode || undefined;
      payload.contributingFactorOtherText = form.contributingFactorOtherText || undefined;
      payload.errorProneAbbreviationCode = form.errorProneAbbreviationCode || undefined;
    } else if (form.category === "DentalError") {
      payload.staffCategoryCode = form.staffCategoryCode || undefined;
      payload.stageCode = form.stageCode || undefined;
      payload.stageOtherText = form.stageOtherText || undefined;
      payload.levelOfHarmCode = form.levelOfHarmCode || undefined;
      payload.contributingFactorCode = form.contributingFactorCode || undefined;
      payload.contributingFactorOtherText = form.contributingFactorOtherText || undefined;
      payload.errorTypeText = form.errorTypeText || undefined;
    }

    notifySaveStatus("saving");
    try {
      setIsSaving(true);
      if (editingReportId) {
        await ClinicalIncidentService.update(editingReportId, payload);
        toast.success("Incident report updated");
      } else {
        await ClinicalIncidentService.create(payload);
        toast.success("Incident report filed");
      }
      notifySaveStatus("saved");
      resetForm();
      setShowForm(false);
      await fetchReports(filterCategory || undefined);
    } catch {
      notifySaveStatus("error");
      toast.error(editingReportId ? "Failed to update incident report" : "Failed to file incident report");
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    notifySaveStatus("saving");
    try {
      await ClinicalIncidentService.update(id, { status });
      toast.success("Status updated");
      notifySaveStatus("saved");
      await fetchReports(filterCategory || undefined);
    } catch {
      notifySaveStatus("error");
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <AlertTriangle className="text-primary" /> Clinical Incidents
          </h1>
          <p className="text-sm text-muted-foreground">
            Sentinel events, medication errors, and dental errors — feeds the PL4.3, PL4.4, and PL4.7 KPI reports.
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            setShowForm((v) => !v);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "File Report"}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setForm(() => ({ ...emptyForm, category: c.value }))}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  form.category === c.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Event date/time</label>
              <DateTimePicker
                value={form.eventDateTime}
                onChange={(v) => setForm((p) => ({ ...p, eventDateTime: v }))}
                dateClassName="flex h-10 w-full items-center gap-2 overflow-hidden rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-within:ring-2 focus-within:ring-primary"
                timeClassName="h-10 w-28 shrink-0 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Department</label>
              <SearchableSelect
                value={form.departmentId}
                onChange={(v) => setForm((p) => ({ ...p, departmentId: v }))}
                options={[
                  { value: "", label: "Not specified" },
                  ...departments.map((d) => ({ value: d.departmentId, label: d.name })),
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <PatientPicker
                value={selectedPatient}
                onChange={(patient) => {
                  setSelectedPatient(patient);
                  setForm((prev) => ({ ...prev, patientId: patient?.opId ?? "" }));
                }}
                allowQuickAdd={false}
                label="Patient (optional)"
                labelClassName="text-xs font-semibold text-muted-foreground"
              />
            </div>
          </div>

          {form.category === "SentinelEvent" && (
            <div className="grid grid-cols-1 gap-3">
              <textarea
                placeholder="What happened?"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full min-h-16 text-sm"
              />
              <textarea
                placeholder="Why did it happen?"
                value={form.rootCauseAnalysis}
                onChange={(e) => setForm((p) => ({ ...p, rootCauseAnalysis: e.target.value }))}
                className="w-full min-h-16 text-sm"
              />
              <textarea
                placeholder="What were the most proximate factors?"
                value={form.proximateFactors}
                onChange={(e) => setForm((p) => ({ ...p, proximateFactors: e.target.value }))}
                className="w-full min-h-16 text-sm"
              />
              <textarea
                placeholder="Why did that happen? What systems and processes underlie those proximate factors?"
                value={form.systemsAndProcesses}
                onChange={(e) => setForm((p) => ({ ...p, systemsAndProcesses: e.target.value }))}
                className="w-full min-h-16 text-sm"
              />
            </div>
          )}

          {form.category === "MedicationError" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Location (clinic/unit)"
                value={form.locationText}
                onChange={(e) => setForm((p) => ({ ...p, locationText: e.target.value }))}
                className="h-10 text-sm"
              />
              <input
                type="text"
                placeholder="Drug name"
                value={form.drugName}
                onChange={(e) => setForm((p) => ({ ...p, drugName: e.target.value }))}
                className="h-10 text-sm"
              />
              <SearchableSelect
                value={form.staffCategoryCode}
                onChange={(v) => setForm((p) => ({ ...p, staffCategoryCode: v }))}
                options={[
                  { value: "", label: "Which staff category made the error?" },
                  ...STAFF_CATEGORY_MED.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              {form.staffCategoryCode === "5" && (
                <input
                  type="text"
                  placeholder="Specify other staff category"
                  value={form.staffCategoryOtherText}
                  onChange={(e) => setForm((p) => ({ ...p, staffCategoryOtherText: e.target.value }))}
                  className="h-10 text-sm"
                />
              )}
              <SearchableSelect
                value={form.errorStageCode}
                onChange={(v) => setForm((p) => ({ ...p, errorStageCode: v, errorTypeCode: "" }))}
                options={[
                  { value: "", label: "Which step did the error occur in?" },
                  ...ERROR_STAGE.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              <SearchableSelect
                value={form.errorTypeCode}
                onChange={(v) => setForm((p) => ({ ...p, errorTypeCode: v }))}
                disabled={!form.errorStageCode}
                options={[
                  { value: "", label: "Type of error within that step" },
                  ...(ERROR_TYPE_BY_STAGE[form.errorStageCode] || []).map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              <input
                type="text"
                placeholder="Specify other type (if applicable)"
                value={form.errorTypeOtherText}
                onChange={(e) => setForm((p) => ({ ...p, errorTypeOtherText: e.target.value }))}
                className="h-10 text-sm"
              />
              <div className="sm:col-span-2">
                <SearchableSelect
                  value={form.levelOfHarmCode}
                  onChange={(v) => setForm((p) => ({ ...p, levelOfHarmCode: v }))}
                  options={[
                    { value: "", label: "Level of harm" },
                    ...LEVEL_OF_HARM_MED.map((o) => ({ value: o.code, label: o.label })),
                  ]}
                />
              </div>
              <SearchableSelect
                value={form.contributingFactorCode}
                onChange={(v) => setForm((p) => ({ ...p, contributingFactorCode: v }))}
                options={[
                  { value: "", label: "Contributing factor" },
                  ...CONTRIBUTING_FACTOR.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              {form.contributingFactorCode === "7" && (
                <input
                  type="text"
                  placeholder="Specify other contributing factor"
                  value={form.contributingFactorOtherText}
                  onChange={(e) => setForm((p) => ({ ...p, contributingFactorOtherText: e.target.value }))}
                  className="h-10 text-sm"
                />
              )}
              <SearchableSelect
                value={form.errorProneAbbreviationCode}
                onChange={(v) => setForm((p) => ({ ...p, errorProneAbbreviationCode: v }))}
                options={[
                  { value: "", label: "Due to an error-prone abbreviation?" },
                  { value: "1", label: "Yes" },
                  { value: "2", label: "No" },
                ]}
              />
            </div>
          )}

          {form.category === "DentalError" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SearchableSelect
                value={form.staffCategoryCode}
                onChange={(v) => setForm((p) => ({ ...p, staffCategoryCode: v }))}
                options={[
                  { value: "", label: "Which staff category made the error?" },
                  ...STAFF_CATEGORY_DENTAL.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              <SearchableSelect
                value={form.stageCode}
                onChange={(v) => setForm((p) => ({ ...p, stageCode: v }))}
                options={[
                  { value: "", label: "Which stage of treatment?" },
                  ...DENTAL_STAGE.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              {form.stageCode === "4" && (
                <input
                  type="text"
                  placeholder="Specify other stage"
                  value={form.stageOtherText}
                  onChange={(e) => setForm((p) => ({ ...p, stageOtherText: e.target.value }))}
                  className="h-10 text-sm"
                />
              )}
              <input
                type="text"
                placeholder="Type of error"
                value={form.errorTypeText}
                onChange={(e) => setForm((p) => ({ ...p, errorTypeText: e.target.value }))}
                className="h-10 text-sm"
              />
              <div className="sm:col-span-2">
                <SearchableSelect
                  value={form.levelOfHarmCode}
                  onChange={(v) => setForm((p) => ({ ...p, levelOfHarmCode: v }))}
                  options={[
                    { value: "", label: "Level of harm" },
                    ...LEVEL_OF_HARM_DENTAL.map((o) => ({ value: o.code, label: o.label })),
                  ]}
                />
              </div>
              <SearchableSelect
                value={form.contributingFactorCode}
                onChange={(v) => setForm((p) => ({ ...p, contributingFactorCode: v }))}
                options={[
                  { value: "", label: "Contributing factor" },
                  ...CONTRIBUTING_FACTOR.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              {form.contributingFactorCode === "7" && (
                <input
                  type="text"
                  placeholder="Specify other contributing factor"
                  value={form.contributingFactorOtherText}
                  onChange={(e) => setForm((p) => ({ ...p, contributingFactorOtherText: e.target.value }))}
                  className="h-10 text-sm"
                />
              )}
            </div>
          )}

          {form.category !== "SentinelEvent" && (
            <textarea
              placeholder="What happened? (description)"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full min-h-16 text-sm"
            />
          )}

          <button
            onClick={submitReport}
            disabled={isSaving}
            className="self-start flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {editingReportId ? "Save Changes" : "File Report"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterCategory("")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            filterCategory === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilterCategory(c.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filterCategory === c.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : reports.length === 0 ? (
        <EmptyState
          illustration="incident"
          title="No incident reports filed yet"
          description="Clinical incidents that are reported will be listed here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.clinicalIncidentReportId} className="card p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
                    {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {r.patientName || "No patient linked"}
                  </span>
                  {r.departmentName && <span className="text-xs text-muted-foreground">· {r.departmentName}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {r.status === "Closed" ? (
                    <button
                      onClick={() => reopenReport(r)}
                      title="Reopen"
                      className="flex items-center gap-1 h-8 px-2 text-xs font-semibold rounded-md border border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <RotateCcw size={12} /> Reopen
                    </button>
                  ) : (
                    <SearchableSelect
                      value={r.status}
                      onChange={(v) => updateStatus(r.clinicalIncidentReportId, v)}
                      options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                    />
                  )}
                  {r.status !== "Closed" && (
                    <>
                      <button onClick={() => startEditReport(r)} title="Edit" className="p-1.5 hover:bg-primary/10 rounded-full text-primary">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => removeReport(r)} title="Delete" className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Event: {new Date(r.eventDateTime).toLocaleString()} · Reported: {new Date(r.reportedAt).toLocaleString()}
              </p>
              {r.description && <p className="text-sm text-foreground/90">{r.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
