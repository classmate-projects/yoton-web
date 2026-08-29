"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import ToggleButton from "@/components/ToggleButton";
import DeleteIcon from "@/public/icons/deleteIcon";
import EditIcon from "@/public/icons/EditIcon";
import { RoleService } from "@/services/role.service";
import { FormEvent, useEffect, useState } from "react";
import { MdAdminPanelSettings, MdAdd, MdEdit, MdChecklist, MdClose, MdLock, MdLockOpen } from "react-icons/md";
import { toast } from "sonner";
import axios from "axios";
import { FetchedRoles } from "@/types/role.type";
import { useRoleSignalR } from "@/hooks/useRoleSignalR";
import { sidebarMenuItems } from "@/helpers/sidebaritems";
import { DEFAULT_ROLE_ICON_KEY, getRoleIcon } from "@/helpers/roleIcons";
import RoleIconPicker from "@/components/RoleIconPicker";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Settings is always reachable regardless of role, and Confidential Notes is nurse-only
// and excludes even admin (NursingController's confidential-note endpoints refuse admin
// outright) - neither is ever offered as a toggle here. See components/sidebar.tsx and
// app/(pages)/layout.tsx's matching hardcoded exemptions.
// Every other module is offered to every role, built-in or brand new - access is now a
// per-role allow-list (Cli_RoleModulePermissions) rather than a hardcoded roles[] array
// that a hidden-modules table could only narrow, so there's no "eligibility" left to
// filter by. A role with no configuration yet (a freshly created one) simply starts fully
// unchecked.
const allToggleableModules = sidebarMenuItems.filter(
  (item) => item.navLink !== "/settings" && item.navLink !== "/nursing/confidential-notes",
);

// Mirrors the backend's ModuleKeys.AdminOnly exactly - each is either full account/
// permission administration or master reference/compliance data that shouldn't be
// reshapeable by a delegated role, so none of them are delegable through the plain
// checklist - shown below locked (rather than removed) so it's obvious *why* one can't be
// checked instead of just silently missing. The backend rejects a plain checklist grant of
// any of these outright even if this were bypassed (see ModuleKeys.AdminOnly's comment);
// force-assigning one anyway is a separate, deliberately harder, password-confirmed path
// (see handleForceAssignConfirm below and RoleController.ForceModule).
const ADMIN_ONLY_MODULES = new Set(["/user-management", "/departments", "/config-lists", "/icd-codes", "/reports/kpi"]);

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

  // Which admin-only module (if any) is currently prompting for the admin's own password
  // before force-assigning it - see handleForceAssignConfirm.
  const [forceAssignTarget, setForceAssignTarget] = useState<{ navLink: string; name: string } | null>(null);


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

  // Admin-only tiles don't use handleToggleModule/Save Permissions at all - each click
  // takes effect immediately through its own dedicated endpoint instead of being staged
  // into visibleModules and batched into the next Save (see RoleController.ForceModule/
  // RevokeModule's own comments on why granting and revoking these have different levels
  // of friction).
  const handleAdminOnlyModuleClick = (item: { navLink: string; name: string }) => {
    if (visibleModules.has(item.navLink)) {
      void handleRevokeForcedModule(item.navLink);
    } else {
      setForceAssignTarget(item);
    }
  };

  // Confirmed from the password prompt below - throws on failure (e.g. wrong password) so
  // AdminPasswordConfirm can show the error inline and let the admin retry.
  const handleForceAssignConfirm = async (adminPassword: string) => {
    if (!permissionsRole || !forceAssignTarget) return;
    const { navLink } = forceAssignTarget;
    await RoleService.forceAssignModule(permissionsRole.roleId, navLink, adminPassword);
    setVisibleModules((prev) => new Set(prev).add(navLink));
    toast.success(`${forceAssignTarget.name} force-assigned to ${permissionsRole.name}`);
    setForceAssignTarget(null);
  };

  // No password needed - revoking is always the safe direction.
  const handleRevokeForcedModule = async (navLink: string) => {
    if (!permissionsRole) return;
    try {
      await RoleService.revokeModule(permissionsRole.roleId, navLink);
      setVisibleModules((prev) => {
        const next = new Set(prev);
        next.delete(navLink);
        return next;
      });
      toast.success("Module access revoked");
    } catch (error) {
      console.error("Failed to revoke module", error);
      toast.error("Failed to revoke module");
    }
  };

  const grantableModules = allToggleableModules.filter((item) => !ADMIN_ONLY_MODULES.has(item.navLink));
  const allModulesSelected =
    grantableModules.length > 0 &&
    grantableModules.every((item) => visibleModules.has(item.navLink));
  const someModulesSelected = grantableModules.some((item) => visibleModules.has(item.navLink));

  const handleToggleAllModules = () => {
    setVisibleModules(
      allModulesSelected ? new Set() : new Set(grantableModules.map((item) => item.navLink)),
    );
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 content-start h-[60dvh] overflow-y-scroll">
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
              The locked (<MdLock className="inline align-text-top" size={13} />) modules are
              admin-only - click one to force-assign it after confirming your password, or
              click a force-assigned one to revoke it.
            </p>

            {loadingPermissions ? (
              <div className="h-60 flex justify-center items-center">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 p-2.5 mb-2 w-fit rounded-lg border border-border hover:bg-neutral-100 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allModulesSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someModulesSelected && !allModulesSelected;
                    }}
                    onChange={handleToggleAllModules}
                    className="h-4 w-4 shrink-0 accent-purple-600 cursor-pointer"
                  />
                  <span className="text-sm font-semibold">Select All</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 max-h-[50dvh] overflow-y-auto pr-1">
                {allToggleableModules.map((item) => {
                  const isAdminOnly = ADMIN_ONLY_MODULES.has(item.navLink);
                  const isForceGranted = isAdminOnly && visibleModules.has(item.navLink);

                  if (isAdminOnly) {
                    return (
                      <label
                        key={item.navLink}
                        title={
                          isForceGranted
                            ? "Force-assigned - click to revoke"
                            : "Admin only - click to force-assign (requires your password)"
                        }
                        onClick={() => handleAdminOnlyModuleClick(item)}
                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer ${
                          isForceGranted
                            ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
                            : "opacity-50 hover:opacity-75"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isForceGranted}
                          readOnly
                          className="h-4 w-4 shrink-0 accent-amber-600 pointer-events-none"
                        />
                        <item.icon />
                        <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>
                        {isForceGranted ? (
                          <MdLockOpen className="text-amber-600 shrink-0" size={14} />
                        ) : (
                          <MdLock className="text-muted-foreground shrink-0" size={14} />
                        )}
                      </label>
                    );
                  }

                  return (
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
                  );
                })}
                </div>
              </>
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

      {forceAssignTarget && permissionsRole && (
        <AdminPasswordConfirm
          title="Force-assign admin-only module"
          description={
            <>
              Grant <b>{forceAssignTarget.name}</b> to{" "}
              <b className="capitalize">{permissionsRole.name}</b>? Confirm your password to
              continue - this is normally admin-only.
            </>
          }
          confirmLabel="Force Assign"
          confirmingLabel="Assigning..."
          onCancel={() => setForceAssignTarget(null)}
          onConfirm={handleForceAssignConfirm}
        />
      )}
    </div>
  );
}
