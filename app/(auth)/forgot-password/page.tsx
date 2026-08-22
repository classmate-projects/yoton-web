"use client";

interface EmailSendResponseType {
  message: string;
}

import AskEmailPage from "@/components/forgotPassword/AskEmail";
import SetPasswordPage from "@/components/forgotPassword/SetPassword";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import logo from "@/public/yoton_logo.png";
import LoadingSpinner from "@/components/LoadingSpinner";

function ForgotPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Arriving here via the emailed reset link (?token=...) skips straight to
  // setting a new password — the token itself is never exposed anywhere else,
  // since echoing it back in the initial API response would let anyone who
  // merely knows an account's email reset that account's password outright.
  const tokenFromLink = searchParams.get("token") ?? "";
  // Prefilled when the mobile app hands off here (e.g. "update your default
  // password" prompt) so the patient isn't retyping an email they already gave
  // the app moments ago.
  const emailFromLink = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailFromLink);
  const [token] = useState(tokenFromLink);
  const [emailSent, setEmailSent] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const validationError =
    confirmPassword && password !== confirmPassword
      ? "Both fields should be same!"
      : "";

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingResetLink(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data: EmailSendResponseType = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send reset link");

      setEmailSent(true);
      toast.success(data.message || "Reset link sent to your email!");
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSendingResetLink(false);
    }
  };

  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;
    setIsSavingPassword(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, token }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password");

      toast.success("Password reset successful!");
      router.push("/login");
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background px-5 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="card grid w-full overflow-hidden rounded-4xl shadow-[0_24px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden bg-[color-mix(in_srgb,var(--primary)_85%,black)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl">
                <Image
                  src={logo}
                  alt="Yoton Health"
                  className="h-8 w-8 object-contain"
                  priority
                />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">Yoton Health</p>
                <p className="mt-1 text-sm text-white/70">Account recovery</p>
              </div>
            </div>

            <div className="max-w-sm">
              <p className="mb-4 text-sm font-semibold uppercase text-white/90">
                Secure reset
              </p>
              <h1 className="text-4xl font-bold leading-tight">
                Get back into your workspace without the friction.
              </h1>
              <p className="mt-5 text-sm leading-6 text-white/72">
                Verify your account, set a new password, and return to the
                hospital dashboard with a cleaner recovery flow.
              </p>
            </div>

            <p className="text-sm text-white/60">
              © {new Date().getFullYear()} Yoton Health.
            </p>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-9 flex items-center justify-center gap-3 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-md">
                  <Image
                    src={logo}
                    alt="Yoton Health"
                    className="h-8 w-8 object-contain"
                    priority
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-none">
                    Yoton Health
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Account recovery
                  </p>
                </div>
              </div>

              {token ? (
                <SetPasswordPage
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  handleSubmitNewPassword={handleSubmitNewPassword}
                  setshowAskEmail={() => router.push("/forgot-password")}
                  error={validationError}
                  isSaving={isSavingPassword}
                />
              ) : emailSent ? (
                <div className="text-center">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MailCheck size={22} />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Check your email
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    If <b>{email}</b> is registered with us, a password reset
                    link is on its way. It expires in 30 minutes.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEmailSent(false)}
                    className="mt-6 text-sm font-semibold text-primary hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <AskEmailPage
                  email={email}
                  setEmail={setEmail}
                  handleEmailSubmit={handleEmailSubmit}
                  isSending={isSendingResetLink}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <ForgotPasswordPageInner />
    </Suspense>
  );
}
