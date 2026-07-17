import { useEffect } from "react";
import { getSignalRConnection } from "@/lib/signalR";
import { FetchedRoles } from "@/types/role.type";

export function useRoleSignalR(
  setRoles: React.Dispatch<React.SetStateAction<FetchedRoles[]>>
) {
  useEffect(() => {
    let isMounted = true;

    const handleRoleCreated = (newRole: FetchedRoles) => {
      setRoles((prev) => {
        if (prev.some((r) => r.roleId === newRole.roleId)) {
          return prev;
        }

        return [newRole, ...prev];
      });
    };

    const handleRoleUpdated = (updatedRole: FetchedRoles) => {
      setRoles((prev) =>
        prev.map((role) =>
          role.roleId === updatedRole.roleId ? updatedRole : role
        )
      );
    };

    const handleRoleDeleted = (deletedRole: FetchedRoles) => {
      setRoles((prev) =>
        prev.filter((role) => role.roleId !== deletedRole.roleId)
      );
    };

    const connect = async () => {
      const connection = await getSignalRConnection();

      if (!isMounted) return;

      // Prevent duplicate subscriptions
      connection.off("roleCreated", handleRoleCreated);
      connection.off("roleUpdated", handleRoleUpdated);
      connection.off("roleDeleted", handleRoleDeleted);

      connection.on("roleCreated", handleRoleCreated);
      connection.on("roleUpdated", handleRoleUpdated);
      connection.on("roleDeleted", handleRoleDeleted);
    };

    connect();

    return () => {
      isMounted = false;

      getSignalRConnection().then((connection) => {
        connection.off("roleCreated", handleRoleCreated);
        connection.off("roleUpdated", handleRoleUpdated);
        connection.off("roleDeleted", handleRoleDeleted);
      });
    };
  }, [setRoles]);
}