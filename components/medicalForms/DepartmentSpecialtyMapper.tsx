"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DepartmentSerivce } from "@/services/department.service";
import { SpecializationService } from "@/services/specialization.service";
import { DepartmentTypes } from "@/types/department.type";
import { SpecializationTypes } from "@/types/specialization.type";
import { FormTemplateService } from "@/services/medicalForm.service";

// Two independent multi-select checklists - a template maps to any number of departments
// and/or specialties (an OR match at fill time, see FormTemplateController.GetAvailable),
// not an either/or choice, so there's no conflict to guard against here.
export default function DepartmentSpecialtyMapper({
  formTemplateId,
  selectedDepartmentIds,
  selectedSpecializationIds,
  onSaved,
}: {
  formTemplateId: string;
  selectedDepartmentIds: string[];
  selectedSpecializationIds: string[];
  onSaved: (departmentIds: string[], specializationIds: string[]) => void;
}) {
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationTypes[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>(selectedDepartmentIds);
  const [specializationIds, setSpecializationIds] = useState<string[]>(selectedSpecializationIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Both endpoints return a bare array (Ok(departments)/Ok(specs)), not a { data } envelope
    // - DepartmentSerivce.getAll()/SpecializationService.getAll() already unwrap axios's own
    // response.data once, so the resolved value here IS the list. Reading `.data` off it again
    // (the original bug) silently produced undefined -> `?? []` -> nothing ever showed up,
    // even though the admin had created departments/specialties.
    DepartmentSerivce.getAll()
      .then((data) => setDepartments((data ?? []).filter((d: DepartmentTypes) => d.isActive)))
      .catch(() => toast.error("Failed to load departments"));
    SpecializationService.getAll()
      .then((data) => setSpecializations((data ?? []).filter((s: SpecializationTypes) => s.isActive)))
      .catch(() => toast.error("Failed to load specialties"));
  }, []);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        FormTemplateService.setDepartments(formTemplateId, departmentIds),
        FormTemplateService.setSpecialties(formTemplateId, specializationIds),
      ]);
      toast.success("Mapping saved");
      onSaved(departmentIds, specializationIds);
    } catch {
      toast.error("Failed to save mapping");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Leave both empty to make this form visible to everyone. Otherwise it shows for a matching department <span className="font-semibold">or</span> specialty.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Departments</span>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-3">
            {departments.length === 0 && <p className="text-xs text-muted-foreground">No departments yet.</p>}
            {departments.map((d) => (
              <label key={d.departmentId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={departmentIds.includes(d.departmentId)}
                  onChange={() => toggle(departmentIds, setDepartmentIds, d.departmentId)}
                  className="h-4 w-4"
                />
                {d.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Specialties</span>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-3">
            {specializations.length === 0 && <p className="text-xs text-muted-foreground">No specialties yet.</p>}
            {specializations.map((s) => (
              <label key={s.specializationId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={specializationIds.includes(s.specializationId)}
                  onChange={() => toggle(specializationIds, setSpecializationIds, s.specializationId)}
                  className="h-4 w-4"
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save mapping"}
      </button>
    </div>
  );
}
