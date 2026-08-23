"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { StaffExposureService } from "@/services/staffExposure.service";
import { UserService } from "@/services/user.service";
import { DepartmentSerivce } from "@/services/department.service";
import { StaffExposureCreatePayload, StaffExposureType } from "@/types/staffExposure.type";
import { DepartmentTypes } from "@/types/department.type";

interface StaffOption {
  id: string;
  name: string;
}

const EXPOSURE_TYPE = [
  { code: "1", label: "Percutaneous injury" },
  { code: "2", label: "Mucous membrane exposure" },
  { code: "3", label: "Skin" },
  { code: "4", label: "Bite" },
];

const BODY_SITE = [
  { code: "1", label: "Hand/finger" },
  { code: "2", label: "Eye" },
  { code: "3", label: "Arm" },
  { code: "4", label: "Leg" },
  { code: "5", label: "Foot" },
  { code: "6", label: "Mouth" },
  { code: "7", label: "Nose" },
  { code: "8", label: "Other" },
];

const OBJECT_CAUSING_INJURY = [
  { code: "1", label: "Needle" },
  { code: "2", label: "Surgical instrument or other sharp item" },
  { code: "3", label: "Glass" },
];

const INJURY_TYPE = [
  { code: "1", label: "Superficial" },
  { code: "2", label: "Moderate" },
  { code: "3", label: "Severe" },
];

const BLOOD_AMOUNT = [
  { code: "1", label: "Small" },
  { code: "2", label: "Moderate" },
  { code: "3", label: "Large" },
  { code: "4", label: "Unknown" },
];

const WOUND_DESCRIPTION = [
  { code: "1", label: "No spontaneous bleeding" },
  { code: "2", label: "Spontaneous bleeding" },
  { code: "3", label: "Tissue avulsed" },
  { code: "4", label: "Unknown" },
];

const STATUS_OPTIONS = ["Open", "UnderInvestigation", "Closed"];

const emptyForm = {
  exposedStaffUserId: "",
  isTempAgencyStaff: false,
  position: "",
  homeDepartmentId: "",
  hoursOnDutyAtExposure: "",
  eventDateTime: "",
  exposureTypeCode: "",
  fluidTissueTypeCode: "",
  exposureLocationCode: "",
  bodySiteCode: "",
  bodySiteOtherText: "",
  objectCausingInjuryCode: "",
  objectCausingInjuryDetailText: "",
  injuryDescriptionText: "",
  injuryTypeCode: "",
  bloodExposureAmountCode: "",
  activityCode: "",
  barriersUsedCode: "",
  woundDescriptionCode: "",
  biteActivityCode: "",
  notes: "",
};

export default function StaffExposurePage() {
  const [incidents, setIncidents] = useState<StaffExposureType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await StaffExposureService.getAll();
      setIncidents(res.data ?? []);
    } catch {
      toast.error("Failed to load staff exposure incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    UserService.getAll().then((res) => {
      const users = res.data ?? [];
      setStaff(users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
    }).catch(() => {});
    DepartmentSerivce.getAll().then((data) => setDepartments(data || [])).catch(() => {});
  }, []);

  const exposureType = form.exposureTypeCode;

  const submitReport = async () => {
    if (!form.eventDateTime) {
      toast.error("Event date/time is required");
      return;
    }
    const payload: StaffExposureCreatePayload = {
      exposedStaffUserId: form.exposedStaffUserId || undefined,
      isTempAgencyStaff: form.isTempAgencyStaff,
      position: form.position || undefined,
      homeDepartmentId: form.homeDepartmentId || undefined,
      hoursOnDutyAtExposure: form.hoursOnDutyAtExposure ? Number(form.hoursOnDutyAtExposure) : undefined,
      eventDateTime: form.eventDateTime,
      exposureTypeCode: form.exposureTypeCode || undefined,
      fluidTissueTypeCode: form.fluidTissueTypeCode || undefined,
      exposureLocationCode: form.exposureLocationCode || undefined,
      bodySiteCode: form.bodySiteCode || undefined,
      bodySiteOtherText: form.bodySiteCode === "8" ? form.bodySiteOtherText || undefined : undefined,
      notes: form.notes || undefined,
    };

    if (exposureType === "1") {
      payload.objectCausingInjuryCode = form.objectCausingInjuryCode || undefined;
      payload.objectCausingInjuryDetailText = form.objectCausingInjuryDetailText || undefined;
      payload.injuryDescriptionText = form.injuryDescriptionText || undefined;
      payload.injuryTypeCode = form.injuryTypeCode || undefined;
    } else if (exposureType === "2" || exposureType === "3") {
      payload.bloodExposureAmountCode = form.bloodExposureAmountCode || undefined;
      payload.activityCode = form.activityCode || undefined;
      payload.barriersUsedCode = form.barriersUsedCode || undefined;
      payload.woundDescriptionCode = form.woundDescriptionCode || undefined;
    } else if (exposureType === "4") {
      payload.biteActivityCode = form.biteActivityCode || undefined;
    }

    try {
      setIsSaving(true);
      await StaffExposureService.create(payload);
      toast.success("Exposure incident reported");
      setForm(emptyForm);
      setShowForm(false);
      await fetchIncidents();
    } catch {
      toast.error("Failed to report exposure incident");
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await StaffExposureService.update(id, { status });
      toast.success("Status updated");
      await fetchIncidents();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const staffOptions = useMemo(() => staff, [staff]);

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <ShieldAlert className="text-primary" /> Staff Exposure
          </h1>
          <p className="text-sm text-muted-foreground">
            Blood/body-fluid staff exposure incidents — feeds the PL4.2 KPI report.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Report Exposure"}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.exposedStaffUserId}
              onChange={(e) => setForm((p) => ({ ...p, exposedStaffUserId: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Exposed staff member</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={form.eventDateTime}
              onChange={(e) => setForm((p) => ({ ...p, eventDateTime: e.target.value }))}
              className="h-10 text-sm"
            />
            <input
              type="text"
              placeholder="Position"
              value={form.position}
              onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
              className="h-10 text-sm"
            />
            <select
              value={form.homeDepartmentId}
              onChange={(e) => setForm((p) => ({ ...p, homeDepartmentId: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Home department</option>
              {departments.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.5"
              placeholder="Hours on duty at exposure"
              value={form.hoursOnDutyAtExposure}
              onChange={(e) => setForm((p) => ({ ...p, hoursOnDutyAtExposure: e.target.value }))}
              className="h-10 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isTempAgencyStaff}
                onChange={(e) => setForm((p) => ({ ...p, isTempAgencyStaff: e.target.checked }))}
              />
              Temp/agency staff
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.exposureTypeCode}
              onChange={(e) => setForm((p) => ({ ...p, exposureTypeCode: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Type of exposure</option>
              {EXPOSURE_TYPE.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
            <select
              value={form.bodySiteCode}
              onChange={(e) => setForm((p) => ({ ...p, bodySiteCode: e.target.value }))}
              className="h-10 text-sm"
            >
              <option value="">Body site of exposure</option>
              {BODY_SITE.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
            {form.bodySiteCode === "8" && (
              <input
                type="text"
                placeholder="Specify other body site"
                value={form.bodySiteOtherText}
                onChange={(e) => setForm((p) => ({ ...p, bodySiteOtherText: e.target.value }))}
                className="h-10 text-sm"
              />
            )}
            <input
              type="text"
              placeholder="Type of fluid/tissue involved"
              value={form.fluidTissueTypeCode}
              onChange={(e) => setForm((p) => ({ ...p, fluidTissueTypeCode: e.target.value }))}
              className="h-10 text-sm"
            />
            <input
              type="text"
              placeholder="Where did the exposure occur?"
              value={form.exposureLocationCode}
              onChange={(e) => setForm((p) => ({ ...p, exposureLocationCode: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>

          {exposureType === "1" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3">
              <select
                value={form.objectCausingInjuryCode}
                onChange={(e) => setForm((p) => ({ ...p, objectCausingInjuryCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Object causing injury</option>
                {OBJECT_CAUSING_INJURY.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <select
                value={form.injuryTypeCode}
                onChange={(e) => setForm((p) => ({ ...p, injuryTypeCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Type of injury</option>
                {INJURY_TYPE.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Object detail (specific mechanism)"
                value={form.objectCausingInjuryDetailText}
                onChange={(e) => setForm((p) => ({ ...p, objectCausingInjuryDetailText: e.target.value }))}
                className="h-10 text-sm sm:col-span-2"
              />
              <textarea
                placeholder="Description of injury event"
                value={form.injuryDescriptionText}
                onChange={(e) => setForm((p) => ({ ...p, injuryDescriptionText: e.target.value }))}
                className="w-full min-h-16 text-sm sm:col-span-2"
              />
            </div>
          )}

          {(exposureType === "2" || exposureType === "3") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3">
              <select
                value={form.bloodExposureAmountCode}
                onChange={(e) => setForm((p) => ({ ...p, bloodExposureAmountCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Estimated blood/fluid exposure amount</option>
                {BLOOD_AMOUNT.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <select
                value={form.woundDescriptionCode}
                onChange={(e) => setForm((p) => ({ ...p, woundDescriptionCode: e.target.value }))}
                className="h-10 text-sm"
              >
                <option value="">Wound description</option>
                {WOUND_DESCRIPTION.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Activity/event when exposure occurred"
                value={form.activityCode}
                onChange={(e) => setForm((p) => ({ ...p, activityCode: e.target.value }))}
                className="h-10 text-sm"
              />
              <input
                type="text"
                placeholder="Barriers used at time of exposure"
                value={form.barriersUsedCode}
                onChange={(e) => setForm((p) => ({ ...p, barriersUsedCode: e.target.value }))}
                className="h-10 text-sm"
              />
            </div>
          )}

          {exposureType === "4" && (
            <div className="rounded-lg bg-muted/30 p-3">
              <input
                type="text"
                placeholder="Activity/event when bite occurred"
                value={form.biteActivityCode}
                onChange={(e) => setForm((p) => ({ ...p, biteActivityCode: e.target.value }))}
                className="h-10 text-sm w-full"
              />
            </div>
          )}

          <textarea
            placeholder="Investigation notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            className="w-full min-h-16 text-sm"
          />

          <button
            onClick={submitReport}
            disabled={isSaving}
            className="self-start flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Report Exposure
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exposure incidents reported yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {incidents.map((i) => (
            <div key={i.staffExposureIncidentId} className="card p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {i.exposedStaffName || "Unknown staff member"}
                  </span>
                  {i.homeDepartmentName && <span className="text-xs text-muted-foreground">· {i.homeDepartmentName}</span>}
                </div>
                <select
                  value={i.status}
                  onChange={(e) => updateStatus(i.staffExposureIncidentId, e.target.value)}
                  className="h-8 text-xs"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Event: {new Date(i.eventDateTime).toLocaleString()} · Reported: {new Date(i.reportedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
