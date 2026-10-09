"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { Pencil, Plus, RotateCcw, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { StaffExposureService } from "@/services/staffExposure.service";
import { UserService } from "@/services/user.service";
import { DepartmentSerivce } from "@/services/department.service";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { notifySaveStatus } from "@/lib/saveStatus";
import { StaffExposureCreatePayload, StaffExposureType } from "@/types/staffExposure.type";
import { DepartmentTypes } from "@/types/department.type";
import { SearchableSelect } from "@/components/SearchableSelect";

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
  // Set while correcting an existing not-Closed report - reuses the same form as filing a
  // new one, matching every other add-form-doubles-as-edit-form in this feature.
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null);

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
    DepartmentSerivce.getAll().then((data) => setDepartments((data || []).filter((d: DepartmentTypes) => d.isActive))).catch(() => {});
  }, []);

  const exposureType = form.exposureTypeCode;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingIncidentId(null);
  };

  const startEditReport = (i: StaffExposureType) => {
    setForm({
      exposedStaffUserId: i.exposedStaffUserId || "",
      isTempAgencyStaff: i.isTempAgencyStaff,
      position: i.position || "",
      homeDepartmentId: i.homeDepartmentId || "",
      hoursOnDutyAtExposure: i.hoursOnDutyAtExposure != null ? String(i.hoursOnDutyAtExposure) : "",
      eventDateTime: i.eventDateTime ? i.eventDateTime.slice(0, 16) : "",
      exposureTypeCode: i.exposureTypeCode || "",
      fluidTissueTypeCode: i.fluidTissueTypeCode || "",
      exposureLocationCode: i.exposureLocationCode || "",
      bodySiteCode: i.bodySiteCode || "",
      bodySiteOtherText: i.bodySiteOtherText || "",
      objectCausingInjuryCode: i.objectCausingInjuryCode || "",
      objectCausingInjuryDetailText: i.objectCausingInjuryDetailText || "",
      injuryDescriptionText: i.injuryDescriptionText || "",
      injuryTypeCode: i.injuryTypeCode || "",
      bloodExposureAmountCode: i.bloodExposureAmountCode || "",
      activityCode: i.activityCode || "",
      barriersUsedCode: i.barriersUsedCode || "",
      woundDescriptionCode: i.woundDescriptionCode || "",
      biteActivityCode: i.biteActivityCode || "",
      notes: i.notes || "",
    });
    setEditingIncidentId(i.staffExposureIncidentId);
    setShowForm(true);
  };

  const removeReport = (i: StaffExposureType) => {
    confirmDeleteToast(
      <span>Delete this staff exposure report?</span>,
      async () => {
        try {
          await StaffExposureService.remove(i.staffExposureIncidentId);
          toast.success("Exposure report removed");
          await fetchIncidents();
        } catch {
          toast.error("Failed to remove exposure report");
        }
      }
    );
  };

  const reopenReport = async (i: StaffExposureType) => {
    try {
      await StaffExposureService.reopen(i.staffExposureIncidentId);
      toast.success("Report reopened");
      await fetchIncidents();
    } catch {
      toast.error("Failed to reopen report");
    }
  };

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

    notifySaveStatus("saving");
    try {
      setIsSaving(true);
      if (editingIncidentId) {
        await StaffExposureService.update(editingIncidentId, payload);
        toast.success("Exposure report updated");
      } else {
        await StaffExposureService.create(payload);
        toast.success("Exposure incident reported");
      }
      notifySaveStatus("saved");
      resetForm();
      setShowForm(false);
      await fetchIncidents();
    } catch {
      notifySaveStatus("error");
      toast.error(editingIncidentId ? "Failed to update exposure report" : "Failed to report exposure incident");
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    notifySaveStatus("saving");
    try {
      await StaffExposureService.update(id, { status });
      toast.success("Status updated");
      notifySaveStatus("saved");
      await fetchIncidents();
    } catch {
      notifySaveStatus("error");
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
          onClick={() => {
            if (showForm) resetForm();
            setShowForm((v) => !v);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Cancel" : "Report Exposure"}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SearchableSelect
              value={form.exposedStaffUserId}
              onChange={(v) => setForm((p) => ({ ...p, exposedStaffUserId: v }))}
              options={[
                { value: "", label: "Exposed staff member" },
                ...staffOptions.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
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
            <SearchableSelect
              value={form.homeDepartmentId}
              onChange={(v) => setForm((p) => ({ ...p, homeDepartmentId: v }))}
              options={[
                { value: "", label: "Home department" },
                ...departments.map((d) => ({ value: d.departmentId, label: d.name })),
              ]}
            />
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
            <SearchableSelect
              value={form.exposureTypeCode}
              onChange={(v) => setForm((p) => ({ ...p, exposureTypeCode: v }))}
              options={[
                { value: "", label: "Type of exposure" },
                ...EXPOSURE_TYPE.map((o) => ({ value: o.code, label: o.label })),
              ]}
            />
            <SearchableSelect
              value={form.bodySiteCode}
              onChange={(v) => setForm((p) => ({ ...p, bodySiteCode: v }))}
              options={[
                { value: "", label: "Body site of exposure" },
                ...BODY_SITE.map((o) => ({ value: o.code, label: o.label })),
              ]}
            />
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
              <SearchableSelect
                value={form.objectCausingInjuryCode}
                onChange={(v) => setForm((p) => ({ ...p, objectCausingInjuryCode: v }))}
                options={[
                  { value: "", label: "Object causing injury" },
                  ...OBJECT_CAUSING_INJURY.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              <SearchableSelect
                value={form.injuryTypeCode}
                onChange={(v) => setForm((p) => ({ ...p, injuryTypeCode: v }))}
                options={[
                  { value: "", label: "Type of injury" },
                  ...INJURY_TYPE.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
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
              <SearchableSelect
                value={form.bloodExposureAmountCode}
                onChange={(v) => setForm((p) => ({ ...p, bloodExposureAmountCode: v }))}
                options={[
                  { value: "", label: "Estimated blood/fluid exposure amount" },
                  ...BLOOD_AMOUNT.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
              <SearchableSelect
                value={form.woundDescriptionCode}
                onChange={(v) => setForm((p) => ({ ...p, woundDescriptionCode: v }))}
                options={[
                  { value: "", label: "Wound description" },
                  ...WOUND_DESCRIPTION.map((o) => ({ value: o.code, label: o.label })),
                ]}
              />
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
            {editingIncidentId ? "Save Changes" : "Report Exposure"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : incidents.length === 0 ? (
        <EmptyState
          illustration="incident"
          title="No exposure incidents reported yet"
          description="Staff exposure incidents that are reported will be listed here."
        />
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
                <div className="flex items-center gap-1.5">
                  {i.status === "Closed" ? (
                    <button
                      onClick={() => reopenReport(i)}
                      title="Reopen"
                      className="flex items-center gap-1 h-8 px-2 text-xs font-semibold rounded-md border border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <RotateCcw size={12} /> Reopen
                    </button>
                  ) : (
                    <SearchableSelect
                      value={i.status}
                      onChange={(v) => updateStatus(i.staffExposureIncidentId, v)}
                      options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                    />
                  )}
                  {i.status !== "Closed" && (
                    <>
                      <button onClick={() => startEditReport(i)} title="Edit" className="p-1.5 hover:bg-primary/10 rounded-full text-primary">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => removeReport(i)} title="Delete" className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
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
