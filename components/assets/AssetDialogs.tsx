"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MapPin, Pencil, Play, Printer, Save, Trash2, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import DatePicker from "@/components/DatePicker";
import SearchableSelect, { fieldSelectClass } from "@/components/SearchableSelect";
import { AssetsService } from "@/services/assets.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/currency";
import type { Asset, AssetDetail as AssetDetailData, AssetCategory, SaveAssetPayload, WorkOrderDetail as WorkOrderDetailData, WorkOrderKind } from "@/types/assets.type";
import type { PatientUseItem } from "@/types/inventory.type";
import BarcodeLabels from "@/components/inventory/BarcodeLabels";
import { StoreItemSearch } from "@/components/inventory/PatientItemsUsed";
import {
  Facts,
  Field,
  Modal,
  ReasonPrompt,
  dangerButton,
  dateInputClass,
  day,
  inputClass,
  primaryButton,
  qty,
  secondaryButton,
  smallInputClass,
  stamp,
  todayInput,
} from "@/components/inventory/inventoryUi";
import { CATEGORY_LABELS, DueText, KIND_LABELS, StatusBadge, useAssets } from "./assetsUi";

const textareaClass = "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm";
const none = (label = "None") => [{ value: "", label }];

// ---------------- register / edit ----------------

const emptyAsset = (): SaveAssetPayload => ({
  assetTag: "",
  name: "",
  category: "MedicalEquipment",
  make: null,
  model: null,
  serialNumber: null,
  branchId: null,
  departmentId: null,
  location: null,
  custodianUserId: null,
  status: "InUse",
  vendorId: null,
  purchaseDate: null,
  purchaseCost: 0,
  invoiceNumber: null,
  usefulLifeYears: null,
  salvageValue: 0,
  warrantyEndDate: null,
  serviceVendorId: null,
  warrantyTerms: null,
  maintenanceIntervalDays: null,
  nextMaintenanceDue: null,
  requiresCalibration: false,
  calibrationIntervalDays: null,
  nextCalibrationDue: null,
  notes: null,
});

export function AssetForm({ asset, onClose, onSaved }: { asset: Asset | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { lookups } = useAssets();
  const [form, setForm] = useState<SaveAssetPayload>(() => (asset ? { ...emptyAsset(), ...asset, status: undefined } : emptyAsset()));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SaveAssetPayload>(key: K, value: SaveAssetPayload[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (v: string) => (v.trim() === "" ? null : v);
  const whole = (v: string) => (v === "" ? null : Math.max(0, Math.round(Number(v))));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = asset ? await AssetsService.updateAsset(asset.assetId, form) : await AssetsService.createAsset(form);
      toast.success(res.message ?? "Saved");
      onSaved(res.data.asset.assetId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save the asset"));
    } finally {
      setSaving(false);
    }
  };

  const vendors = [...none(), ...(lookups?.vendors ?? []).map((v) => ({ value: v.vendorId, label: v.name }))];
  return (
    <Modal
      title={asset ? `Edit ${asset.name}` : "Register an asset"}
      subtitle={asset ? asset.assetTag : "Leave the tag empty to number it automatically."}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form="asset-form" disabled={saving} className={primaryButton}>
            <Save size={15} /> {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="asset-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="What it is" required className="sm:col-span-2">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} placeholder="e.g. ECG machine" className={inputClass} />
        </Field>
        <Field label="Asset tag">
          <input value={form.assetTag} onChange={(e) => set("assetTag", e.target.value)} maxLength={50} placeholder="Automatic" className={inputClass} />
        </Field>
        <Field label="Category" required>
          <SearchableSelect value={form.category} onChange={(v) => set("category", v as AssetCategory)} options={(lookups?.categories ?? []).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Make">
          <input value={form.make ?? ""} onChange={(e) => set("make", text(e.target.value))} maxLength={100} className={inputClass} />
        </Field>
        <Field label="Model">
          <input value={form.model ?? ""} onChange={(e) => set("model", text(e.target.value))} maxLength={100} className={inputClass} />
        </Field>
        <Field label="Serial number">
          <input value={form.serialNumber ?? ""} onChange={(e) => set("serialNumber", text(e.target.value))} maxLength={100} className={inputClass} />
        </Field>
        {!asset && (
          <Field label="Status">
            <SearchableSelect value={form.status ?? "InUse"} onChange={(v) => set("status", v as SaveAssetPayload["status"])} options={[{ value: "InUse", label: "In use" }, { value: "InStore", label: "In store (not deployed)" }]} className={fieldSelectClass} preserveCase />
          </Field>
        )}

        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:col-span-2 lg:col-span-3">Where it is</p>
        <Field label="Department">
          <SearchableSelect value={form.departmentId ?? ""} onChange={(v) => set("departmentId", v || null)} options={[...none(), ...(lookups?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.name }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Room / place">
          <input value={form.location ?? ""} onChange={(e) => set("location", text(e.target.value))} maxLength={200} placeholder="e.g. Room 4" className={inputClass} />
        </Field>
        <Field label="Looked after by">
          <SearchableSelect value={form.custodianUserId ?? ""} onChange={(v) => set("custodianUserId", v || null)} options={[...none("Nobody"), ...(lookups?.staff ?? []).map((u) => ({ value: u.userId, label: `${u.name} (${u.role})` }))]} className={fieldSelectClass} preserveCase />
        </Field>
        {(lookups?.branches.length ?? 0) > 1 && (
          <Field label="Branch">
            <SearchableSelect value={form.branchId ?? ""} onChange={(v) => set("branchId", v || null)} options={[...none("—"), ...(lookups?.branches ?? []).map((b) => ({ value: b.branchId, label: b.name }))]} className={fieldSelectClass} preserveCase />
          </Field>
        )}

        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:col-span-2 lg:col-span-3">Purchase and value</p>
        <Field label="Bought from">
          <SearchableSelect value={form.vendorId ?? ""} onChange={(v) => set("vendorId", v || null)} options={vendors} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Bought on">
          <DatePicker value={form.purchaseDate ?? ""} onChange={(v) => set("purchaseDate", v || null)} max={todayInput()} className={dateInputClass} />
        </Field>
        <Field label="Invoice number">
          <input value={form.invoiceNumber ?? ""} onChange={(e) => set("invoiceNumber", text(e.target.value))} maxLength={100} className={inputClass} />
        </Field>
        <Field label="Cost">
          <input type="number" min={0} step="any" value={form.purchaseCost} onChange={(e) => set("purchaseCost", Number(e.target.value) || 0)} className={inputClass} />
        </Field>
        <Field label="Useful life (years)" hint="Its value goes down evenly over this. Empty = not depreciated.">
          <input type="number" min={1} max={100} value={form.usefulLifeYears ?? ""} onChange={(e) => set("usefulLifeYears", whole(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Worth at the end">
          <input type="number" min={0} step="any" value={form.salvageValue} onChange={(e) => set("salvageValue", Number(e.target.value) || 0)} className={inputClass} />
        </Field>

        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:col-span-2 lg:col-span-3">Warranty and servicing</p>
        <Field label="Warranty / contract ends">
          <DatePicker value={form.warrantyEndDate ?? ""} onChange={(v) => set("warrantyEndDate", v || null)} className={dateInputClass} />
        </Field>
        <Field label="Serviced by">
          <SearchableSelect value={form.serviceVendorId ?? ""} onChange={(v) => set("serviceVendorId", v || null)} options={vendors} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="What it covers">
          <input value={form.warrantyTerms ?? ""} onChange={(e) => set("warrantyTerms", text(e.target.value))} maxLength={1000} placeholder="e.g. Parts and labour" className={inputClass} />
        </Field>
        <Field label="Service every (days)" hint="Empty = no regular servicing.">
          <input type="number" min={1} max={3650} value={form.maintenanceIntervalDays ?? ""} onChange={(e) => set("maintenanceIntervalDays", whole(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Next servicing due" hint="Empty = one interval from today.">
          <DatePicker value={form.nextMaintenanceDue ?? ""} onChange={(v) => set("nextMaintenanceDue", v || null)} className={dateInputClass} />
        </Field>
        <div />
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2 lg:col-span-3">
          <input type="checkbox" checked={form.requiresCalibration} onChange={(e) => set("requiresCalibration", e.target.checked)} className="h-4 w-4" />
          Needs regular calibration (e.g. monitors, scales, analysers)
        </label>
        {form.requiresCalibration && (
          <>
            <Field label="Calibrate every (days)">
              <input type="number" min={1} max={3650} value={form.calibrationIntervalDays ?? ""} onChange={(e) => set("calibrationIntervalDays", whole(e.target.value))} className={inputClass} />
            </Field>
            <Field label="Next calibration due" hint="Empty = one interval from today.">
              <DatePicker value={form.nextCalibrationDue ?? ""} onChange={(v) => set("nextCalibrationDue", v || null)} className={dateInputClass} />
            </Field>
            <div />
          </>
        )}
        <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
          <textarea value={form.notes ?? ""} onChange={(e) => set("notes", text(e.target.value))} rows={2} maxLength={2000} className={textareaClass} />
        </Field>
      </form>
    </Modal>
  );
}

// ---------------- move ----------------

function MoveDialog({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const { lookups } = useAssets();
  const [departmentId, setDepartmentId] = useState(asset.departmentId ?? "");
  const [location, setLocation] = useState(asset.location ?? "");
  const [custodian, setCustodian] = useState(asset.custodianUserId ?? "");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await AssetsService.moveAsset(asset.assetId, {
        branchId: asset.branchId,
        departmentId: departmentId || null,
        location: location.trim() || null,
        custodianUserId: custodian || null,
        status: status || null,
        note: note.trim() || null,
      });
      toast.success(res.message ?? "Saved");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`Move ${asset.name}`}
      subtitle="Where it is now and who looks after it."
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <Save size={15} /> Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Department">
          <SearchableSelect value={departmentId} onChange={setDepartmentId} options={[...none(), ...(lookups?.departments ?? []).map((d) => ({ value: d.departmentId, label: d.name }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Room / place">
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} className={inputClass} />
        </Field>
        <Field label="Looked after by">
          <SearchableSelect value={custodian} onChange={setCustodian} options={[...none("Nobody"), ...(lookups?.staff ?? []).map((u) => ({ value: u.userId, label: `${u.name} (${u.role})` }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Status">
          <SearchableSelect
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: "Unchanged" }, { value: "InUse", label: "In use" }, { value: "InStore", label: "In store" }, { value: "OutOfService", label: "Out of service" }]}
            className={fieldSelectClass}
            preserveCase
          />
        </Field>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------- fault report ----------------

export function FaultDialog({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const [problem, setProblem] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [outOfService, setOutOfService] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!problem.trim()) return toast.error("Describe the fault");
    setSaving(true);
    try {
      const res = await AssetsService.reportFault(asset.assetId, { problem: problem.trim(), priority: urgent ? "Urgent" : "Normal", outOfService });
      toast.success(res.message ?? "Reported");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't report the fault"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`Report a fault: ${asset.name}`}
      subtitle={`${asset.assetTag} - the maintenance team gets a repair job.`}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <AlertTriangle size={15} /> Report
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="What's wrong" required>
          <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} maxLength={2000} autoFocus className={textareaClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-4 w-4" /> Urgent - patient care is affected
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={outOfService} onChange={(e) => setOutOfService(e.target.checked)} className="h-4 w-4" /> Stop using it until it&apos;s fixed
        </label>
      </div>
    </Modal>
  );
}

// ---------------- dispose ----------------

function DisposeDialog({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const { lookups } = useAssets();
  const [method, setMethod] = useState("Scrapped");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [on, setOn] = useState(todayInput());
  const [saving, setSaving] = useState(false);
  const labels: Record<string, string> = { Sold: "Sold", Scrapped: "Scrapped", Donated: "Donated", ReturnedToSupplier: "Returned to supplier" };
  const save = async () => {
    if (!reason.trim()) return toast.error("Give the reason");
    setSaving(true);
    try {
      const res = await AssetsService.disposeAsset(asset.assetId, { method, value: value === "" ? null : Number(value), reason: reason.trim(), disposedOn: on || null });
      toast.success(res.message ?? "Disposed of");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't dispose of it"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`Dispose of ${asset.name}`}
      subtitle={`${asset.assetTag} · book value ${formatCurrency(asset.bookValue)}. It leaves the register; its history stays.`}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={dangerButton}>
            <Trash2 size={15} /> Dispose of it
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="How" required>
          <SearchableSelect value={method} onChange={setMethod} options={(lookups?.disposalMethods ?? []).map((m) => ({ value: m, label: labels[m] ?? m }))} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="When">
          <DatePicker value={on} onChange={setOn} max={todayInput()} className={dateInputClass} />
        </Field>
        <Field label="Received for it">
          <input type="number" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className={inputClass} />
        </Field>
        <Field label="Why" required className="sm:col-span-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className={textareaClass} />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------- raise a work order ----------------

export function WorkOrderForm({ asset, kind: initialKind, onClose, onSaved }: { asset: Asset; kind?: WorkOrderKind; onClose: () => void; onSaved: (id: string) => void }) {
  const { lookups } = useAssets();
  const [kind, setKind] = useState<WorkOrderKind>(initialKind ?? "Repair");
  const [urgent, setUrgent] = useState(false);
  const [problem, setProblem] = useState("");
  const [scheduledFor, setScheduledFor] = useState(
    initialKind === "Preventive" ? asset.nextMaintenanceDue ?? "" : initialKind === "Calibration" ? asset.nextCalibrationDue ?? "" : ""
  );
  const [assignedTo, setAssignedTo] = useState("");
  const [vendorId, setVendorId] = useState(initialKind && initialKind !== "Repair" && asset.underWarranty ? asset.serviceVendorId ?? "" : "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (kind === "Repair" && !problem.trim()) return toast.error("Describe the fault");
    setSaving(true);
    try {
      const res = await AssetsService.createWorkOrder({
        assetId: asset.assetId,
        kind,
        priority: urgent ? "Urgent" : "Normal",
        problem: problem.trim(),
        scheduledFor: scheduledFor || null,
        assignedToUserId: assignedTo || null,
        vendorId: vendorId || null,
      });
      toast.success(res.message ?? "Raised");
      onSaved(res.data.workOrder.workOrderId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't raise the work order"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={`New work order: ${asset.name}`}
      subtitle={`${asset.assetTag}${asset.underWarranty ? ` · under warranty until ${day(asset.warrantyEndDate)}${asset.serviceVendorName ? ` (${asset.serviceVendorName})` : ""}` : ""}`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className={primaryButton}>
            <Wrench size={15} /> Raise
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Kind" required>
          <SearchableSelect value={kind} onChange={(v) => setKind(v as WorkOrderKind)} options={(lookups?.workOrderKinds ?? []).map((k) => ({ value: k, label: KIND_LABELS[k] }))} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Planned for">
          <DatePicker value={scheduledFor} onChange={setScheduledFor} className={dateInputClass} />
        </Field>
        <Field label={kind === "Repair" ? "What's wrong" : "What's to be done"} required={kind === "Repair"} className="sm:col-span-2">
          <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} maxLength={2000} placeholder={kind === "Repair" ? "" : `Scheduled ${KIND_LABELS[kind].toLowerCase()}`} className={textareaClass} />
        </Field>
        <Field label="Done by (staff)">
          <SearchableSelect value={assignedTo} onChange={setAssignedTo} options={[...none("Not assigned"), ...(lookups?.staff ?? []).map((u) => ({ value: u.userId, label: `${u.name} (${u.role})` }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <Field label="Or an outside company">
          <SearchableSelect value={vendorId} onChange={setVendorId} options={[...none(), ...(lookups?.vendors ?? []).map((v) => ({ value: v.vendorId, label: v.name }))]} className={fieldSelectClass} preserveCase />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-4 w-4" /> Urgent
        </label>
      </div>
    </Modal>
  );
}

// ---------------- work order ----------------

export function WorkOrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { lookups } = useAssets();
  const [data, setData] = useState<WorkOrderDetailData | null>(null);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workDone, setWorkDone] = useState("");
  const [outcome, setOutcome] = useState("");
  const [certificate, setCertificate] = useState("");
  const [cost, setCost] = useState("");
  const [completedOn, setCompletedOn] = useState(todayInput());
  const [storeId, setStoreId] = useState("");
  const [parts, setParts] = useState<{ item: PatientUseItem; quantity: string }[]>([]);

  const load = useCallback(() => {
    AssetsService.workOrder(id).then((r) => setData(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the work order")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!storeId && lookups?.partsStores.length) setStoreId(lookups.partsStores[0].storeId);
  }, [lookups, storeId]);
  if (!data) return null;
  const wo = data.workOrder;
  const active = wo.status === "Open" || wo.status === "InProgress";
  const isCalibration = wo.kind === "Calibration";

  const run = async (action: () => Promise<{ message?: string }>) => {
    setBusy(true);
    try {
      const res = await action();
      toast.success(res.message ?? "Saved");
      setCompleting(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };

  const complete = () => {
    if (!workDone.trim()) return toast.error("Describe the work done");
    if (!outcome) return toast.error(isCalibration ? "Did it pass?" : "Is it working now?");
    return run(() =>
      AssetsService.completeWorkOrder(wo.workOrderId, {
        workDone: workDone.trim(),
        outcome,
        certificateNumber: certificate.trim() || null,
        serviceCost: Number(cost) || 0,
        completedOn: completedOn || null,
        partsStoreId: parts.length ? storeId : null,
        parts: parts.map((p) => ({ itemId: p.item.itemId, quantity: Number(p.quantity) || 0 })),
      })
    );
  };

  return (
    <Modal
      title={`${wo.number} · ${KIND_LABELS[wo.kind]}`}
      subtitle={`${wo.assetTag} ${wo.assetName}${wo.departmentName ? ` · ${wo.departmentName}` : ""}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        active &&
        !completing && (
          <>
            <button type="button" onClick={() => setCancelling(true)} className={`${dangerButton} mr-auto`}>
              <XCircle size={15} /> Cancel
            </button>
            {wo.status === "Open" && (
              <button type="button" onClick={() => run(() => AssetsService.startWorkOrder(wo.workOrderId))} disabled={busy} className={secondaryButton}>
                <Play size={15} /> Start
              </button>
            )}
            <button type="button" onClick={() => setCompleting(true)} className={primaryButton}>
              <CheckCircle2 size={15} /> Complete
            </button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={wo.status} />
          {wo.priority === "Urgent" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">Urgent</span>}
        </div>
        <p className="text-sm text-foreground">{wo.problem}</p>
        <Facts
          items={[
            { label: "Raised by", value: `${wo.reportedByName ?? "—"} · ${stamp(wo.createdAt)}` },
            { label: "Planned for", value: day(wo.scheduledFor) },
            { label: "Done by", value: wo.assignedToName ?? wo.vendorName ?? "—" },
            { label: "Started", value: stamp(wo.startedAt) },
          ]}
        />
        {wo.status === "Completed" && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <p className="font-semibold text-foreground">
              {wo.outcome === "Pass" ? "Passed" : wo.outcome === "Fail" ? "Failed" : wo.outcome === "NotWorking" ? "Still not working" : "Working"} · {wo.completedByName} · {stamp(wo.completedAt)}
            </p>
            <p className="text-foreground">{wo.workDone}</p>
            {wo.certificateNumber && <p className="text-muted-foreground">Certificate {wo.certificateNumber}</p>}
            <p className="text-muted-foreground">
              Service {formatCurrency(wo.serviceCost)} + parts {formatCurrency(wo.partsCost)} = <span className="font-semibold text-foreground">{formatCurrency(wo.totalCost)}</span>
            </p>
            {data.parts && (
              <ul className="text-xs text-muted-foreground">
                {data.parts.lines.map((l, i) => (
                  <li key={i}>
                    {l.itemName} × {qty(l.quantity)} {l.unit} ({formatCurrency(l.value)}){l.returnedQuantity > 0 ? `, ${qty(l.returnedQuantity)} handed back` : ""} - {data.parts!.storeName}, {data.parts!.number}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {wo.status === "Cancelled" && <p className="text-sm text-muted-foreground">Cancelled: {wo.cancelReason}</p>}

        {completing && (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <Field label="Findings and work done" required>
              <textarea value={workDone} onChange={(e) => setWorkDone(e.target.value)} rows={3} maxLength={2000} autoFocus className={textareaClass} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={isCalibration ? "Result" : "Is it working?"} required>
                <SearchableSelect
                  value={outcome}
                  onChange={setOutcome}
                  options={isCalibration ? [{ value: "Pass", label: "Passed" }, { value: "Fail", label: "Failed - stop using it" }] : [{ value: "Working", label: "Yes - back in use" }, { value: "NotWorking", label: "No - out of service" }]}
                  placeholder="Choose…"
                  className={fieldSelectClass}
                  preserveCase
                />
              </Field>
              <Field label="Service cost">
                <input type="number" min={0} step="any" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={inputClass} />
              </Field>
              <Field label="Finished on">
                <DatePicker value={completedOn} onChange={setCompletedOn} max={todayInput()} className={dateInputClass} />
              </Field>
              {isCalibration && (
                <Field label="Certificate number">
                  <input value={certificate} onChange={(e) => setCertificate(e.target.value)} maxLength={100} className={inputClass} />
                </Field>
              )}
            </div>
            {(lookups?.partsStores.length ?? 0) > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Spare parts used (taken from the store)</p>
                {(lookups?.partsStores.length ?? 0) > 1 && (
                  <SearchableSelect
                    value={storeId}
                    onChange={(v) => {
                      setStoreId(v);
                      setParts([]);
                    }}
                    options={(lookups?.partsStores ?? []).map((s) => ({ value: s.storeId, label: s.name }))}
                    className={fieldSelectClass}
                    preserveCase
                  />
                )}
                {storeId && (
                  <StoreItemSearch
                    storeId={storeId}
                    fetchItems={AssetsService.parts}
                    onPick={(item) => (parts.some((p) => p.item.itemId === item.itemId) ? toast.info(`${item.name} is already listed`) : setParts((ps) => [...ps, { item, quantity: "1" }]))}
                  />
                )}
                {parts.map((p) => (
                  <div key={p.item.itemId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-foreground">
                      {p.item.name} <span className="text-xs text-muted-foreground">({qty(p.item.quantity)} in store)</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={p.item.quantity}
                      step="any"
                      value={p.quantity}
                      onChange={(e) => setParts((ps) => ps.map((x) => (x.item.itemId === p.item.itemId ? { ...x, quantity: e.target.value } : x)))}
                      aria-label={`How many ${p.item.name}`}
                      className={`${smallInputClass} w-24`}
                    />
                    <span className="text-xs text-muted-foreground">{p.item.unit}</span>
                    <button type="button" onClick={() => setParts((ps) => ps.filter((x) => x.item.itemId !== p.item.itemId))} className="rounded p-1 text-muted-foreground hover:text-red-600" aria-label={`Remove ${p.item.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCompleting(false)} className={secondaryButton}>
                Back
              </button>
              <button type="button" onClick={complete} disabled={busy} className={primaryButton}>
                <CheckCircle2 size={15} /> Complete
              </button>
            </div>
          </div>
        )}
      </div>
      {cancelling && (
        <ReasonPrompt
          title={`Cancel ${wo.number}`}
          confirmLabel="Cancel work order"
          danger
          onClose={() => setCancelling(false)}
          onConfirm={async (reason) => {
            await run(() => AssetsService.cancelWorkOrder(wo.workOrderId, reason));
            setCancelling(false);
          }}
        />
      )}
    </Modal>
  );
}

// ---------------- asset ----------------

const EVENT_LABELS: Record<string, string> = {
  Registered: "Registered",
  Updated: "Details updated",
  Moved: "Moved",
  StatusChanged: "Status changed",
  FaultReported: "Fault reported",
  Serviced: "Serviced",
  Calibrated: "Calibrated",
  Repaired: "Repaired",
  Disposed: "Disposed of",
};

export function AssetDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { lookups } = useAssets();
  const [data, setData] = useState<AssetDetailData | null>(null);
  const [dialog, setDialog] = useState<"edit" | "move" | "fault" | "dispose" | "label" | WorkOrderKind | null>(null);
  const [openWorkOrder, setOpenWorkOrder] = useState<string | null>(null);
  const load = useCallback(() => {
    AssetsService.asset(id).then((r) => setData(r.data)).catch((err) => toast.error(apiErrorMessage(err, "Couldn't load the asset")));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useSignalRRefetch(["assetsChanged"], load);
  if (!data) return null;
  const a = data.asset;
  const team = lookups?.isAssetTeam ?? false;
  const disposed = a.status === "Disposed";
  const done = () => {
    setDialog(null);
    load();
  };

  return (
    <Modal
      title={a.name}
      subtitle={[a.assetTag, CATEGORY_LABELS[a.category], [a.make, a.model].filter(Boolean).join(" "), a.serialNumber ? `S/N ${a.serialNumber}` : null].filter(Boolean).join(" · ")}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        !disposed && (
          <>
            {team && lookups?.isAdmin && (
              <button type="button" onClick={() => setDialog("dispose")} className={`${dangerButton} mr-auto`}>
                <Trash2 size={15} /> Dispose of
              </button>
            )}
            {team ? (
              <>
                <button type="button" onClick={() => setDialog("label")} className={secondaryButton}>
                  <Printer size={15} /> Label
                </button>
                <button type="button" onClick={() => setDialog("edit")} className={secondaryButton}>
                  <Pencil size={15} /> Edit
                </button>
                <button type="button" onClick={() => setDialog("move")} className={secondaryButton}>
                  <MapPin size={15} /> Move
                </button>
                <button type="button" onClick={() => setDialog("Repair")} className={primaryButton}>
                  <Wrench size={15} /> New work order
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setDialog("fault")} className={primaryButton}>
                <AlertTriangle size={15} /> Report a fault
              </button>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={a.status} />
          {a.underWarranty && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Under warranty until {day(a.warrantyEndDate)}</span>}
          {a.openWorkOrders > 0 && <span className="text-xs text-muted-foreground">{a.openWorkOrders} open work order{a.openWorkOrders === 1 ? "" : "s"}</span>}
        </div>
        <Facts
          items={[
            { label: "Where", value: [a.departmentName, a.location].filter(Boolean).join(" · ") || "—" },
            { label: "Looked after by", value: a.custodianName ?? "—" },
            { label: "Bought", value: a.purchaseDate ? `${day(a.purchaseDate)}${a.vendorName ? ` · ${a.vendorName}` : ""}` : "—" },
            { label: "Cost / value now", value: `${formatCurrency(a.purchaseCost)} / ${formatCurrency(a.bookValue)}` },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">Servicing</p>
            {a.maintenanceIntervalDays ? (
              <>
                <p className="text-foreground">Every {a.maintenanceIntervalDays} days · last {day(a.lastMaintainedOn)}</p>
                <p>
                  Next {day(a.nextMaintenanceDue)} · <DueText days={a.maintenanceDueInDays} />
                </p>
                {team && !disposed && (
                  <button type="button" onClick={() => setDialog("Preventive")} className="mt-1 text-xs font-semibold text-primary hover:underline">
                    Schedule servicing
                  </button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No regular servicing</p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">Calibration</p>
            {a.requiresCalibration ? (
              <>
                <p className="text-foreground">
                  {a.calibrationIntervalDays ? `Every ${a.calibrationIntervalDays} days` : "Required"} · last {day(a.lastCalibratedOn)}
                </p>
                <p>
                  Next {day(a.nextCalibrationDue)} · <DueText days={a.calibrationDueInDays} />
                </p>
                {team && !disposed && (
                  <button type="button" onClick={() => setDialog("Calibration")} className="mt-1 text-xs font-semibold text-primary hover:underline">
                    Schedule calibration
                  </button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Not needed</p>
            )}
          </div>
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">Warranty / contract</p>
            {a.warrantyEndDate ? (
              <>
                <p className="text-foreground">
                  {a.underWarranty ? "Until" : "Ended"} {day(a.warrantyEndDate)}
                  {a.serviceVendorName ? ` · ${a.serviceVendorName}` : ""}
                </p>
                {a.warrantyTerms && <p className="text-muted-foreground">{a.warrantyTerms}</p>}
              </>
            ) : (
              <p className="text-muted-foreground">None recorded</p>
            )}
          </div>
        </div>
        {disposed && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Disposed of on {day(a.disposedOn)} ({a.disposalMethod}) by {a.disposedByName}: {a.disposalReason}
            {a.disposalValue != null ? ` · received ${formatCurrency(a.disposalValue)}` : ""}
          </p>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Work orders</h3>
          {data.workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <table className="table-compact w-full text-sm">
              <tbody>
                {data.workOrders.map((w) => (
                  <tr key={w.workOrderId} className={team ? "cursor-pointer" : ""} onClick={() => team && setOpenWorkOrder(w.workOrderId)}>
                    <td className="whitespace-nowrap font-medium text-foreground">{w.number}</td>
                    <td>{KIND_LABELS[w.kind]}</td>
                    <td className="max-w-md truncate">{w.problem}</td>
                    <td>
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="whitespace-nowrap text-right text-xs text-muted-foreground">{stamp(w.completedAt ?? w.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">History</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.events.map((e) => (
              <li key={e.eventId} className="flex flex-wrap gap-x-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">{stamp(e.createdAt)}</span>
                <span className="font-medium text-foreground">{EVENT_LABELS[e.eventType] ?? e.eventType}</span>
                <span className="text-muted-foreground">{e.details}</span>
                {e.userName && <span className="text-xs text-muted-foreground">· {e.userName}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {dialog === "edit" && <AssetForm asset={a} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog === "move" && <MoveDialog asset={a} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog === "fault" && <FaultDialog asset={a} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog === "dispose" && <DisposeDialog asset={a} onClose={() => setDialog(null)} onSaved={done} />}
      {(dialog === "Repair" || dialog === "Preventive" || dialog === "Calibration") && (
        <WorkOrderForm
          asset={a}
          kind={dialog}
          onClose={() => setDialog(null)}
          onSaved={(woId) => {
            done();
            setOpenWorkOrder(woId);
          }}
        />
      )}
      {dialog === "label" && (
        <BarcodeLabels
          labels={[{ code: a.assetTag, title: a.name, lines: [a.serialNumber ? `S/N ${a.serialNumber}` : CATEGORY_LABELS[a.category], a.departmentName ?? ""].filter(Boolean) }]}
          onClose={() => setDialog(null)}
        />
      )}
      {openWorkOrder && (
        <WorkOrderDetail
          id={openWorkOrder}
          onClose={() => {
            setOpenWorkOrder(null);
            load();
          }}
        />
      )}
    </Modal>
  );
}
