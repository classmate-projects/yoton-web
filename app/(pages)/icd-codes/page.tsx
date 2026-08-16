"use client";

import { Hash } from "lucide-react";
import ListItemManager from "@/components/configLists/ListItemManager";

export default function IcdCodesPage() {
  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <Hash className="text-primary" /> ICD Codes
        </h1>
        <p className="text-sm text-muted-foreground">
          The diagnosis code list doctors search when recording a diagnosis on a patient&apos;s file. Add codes one
          at a time, paste a batch, or upload a filled-in Excel template for large sets like ICD-10/ICD-11.
        </p>
      </div>

      <ListItemManager listType="Diagnosis" itemLabel="ICD Code" />
    </div>
  );
}
