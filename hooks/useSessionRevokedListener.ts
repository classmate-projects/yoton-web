"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getSignalRConnection } from "@/lib/signalR";
import { getUserDetail } from "@/lib/userDetail";
import { logout } from "@/lib/auth";

interface SessionRevokedPayload {
  userId: string;
  reason: string;
}

// An admin can move a staff member to a different branch (directly, or in bulk while
// removing their old branch) while that staff member is already signed in elsewhere - their
// open session was authorized against a branch assignment that no longer holds, so it's
// force-ended here instead of being left to run until its access token naturally expires.
// UserController/BranchController broadcast this over the shared notification hub (the same
// broadcast-and-filter-by-id pattern useRolePermissionsSync uses for role changes); every
// OTHER open tab/session just ignores an event that isn't about it.
export function useSessionRevokedListener() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const handleRevoked = async (payload: SessionRevokedPayload) => {
      const myUserId = getUserDetail()?.userId;
      if (!myUserId || payload.userId !== myUserId) return;

      await logout();
      toast.error(payload.reason);
      router.push("/login");
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;

      connection.off("sessionRevoked", handleRevoked);
      connection.on("sessionRevoked", handleRevoked);
    };

    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection()
        .then((connection) => connection.off("sessionRevoked", handleRevoked))
        .catch(() => {});
    };
  }, [router]);
}
