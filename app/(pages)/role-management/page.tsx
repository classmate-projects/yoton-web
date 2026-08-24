"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import DeleteIcon from "@/public/icons/deleteIcon";
import EditIcon from "@/public/icons/EditIcon";
import { RoleService } from "@/services/role.service";
import { FormEvent, useEffect, useState } from "react";
import { MdAdminPanelSettings, MdAdd, MdEdit, MdChecklist, MdClose } from "react-icons/md";
import { toast } from "sonner";
import axios from "axios";
import { FetchedRoles } from "@/types/role.type";
import { useRoleSignalR } from "@/hooks/useRoleSignalR";
import { sidebarMenuItems } from "@/helpers/sidebaritems";
import { DEFAULT_ROLE_ICON_KEY, getRoleIcon } from "@/helpers/roleIcons";
import RoleIconPicker from "@/components/RoleIconPicker";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Settings is always reachable regardless of role, and Confidential Notes is nurse-only
// and excludes even admin (NursingController's confidential-note endpoints refuse admin
// outright) - neither is ever offered as a toggle here. See components/sidebar.tsx and
// app/(pages)/layout.tsx's matching hardcoded exemptions.
// Every module is offered to every role, built-in or brand new - access is now a per-role
// allow-list (Cli_RoleModulePermissions) rather than a hardcoded roles[] array that a
// hidden-modules table could only narrow, so there's no "eligibility" left to filter by.
// A role with no configuration yet (a freshly created one) simply starts fully unchecked.
const allToggleableModules = sidebarMenuItems.filter(
  (item) => item.navLink !== "/settings" && item.navLink !== "/nursing/confidential-notes",
);

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<FetchedRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Role Form
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [iconKey, setIconKey] = useState<string>(DEFAULT_ROLE_ICON_KEY);
  const [editingRole, setEditingRole] = useState<FetchedRoles | null>(null);

  // Module permissions modal
  const [permissionsRole, setPermissionsRole] = useState<FetchedRoles | null>(null);
  const [visibleModules, setVisibleModules] = useState<Set<string>>(new Set());
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);


  // reset values
  const resetValues = () => {
    setRoleName("")
    setDescription("")
    setIconKey(DEFAULT_ROLE_ICON_KEY)
    setEditingRole(null)
  }

  useRoleSignalR(setRoles)


  // fetch roles
  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await RoleService.getAll();
      setRoles(res.data);
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
        description,
        iconKey
      }

      const data = await RoleService.create(payload);
      toast.success(data.message)
      resetValues()
    } catch (error) {
      if(axios.isAxiosError(error)) {
        toast.error(error.response?.data.message)
      } else {
        toast.error("Something went wrong")
      }
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
        isActive: editingRole?.isActive,
        iconKey
      }

      const data = await RoleService.update(editingRole?.roleId, payload)
      toast.success(data.message)
      resetValues();
    } catch (error) {
      console.error("Failed to Update role", error);
    }
  }

  // handle editing role model
  const handleEditRole = (role: FetchedRoles) => {
    setEditingRole(role);
    setRoleName(role.name);
    setDescription(role.description || "");
    setIconKey(role.iconKey || DEFAULT_ROLE_ICON_KEY);
    // Scroll to form if needed
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setRoleName("");
    setDescription("");
    setIconKey(DEFAULT_ROLE_ICON_KEY);
  };


  // delete role
  const handleRoleDelete = async (id: string) => {
    try {
      const data = await RoleService.delete(id);
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
        isActive: nextIsActive,
        // Preserve the current icon - RoleController.Update overwrites IconKey
        // unconditionally, so omitting this would silently clear it on a plain toggle.
        iconKey: role.iconKey || undefined
      }

      const data = await RoleService.update(role.roleId, payload);
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

  // open module permissions modal
  const handleOpenPermissions = async (role: FetchedRoles) => {
    setPermissionsRole(role);
    setLoadingPermissions(true);
    try {
      const data = await RoleService.getAllowedModules(role.roleId);
      // Empty for a freshly created role that's never been configured - the checklist
      // simply starts fully unchecked, per allToggleableModules always listing every module.
      setVisibleModules(new Set(data.data ?? []));
    } catch (error) {
      console.error("Failed to fetch role permissions", error);
      toast.error("Failed to load current permissions");
      setVisibleModules(new Set());
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleClosePermissions = () => {
    setPermissionsRole(null);
    setVisibleModules(new Set());
  };

  const handleToggleModule = (navLink: string) => {
    setVisibleModules((prev) => {
      const next = new Set(prev);
      if (next.has(navLink)) next.delete(navLink);
      else next.add(navLink);
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionsRole) return;
    setSavingPermissions(true);
    try {
      const data = await RoleService.setAllowedModules(permissionsRole.roleId, [...visibleModules]);
      toast.success(data.message);
      handleClosePermissions();
    } catch (error) {
      console.error("Failed to update role permissions", error);
      toast.error("Failed to save permissions");
    } finally {
      setSavingPermissions(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
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
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .map((role) => (
                  <div
                    key={role.roleId}
                    className={`p-4 flex justify-between items-center shadow-md rounded-lg border transition-all duration-150 border-neutral-500/20 mr-2 ${!role.isActive ? "bg-neutral-200 dark:bg-gray-800" : ""}`}
                  >
                    <div className="flex flex-col justify-between mb-1 w-full">
                      <div className="flex justify-between items-center gap-4 mb-4">
                        <span className={`flex items-center gap-2 font-bold text-lg capitalize ${!role.isActive ? "text-gray-500/50" : ""}`}>
                          <FontAwesomeIcon icon={getRoleIcon(role.iconKey)} size="lg" className="shrink-0 text-purple-600" />
                          {role.name}
                        </span>

                        <div className="flex gap-2 items-center">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenPermissions(role)}
                              className="cursor-pointer hover:bg-purple-100 ring ring-transparent hover:ring-purple-200 p-2 rounded-full transition-all duration-200"
                              title={`Manage modules visible to ${role.name}`}
                            >
                              <MdChecklist className="text-purple-600" size={18} />
                            </button>
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

            <div>
              <label className="text-sm font-bold text-gray-700">
                Icon
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Shown on the admin sidebar&apos;s per-role tile.
              </p>
              <RoleIconPicker value={iconKey} onChange={setIconKey} />
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

      {permissionsRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-6xl rounded-xl border border-border p-6 shadow-2xl mx-4">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                <MdChecklist className="text-purple-600" />
                Modules for <span className="capitalize">{permissionsRole.name}</span>
              </h2>
              <button
                onClick={handleClosePermissions}
                className="cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-700 p-1.5 rounded-full transition-all duration-200"
                title="Close"
              >
                <MdClose size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Check a module to grant this role access to it. Every module starts unchecked
              for a role until you configure it; Settings is always available to every role.
            </p>

            {loadingPermissions ? (
              <div className="h-60 flex justify-center items-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 max-h-[50dvh] overflow-y-auto pr-1">
                {allToggleableModules.map((item) => (
                  <label
                    key={item.navLink}
                    className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleModules.has(item.navLink)}
                      onChange={() => handleToggleModule(item.navLink)}
                      className="h-4 w-4 shrink-0 accent-purple-600 cursor-pointer"
                    />
                    <item.icon />
                    <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleClosePermissions}
                className="w-1/3 border border-neutral-400 text-gray-700 font-semibold py-3 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={loadingPermissions || savingPermissions}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
              >
                {savingPermissions ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
