"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Pill, Plus, X } from "lucide-react";
import CatalogSearchInput from "./CatalogSearchInput";
import DatePicker from "@/components/DatePicker";
import { ConfigListService } from "@/services/configList.service";
import { PharmacyService } from "@/services/pharmacy.service";
import { MedicationPayload, MedicationType, TaperingStepPayload } from "@/types/emr.type";
import { ListItemType } from "@/types/configList.type";
import { MedicineType } from "@/types/pharmacy.type";
import { toDateInputValue } from "@/lib/date";

interface MedicationOrderPanelProps {
  onSubmit: (payload: MedicationPayload) => Promise<boolean>;
  // When set, the panel pre-fills from this order and the parent's onSubmit is expected to
  // call the correction (soft-delete + reinsert) endpoint instead of adding a new one -
  // mirrors how the doctor page's other add-forms double as their own edit form.
  editingMedication?: MedicationType | null;
  onCancelEdit?: () => void;
  // Pre-fills the form from a historical medication but stays in "create new" mode
  // (no correction/update — a fresh prescription is created on submit).
  prefillFromHistory?: MedicationType | null;
  onClearPrefill?: () => void;
}

interface TaperingStepForm {
  dosage: string;
  dosageUnit: string;
  frequency: string;
  durationDays: string;
}

const MEAL_TIMINGS = ["Before Meal", "After Meal", "With Meal", "Empty Stomach"];

const emptyTaperingStep: TaperingStepForm = { dosage: "", dosageUnit: "", frequency: "", durationDays: "" };

// Mirrors EmrController.GenerateMedicationInstructions server-side — this is only a live
// preview for the doctor; the server always regenerates authoritatively on submit.
function buildInstructionsPreview(dosage: string, dosageUnit: string, route: string, frequency: string, durationDays: string) {
  const parts: string[] = [];
  if (dosage) parts.push(`Take ${dosage}${dosageUnit ? ` ${dosageUnit}` : ""}`);
  if (route) parts.push(route.toLowerCase());
  if (frequency) parts.push(frequency);
  if (durationDays) parts.push(`for ${durationDays} day${durationDays === "1" ? "" : "s"}`);
  return parts.length === 0 ? "" : parts.join(", ") + ".";
}

// Inline "Prescribe Medications" panel on the doctor workbench — always in flow next to
// Order Investigation, not a popup. Replaced the old MedicationOrderModal for consistency
// with how investigation ordering already worked.
export default function MedicationOrderPanel({ onSubmit, editingMedication, onCancelEdit, prefillFromHistory, onClearPrefill }: MedicationOrderPanelProps) {
  const [drugName, setDrugName] = useState("");
  const [medicineId, setMedicineId] = useState<string | undefined>(undefined);
  const [drugType, setDrugType] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState("");
  const [frequency, setFrequency] = useState("");
  const [mealTiming, setMealTiming] = useState("");
  const [orderType, setOrderType] = useState("");
  const [route, setRoute] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [instructionsTouched, setInstructionsTouched] = useState(false);
  const [refillCount, setRefillCount] = useState("0");
  const [prnReason, setPrnReason] = useState("");
  const [requiresCounselling, setRequiresCounselling] = useState(false);
  const [taperingSteps, setTaperingSteps] = useState<TaperingStepForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dosageUnits, setDosageUnits] = useState<ListItemType[]>([]);
  const [frequencies, setFrequencies] = useState<ListItemType[]>([]);
  const [orderTypes, setOrderTypes] = useState<ListItemType[]>([]);
  const [routes, setRoutes] = useState<ListItemType[]>([]);
  const [drugTypes, setDrugTypes] = useState<ListItemType[]>([]);

  // Populated on every drug-name search so onSelect can look up the just-picked medicine's
  // discontinued flag synchronously, regardless of React state-update timing - same pattern
  // used for the unified CPT/Procedure search on this same page.
  const medicineResultsRef = useRef<Map<string, MedicineType>>(new Map());

  useEffect(() => {
    (async () => {
      const [dosageRes, freqRes, orderRes, routeRes, drugTypeRes] = await Promise.all([
        ConfigListService.get("DosageUnit").catch(() => ({ data: [] })),
        ConfigListService.get("Frequency").catch(() => ({ data: [] })),
        ConfigListService.get("OrderType").catch(() => ({ data: [] })),
        ConfigListService.get("Route").catch(() => ({ data: [] })),
        ConfigListService.get("DrugType").catch(() => ({ data: [] })),
      ]);
      setDosageUnits(dosageRes.data || []);
      setFrequencies(freqRes.data || []);
      setOrderTypes(orderRes.data || []);
      setRoutes(routeRes.data || []);
      setDrugTypes(drugTypeRes.data || []);
    })();
  }, []);

  const isStat = useMemo(() => orderType.toLowerCase().includes("stat"), [orderType]);

  // Selecting Stat collapses frequency to once daily, matching the server's rule exactly.
  useEffect(() => {
    if (isStat) setFrequency("Once daily");
  }, [isStat]);

  useEffect(() => {
    if (!instructionsTouched) {
      setInstructions(buildInstructionsPreview(dosage, dosageUnit, route, frequency, durationDays));
    }
  }, [dosage, dosageUnit, route, frequency, durationDays, instructionsTouched]);

  // Pre-fill the form when an order is opened for correction. Runs only when the identity
  // of the medication being edited changes (medicationId), not on every re-render, since the
  // parent's summary refetch after a save would otherwise re-run this and stomp on whatever
  // the doctor is mid-typing.
  useEffect(() => {
    if (!editingMedication) return;
    setDrugName(editingMedication.drugName);
    setMedicineId(editingMedication.medicineId ?? undefined);
    setDrugType(editingMedication.drugType ?? "");
    setDosage(editingMedication.dosage ?? "");
    setDosageUnit(editingMedication.dosageUnit ?? "");
    setFrequency(editingMedication.frequency ?? "");
    setMealTiming(editingMedication.mealTiming ?? "");
    setOrderType(editingMedication.orderType ?? "");
    setRoute(editingMedication.route ?? "");
    setDurationDays(editingMedication.durationDays ? String(editingMedication.durationDays) : "");
    setTotalQuantity(editingMedication.totalQuantity ? String(editingMedication.totalQuantity) : "");
    setStartDate(toDateInputValue(new Date(editingMedication.startedAt)));
    setPlannedEndDate(editingMedication.plannedEndDate ? toDateInputValue(new Date(editingMedication.plannedEndDate)) : "");
    setInstructions(editingMedication.instructions ?? "");
    setInstructionsTouched(true);
    setRefillCount(String(editingMedication.refillCount ?? 0));
    setPrnReason(editingMedication.prnReason ?? "");
    setRequiresCounselling(editingMedication.requiresCounselling);
    setTaperingSteps(
      editingMedication.taperingSteps.map((s) => ({
        dosage: s.dosage ?? "",
        dosageUnit: s.dosageUnit ?? "",
        frequency: s.frequency ?? "",
        durationDays: s.durationDays ? String(s.durationDays) : "",
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMedication?.medicationId]);

  // Pre-fill from history without entering edit mode — creates a new prescription.
  useEffect(() => {
    if (!prefillFromHistory) return;
    setDrugName(prefillFromHistory.drugName);
    setMedicineId(prefillFromHistory.medicineId ?? undefined);
    setDrugType(prefillFromHistory.drugType ?? "");
    setDosage(prefillFromHistory.dosage ?? "");
    setDosageUnit(prefillFromHistory.dosageUnit ?? "");
    setFrequency(prefillFromHistory.frequency ?? "");
    setMealTiming(prefillFromHistory.mealTiming ?? "");
    setOrderType(prefillFromHistory.orderType ?? "");
    setRoute(prefillFromHistory.route ?? "");
    setDurationDays(prefillFromHistory.durationDays ? String(prefillFromHistory.durationDays) : "");
    setTotalQuantity(prefillFromHistory.totalQuantity ? String(prefillFromHistory.totalQuantity) : "");
    setStartDate(toDateInputValue(new Date()));
    setPlannedEndDate("");
    setInstructions(prefillFromHistory.instructions ?? "");
    setInstructionsTouched(!!prefillFromHistory.instructions);
    setRefillCount(String(prefillFromHistory.refillCount ?? 0));
    setPrnReason(prefillFromHistory.prnReason ?? "");
    setRequiresCounselling(prefillFromHistory.requiresCounselling);
    setTaperingSteps([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillFromHistory?.medicationId]);

  const resetForm = () => {
    setDrugName("");
    setMedicineId(undefined);
    setDrugType("");
    setDosage("");
    setDosageUnit("");
    setFrequency("");
    setMealTiming("");
    setOrderType("");
    setRoute("");
    setDurationDays("");
    setTotalQuantity("");
    setStartDate(toDateInputValue(new Date()));
    setPlannedEndDate("");
    setInstructions("");
    setInstructionsTouched(false);
    setRefillCount("0");
    setPrnReason("");
    setRequiresCounselling(false);
    setTaperingSteps([]);
  };

  const updateTaperingStep = (index: number, field: keyof TaperingStepForm, value: string) => {
    setTaperingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async () => {
    if (!drugName.trim()) return;
    setIsSubmitting(true);
    try {
      const validTaperingSteps: TaperingStepPayload[] = taperingSteps
        .filter((s) => s.dosage.trim() || s.frequency.trim())
        .map((s, i) => ({
          stepOrder: i + 1,
          dosage: s.dosage || undefined,
          dosageUnit: s.dosageUnit || undefined,
          frequency: s.frequency || undefined,
          durationDays: s.durationDays ? Number(s.durationDays) : undefined,
        }));

      const success = await onSubmit({
        medicineId,
        drugName: drugName.trim(),
        dosage: dosage || undefined,
        dosageUnit: dosageUnit || undefined,
        frequency: frequency || undefined,
        durationDays: durationDays ? Number(durationDays) : undefined,
        orderType: orderType || undefined,
        route: route || undefined,
        instructions: instructions || undefined,
        drugType: drugType || undefined,
        mealTiming: mealTiming || undefined,
        startDate: startDate || undefined,
        plannedEndDate: plannedEndDate || undefined,
        totalQuantity: totalQuantity ? Number(totalQuantity) : undefined,
        refillCount: refillCount ? Number(refillCount) : 0,
        prnReason: prnReason || undefined,
        requiresCounselling,
        taperingSteps: validTaperingSteps.length > 0 ? validTaperingSteps : undefined,
      });
      if (success) resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    onCancelEdit?.();
  };

  return (
    <div className="card p-6 flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Pill size={18} className="text-primary" /> Prescribe Medication
      </h2>

      {prefillFromHistory && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-xs">
          <span className="text-primary font-medium">Pre-filled from history: {prefillFromHistory.drugName}</span>
          <button onClick={onClearPrefill} className="text-primary hover:underline font-semibold">Clear</button>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">Drug name</label>
        {drugName ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium">{drugName}</span>
            <button
              type="button"
              onClick={() => { setDrugName(""); setMedicineId(undefined); }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <CatalogSearchInput
            placeholder="Search medication (trade name, generic name, or code)..."
            fetchOptions={async (search) => {
              if (!search.trim()) return [];
              const res = await PharmacyService.getMedicines({ search: search.trim(), pageSize: 20 });
              const results: MedicineType[] = res.data || [];
              medicineResultsRef.current = new Map(results.map((m) => [m.medicineId, m]));
              return results.map((m) => ({
                id: m.medicineId,
                name: m.name,
                code: m.code,
                meta: [
                  m.genericName ? `Generic: ${m.genericName}` : null,
                  m.manufacturer,
                  m.route,
                  m.isDiscontinued ? "⚠ Discontinued" : m.stock > 0 ? `Stock: ${m.stock}` : "No stock",
                ]
                  .filter(Boolean)
                  .join(" · "),
              }));
            }}
            onSelect={(opt) => {
              setDrugName(opt.name);
              setMedicineId(opt.id);
              const medicine = medicineResultsRef.current.get(opt.id);
              if (medicine?.isDiscontinued) {
                toast.warning("This medication was discontinued by the health authority — confirm before prescribing.");
              }
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Drug type</label>
          <select value={drugType} onChange={(e) => setDrugType(e.target.value)} className="h-10 text-sm">
            <option value="">Select drug type</option>
            {drugTypes.map((d) => (
              <option key={d.listItemId} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Route of administration</label>
          <select value={route} onChange={(e) => setRoute(e.target.value)} className="h-10 text-sm">
            <option value="">Select route</option>
            {routes.map((r) => (
              <option key={r.listItemId} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Dosage</label>
          <input type="text" placeholder="e.g. 500" value={dosage} onChange={(e) => setDosage(e.target.value)} className="h-10 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Dosage unit</label>
          <select value={dosageUnit} onChange={(e) => setDosageUnit(e.target.value)} className="h-10 text-sm">
            <option value="">Select unit</option>
            {dosageUnits.map((u) => (
              <option key={u.listItemId} value={u.name}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Order type</label>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="h-10 text-sm">
            <option value="">Select order type</option>
            {orderTypes.map((o) => (
              <option key={o.listItemId} value={o.name}>{o.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Meal timing</label>
          <select value={mealTiming} onChange={(e) => setMealTiming(e.target.value)} className="h-10 text-sm">
            <option value="">Select timing</option>
            {MEAL_TIMINGS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            disabled={isStat}
            className="h-10 text-sm disabled:opacity-60"
          >
            <option value="">Select frequency</option>
            {frequencies.map((f) => (
              <option key={f.listItemId} value={f.name}>
                {f.name}{f.code ? ` (${f.code})` : ""}
              </option>
            ))}
            {isStat && <option value="Once daily">Once daily</option>}
          </select>
          {isStat && <p className="text-xs text-muted-foreground">Stat orders default to once daily.</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Duration (days)</label>
          <input type="number" min={0} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="h-10 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Start date</label>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Planned end date</label>
          <DatePicker
            value={plannedEndDate}
            onChange={setPlannedEndDate}
            min={startDate}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Total quantity</label>
          <input type="number" min={0} value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} className="h-10 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Refill count</label>
          <input type="number" min={0} value={refillCount} onChange={(e) => setRefillCount(e.target.value)} className="h-10 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">PRN reason</label>
        <input
          type="text"
          placeholder="Why this is given as-needed (optional)"
          value={prnReason}
          onChange={(e) => setPrnReason(e.target.value)}
          className="h-10 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">Instructions</label>
        <textarea
          placeholder="Auto-generated from the fields above — edit if needed"
          value={instructions}
          onChange={(e) => { setInstructions(e.target.value); setInstructionsTouched(true); }}
          className="w-full min-h-16 text-sm"
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-muted-foreground">Medicine counselling required</span>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={requiresCounselling} onChange={() => setRequiresCounselling(true)} /> Yes
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={!requiresCounselling} onChange={() => setRequiresCounselling(false)} /> No
          </label>
        </div>
      </div>

      {/* Tapering dose — optional dose-step schedule for gradually reducing the drug */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border">
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-semibold text-muted-foreground">Tapering schedule (optional)</span>
          <button
            type="button"
            onClick={() => setTaperingSteps((prev) => [...prev, { ...emptyTaperingStep }])}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Plus size={13} /> Add Tapering Dose
          </button>
        </div>
        {taperingSteps.map((step, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
            <div className="flex flex-col gap-1">
              {index === 0 && <label className="text-[11px] text-muted-foreground">Dosage</label>}
              <input
                type="text"
                placeholder="e.g. 5"
                value={step.dosage}
                onChange={(e) => updateTaperingStep(index, "dosage", e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              {index === 0 && <label className="text-[11px] text-muted-foreground">Unit</label>}
              <select value={step.dosageUnit} onChange={(e) => updateTaperingStep(index, "dosageUnit", e.target.value)} className="h-9 text-xs">
                <option value="">Unit</option>
                {dosageUnits.map((u) => (
                  <option key={u.listItemId} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              {index === 0 && <label className="text-[11px] text-muted-foreground">Frequency</label>}
              <select value={step.frequency} onChange={(e) => updateTaperingStep(index, "frequency", e.target.value)} className="h-9 text-xs">
                <option value="">Frequency</option>
                {frequencies.map((f) => (
                  <option key={f.listItemId} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              {index === 0 && <label className="text-[11px] text-muted-foreground">Days</label>}
              <input
                type="number"
                min={0}
                placeholder="Days"
                value={step.durationDays}
                onChange={(e) => updateTaperingStep(index, "durationDays", e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => setTaperingSteps((prev) => prev.filter((_, i) => i !== index))}
              className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
              aria-label="Remove tapering step"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !drugName.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={15} /> {isSubmitting ? (editingMedication ? "Saving correction..." : "Adding order...") : editingMedication ? "Save Correction" : "Add Medicine"}
        </button>
        {editingMedication && (
          <button onClick={handleCancelEdit} className="text-sm font-semibold text-muted-foreground hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
