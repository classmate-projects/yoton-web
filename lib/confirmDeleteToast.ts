import type { ReactNode } from "react";
import { toast } from "sonner";

// Single reusable "are you sure?" delete confirmation - was copy-pasted with minor
// variations across patient-records, departments, role-management, user-management,
// and ListItemManager. Nothing is deleted until the toast's own "Delete" action is
// clicked; dismissing/ignoring the toast cancels it.
export function confirmDeleteToast(message: ReactNode, onConfirm: () => void) {
  toast(message, {
    action: {
      label: "Delete",
      onClick: onConfirm,
    },
    duration: 10000,
    closeButton: true,
  });
}
