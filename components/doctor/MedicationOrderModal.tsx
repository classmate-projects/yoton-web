"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import CatalogSearchInput from "./CatalogSearchInput";
import { ConfigListService } from "@/services/configList.service";
import { PharmacyService } from "@/services/pharmacy.service";
import { MedicationPayload } from "@/types/emr.type";
import { ListItemType } from "@/types/configList.type";
import { MedicineType } from "@/types/pharmacy.type";

interface MedicationOrderModalProps {
  onClose: () => void;
  onSubmit: (payload: MedicationPayload) => Promise<void> | void;
}

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

export default function MedicationOrderModal({ onClose, onSubmit }: MedicationOrderModalProps) {
  const [drugName, setDrugName] = useState("");
  const [medicineId, setMedicineId] = useState<string | undefined>(undefined);
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState("");
  const [frequency, setFrequency] = useState("");
  const [orderType, setOrderType] = useState("");
  const [route, setRoute] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [instructions, setInstructions] = useState("");
  const [instructionsTouched, setInstructionsTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [medicines, setMedicines] = useState<MedicineType[]>([]);
  const [dosageUnits, setDosageUnits] = useState<ListItemType[]>([]);
  const [frequencies, setFrequencies] = useState<ListItemType[]>([]);
  const [orderTypes, setOrderTypes] = useState<ListItemType[]>([]);
  const [routes, setRoutes] = useState<ListItemType[]>([]);

  useEffect(() => {
    (async () => {
      const [medsRes, dosageRes, freqRes, orderRes, routeRes] = await Promise.all([
        PharmacyService.getMedicines().catch(() => ({ data: [] })),
        ConfigListService.get("DosageUnit").catch(() => ({ data: [] })),
        ConfigListService.get("Frequency").catch(() => ({ data: [] })),
        ConfigListService.get("OrderType").catch(() => ({ data: [] })),
        ConfigListService.get("Route").catch(() => ({ data: [] })),
      ]);
      setMedicines(medsRes.data || []);
      setDosageUnits(dosageRes.data || []);
      setFrequencies(freqRes.data || []);
      setOrderTypes(orderRes.data || []);
      setRoutes(routeRes.data || []);
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

  const handleSubmit = async () => {
    if (!drugName.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        medicineId,
        drugName: drugName.trim(),
        dosage: dosage || undefined,
        dosageUnit: dosageUnit || undefined,
        frequency: frequency || undefined,
        durationDays: durationDays ? Number(durationDays) : undefined,
        orderType: orderType || undefined,
        route: route || undefined,
        instructions: instructions || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg shadow-2xl border border-border rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">New Medication Order</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
              <X size={20} />
            </button>
          </div>

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
                placeholder="Search medication..."
                fetchOptions={async (search) => {
                  const term = search.trim().toLowerCase();
                  return medicines
                    .filter((m) => !term || m.name.toLowerCase().includes(term))
                    .slice(0, 20)
                    .map((m) => ({ id: m.medicineId, name: m.name }));
                }}
                onSelect={(opt) => { setDrugName(opt.name); setMedicineId(opt.id); }}
              />
            )}
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Instructions</label>
            <textarea
              placeholder="Auto-generated from the fields above — edit if needed"
              value={instructions}
              onChange={(e) => { setInstructions(e.target.value); setInstructionsTouched(true); }}
              className="w-full min-h-16 text-sm"
            />
          </div>
        </div>

        <div className="bg-muted/50 p-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !drugName.trim()}
            className="bg-primary text-primary-foreground px-6 py-2 text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:translate-y-[-1px] disabled:opacity-50"
          >
            Add Order
          </button>
        </div>
      </div>
    </div>
  );
}
