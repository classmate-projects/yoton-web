"use client";

interface EmailSendResponseType {
  email: string;
  message: string;
  token: string;
}

import AskEmailPage from "@/components/forgotPassword/AskEmail";
import SetPasswordPage from "@/components/forgotPassword/SetPassword";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
    <div className="min-h-screen w-full flex justify-center items-center bg-background p-4">
      <div className="w-full max-w-[500px] card p-8 sm:p-12 shadow-xl border-border/50">
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
    </div>
  );
}
