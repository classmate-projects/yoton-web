"use client";

import ToggleButton from "@/components/ToggleButton";
import BuildingIcon from "@/public/icons/BuildingIcon";
import { MdAdd } from "react-icons/md";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DeleteIcon from "@/public/icons/deleteIcon";
import EditIcon from "@/public/icons/EditIcon";
import { baseUrl } from "@/lib/constants";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Department {
  departmentId: number;
  name: string;
  description: string;
  isActive: boolean;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

  // fetch departments
  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${baseUrl}/api/department`);
      const data = await res.json();
      
      if (!res.ok)
        throw new Error(data.message || "Failed to fetch Departments");

      setDepartments(data);
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const callFetchApi = () => {
      fetchDepartments();
    };
    callFetchApi();
  }, []);

  // create or update department
  const handleSubmitDepartment = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    try {
      const res = await fetch(
        `${baseUrl}/api/department/${isEditing ? editingDepartment.departmentId : ""}`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEditing
              ? {
                  name,
                  description,
                  isActive: editingDepartment.isActive,
                }
              : { name, description },
          ),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message ||
            (isEditing
              ? "Failed to update department"
              : "Failed to create department"),
        );
      }

      toast.success(data.message);
      fetchDepartments();
      closeModal();
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    }
  };

  // toggle department active status
  const handleToggleDepartment = async (department: Department) => {
    const nextIsActive = !department.isActive;

    try {
      const res = await fetch(
        `${baseUrl}/api/department/${department.departmentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: department.name,
            description: department.description,
            isActive: nextIsActive,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update department status");
      }

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
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${baseUrl}/api/department/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();

      if (!res.ok)
        throw new Error(data.message || "Failed to delete department.");
      toast.success(data.message);
      fetchDepartments();
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    }
  };

  // confirm before delete
  const confirmDelete = (id: number, name: string) => {
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
              onSubmit={handleSubmitDepartment}
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
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground resize-y min-h-25"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer"
                >
                  {isEditing ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="text-foreground/90">Name</th>
                <th className="text-foreground/90">Description</th>
                <th className="text-center text-foreground/90">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : departments.length > 0 ? (
                departments.map((department) => (
                  <tr
                    key={department.departmentId}
                    className={!department.isActive ? "bg-destructive/5 opacity-80" : ""}
                  >
                    <td className="font-semibold capitalize text-foreground">
                      {department.name}
                    </td>
                    <td className="text-foreground/80">
                      {department.description || "No description provided."}
                    </td>
                    <td>
                      <div className="flex justify-center items-center gap-4">
                        <ToggleButton
                          checked={department.isActive}
                          onChange={() => handleToggleDepartment(department)}
                        />

                        <button
                          onClick={() =>
                            confirmDelete(
                              department.departmentId,
                              department.name,
                            )
                          }
                          title={`Delete ${department.name}`}
                          className="p-2 hover:bg-destructive/10 rounded-full transition-all duration-200 cursor-pointer"
                        >
                          <DeleteIcon color="currentColor" className="text-destructive" size={18} />
                        </button>

                        <button
                          onClick={() => openEditModal(department)}
                          title={`Edit ${department.name}`}
                          className="p-2 hover:bg-primary/10 rounded-full transition-all duration-200 cursor-pointer"
                        >
                          <EditIcon color="currentColor" className="text-primary" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
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