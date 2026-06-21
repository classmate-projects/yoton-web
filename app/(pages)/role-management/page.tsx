"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import { baseUrl } from "@/lib/constants";
import DeleteIcon from "@/public/icons/deleteIcon";
import EditIcon from "@/public/icons/EditIcon";
import { RoleService } from "@/services/role.service";
import { FormEvent, useEffect, useState } from "react";
import { MdAdminPanelSettings, MdAdd, MdEdit } from "react-icons/md";
import { toast } from "sonner";

interface FetchedRoles {
  roleId: string;
  name: string;
  description: string;
  isEditable: boolean;
  isActive: boolean;
}

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<FetchedRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Role Form
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [editingRole, setEditingRole] = useState<FetchedRoles | null>(null);


  // reset values
  const resetValues = () => {
    setRoleName("")
    setDescription("")
    setEditingRole(null)
  }


  // fetch roles
  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const data = await RoleService.getAll();
      setRoles(data);
    } catch (error) {
      console.error("Failed to fetch roles", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoles();
  }, []);


  // create role
  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        name: roleName,
        description
      }

      const data = await RoleService.create(payload);
      toast.success(data.message)
      resetValues()
      fetchRoles()
    } catch (error) {
      console.error("Failed to create role", error);
    }
  }

  // update role
  const handleUpdateRole = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if(!editingRole) return;

      const payload = {
        name: roleName,
        description,
        isActive: editingRole?.isActive
      }

      const data = await RoleService.update(editingRole?.roleId, payload)
      toast.success(data.message)
      resetValues();
      fetchRoles();
    } catch (error) {
      console.error("Failed to Update role", error);
    }
  }

  // handle editing role model
  const handleEditRole = (role: FetchedRoles) => {
    setEditingRole(role);
    setRoleName(role.name);
    setDescription(role.description || "");
    // Scroll to form if needed
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setRoleName("");
    setDescription("");
  };


  // delete role
  const handleRoleDelete = async (id: string) => {
    try {
      const data = await RoleService.delete(id);
      fetchRoles()
      toast.success(data.message)
    } catch (error) {
      console.error("Failed to Delete role", error);
    }
  }

  const RequestDeleteRole = (roleId: string, name: string) => {
    toast(
      <span>
        Are you sure you want to delete the role{" "}
        <b className="text-red-500 ml-1">{name}</b>?
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => handleRoleDelete(roleId),
        },
        duration: 10000,
        closeButton: true,
      },
    );
  };


  // toggle role status
  const handleToggleRole = async (role: FetchedRoles) => {
    const nextIsActive = !role.isActive;

    try {
      const payload = {
        name: role.name,
        description: role.description,
        isActive: nextIsActive
      }

      const data = await RoleService.update(role.roleId, payload);
      console.log("toggle data: ", data)
      toast.success(data.message)

      setRoles((prev) =>
        prev.map((r) =>
          r.roleId === role.roleId ? { ...r, isActive: nextIsActive } : r,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3">
          <MdAdminPanelSettings className="text-purple-600" /> Role Management
        </h1>
        <p className="text-sm text-gray-500">
          Manage system roles and permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6 rounded-xl shadow-lg border-t">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">System Roles</h2>
            <span>
              <b>Total:</b> {roles.length}
            </span>
          </div>
          <hr className="text-neutral-400/50 mb-4" />

          {isLoading ? (
            <div className="h-80 flex justify-center items-center">
              < LoadingSpinner />
            </div>
          ) : roles.length === 0 ? (
            <div className="h-80 flex justify-center items-center">
              <p className="text-gray-500">No roles configured.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 h-[60dvh] overflow-y-scroll">
              {roles
                .slice()
                .map((role) => (
                  <div
                    key={role.roleId}
                    className={`p-4 flex justify-between items-center shadow-md rounded-lg border transition-all duration-150 border-neutral-500/20 mr-2 ${!role.isActive ? "bg-neutral-200 dark:bg-gray-800" : ""}`}
                  >
                    <div className="flex flex-col justify-between mb-1 w-full">
                      <div className="flex justify-between items-center gap-4 mb-4">
                        <span className={`font-bold text-lg capitalize ${!role.isActive ? "text-gray-500/50" : ""}`}>
                          {role.name}
                        </span>

                        <div className="flex gap-2 items-center">
                          <div className="flex items-center gap-2">
                            {role.isEditable && (
                              <>
                                <button onClick={() => handleEditRole(role)}
                                  className="cursor-pointer hover:bg-blue-100 ring ring-transparent hover:ring-blue-200 p-2 rounded-full transition-all duration-200"
                                  title={`Edit ${role.name}`}
                                >
                                  <EditIcon color="blue" />
                                </button>
                                <button onClick={() => RequestDeleteRole(role.roleId, role.name)}
                                  className="cursor-pointer hover:bg-red-100 ring ring-transparent hover:ring-red-200 p-2 rounded-full transition-all duration-200"
                                  title={`Delete ${role.name}`}
                                >
                                  <DeleteIcon color="red" />
                                </button>
                              </>
                            )}
                            <ToggleButton
                              checked={role.isActive}
                              onChange={() => handleToggleRole(role)}
                            />
                          </div>
                        </div>
                      </div>
                      <p className={`text-sm text-gray-500 ${!role.isActive ? "text-gray-100" : "text-gray-500"}`}>
                        {role.description || "No description provided."}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card p-6 rounded-xl shadow-lg border-t h-fit">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            {editingRole ? (
              <MdEdit className="text-blue-600" />
            ) : (
              <MdAdd className="text-purple-600" />
            )}
            {editingRole ? "Update Role" : "Create New Role"}
          </h2>
          <hr className="text-neutral-400/50 mb-4" />

          <form onSubmit={editingRole ? handleUpdateRole : handleCreateRole} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold text-gray-700 required">
                Role Name
              </label>
              <input
                type="text"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Pharmacist"
                className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-border"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe role responsibilities"
                className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-border min-h-25 max-h-25"
              />
            </div>

            <div className="flex gap-3">
              {editingRole && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-1/3 mt-2 border border-neutral-400 text-gray-700 font-semibold py-3 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className={`w-full mt-2 ${editingRole ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"} text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer`}
              >
                {editingRole ? "Update Role" : "Save Role"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
