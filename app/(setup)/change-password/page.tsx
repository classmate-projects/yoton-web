"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, KeyRound, Loader2, X } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";
import { AuthService } from "@/services/auth.service";
import { apiErrorMessage } from "@/lib/apiError";
import { getUserDetail, patchUserDetail } from "@/lib/userDetail";

// Mirrors the API's PasswordPolicy (Helpers/PasswordGenerator.cs). The "mustn't contain your
// username" rule is checked by the API only.
const RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 10 characters", test: (p) => p.length >= 10 },
  { label: "An upper-case letter", test: (p) => /[A-Z]/.test(p) },
  { label: "A lower-case letter", test: (p) => /[a-z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
  { label: "A symbol (e.g. ! @ # $)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function ChangePasswordPage() {
  const router = useRouter();
  const [issued, setIssued] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const detail = getUserDetail();
    setIssued(detail?.mustChangePassword === true);
    setIsSuperAdmin(detail?.role === "superadmin");
  }, []);

  const rulesMet = RULES.every((r) => r.test(next));
  const mismatch = confirm.length > 0 && confirm !== next;
  const sameAsCurrent = next.length > 0 && next === current;
  const canSave = !saving && current.length > 0 && rulesMet && confirm === next && !sameAsCurrent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await AuthService.changePassword(current, next);
      patchUserDetail({ mustChangePassword: false });
      toast.success("Password changed");
      router.replace(isSuperAdmin ? "/system-setup" : "/");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't change the password"));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-7 sm:p-9">
        <div className="mb-7">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound size={22} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {issued ? "Choose your own password" : "Change password"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {issued
              ? "You signed in with a password you were issued. Replace it with one only you know before continuing."
              : "Enter your current password, then the new one."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="current-password" className="required text-sm font-semibold text-foreground/90">
              {issued ? "Issued password" : "Current password"}
            </label>
            <PasswordInput
              id="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="required text-sm font-semibold text-foreground/90">
              New password
            </label>
            <PasswordInput
              id="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
            />
            <ul className="grid grid-cols-1 gap-1 pt-1 text-xs sm:grid-cols-2">
              {RULES.map((r) => {
                const ok = r.test(next);
                return (
                  <li key={r.label} className={`flex items-center gap-1.5 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {ok ? <Check size={13} /> : <X size={13} />}
                    {r.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="required text-sm font-semibold text-foreground/90">
              Confirm new password
            </label>
            <PasswordInput
              id="confirm-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            {mismatch && <p className="text-xs text-red-500">The passwords don&apos;t match.</p>}
            {sameAsCurrent && <p className="text-xs text-red-500">Choose a password different from the current one.</p>}
          </div>

          {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={!canSave}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Saving
              </>
            ) : (
              "Save password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
