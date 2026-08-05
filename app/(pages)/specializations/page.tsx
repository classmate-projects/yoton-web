"use client";

interface DepartmentType {
  departmentId: string;
  name: string;
}

interface SpecializationType {
  specializationId: string;
  name: string;
  description: string;
  isActive: boolean;
  departmentId: string;
  department: DepartmentType;
}

import { useEffect, useState } from "react";
import ToggleButton from "@/components/ToggleButton";
import SpecializationIcon from "@/public/icons/SpecializationIcon";
import { MdAdd } from "react-icons/md";
import DeleteIcon from "@/public/icons/deleteIcon";
import { toast } from "sonner";
import EditIcon from "@/public/icons/EditIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import SpecializationModal from "@/components/SpecializationModal";
import { SpecializationService } from "@/services/specialization.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

export default function SpecializationPage() {
  const [specializations, setSpecializations] = useState<SpecializationType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpecialization, setEditingSpecialization] = useState<SpecializationType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const openModal = () => {
    setEditingSpecialization(null);
    setIsModalOpen(true);
  };

  const openEditModal = (spec: SpecializationType) => {
    setEditingSpecialization(spec);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSpecialization(null);
  };

  const handleSuccess = () => {
    fetchSpecializations();
  };

  // handle toggle specialization active status
  const handleToggleSpecialization = async (spec: SpecializationType) => {
    const nextIsActive = !spec.isActive;

    const payload = {
      name: spec.name,
      description: spec.description,
      departmentId: spec.department.departmentId,
      isActive: nextIsActive,
    }

    try {
      await SpecializationService.update(spec.specializationId, payload)

      setSpecializations((prev) =>
        prev.map((s) =>
          s.specializationId === spec.specializationId
            ? { ...s, isActive: nextIsActive }
            : s,
        ),
      );

      toast.success("Specialization status updated");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
      console.error("Error updating specialization status:", error);
    }
  };

  // fetch specializations
  const fetchSpecializations = async () => {
    try {
      setIsLoading(true);
      const res = await SpecializationService.getAll()
      setSpecializations(res);
    } catch (error) {
      console.error("Error fetching specializations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecializations();
  }, []);

  useSignalRRefetch(["specializationCreated", "specializationUpdated", "specializationDeleted"], fetchSpecializations);

  // handle delete specialization
  const handleDeleteSpecialization = async (id: string) => {
    try {
      const data = await SpecializationService.delete(id)
      toast.success(data.message)

      fetchSpecializations();
    } catch (error: unknown) {
      console.error("Error deleting specialization:", error);
      toast.error(
        (error as Error).message || "Failed to delete specialization",
      );
    }
  };

  const confirmDelete = (id: string, name: string) => {
    toast(
      <span>
        Are you sure you want to delete the specialization{" "}
        <b className="text-red-500 ml-1">{name}</b>?
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => handleDeleteSpecialization(id),
        },
        duration: 10000,
        closeButton: true,
      },
    );
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      {/* Header Section */}
      <div className="flex justify-between items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3">
            <SpecializationIcon size={36} color="#2563eb" />
            Specializations
          </h1>
          <p className="text-sm text-gray-500 max-w-xl">
            Specializations are searchable when linking a doctor account under Assign Doctor, when a doctor
            refers a patient to another specialty from the Doctor Workbench, and when filtering doctors during
            appointment booking. Deactivating one hides it from those pickers without deleting existing records.
          </p>
        </div>
        <button
          onClick={openModal}
          className="rounded-lg bg-emerald-500 px-6 py-2 text-white font-medium hover:bg-emerald-600 transition-colors duration-200 flex items-center gap-2 whitespace-nowrap"
        >
          <MdAdd size={20} />
          Add Specialization
        </button>
      </div>

      {/* Reusable Modal */}
      <SpecializationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={handleSuccess}
        editingSpecialization={editingSpecialization}
      />

      {/* Table Section */}
      <div className="card">
        <table>
          {/* Table Head */}
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Department</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : specializations.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="h-12 w-12 text-gray-400 mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-gray-500 font-medium">
                      No specializations added yet
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      Create your first specialization to get started
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              specializations.map((spec) => (
                <tr key={spec.specializationId}>
                  <td className="font-semibold">
                    {spec.name}
                  </td>
                  <td>
                    {spec.description || "No description provided"}
                  </td>
                  <td>
                    {spec.department?.name || "No department assigned"}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center items-center ">
                      <ToggleButton
                        checked={spec.isActive}
                        onChange={() => handleToggleSpecialization(spec)}
                      />

                      <button
                        onClick={() =>
                          confirmDelete(spec.specializationId, spec.name)
                        }
                        title="Delete"
                        className="ml-4 hover:bg-red-100 ring-transparent hover:ring-red-200 transition-colors duration-150 rounded-full p-2 cursor-pointer mr-4"
                      >
                        <DeleteIcon color="red" size={20} />
                      </button>

                      <button
                        title="Edit"
                        onClick={() => openEditModal(spec)}
                        className="hover:bg-blue-100 ring-transparent hover:ring-blue-200 transition-colors duration-150 rounded-full p-2 cursor-pointer">
                        <EditIcon color="blue" size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
