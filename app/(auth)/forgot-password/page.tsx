'use client';

interface emailSendResponseType {
  email: string;
  message: string;
  token: string;
}

import AskEmailPage from "@/components/forgotPassword/AskEmail";
import SetPasswordPage from "@/components/forgotPassword/SetPassword";
import { useEffect, useState } from "react";


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [showAskEmail, setshowAskEmail] = useState<boolean>(true)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const error =
    confirmPassword && password !== confirmPassword
      ? "Both fields should be same!"
      : "";


  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("email: ", email)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })

      const data: emailSendResponseType = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to generate password reset token")

      setToken(data.token)
      setshowAskEmail(false);

    } catch (error) {
      console.log(error)
    }
  }


  const handleSubmitNewPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
  
    if (error) return;
  
    
  }

  return (
    <div className="h-dvh w-full flex justify-center items-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="h-dvh sm:h-fit w-full max-w-150 px-4 sm:px-16 py-8 rounded-xl shadow-xl flex flex-col justify-center items-center card">
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
            setshowAskEmail={setshowAskEmail}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
