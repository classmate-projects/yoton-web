"use client";

import { useEffect, useState } from "react";
import { MdAdminPanelSettings, MdAdd } from "react-icons/md";
import { RiDeleteBinLine } from "react-icons/ri";
import { toast } from "sonner";

interface Role {
  id: number;
  name: string;
  description: string;
}

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Role Form
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/role");
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
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

      if (res.ok) {
        alert("Role created successfully");
        setRoleName("");
        setDescription("");
        fetchRoles();
      } else {
        alert("Failed to create role");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRoleDelete = async (id: number) => {
    try {
      const data = await fetch("/api/role", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      })

      const res = await data.json();

      console.log("delete response: ", res)
      fetchRoles();
    } catch {
      console.log("Error: error with deleting role")
    }
  }


  const RequestDeleteRole = (id: number, name: string) => {
    toast(
      <span>
        Delete role: <b className="text-red-500 ml-1">{name}</b>
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => handleRoleDelete(id)
        }
      }
    )
  }

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
          <h2 className="text-2xl font-semibold mb-4">System Roles</h2>
          <hr className="text-neutral-400/50 mb-4" />

          {isLoading ? (
            <p>Loading...</p>
          ) : roles.length === 0 ? (
            <p className="text-gray-500">No roles configured.</p>
          ) : (
            <div className="flex flex-col gap-3 h-[60dvh] overflow-y-scroll">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="p-4 border rounded-lg bg-gray-50 hover:shadow-sm transition-shadow"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-lg text-gray-800">
                      {role.name}
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      ID: {role.id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">
                      {role.description || "No description provided."}
                    </p>
                    <button>
                      <RiDeleteBinLine onClick={() => RequestDeleteRole(role.id, role.name)} className="text-red-400 cursor-pointer hover:text-red-500 hover:scale-110 transition-all duration-150 text-xl" />
                    </button>
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
              <label className="text-sm font-bold text-gray-700">
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
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe role responsibilities"
                className="w-full mt-1 p-3 rounded-lg bg-(--color-highlight) border border-(--color-border) min-h-25"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Save Role
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
