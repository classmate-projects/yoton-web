"use client";

import { RoleService } from "@/services/role.service";
import { AvailableRolesType, SelectRoleProps } from "@/types/selectRole";
import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

export default function SelectRole({
  role,
  setRole,
  selectRole,
  allRole,
}: SelectRoleProps) {
  const [availableRoles, setAvailableRoles] = useState<AvailableRolesType[]>(
    [],
  );

  useEffect(() => {
    const fetchAvailableRoles = async () => {
      try {
        const res = await RoleService.getAll();
        setAvailableRoles(res.data);
      } catch (error) {
        console.error("Error fetching roles: ", error);
      }
    };

    fetchAvailableRoles();
  }, []);

  const options = [
    ...(allRole ? [{ value: "allRole", label: "All Roles" }] : []),
    ...availableRoles.map((r) => ({ value: r.name, label: r.name })),
  ];

  return (
    <SearchableSelect
      id="role"
      name="role"
      value={role}
      onChange={setRole}
      options={options}
      placeholder={selectRole ? "Select Role" : undefined}
      required
      className={`flex w-full items-center justify-between gap-1 rounded-xl border border-border bg-card capitalize text-foreground hover:bg-muted transition-colors ${selectRole ? "h-12 px-4" : "h-10 px-3"}`}
    />
  );
}
