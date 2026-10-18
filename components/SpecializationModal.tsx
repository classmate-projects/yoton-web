"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SpecializationService } from "@/services/specialization.service";
import { DepartmentSerivce } from "@/services/department.service";
import { SpecializationTypes } from "@/types/specialization.type";
import { DepartmentTypes } from "@/types/department.type";
import ToggleButton from "@/components/ToggleButton";
import { apiErrorMessage } from "@/lib/apiError";
import SearchableSelect from "@/components/SearchableSelect";


interface SpecializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSpecialization?: SpecializationTypes | null;
  initialDepartmentId?: string;
}

export default function SpecializationModal({
  isOpen,
  onClose,
  onSuccess,
  editingSpecialization,
  initialDepartmentId,
}: SpecializationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [isDentalSpecialty, setIsDentalSpecialty] = useState(false);
  const [allDepartments, setAllDepartments] = useState<DepartmentTypes[]>([]);
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingSpecialization;

  // Only medical departments can hold specializations (see SpecializationController.Create,
  // which rejects non-medical ones server-side) - filtered here too so the picker itself
  // never offers a department that would just be rejected on submit. The currently-selected
  // department stays selectable even if it's since been flipped non-medical, so editing an
  // older specialization doesn't silently blank out its department.
  const selectableDepartments = allDepartments.filter(
    (d) => d.isMedical || d.departmentId === selectedDepartment
  );

  const fetchDepartments = async () => {
    try {
      const data = await DepartmentSerivce.getAll()
      setAllDepartments(data);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };


  useEffect(() => {
    if (isOpen) {
      if (editingSpecialization) {
        setName(editingSpecialization.name);
        setDescription(editingSpecialization.description);
        setSelectedDepartment(String(editingSpecialization.departmentId));
        setIsDentalSpecialty(editingSpecialization.isDentalSpecialty);
      } else {
        setName("");
        setDescription("");
        setSelectedDepartment(initialDepartmentId || "");
        setIsDentalSpecialty(false);
      }
      fetchDepartments();
    }
  }, [isOpen, editingSpecialization, initialDepartmentId]);

  const handleCreateSpecialization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedDepartment) {
      toast.warning("Please select a department");
      return;
    }
    setLoading(true)
    try {
      const payload = {
        name,
        description,
        departmentId: selectedDepartment,
        isDentalSpecialty,
      };
      const data = await SpecializationService.create(payload)
      toast.success(data.message)
      onSuccess();
      onClose();
    } catch (error) {
      // Left open on failure (e.g. the department was flipped non-medical by someone else
      // between opening this modal and submitting) so the admin actually sees why, instead
      // of the modal just closing as if it had worked.
      toast.error(
        apiErrorMessage(error, "Failed to create specialization")
      );
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSpecialization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedDepartment) {
      toast.warning("Please select a department");
      return;
    }
    setLoading(true)

    if(!editingSpecialization) return;

    try {
      const payload = {
        name,
        description,
        departmentId: selectedDepartment,
        isActive: editingSpecialization?.isActive,
        isDentalSpecialty
      };
      const data = await SpecializationService.update(editingSpecialization.specializationId, payload)
      toast.success(data.message)
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "Failed to update specialization")
      );
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
      <div className="card w-full max-w-md rounded-xl border-t p-6 shadow-2xl mx-4">
        <h2 className="text-2xl font-semibold mb-1 text-foreground">
          {isEditing ? "Update Specialization" : "Add Specialization"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {isEditing
            ? "Update the specialization name, description, and department."
            : "Enter the specialization name, description, and select a department."}
        </p>

        <form onSubmit={isEditing ? handleUpdateSpecialization : handleCreateSpecialization} className="flex flex-col gap-4">
          <div>
            <label htmlFor="spec-name" className="text-sm font-bold text-foreground/90 required">
              Name
            </label>
            <input
              id="spec-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cardiothoracic Surgery"
              className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
            />
          </div>

          <div>
            <label htmlFor="spec-description" className="text-sm font-bold text-foreground/90">
              Description
            </label>
            <textarea
              id="spec-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this specialization"
              rows={4}
              className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground resize-none min-h-25"
            />
          </div>

          <div>
            <label htmlFor="spec-department" className="text-sm font-bold text-foreground/90 required">
              Department
            </label>
            <div className="mt-1">
              <SearchableSelect
                id="spec-department"
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                placeholder="Select department"
                options={selectableDepartments.map((dept) => ({ value: dept.departmentId, label: dept.name }))}
                className="flex w-full items-center justify-between gap-1 p-3 rounded-lg bg-muted border border-border text-left text-foreground transition-colors hover:border-primary/60"
                preserveCase
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Only medical departments are listed — specialties can&apos;t be created under a non-medical
              department (e.g. IT, Quality).
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground/90">Dental specialty</p>
              <p className="text-xs text-muted-foreground">
                Enables the dental checklist panel and dental KPI reports for this specialty&apos;s doctors.
              </p>
            </div>
            <ToggleButton checked={isDentalSpecialty} onChange={setIsDentalSpecialty} />
          </div>

          <div className="flex items-center justify-end gap-3 mt-2 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-50"
            >
              {loading ? isEditing ? "Updating..." : "Saving..." : isEditing ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
