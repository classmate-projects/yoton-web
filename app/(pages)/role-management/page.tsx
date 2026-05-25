"use client";

import ToggleButton from "@/components/ToggleButton";
import DeleteIcon from "@/public/icons/deleteIcon";
import { useEffect, useState } from "react";
import { MdAdminPanelSettings, MdAdd } from "react-icons/md";
import { toast } from "sonner";

interface FetchedRoles {
  roleId: number;
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

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/role");
      const data = await res.json();
      setRoles(data.body);
      console.log("Fetched roles:", data.body);
    } catch (error) {
      console.error("Failed to fetch roles", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const callfetchRoles = () => {
      fetchRoles();
    };

    callfetchRoles();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName,
          description,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message);
        setRoleName("");
        setDescription("");
        fetchRoles();
      } else {
        toast.warning(data.message || data.error || "Failed to create role");
        setRoleName("");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRoleDelete = async (roleId: number) => {
    try {
      await fetch("/api/role", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      fetchRoles();
    } catch {
      console.log("Error: error with deleting role");
    }
  };

  const RequestDeleteRole = (roleId: number, name: string) => {
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

  const handleToggleRole = async (role: FetchedRoles) => {
    console.log("from confirmation: ", role.roleId)
    const nextIsActive = !role.isActive;

    try {
      const res = await fetch("/api/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: role.roleId,
          name: role.name,
          description: role.description,
          isActive: nextIsActive,
        }),
      });

      if (!res.ok) {
        toast.warning("Failed to update role status");
        return;
      }

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
              <p>Loading...</p>
            </div>
          ) : roles.length === 0 ? (
            <div className="h-80 flex justify-center items-center">
              <p className="text-gray-500">No roles configured.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 h-[60dvh] overflow-y-scroll">
              {roles
                .slice()
                .sort((a, b) => b.roleId - a.roleId)
                .map((role) => (
                  <div
                    key={role.roleId}
                    className={`p-4 flex justify-between items-center shadow-md rounded-lg border transition-all duration-150 border-neutral-500/20 mr-2 ${!role.isActive ? "bg-neutral-200" : ""}`}
                  >
                    <div className="flex flex-col justify-between mb-1">
                      <span className={`font-bold text-lg capitalize ${!role.isActive ? "text-gray-500/50" : "text-gray-800"}`}>
                        {role.name}
                      </span>
                      <p className={`text-sm text-gray-500 ${!role.isActive ? "text-gray-100" : "text-gray-500"}`}>
                        {role.description || "No description provided."}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 items-center">
                      <ToggleButton
                        checked={role.isActive}
                        onChange={() => handleToggleRole(role)}
                      />
                      {role.isEditable && (
                        <button onClick={() => RequestDeleteRole(role.roleId, role.name)}
                          className="cursor-pointer hover:bg-red-100 ring ring-transparent hover:ring-red-200 p-2 rounded-full transition-all duration-200"
                          title={`Delete ${role.name}`}
                        >
                          <DeleteIcon color="red" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="card p-6 rounded-xl shadow-lg border-t h-fit">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MdAdd className="text-purple-600" /> Create New Role
          </h2>
          <hr className="text-neutral-400/50 mb-4" />

          <form onSubmit={handleCreateRole} className="flex flex-col gap-4">
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
                className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border)"
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
                className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border) min-h-25 max-h-25"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
            >
              Save Role
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
