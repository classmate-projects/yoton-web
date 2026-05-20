"use client";

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
        const res = await fetch("/api/role");
        const data = await res.json();
        setAvailableRoles(data.body);
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
      className={`${selectRole ? "outline-0 px-4 py-4.75 rounded-xl w-full capitalize bg-(--color-highlight) border border-(--color-border) text-(--color-text)" : "border border-neutral-500 px-4 py-2 rounded-md outline-0"}`}
      required
    >
      {selectRole && (
        <option value="" disabled>
          Select Role
        </option>
      )}

      {
        allRole && (
            <option value="allRole">All roles</option>
        )
      }

      {availableRoles.map((role) => (
        <option key={role.id} value={role.name} className="capitalize">
          {role.name}
        </option>
      ))}
    </select>
  );
}
