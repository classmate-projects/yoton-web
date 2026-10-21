"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import ListItemManager from "@/components/configLists/ListItemManager";
import MedicineCatalogManager from "@/components/configLists/MedicineCatalogManager";
import VaccineMasterManager from "@/components/configLists/VaccineMasterManager";
import { ConfigListType } from "@/types/configList.type";

// "Medication" isn't a real ConfigListType/ListItem-backed list like the others below - the
// Medicine catalog is its own dedicated model (see PharmacyController) - but it's curated
// here, admin-only, for the same reason Procedure's bulk upload lives here: catalog curation
// is an admin/IT job, distinct from Pharmacy's day-to-day stock/dispensing work.
type TabValue = ConfigListType | "Medication" | "FamilyHistory" | "Vaccine";

const LIST_TYPES: { value: TabValue; label: string; hint: string }[] = [
  {
    value: "Procedure",
    label: "Procedure (CPT Codes)",
    hint: "The unified catalog behind Lab, Radiology, and Treatment ordering on the Doctor Workbench - each entry's Department decides which of those three it becomes (\"Pathology and Laboratory\" → Lab, \"Radiology\" → Radiology, anything else → Treatment). Add entries one at a time, or upload a filled-in Excel with Department/CPT Code/Service Description/Cash Price columns for large sets like a full CPT price list.",
  },
  {
    value: "Medication",
    label: "Medication",
    hint: "The medication catalog doctors search when prescribing. Upload the DDC or Riayati medication registry export as-is - columns are matched automatically. Day-to-day stock, pricing overrides, high-risk flagging, and alternatives are managed separately on the Pharmacy page.",
  },
  { value: "Investigation", label: "Investigation", hint: "Searchable when ordering lab/radiology investigations (legacy - new investigations should use Procedure above instead)" },
  { value: "Treatment", label: "Treatment", hint: "Searchable in the doctor workbench's Treatment section (legacy - new treatments should use Procedure above instead)" },
  { value: "Diagnosis", label: "ICD Code", hint: "The diagnosis code list doctors search when recording a diagnosis. Add codes one at a time, paste a batch, or upload a filled-in Excel template for large sets like ICD-10/ICD-11" },
  { value: "OrderType", label: "Order Type", hint: "Regular, Stat, PRN, IV Push, Oral, Vaginal, Rectal, etc." },
  { value: "Route", label: "Route of Administration", hint: "Oral, Dental, and other routes" },
  { value: "DosageUnit", label: "Dosage Unit", hint: "ml, mg, tablet, capsule, vial, bottle, puff, drops" },
  { value: "Frequency", label: "Frequency", hint: "e.g. Once daily, Twice daily — Code can hold a session pattern like 1111" },
  { value: "InsuranceProvider", label: "Insurance Provider", hint: "Selectable at patient registration when Payment Type is Insurance or Corporate" },
  { value: "DrugType", label: "Drug Type", hint: "Tablet, Syrup, Injection, Cream — selectable when prescribing on the doctor workbench" },
  { value: "CancerSite", label: "Cancer Site", hint: "Selectable on an urgent suspected-cancer referral in the doctor workbench" },
  { value: "FamilyHistory", label: "Family History", hint: "The Relation and Condition dropdowns on the Family History section (doctor and nurse workbenches) — managed together here." },
  {
    value: "Vaccine",
    label: "Vaccines",
    hint: "The vaccine master behind the Pediatric Immunization Schedule. Routine vaccines carry the recommended schedule every pediatric patient gets (seeded from Qatar's national childhood immunization schedule - review it against the current MoPH schedule); other categories, such as Influenza, Meningococcal for Hajj/Umrah and travel vaccines, are ordered on demand. Add your organization's own vaccines here; a vaccine already on patients' records can be deactivated but not deleted.",
  },
];

export default function ConfigListsPage() {
  const [listType, setListType] = useState<TabValue>("Procedure");

  const activeType = LIST_TYPES.find((t) => t.value === listType)!;

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <ListPlus className="text-primary" /> Configurable Lists
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage the picklists used across the doctor workbench — investigations, treatments, ICD diagnosis codes,
          medication order types, routes, dosage units, and frequencies.
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

      {listType === "Medication" ? (
        <MedicineCatalogManager key={listType} />
      ) : listType === "Vaccine" ? (
        <VaccineMasterManager />
      ) : listType === "FamilyHistory" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ListItemManager listType="FamilyRelation" itemLabel="Relation" />
          <ListItemManager listType="FamilyHistoryCondition" itemLabel="Condition" />
        </div>
      ) : (
        <ListItemManager key={listType} listType={listType} itemLabel={activeType.label} />
      )}
    </div>
  );
}
