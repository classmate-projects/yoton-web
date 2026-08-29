"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ClinicalIncidentService } from "@/services/clinicalIncident.service";
import { ReceptionService } from "@/services/reception.service";
import { DepartmentSerivce } from "@/services/department.service";
import { ClinicalIncidentCategory, ClinicalIncidentCreatePayload, ClinicalIncidentType } from "@/types/clinicalIncident.type";
import { PatientListItemType } from "@/types/appointment.type";
import { DepartmentTypes } from "@/types/department.type";

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

  const [patients, setPatients] = useState<PatientListItemType[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);

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
    ReceptionService.getAllPatients().then((data) => setPatients(data.patients ?? [])).catch(() => {});
    DepartmentSerivce.getAll().then((data) => setDepartments((data || []).filter((d: DepartmentTypes) => d.isActive))).catch(() => {});
  }, []);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const q = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.opNumber?.toLowerCase().includes(q) ||
          p.opId?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q) ||
          p.nationalID?.toLowerCase().includes(q) ||
          p.passportNumber?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [patients, patientSearch]);

  const selectedPatient = patients.find((p) => p.opId === form.patientId) || null;

  const resetForm = () => {
    setForm(emptyForm);
    setPatientSearch("");
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

    try {
      setIsSaving(true);
      await ClinicalIncidentService.create(payload);
      toast.success("Incident report filed");
      resetForm();
      setShowForm(false);
      await fetchReports(filterCategory || undefined);
    } catch {
      toast.error("Failed to file incident report");
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await ClinicalIncidentService.update(id, { status });
      toast.success("Status updated");
      await fetchReports(filterCategory || undefined);
    } catch {
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
          onClick={() => setShowForm((v) => !v)}
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
              <input
                type="datetime-local"
                value={form.eventDateTime}
                onChange={(e) => setForm((p) => ({ ...p, eventDateTime: e.target.value }))}
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">Department</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Not specified</option>
                {departments.map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2 relative">
              <label className="text-xs font-semibold text-muted-foreground">Patient (optional)</label>
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <span>{selectedPatient.name} ({selectedPatient.opNumber || selectedPatient.opId})</span>
                  <button
                    onClick={() => setForm((p) => ({ ...p, patientId: "" }))}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search by name, phone, MRN, national ID, or passport..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="h-10 text-sm"
                  />
                  {filteredPatients.length > 0 && (
                    <div className="absolute top-full mt-1 z-10 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                      {filteredPatients.map((p) => (
                        <button
                          key={p.opId}
                          onClick={() => {
                            setForm((prev) => ({ ...prev, patientId: p.opId }));
                            setPatientSearch("");
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                        >
                          <span>{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.opNumber || p.opId}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
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
              <select
                value={form.staffCategoryCode}
                onChange={(e) => setForm((p) => ({ ...p, staffCategoryCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Which staff category made the error?</option>
                {STAFF_CATEGORY_MED.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              {form.staffCategoryCode === "5" && (
                <input
                  type="text"
                  placeholder="Specify other staff category"
                  value={form.staffCategoryOtherText}
                  onChange={(e) => setForm((p) => ({ ...p, staffCategoryOtherText: e.target.value }))}
                  className="h-10 text-sm"
                />
              )}
              <select
                value={form.errorStageCode}
                onChange={(e) => setForm((p) => ({ ...p, errorStageCode: e.target.value, errorTypeCode: "" }))}
                className="h-10 text-sm"
              >
                <option value="">Which step did the error occur in?</option>
                {ERROR_STAGE.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <select
                value={form.errorTypeCode}
                onChange={(e) => setForm((p) => ({ ...p, errorTypeCode: e.target.value }))}
                disabled={!form.errorStageCode}
                className="h-10 text-sm"
              >
                <option value="">Type of error within that step</option>
                {(ERROR_TYPE_BY_STAGE[form.errorStageCode] || []).map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Specify other type (if applicable)"
                value={form.errorTypeOtherText}
                onChange={(e) => setForm((p) => ({ ...p, errorTypeOtherText: e.target.value }))}
                className="h-10 text-sm"
              />
              <select
                value={form.levelOfHarmCode}
                onChange={(e) => setForm((p) => ({ ...p, levelOfHarmCode: e.target.value }))}
                className="h-10 text-sm sm:col-span-2"
              >
                <option value="">Level of harm</option>
                {LEVEL_OF_HARM_MED.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <select
                value={form.contributingFactorCode}
                onChange={(e) => setForm((p) => ({ ...p, contributingFactorCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Contributing factor</option>
                {CONTRIBUTING_FACTOR.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              {form.contributingFactorCode === "7" && (
                <input
                  type="text"
                  placeholder="Specify other contributing factor"
                  value={form.contributingFactorOtherText}
                  onChange={(e) => setForm((p) => ({ ...p, contributingFactorOtherText: e.target.value }))}
                  className="h-10 text-sm"
                />
              )}
              <select
                value={form.errorProneAbbreviationCode}
                onChange={(e) => setForm((p) => ({ ...p, errorProneAbbreviationCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Due to an error-prone abbreviation?</option>
                <option value="1">Yes</option>
                <option value="2">No</option>
              </select>
            </div>
          )}

          {form.category === "DentalError" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={form.staffCategoryCode}
                onChange={(e) => setForm((p) => ({ ...p, staffCategoryCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Which staff category made the error?</option>
                {STAFF_CATEGORY_DENTAL.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <select
                value={form.stageCode}
                onChange={(e) => setForm((p) => ({ ...p, stageCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Which stage of treatment?</option>
                {DENTAL_STAGE.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
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
              <select
                value={form.levelOfHarmCode}
                onChange={(e) => setForm((p) => ({ ...p, levelOfHarmCode: e.target.value }))}
                className="h-10 text-sm sm:col-span-2"
              >
                <option value="">Level of harm</option>
                {LEVEL_OF_HARM_DENTAL.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <select
                value={form.contributingFactorCode}
                onChange={(e) => setForm((p) => ({ ...p, contributingFactorCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Contributing factor</option>
                {CONTRIBUTING_FACTOR.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
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
            File Report
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
        <p className="text-sm text-muted-foreground">No incident reports filed yet.</p>
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
                <select
                  value={r.status}
                  onChange={(e) => updateStatus(r.clinicalIncidentReportId, e.target.value)}
                  className="h-8 text-xs"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
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
