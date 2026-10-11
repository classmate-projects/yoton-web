"use client";

import { useState } from "react";
import { ArrowLeft, FlaskConical, Pill, Plus, Radio, Save, Stethoscope, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { OrderSetItemDto } from "@/types/orderSet.type";
import { saveOrderSetItems } from "@/services/orderSet.service";
import CatalogSearchInput from "@/components/doctor/CatalogSearchInput";
import MedicationOrderPanel from "@/components/doctor/MedicationOrderPanel";
import { ConfigListService } from "@/services/configList.service";
import { MedicationPayload } from "@/types/emr.type";

type Tab = "Diagnosis" | "Medication" | "Lab" | "Radiology" | "Treatment";

interface Props {
  orderSetId: string;
  orderSetName: string;
  initialItems: OrderSetItemDto[];
  onBack: () => void;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "Diagnosis", label: "Diagnosis", icon: <Stethoscope size={14} /> },
  { id: "Medication", label: "Medication", icon: <Pill size={14} /> },
  { id: "Lab", label: "Lab", icon: <FlaskConical size={14} /> },
  { id: "Radiology", label: "Radiology", icon: <Radio size={14} /> },
  { id: "Treatment", label: "Treatment", icon: <Wrench size={14} /> },
];

export default function OrderSetEditor({ orderSetId, orderSetName, initialItems, onBack }: Props) {
  const [items, setItems] = useState<OrderSetItemDto[]>(initialItems);
  const [tab, setTab] = useState<Tab>("Diagnosis");
  const [isSaving, setIsSaving] = useState(false);

  const addItem = (item: Omit<OrderSetItemDto, "orderSetItemId">) => {
    setItems((prev) => [...prev, { orderSetItemId: `tmp-${Date.now()}`, ...item }]);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveOrderSetItems(orderSetId, items);
      toast.success("Order set saved");
      onBack();
    } catch {
      toast.error("Failed to save order set");
    } finally {
      setIsSaving(false);
    }
  };

  const tabItems = items.filter((i) => i.itemType === tab);

  return (
    <div className="flex flex-col h-full min-h-[540px]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{orderSetName}</p>
          <p className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          <Save size={13} />
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
        {TABS.map((t) => {
          const count = items.filter((i) => i.itemType === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {t.icon}
              {t.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${tab === t.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {tab === "Medication" ? (
          <MedicationOrderPanel
            onSubmit={async (payload: MedicationPayload) => {
              addItem({
                itemType: "Medication",
                drugName: payload.drugName,
                dosage: payload.dosage,
                dosageUnit: payload.dosageUnit,
                frequency: payload.frequency,
                durationDays: payload.durationDays,
                orderType: payload.orderType,
                route: payload.route,
                instructions: payload.instructions,
                priority: payload.priority,
                drugType: payload.drugType,
                mealTiming: payload.mealTiming,
                totalQuantity: payload.totalQuantity,
                refillCount: payload.refillCount,
                prnReason: payload.prnReason,
                requiresCounselling: payload.requiresCounselling,
                medicineId: payload.medicineId,
              });
              return true;
            }}
          />
        ) : (
          <CatalogAddForm
            tab={tab}
            onAdd={addItem}
          />
        )}

        {/* Items list for this tab */}
        {tabItems.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tab} items in template</p>
            {tabItems.map((item, idx) => {
              const globalIdx = items.findIndex((i) => i === item);
              return (
                <div key={item.orderSetItemId} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.itemType === "Medication" ? item.drugName : item.displayName}
                    </p>
                    {item.itemType === "Medication" && (
                      <p className="text-xs text-muted-foreground">
                        {[item.dosage && `${item.dosage}${item.dosageUnit ? ` ${item.dosageUnit}` : ""}`, item.frequency, item.durationDays && `${item.durationDays}d`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {item.itemType !== "Medication" && item.remarks && (
                      <p className="text-xs text-muted-foreground">{item.remarks}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(globalIdx)}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogAddForm({ tab, onAdd }: { tab: Exclude<Tab, "Medication">; onAdd: (item: Omit<OrderSetItemDto, "orderSetItemId">) => void }) {
  const [listItemId, setListItemId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [priority, setPriority] = useState("Normal");

  const configListType = tab === "Diagnosis" ? "Diagnosis" : "Procedure";

  const handleAdd = () => {
    if (!displayName.trim()) return;
    onAdd({ itemType: tab, listItemId, displayName: displayName.trim(), remarks: remarks.trim() || null, priority });
    setListItemId(null);
    setDisplayName("");
    setRemarks("");
    setPriority("Normal");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold">Add {tab}</p>
      <CatalogSearchInput
        placeholder={`Search ${tab.toLowerCase()} catalog…`}
        fetchOptions={async (search) => {
          const res = await ConfigListService.get(configListType, search);
          return (res.data || []).map((i: { listItemId: string; name: string; code?: string }) => ({ id: i.listItemId, name: i.name, code: i.code }));
        }}
        onSelect={(opt) => {
          setListItemId(opt.id);
          setDisplayName(opt.name);
        }}
        value={displayName}
      />
      {displayName && (
        <p className="text-xs text-primary font-medium">Selected: {displayName}</p>
      )}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Remarks (optional)</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            placeholder="Any notes for this template item"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
          <select
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option>Normal</option>
            <option>Urgent</option>
            <option>STAT</option>
          </select>
        </div>
      </div>
      <button
        onClick={handleAdd}
        disabled={!displayName.trim()}
        className="flex items-center gap-1.5 self-end rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <Plus size={13} />
        Add to template
      </button>
    </div>
  );
}
