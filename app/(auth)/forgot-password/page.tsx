"use client";

interface EmailSendResponseType {
  email: string;
  message: string;
  token: string;
}

import AskEmailPage from "@/components/forgotPassword/AskEmail";
import SetPasswordPage from "@/components/forgotPassword/SetPassword";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import logo from "@/public/yoton_logo.png";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [showAskEmail, setShowAskEmail] = useState<boolean>(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const validationError =
    confirmPassword && password !== confirmPassword
      ? "Both fields should be same!"
      : "";

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data: EmailSendResponseType = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate password reset token");

      setToken(data.token);
      setShowAskEmail(false);
      toast.success("Reset link sent to your email!");
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    }
  };

  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;

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
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#f6f9fc] px-5 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden bg-[#0b5968] p-10 text-white lg:flex lg:flex-col lg:justify-between">
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
              <p className="mb-4 text-sm font-semibold uppercase text-cyan-100">
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md">
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

              {showAskEmail ? (
                <AskEmailPage
                  email={email}
                  setEmail={setEmail}
                  handleEmailSubmit={handleEmailSubmit}
                />
              ) : (
                <SetPasswordPage
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  handleSubmitNewPassword={handleSubmitNewPassword}
                  setshowAskEmail={setShowAskEmail}
                  error={validationError}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
