"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getSignalRConnection } from "@/lib/signalR";
import { AuthService } from "@/services/auth.service";
import { patchUserDetail } from "@/lib/userDetail";

interface RegionChangedPayload {
  code: string;
  country: string;
}

// The super administrator switched the installation's country (SystemController broadcasts
// systemRegionChanged). The new region is pulled into this session straight away, so anything
// reading it through lib/region.ts (currency, phone/ID formats, address fields, tax,
// country-only features) follows on its next render - and a reload is offered for whatever is
// already on screen, rather than forced, so nobody loses a half-filled form.
export function useRegionSync() {
  useEffect(() => {
    let isMounted = true;

    const handleChanged = async (payload: RegionChangedPayload) => {
      try {
        const me = await AuthService.getMe();
        patchUserDetail({
          region: me.region ?? null,
          systemConfigured: me.systemConfigured ?? true,
          country: me.country,
          currencyCode: me.currencyCode,
          currencySymbol: me.currencySymbol,
        });
      } catch {
        // The reload below fetches everything fresh anyway.
      }
      toast.info(`The system's country is now ${payload.country}`, {
        description: "Reload to apply its currency, formats and features on every screen.",
        duration: Infinity,
        action: { label: "Reload", onClick: () => window.location.reload() },
      });
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;
      connection.off("systemRegionChanged", handleChanged);
      connection.on("systemRegionChanged", handleChanged);
    };

    connect().catch(() => {});

    return () => {
      isMounted = false;
      getSignalRConnection()
        .then((connection) => connection.off("systemRegionChanged", handleChanged))
        .catch(() => {});
    };
  }, []);
}
