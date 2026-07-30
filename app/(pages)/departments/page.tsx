"use client";

import ToggleButton from "@/components/ToggleButton";
import BuildingIcon from "@/public/icons/BuildingIcon";
import { MdAdd, MdExpandMore, MdExpandLess } from "react-icons/md";
import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import DeleteIcon from "@/public/icons/deleteIcon";
import EditIcon from "@/public/icons/EditIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import SpecializationModal from "@/components/SpecializationModal";
import { DepartmentSerivce } from "@/services/department.service";
import { SpecializationService } from "@/services/specialization.service";
import { SpecializationTypes } from "@/types/specialization.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

interface Department {
  departmentId: string;
  name: string;
  description: string;
  isActive: boolean;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specializations, setSpecializations] = useState<SpecializationTypes[]>([]);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [initialDeptIdForSpec, setInitialDeptIdForSpec] = useState("");
  const [editingSpecialization, setEditingSpecialization] = useState<SpecializationTypes | null>(null);

  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setloading] = useState(false)

  const isEditing = editingDepartment !== null;

  const openCreateModal = () => {
    setEditingDepartment(null);
    setName("");
    setDescription("");
    setIsModalOpen(true);
  };

  const openEditModal = (department: Department) => {
    setEditingDepartment(department);
    setName(department.name);
    setDescription(department.description ?? "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDepartment(null);
    setName("");
    setDescription("");
  };

  const openSpecModal = (departmentId: string) => {
    setInitialDeptIdForSpec(String(departmentId));
    setEditingSpecialization(null);
    setIsSpecModalOpen(true);
  };

  const openEditSpecModal = (spec: SpecializationTypes) => {
    setEditingSpecialization(spec);
    setIsSpecModalOpen(true);
  };

  const closeSpecModal = () => {
    setIsSpecModalOpen(false);
    setInitialDeptIdForSpec("");
    setEditingSpecialization(null);
  };

  const handleSpecSuccess = () => {
    fetchSpecializations();
  };

  const toggleExpand = (id: string) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // department logics
  // fetch departments
  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const data = await DepartmentSerivce.getAll();
      setDepartments(data || []);
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // create deaprtment
  const handleCreateDepartment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setloading(true)
    if (!name.trim()) return;

    try {
      const payload = { name, description }
      const data = await DepartmentSerivce.create(payload)
      setIsModalOpen(false)
      fetchDepartments();
      toast.success(data.message)
    } catch (error) {
      console.log("Error: ", error)
    } finally {
      setloading(false)
    }
  }

  // update department
  const handleUpdateDepartment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setloading(true)
    if (!editingDepartment) return;
    try {
      const payload = {
        name,
        description,
        isActive: editingDepartment?.isActive
      }

      const data = await DepartmentSerivce.update(editingDepartment.departmentId, payload)
      setIsModalOpen(false)
      fetchDepartments()
      toast.success(data.message)
    } catch (error) {
      console.log("Error: ", error)
    } finally {
      setloading(false)
    }
  }

  // toggle department active status
  const handleToggleDepartment = async (department: Department) => {
    const nextIsActive = !department.isActive;

    try {
      const payload = {
        name: department.name,
        description: department.description,
        isActive: nextIsActive
      }
      const data = await DepartmentSerivce.update(department.departmentId, payload)
      toast.success(data.message)

      setDepartments((prev) =>
        prev.map((d) =>
          d.departmentId === department.departmentId
            ? { ...d, isActive: nextIsActive }
            : d,
        ),
      );
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    }
  };

  // delete department
  const handleDelete = async (id: string) => {
    try {
      const data = await DepartmentSerivce.delete(id)
      toast.success(data.message);
      fetchDepartments();
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    }
  };

  // confirm before delete
  const confirmDelete = (id: string, name: string) => {
    toast(
      <span>
        Are you sure you want to delete{" "}
        <b className="text-red-500 ml-1">{name}</b>
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => handleDelete(id),
        },
      },
    );
  };

  // specialization logic
  // fetch specializations
  const fetchSpecializations = async () => {
    try {
      const data = await SpecializationService.getAll()
      setSpecializations(data)
    } catch (error) {
      console.error("Error fetching specializations:", error);
    }
  };

  useEffect(() => {
    fetchSpecializations();
    fetchDepartments();
  }, []);

  useSignalRRefetch(["departmentCreated", "departmentUpdated", "departmentDeleted"], fetchDepartments);
  useSignalRRefetch(["specializationCreated", "specializationUpdated", "specializationDeleted"], fetchSpecializations);

  // toggle specialization active status
  const handleToggleSpecialization = async (spec: SpecializationTypes) => {
    const nextIsActive = !spec.isActive;
    try {
      const payload = {
        name: spec.name,
        description: spec.description,
        departmentId: spec.departmentId,
        isActive: nextIsActive
      }
      await SpecializationService.update(spec.specializationId, payload)

      setSpecializations((prev) =>
        prev.map((s) => (s.specializationId === spec.specializationId ? { ...s, isActive: nextIsActive } : s))
      );
      toast.success("Specialization status updated");
    } catch (error) {
      toast.error("Failed to update specialization status");
      console.log("error: ", error)
    }
  };

  // delete specialization
  const handleDeleteSpecialization = async (id: string) => {
    try {
      const data = await SpecializationService.delete(id)
      toast.success(data.message);
      fetchSpecializations();
    } catch (error) {
      toast.error("Failed to delete specialization");
      console.log("error: ", error)
    }
  };

  const confirmDeleteSpec = (id: string, name: string) => {
    toast(
      <span>
        Are you sure you want to delete specialization <b className="text-red-500 ml-1">{name}</b>?
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => handleDeleteSpecialization(id),
        },
      }
    );
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex justify-between items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <BuildingIcon size={36} color="currentColor" className="text-primary" />
            Departments
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage hospital departments, their details, and active status.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
        >
          <MdAdd size={22} />
          Add Department
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">
              {isEditing ? "Edit Department" : "Add Department"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {isEditing
                ? "Update the department name and description."
                : "Enter the department name and description."}
            </p>

            <form
              onSubmit={isEditing ? handleUpdateDepartment : handleCreateDepartment}
              className="flex flex-col gap-4"
            >
              <div>
                <label
                  htmlFor="department-name"
                  className="text-sm font-bold text-foreground/90 required"
                >
                  Name
                </label>
                <input
                  id="department-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cardiology"
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
              </div>

              <div>
                <label
                  htmlFor="department-description"
                  className="text-sm font-bold text-foreground/90"
                >
                  Description
                </label>
                <textarea
                  id="department-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this department"
                  rows={4}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground min-h-25 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full"
                >
                  {loading ? isEditing ? "Updating..." : "Saving..." : isEditing ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Specialization Modal */}
      <SpecializationModal
        isOpen={isSpecModalOpen}
        onClose={closeSpecModal}
        onSuccess={handleSpecSuccess}
        initialDepartmentId={initialDeptIdForSpec}
        editingSpecialization={editingSpecialization}
      />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th className="text-foreground/90">Name</th>
                <th className="text-foreground/90">Description</th>
                <th className="text-center text-foreground/90">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : departments.length > 0 ? (
                departments.map((department) => {
                  const deptSpecs = specializations.filter(
                    (s) => s.departmentId === department.departmentId
                  );
                  const isExpanded = expandedDepartments.has(department.departmentId);

                  return (
                    <React.Fragment key={department.departmentId}>
                      <tr
                        className={`${!department.isActive ? "bg-destructive/5 opacity-80" : ""} hover:bg-muted/30 transition-colors`}
                      >
                        <td className="pl-4">
                          {deptSpecs.length > 0 && (
                            <button
                              onClick={() => toggleExpand(department.departmentId)}
                              className="p-1 hover:bg-muted rounded transition-colors cursor-pointer"
                            >
                              {isExpanded ? (
                                <MdExpandLess size={24} className="text-muted-foreground" />
                              ) : (
                                <MdExpandMore size={24} className="text-muted-foreground" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="font-semibold capitalize text-foreground">
                          {department.name}
                        </td>
                        <td className="text-foreground/80">
                          {department.description || "No description provided."}
                        </td>
                        <td>
                          <div className="flex justify-center items-center gap-2">
                            <button
                              onClick={() => openSpecModal(department.departmentId)}
                              title="Add Specialization"
                              className="p-1.5 hover:bg-emerald-500/10 rounded-full transition-all duration-200 cursor-pointer text-emerald-500"
                            >
                              <MdAdd size={18} />
                            </button>

                            <ToggleButton
                              checked={department.isActive}
                              onChange={() => handleToggleDepartment(department)}
                              className="scale-[0.8]"
                            />

                            <button
                              onClick={() =>
                                confirmDelete(
                                  department.departmentId,
                                  department.name,
                                )
                              }
                              title={`Delete ${department.name}`}
                              className="p-1.5 hover:bg-destructive/10 rounded-full transition-all duration-200 cursor-pointer"
                            >
                              <DeleteIcon color="red" className="text-destructive" size={16} />
                            </button>

                            <button
                              onClick={() => openEditModal(department)}
                              title={`Edit ${department.name}`}
                              className="p-1.5 hover:bg-primary/10 rounded-full transition-all duration-200 cursor-pointer"
                            >
                              <EditIcon color="currentColor" className="text-primary" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && deptSpecs.length > 0 && (
                        <tr className="bg-muted/20">
                          <td colSpan={4} className="p-0">
                            <div className="px-14 py-3 space-y-1">
                              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-70">
                                Specializations
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                {deptSpecs.map((spec) => (
                                  <div
                                    key={spec.specializationId}
                                    className="bg-card border border-border rounded-lg p-2.5 shadow-sm flex items-center justify-between group"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-sm text-foreground truncate">{spec.name}</p>
                                      {spec.description && (
                                        <p className="text-[11px] text-muted-foreground line-clamp-1 opacity-80">
                                          {spec.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2">
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => openEditSpecModal(spec)}
                                          title="Edit"
                                          className="p-1 hover:bg-primary/10 rounded-md transition-all text-primary"
                                        >
                                          <EditIcon size={14} />
                                        </button>
                                        <button
                                          onClick={() => confirmDeleteSpec(spec.specializationId, spec.name)}
                                          title="Delete"
                                          className="p-1 hover:bg-destructive/10 rounded-md transition-all text-destructive"
                                        >
                                          <DeleteIcon size={14} />
                                        </button>
                                      </div>
                                      <ToggleButton
                                        checked={spec.isActive}
                                        onChange={() => handleToggleSpecialization(spec)}
                                        className="scale-[0.7] -mr-2.5"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-16 text-center text-muted-foreground"
                  >
                    No departments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
