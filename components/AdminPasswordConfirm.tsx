"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import axios from "axios";
import { ShieldAlert } from "lucide-react";

interface AdminPasswordConfirmProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmingLabel: string;
  onCancel: () => void;
  // Throws on failure (e.g. wrong password) so this component can show the error inline
  // and let the caller retry, instead of the caller having to manage that state itself.
  onConfirm: (password: string) => Promise<void>;
  // Defaults to the original admin-specific copy - callers confirming a non-admin user's
  // own password (e.g. check-out, see app/(pages)/check-in/page.tsx) should override this,
  // since "admin password" would be actively wrong for a reception/nurse/doctor account.
  passwordPlaceholder?: string;
}

// Generic step-up re-auth prompt for actions that shouldn't happen from an unattended,
// already-open session - originally built for admin-only actions (restoring a soft-deleted
// user, see app/(pages)/user-registration/page.tsx; rehiring a terminated one, see
// app/(pages)/user-management/page.tsx - both bring back a whole account/employment history,
// not just flip a flag), since generalized to any "confirm your own current password"
// prompt regardless of role (e.g. attendance check-out).
export default function AdminPasswordConfirm({
  title,
  description,
  confirmLabel,
  confirmingLabel,
  onCancel,
  onConfirm,
  passwordPlaceholder = "Your admin password",
}: AdminPasswordConfirmProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;

    setSubmitting(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Incorrect password"
          : "Something went wrong"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md">
      <div className="bg-card w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl mx-4">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
          <ShieldAlert size={22} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1 text-center">{title}</h2>
        <p className="text-sm text-muted-foreground mb-4 text-center">{description}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={passwordPlaceholder}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="w-1/2 rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-1/2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? confirmingLabel : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
