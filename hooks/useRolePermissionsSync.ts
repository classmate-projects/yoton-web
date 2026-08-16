import { useEffect } from "react";
import { getSignalRConnection } from "@/lib/signalR";
import { patchUserDetail } from "@/lib/userDetail";

interface RolePermissionsUpdatedPayload {
  roleName: string;
  hiddenModules: string[];
}

// Keeps an already-open session's sidebar in sync when an admin changes what that
// session's role can see (RoleController.SetHiddenModules) - without this, the change
// would only take effect the next time the affected user logs in. patchUserDetail's own
// onUserDetailChange event is what the sidebar already listens to for re-rendering (same
// mechanism used for live avatar/logo updates), so this hook only needs to update storage.
export function useRolePermissionsSync(userRole: string) {
  useEffect(() => {
    if (!userRole) return;
    let isMounted = true;

    const handleUpdated = (payload: RolePermissionsUpdatedPayload) => {
      if (payload.roleName !== userRole) return;
      patchUserDetail({ hiddenModules: payload.hiddenModules });
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;

      connection.off("rolePermissionsUpdated", handleUpdated);
      connection.on("rolePermissionsUpdated", handleUpdated);
    };

    connect();

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("rolePermissionsUpdated", handleUpdated);
      });
    };
  }, [userRole]);
}
