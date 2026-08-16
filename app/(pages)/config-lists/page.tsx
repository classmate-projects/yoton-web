"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import ListItemManager from "@/components/configLists/ListItemManager";
import { ConfigListType } from "@/types/configList.type";

// ICD/diagnosis codes have their own dedicated page (see the "Codes" sidebar
// group) since that list is large enough and important enough to warrant its
// own screen — everything else still shares this generic tabbed manager.
const LIST_TYPES: { value: ConfigListType; label: string; hint: string }[] = [
  { value: "Investigation", label: "Investigation", hint: "Searchable when ordering lab/radiology investigations" },
  { value: "Treatment", label: "Treatment", hint: "Searchable in the doctor workbench's Treatment section" },
  { value: "OrderType", label: "Order Type", hint: "Regular, Stat, PRN, IV Push, Oral, Vaginal, Rectal, etc." },
  { value: "Route", label: "Route of Administration", hint: "Oral, Dental, and other routes" },
  { value: "DosageUnit", label: "Dosage Unit", hint: "ml, mg, tablet, capsule, vial, bottle, puff, drops" },
  { value: "Frequency", label: "Frequency", hint: "e.g. Once daily, Twice daily — Code can hold a session pattern like 1111" },
  { value: "InsuranceProvider", label: "Insurance Provider", hint: "Selectable at patient registration when Payment Type is Insurance or Corporate" },
  { value: "DrugType", label: "Drug Type", hint: "Tablet, Syrup, Injection, Cream — selectable when prescribing on the doctor workbench" },
];

export default function ConfigListsPage() {
  const [listType, setListType] = useState<ConfigListType>("Investigation");

  const activeType = LIST_TYPES.find((t) => t.value === listType)!;

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <ListPlus className="text-primary" /> Configurable Lists
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage the picklists used across the doctor workbench — investigations, treatments, medication order
          types, routes, dosage units, and frequencies. Looking for ICD/diagnosis codes? That&apos;s under
          Codes &rarr; ICD Codes.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {LIST_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setListType(t.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              listType === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-4">{activeType.hint}</p>

      <ListItemManager key={listType} listType={listType} itemLabel={activeType.label} />
    </div>
  );
}
