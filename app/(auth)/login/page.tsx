"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import logo from "@/public/yoton_logo.png";
import pkg from "@/package.json";

export default function LoginPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [emailOrUserName, setEmailOrUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // `loading` alone isn't enough to stop a duplicate submit: it only disables the button
  // once React actually re-renders, and two submit events fired close together (a fast
  // double-click, autofill's Enter plus a click, etc.) can both start handleLogin before that
  // happens. A ref updates synchronously, so this guard works regardless of render timing -
  // and regardless of what actually fired the second submit, since each one reaches the
  // server as its own successful login and its own audit log entry.
  const submittingRef = useRef(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUserName, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      localStorage.setItem("yoton_token", data.body.token);

      localStorage.setItem(
        "yoton_user_detail",
        JSON.stringify({
          role: data.body.role,
          name: data.body.name,
          userId: data.body.userId,
          companyId: data.body.companyId,
          companyName: data.body.companyName,
          companyLogoUrl: data.body.companyLogoUrl,
          userImage: data.body.userImage,
          allowedModules: data.body.allowedModules ?? [],
          country: data.body.country,
          currencyCode: data.body.currencyCode,
          currencySymbol: data.body.currencySymbol,
          idleTimeoutMinutes: data.body.idleTimeoutMinutes,
        }),
      );

      toast.success(`Welcome back, ${data.body.name}!`);
      router.push("/");
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
      submittingRef.current = false;
      setLoading(false)
    }
  };

  return (
    <main className="min-h-screen w-full bg-background text-foreground">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[color-mix(in_srgb,var(--primary)_85%,black)] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.13)_0%,rgba(255,255,255,0)_42%),radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(0,0,0,0.22),transparent_30%)]" />
          <div className="relative z-10 flex items-center gap-3">
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
              <p className="mt-1 text-sm text-white/70">
                Care operations suite
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/85">
              <ShieldCheck size={16} />
              Secure staff access
            </div>
            <h1 className="max-w-lg text-5xl font-bold leading-tight">
              Run the hospital day from one calm dashboard.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/76">
              Sign in to manage patients, departments, staff activity, billing,
              pharmacy, diagnostics, and the work that keeps every shift moving.
            </p>

            <div className="mt-10 grid max-w-lg grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/16 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur">
                <Activity className="mb-5 text-white/90" size={24} />
                <p className="text-3xl font-semibold">24/7</p>
                <p className="mt-1 text-sm text-white/68">
                  Operational visibility
                </p>
              </div>
              <div className="rounded-2xl border border-white/16 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur">
                <ShieldCheck className="mb-5 text-white/90" size={24} />
                <p className="text-3xl font-semibold">Role</p>
                <p className="mt-1 text-sm text-white/68">Based permissions</p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-sm text-white/60">
            © {new Date().getFullYear()} Yoton Health. All rights reserved. · v{pkg.version}
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
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
                  Care operations suite
                </p>
              </div>
            </div>

            <div className="card rounded-4xl p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-9">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase text-primary">
                  Welcome back
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                  Sign in to Yoton
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Use your staff username and password to continue to the
                  hospital dashboard.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="login-username"
                    className="text-sm font-semibold text-foreground/90"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                      <UserRound size={18} />
                    </span>
                    <input
                      id="login-username"
                      type="text"
                      value={emailOrUserName}
                      onChange={(e) => setEmailOrUserName(e.target.value)}
                      placeholder="Enter your username"
                      className="h-12 rounded-2xl border-border! bg-muted/40! pl-12! pr-4 text-base! text-foreground placeholder:text-muted-foreground! focus-visible:bg-card!  focus-visible:ring-transparent!"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="login-password"
                      className="text-sm font-semibold text-foreground/90"
                    >
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                      <LockKeyhole size={18} />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="h-12 rounded-2xl border-border! bg-muted/40! pl-12! pr-12! text-base! text-foreground! placeholder:text-muted-foreground! focus-visible:bg-card!  focus-visible:ring-transparent!"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  disabled={loading || !password || !emailOrUserName}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Signing in
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight
                        size={17}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center">
                  <Link
                    href="/forgot-password"
                    title="Forgot Password"
                    className="text-sm font-semibold text-primary transition-colors hover:text-primary/75"
                  >
                    Forgot password?
                  </Link>
                </div>
              </form>
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground lg:hidden">
              © {new Date().getFullYear()} Yoton Health. All rights reserved. · v{pkg.version}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
