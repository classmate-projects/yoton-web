"use client";

import ToggleButton from "@/components/ToggleButton";
import BuildingIcon from "@/public/icons/BuildingIcon";
import { MdAdd } from "react-icons/md";
import { useState } from "react";

interface Department {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

const dummyDepartments: Department[] = [
  {
    id: 1,
    name: "Cardiology",
    description: "Heart and cardiovascular care unit.",
    isActive: true,
  },
];

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>(dummyDepartments);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const openModal = () => setIsModalOpen(true);

  const closeModal = () => {
    setIsModalOpen(false);
    setName("");
    setDescription("");
  };

  const handleSaveDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ name, description });
    closeModal();
  };

  const handleToggleDepartment = (department: Department) => {
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === department.id ? { ...d, isActive: !department.isActive } : d,
      ),
    );
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex justify-between items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3">
            <BuildingIcon size={36} color="#2563eb" />
            Departments
          </h1>
          <p className="text-sm text-gray-500">
            Manage hospital departments, their details, and active status.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="bg-blue-500 px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:bg-blue-600 transition duration-150 shrink-0"
        >
          <MdAdd size={22} />
          Add Department
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="card w-full max-w-md rounded-xl border-t p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1">Add Department</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter the department name and description.
            </p>

            <form onSubmit={handleSaveDepartment} className="flex flex-col gap-4">
              <div>
                <label htmlFor="department-name" className="text-sm font-bold text-gray-700 required">
                  Name
                </label>
                <input
                  id="department-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cardiology"
                  className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border) outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="department-description" className="text-sm font-bold text-gray-700">
                  Description
                </label>
                <textarea
                  id="department-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this department"
                  rows={4}
                  className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border) outline-none focus:border-blue-500 resize-y min-h-25"
                />
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card p-6 rounded-xl shadow-lg border-t">
        <h2 className="text-2xl font-semibold mb-4">Department List</h2>
        <hr className="text-neutral-400/50 mb-4" />

        <div className="overflow-x-auto">
          <table className="w-full text-left rounded-xl overflow-hidden border border-neutral-400 border-separate border-spacing-0">
            <thead>
              <tr className="bg-neutral-300">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length > 0 ? (
                departments.map((department) => (
                  <tr
                    key={department.id}
                    className={`transition-colors ${
                      department.isActive
                        ? "bg-white hover:bg-gray-50"
                        : "bg-red-100/80 text-gray-500 hover:bg-red-100"
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800 capitalize">
                      {department.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {department.description || "No description provided."}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <ToggleButton
                          checked={department.isActive}
                          onChange={() => handleToggleDepartment(department)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-20 text-center text-gray-500">
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
