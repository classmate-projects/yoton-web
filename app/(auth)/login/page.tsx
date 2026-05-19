"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// icons
import { LuEye, LuEyeClosed } from "react-icons/lu";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [emailOrUserName, setEmailOrUserName] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailOrUserName, password }),
      });

      if (!res.ok) {
        throw new Error("Login failed");
      }

      const data = await res.json();
      console.log("Login successful:", data);

      router.push("/");
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div
      className="h-dvh w-full flex justify-center items-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="h-dvh sm:h-fit w-full px-4 sm:px-16 py-8 rounded-xl shadow-xl border-t max-w-150 flex flex-col gap-4 justify-center items-center card">
        <div className=" flex flex-col items-center gap-1 pb-10">
          <h1
            className="text-4xl font-bold text-center"
            style={{ color: "var(--color-text)" }}
          >
            Login Page
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Welcome back to Yoton
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className=" w-full flex flex-col justify-center gap-6 "
        >
          <div className="flex flex-col gap-4 w-full">
            <div>
              <input
                type="text"
                id="email"
                name="email"
                value={emailOrUserName}
                onChange={(e) => setEmailOrUserName(e.target.value)}
                placeholder="username@yoton.to"
                className="outline-0 p-4 rounded-xl w-full"
                style={{
                  backgroundColor: "var(--color-highlight)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                required
              />
            </div>
            <div
              className="relative outline-0 p-4 rounded-xl w-full"
              style={{
                backgroundColor: "var(--color-highlight)",
                border: "1px solid var(--color-border)",
              }}
            >
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="outline-none w-[93%] mr-8 flex-1 bg-transparent border-0"
                style={{ color: "var(--color-text)" }}
                required
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 transform -translate-y-1/2 cursor-pointer h-10 w-10 flex items-center justify-center"
              >
                {showPassword ? (
                  <LuEye className="text-xl" />
                ) : (
                  <LuEyeClosed className="text-xl" />
                )}
              </span>
            </div>
          </div>
          <button
            className="theme-blue text-white font-bold flex items-center justify-center gap-2 w-full p-4 rounded-xl mt-4 cursor-pointer hover:bg-[#00288E]/80 transition-all duration-200"
            type="submit"
          >
            Login
          </button>
        </form>
        <Link
          href="/forgot-password"
          className="text-center flex justify-center items-center gap-2 transition-all duration-200 cursor-pointer"
          style={{ color: "var(--color-accent)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--color-accent-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--color-accent)")
          }
        >
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
