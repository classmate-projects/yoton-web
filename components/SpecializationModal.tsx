"use client";

import { useState, useEffect } from "react";
import { baseUrl } from "@/lib/constants";
import { toast } from "sonner";

interface DepartmentType {
  departmentId: number;
  name: string;
}

interface SpecializationType {
  specializationId: number;
  name: string;
  description: string;
  isActive: boolean;
  department: DepartmentType;
}

interface SpecializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSpecialization?: SpecializationType | null;
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
  const [allDepartments, setAllDepartments] = useState<DepartmentType[]>([]);
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingSpecialization;

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/department/get-all`);
      const data = await res.json();
      if (res.ok) {
        setAllDepartments(data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };


  useEffect(() => {
    if (isOpen) {
      if (editingSpecialization) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setName(editingSpecialization.name);
        setDescription(editingSpecialization.description);
        setSelectedDepartment(String(editingSpecialization.department.departmentId));
      } else {
        setName("");
        setDescription("");
        setSelectedDepartment(initialDepartmentId || "");
      }
      fetchDepartments();
    }
  }, [isOpen, editingSpecialization, initialDepartmentId]);


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name,
      description,
      departmentId: selectedDepartment,
    };

    try {
      const url = isEditing
        ? `${baseUrl}/api/specialization/update/${editingSpecialization?.specializationId}`
        : `${baseUrl}/api/specialization/create`;

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message || (isEditing ? "Failed to update specialization" : "Failed to add specialization")
        );
      }

      toast.success(data.message || (isEditing ? "Specialization updated" : "Specialization added"));
      onSuccess();
      onClose();
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <select
              id="spec-department"
              required
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
            >
              <option value="" disabled>
                Select department
              </option>
              {allDepartments.map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.name}
                </option>
              ))}
            </select>
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
              {isEditing ? "Update" : loading ? "Saving..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
