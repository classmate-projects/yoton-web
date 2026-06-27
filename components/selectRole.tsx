"use client";

import { RoleService } from "@/services/role.service";
import { AvailableRolesType, SelectRoleProps } from "@/types/selectRole";
import { useEffect, useState } from "react";

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

  return (
    <select
      name="role"
      id="role"
      value={role}
      onChange={(e) => setRole(e.target.value)}
      className={`w-full capitalize ${selectRole ? "h-12 px-4" : "h-10 px-3"}`}
      required
    >
      {selectRole && (
        <option value="" disabled>
          Select Role
        </option>
      )}

      {
        allRole && (
          <option value="allRole">All Roles</option>
        )
      }

      {availableRoles.map((role) => (
        <option key={role.roleId} value={role.name} className="capitalize">
          {role.name}
        </option>
      ))}
    </select>
  );
}
