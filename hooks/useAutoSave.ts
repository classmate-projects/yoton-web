import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { notifySaveStatus } from "@/lib/saveStatus";

// Watches `value` (compared by serialisation) and, after `delay` ms of no
// further changes, calls `saveFn`. Fires save-status events so the header
// indicator can reflect the state without each page managing that itself.
// saveFn is kept in a ref so callers don't need to memoize it.
export function useAutoSave<T>(
  value: T,
  saveFn: () => Promise<void>,
  delay = 800,
) {
  const isFirstRender = useRef(true);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    notifySaveStatus("saving");

    const timer = setTimeout(async () => {
      try {
        await saveFnRef.current();
        notifySaveStatus("saved");
      } catch {
        notifySaveStatus("error");
        toast.error("Auto-save failed");
      }
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, delay]);
}
