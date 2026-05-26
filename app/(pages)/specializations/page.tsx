"use client";

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

import { useEffect, useState } from "react";
import ToggleButton from "@/components/ToggleButton";
import SpecializationIcon from "@/public/icons/SpecializationIcon";
import { MdAdd } from "react-icons/md";
import { baseUrl } from "@/lib/constants";
import DeleteIcon from "@/public/icons/deleteIcon";
import { toast } from "sonner";

export default function SpecializationPage() {
  const [specializations, setSpecializations] = useState<SpecializationType[]>(
    [],
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [allDepartments, setAllDepartments] = useState<DepartmentType[]>([]);

  const openModal = () => {
    setName("");
    setDescription("");
    setSelectedDepartment("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setName("");
    setDescription("");
    setSelectedDepartment("");
  };

  const handleAddSpecialization = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    const payload = {
      name,
      description,
      departmentId: selectedDepartment,
    };

    try {
      const res = await fetch(`${baseUrl}/api/specialization`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to add specialization");
      }

      fetchSpecializations();
    } catch (error) {
      console.error("Error adding specialization:", error);
    }

    closeModal();
  };

  // fetch departments
  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/department`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch departments");
      }

      setAllDepartments(data);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  useEffect(() => {
    const callApi = () => {
      fetchDepartments();
    };
    callApi();
  }, []);

  // fetch specializations
  const fetchSpecializations = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/specialization`);
      const data = await res.json();

      setSpecializations(data);
    } catch (error) {
      console.error("Error fetching specializations:", error);
    }
  };

  useEffect(() => {
    const callApi = () => {
      fetchSpecializations();
    };

    callApi();
  }, []);

  // handle delete specialization
  const handleDeleteSpecialization = async (id: number) => {
    try {
      const res = await fetch(`${baseUrl}/api/specialization/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete specialization");
      }

      fetchSpecializations();
    } catch (error: unknown) {
      console.error("Error deleting specialization:", error);
      toast.error(
        (error as Error).message || "Failed to delete specialization",
      );
    }
  };

  const confirmDelete = (id: number, name: string) => {
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
          <p className="text-sm text-gray-500">
            Manage medical specializations and departments.
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="card w-full max-w-md rounded-xl border-t p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1">Add Specialization</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter the specialization name, description, and select a
              department.
            </p>

            <form
              onSubmit={handleAddSpecialization}
              className="flex flex-col gap-4"
            >
              <div>
                <label
                  htmlFor="spec-name"
                  className="text-sm font-bold text-gray-700 required"
                >
                  Name
                </label>
                <input
                  id="spec-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cardiothoracic Surgery"
                  className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border) outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="spec-description"
                  className="text-sm font-bold text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="spec-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this specialization"
                  rows={4}
                  className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border) outline-none focus:border-blue-500 resize-none min-h-25"
                />
              </div>

              <div>
                <label
                  htmlFor="spec-department"
                  className="text-sm font-bold text-gray-700 required"
                >
                  Department
                </label>
                <select
                  id="spec-department"
                  required
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border) outline-none focus:border-blue-500"
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

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-md border border-neutral-400/50 hover:bg-neutral-300/50 transition-all duration-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="rounded-lg bg-gray-100 shadow-md overflow-hidden">
        <table className="w-full">
          {/* Table Head */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-200">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Description
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Department
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                Action
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {specializations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
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
                <tr
                  key={spec.specializationId}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {spec.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {spec.description || "No description provided"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {spec.department?.name || "No department assigned"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center ">
                      <ToggleButton
                        checked={spec.isActive}
                        onChange={() => {
                          // Handle toggle change
                        }}
                      />

                      <button
                        onClick={() =>
                          confirmDelete(spec.specializationId, spec.name)
                        }
                        title="Delete"
                        className="ml-4 hover:bg-red-100 ring-transparent hover:ring-red-200 transition-colors duration-150 rounded-full p-2 cursor-pointer"
                      >
                        <DeleteIcon color="red" size={20} />
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
