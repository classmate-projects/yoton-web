"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  Boxes,
  Eye,
  EyeOff,
  FlaskConical,
  Globe2,
  HeartPulse,
  History,
  Loader2,
  LockKeyhole,
  Monitor,
  Moon,
  Pill,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import logo from "@/public/yoton_logo.png";
import pkg from "@/package.json";
import { backendAssetUrl } from "@/lib/backendAsset";
import {
  forgetAccount,
  getInitials,
  getRecentAccounts,
  maskIdentifier,
  rememberAccount,
  type RecentAccount,
} from "@/lib/recentAccounts";
import { clearOtherUsersViewModes } from "@/lib/viewModeCache";

// The welcome side's department chips - illustration only, nothing here is clickable.
const DEPARTMENTS = [
  { label: "Doctors", Icon: Stethoscope },
  { label: "Nursing", Icon: HeartPulse },
  { label: "Lab", Icon: FlaskConical },
  { label: "Pharmacy", Icon: Pill },
  { label: "Billing", Icon: ReceiptText },
  { label: "Stores", Icon: Boxes },
];

const HEARTBEAT_PATH =
  "M0 44 H64 L74 44 L82 32 L90 44 H118 L128 44 L137 8 L148 74 L157 44 H200 L210 36 L220 44 H252 L262 44 L271 14 L282 70 L291 44 H336 L346 34 L356 44 H400";

// A faint heartbeat trace with a brighter pulse running along it (see .login-heartbeat).
function HeartbeatLine() {
  return (
    <svg viewBox="0 0 400 80" className="my-4 h-auto w-full" aria-hidden>
      <path d={HEARTBEAT_PATH} fill="none" stroke="var(--border)" strokeWidth={2} strokeLinejoin="round" />
      <path
        d={HEARTBEAT_PATH}
        pathLength={1}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="login-heartbeat drop-shadow-[0_0_6px_var(--primary)]"
      />
    </svg>
  );
}

// Username/password fields. The global input base sets its own padding, text size and ring
// offset; these utilities override it. The background is passed separately per field.
const fieldClass =
  "h-12 rounded-xl border-border pl-11 text-base text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:ring-offset-0";

const fieldIconClass =
  "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary";

// Photo when there is one, initials otherwise (or if the photo fails to load).
function RecentAccountAvatar({ account }: { account: RecentAccount }) {
  const [failed, setFailed] = useState(false);
  const src = backendAssetUrl(account.userImage);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
      {account.initials || <UserRound size={16} />}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [showPassword, setShowPassword] = useState(false);
  const [emailOrUserName, setEmailOrUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Set when the API refuses clinic sign-ins because the super administrator hasn't chosen
  // the installation's country yet (423 SYSTEM_UNCONFIGURED).
  const [unconfiguredMessage, setUnconfiguredMessage] = useState<string | null>(null);

  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
  // Set while the username came from tapping a recent account - the field then shows the
  // masked value and can't be edited, until "Use a different account" clears it.
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Browsers only offer to save (and autofill) a field that is type="password". Where the
  // browser supports it, the password is a plain text input masked by CSS instead, so the
  // browser's own password manager has nothing to save. Unsupported browsers keep a real
  // password input rather than showing the password in the clear. Decided in an effect so
  // the first render matches the server's.
  const [maskWithCss, setMaskWithCss] = useState(false);

  useEffect(() => {
    setRecentAccounts(getRecentAccounts());
    setMaskWithCss(typeof CSS !== "undefined" && CSS.supports("-webkit-text-security", "disc"));
  }, []);

  const selectAccount = (account: RecentAccount) => {
    setEmailOrUserName(account.identifier);
    setSelectedAccountId(account.userId);
    setPassword("");
    passwordRef.current?.focus();
  };

  const clearSelectedAccount = () => {
    setEmailOrUserName("");
    setSelectedAccountId(null);
    setPassword("");
  };

  const removeAccount = (userId: string) => {
    setRecentAccounts(forgetAccount(userId));
    if (selectedAccountId === userId) clearSelectedAccount();
  };

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

      const data = await res.json().catch(() => ({}));
      if (res.status === 423 && data.code === "SYSTEM_UNCONFIGURED") {
        setUnconfiguredMessage(data.message || "This system hasn't been set up yet.");
        submittingRef.current = false;
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Login failed");
      setUnconfiguredMessage(null);

      const isSuperAdmin = data.body.role === "superadmin";
      localStorage.setItem("yoton_token", data.body.token);
      clearOtherUsersViewModes(data.body.userId);

      localStorage.setItem(
        "yoton_user_detail",
        JSON.stringify({
          role: data.body.role,
          name: data.body.name,
          userId: data.body.userId,
          companyId: data.body.companyId,
          companyName: data.body.companyName,
          companyLogoUrl: data.body.companyLogoUrl,
          companyTaxRegistrationNumber: data.body.companyTaxRegistrationNumber ?? null,
          userImage: data.body.userImage,
          allowedModules: data.body.allowedModules ?? [],
          region: data.body.region ?? null,
          systemConfigured: data.body.systemConfigured ?? true,
          mustChangePassword: data.body.mustChangePassword ?? false,
          country: data.body.country,
          currencyCode: data.body.currencyCode,
          currencySymbol: data.body.currencySymbol,
          idleTimeoutMinutes: data.body.idleTimeoutMinutes,
          branchId: data.body.branchId,
          departmentId: data.body.departmentId ?? null,
          departmentName: data.body.departmentName ?? null,
          staffCheckInRequired: data.body.staffCheckInRequired ?? false,
          userDiscountPercent: data.body.userDiscountPercent ?? null,
        }),
      );

      // The installation's super administrator isn't offered as a one-tap "recent account"
      // on what is usually a shared clinic computer.
      if (!isSuperAdmin) {
        rememberAccount({
          userId: data.body.userId,
          identifier: emailOrUserName.trim(),
          initials: getInitials(data.body.name ?? ""),
          userImage: data.body.userImage,
        });
      }

      toast.success(`Welcome back, ${data.body.name}!`);
      // replace, not push: login must never become a back-navigation target
      // once the user is signed in. An issued password is replaced first; the super
      // administrator only ever works on the system setup page.
      router.replace(data.body.mustChangePassword ? "/change-password" : isSuperAdmin ? "/system-setup" : "/");
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
      submittingRef.current = false;
      setLoading(false)
    }
  };

  return (
    // overflow-clip, not overflow-hidden: hidden still makes a scroll container, and with the
    // glow spilling past the edges, focusing a field could scroll the whole page sideways.
    <main className="relative isolate flex min-h-dvh w-full flex-col overflow-clip bg-background text-foreground">
      {/* Backdrop: a soft drifting glow in the brand colours over a faint dot grid. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-clip">
        <div className="login-drift absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-3xl dark:bg-primary/25" />
        <div className="login-drift absolute -right-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-cyan-400/20 blur-3xl [animation-direction:reverse] [animation-duration:30s] dark:bg-cyan-500/15" />
        <div className="login-drift absolute -bottom-56 left-1/4 h-[34rem] w-[34rem] rounded-full bg-indigo-500/15 blur-3xl [animation-duration:36s] dark:bg-indigo-500/20" />
        <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-lg shadow-primary/10 ring-1 ring-border">
            <Image src={logo} alt="" className="h-7 w-7 object-contain" priority />
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold">Yoton Health</p>
            <p className="text-xs text-muted-foreground">Care operations suite</p>
          </div>
        </div>
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}`}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-card hover:text-foreground"
          >
            {theme === "dark" ? <Moon size={16} /> : theme === "light" ? <Sun size={16} /> : <Monitor size={16} />}
          </button>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-10">
        {/* Welcome side - wide screens only. */}
        <section className="login-rise hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
            <ShieldCheck size={14} />
            Secure staff access
          </span>
          <h2 className="mt-6 max-w-xl text-5xl font-bold leading-[1.08] tracking-tight">
            Run the hospital day from{" "}
            <span className="bg-linear-to-r from-primary via-sky-500 to-cyan-400 bg-clip-text text-transparent">
              one calm dashboard.
            </span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
            Sign in to manage patients, departments, staff activity, billing,
            pharmacy, diagnostics, and the work that keeps every shift moving.
          </p>

          <div className="relative mt-12 max-w-lg">
            <div className="rounded-3xl border border-white/60 bg-card/60 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  Every department, one system
                </p>
                <HeartPulse size={18} className="text-primary" />
              </div>
              <HeartbeatLine />
              <ul className="grid grid-cols-3 gap-2">
                {DEPARTMENTS.map(({ label, Icon }) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs font-medium text-foreground/80"
                  >
                    <Icon size={14} className="shrink-0 text-primary" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="login-float absolute -right-6 -top-6 flex items-center gap-2 rounded-2xl border border-white/60 bg-card/90 px-3.5 py-2.5 text-xs font-semibold shadow-xl backdrop-blur dark:border-white/10">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck size={15} />
              </span>
              Role-based access
            </div>
            <div className="login-float absolute -bottom-6 -left-6 flex items-center gap-2 rounded-2xl border border-white/60 bg-card/90 px-3.5 py-2.5 text-xs font-semibold shadow-xl backdrop-blur [animation-delay:-3s] dark:border-white/10">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <History size={15} />
              </span>
              Every change audited
            </div>
          </div>
        </section>

        {/* Sign-in card. */}
        <section className="login-rise mx-auto w-full max-w-md [animation-delay:120ms]">
          <div className="rounded-[28px] border border-white/70 bg-card/80 p-6 shadow-[0_30px_80px_-24px_rgba(37,99,235,0.35)] backdrop-blur-2xl dark:border-white/10 dark:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.6)] sm:p-9">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Welcome back
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                Sign in to Yoton
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use your staff username and password to continue to the
                hospital dashboard.
              </p>
            </div>

            {unconfiguredMessage && (
              <div role="alert" className="mb-6 flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <Globe2 size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">System not set up yet</p>
                  <p className="mt-1 leading-5">{unconfiguredMessage}</p>
                </div>
              </div>
            )}

            {recentAccounts.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent on this device
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {recentAccounts.map((account) => {
                    const selected = selectedAccountId === account.userId;
                    return (
                      <li key={account.userId} className="relative">
                        <button
                          type="button"
                          onClick={() => selectAccount(account)}
                          aria-label={`Sign in as ${maskIdentifier(account.identifier)}`}
                          aria-pressed={selected}
                          className={`flex max-w-[13rem] items-center gap-2.5 rounded-2xl border py-1.5 pl-1.5 pr-9 text-left transition-colors ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background/60 hover:border-primary/40 hover:bg-muted"
                          }`}
                        >
                          <RecentAccountAvatar account={account} />
                          <span className="truncate text-sm font-medium text-foreground">
                            {maskIdentifier(account.identifier)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAccount(account.userId)}
                          aria-label="Remove this account from this device"
                          title="Remove from this device"
                          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-red-500 hover:text-white"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tap one to fill in the username. You&apos;ll still need your password.
                </p>
                <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or type your username
                  <span className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} autoComplete="off" className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="login-username"
                  className="text-sm font-semibold text-foreground/90"
                >
                  Username
                </label>
                <div className="group relative">
                  <UserRound size={18} className={fieldIconClass} />
                  <input
                    id="login-username"
                    type="text"
                    value={selectedAccountId ? maskIdentifier(emailOrUserName) : emailOrUserName}
                    onChange={(e) => setEmailOrUserName(e.target.value)}
                    readOnly={selectedAccountId !== null}
                    placeholder="Enter your username"
                    className={`${fieldClass} pr-4 ${selectedAccountId ? "bg-primary/5" : "bg-muted/50"}`}
                    autoComplete="off"
                    required
                  />
                </div>
                {selectedAccountId && (
                  <button
                    type="button"
                    onClick={clearSelectedAccount}
                    className="text-xs font-semibold text-primary transition-colors hover:text-primary/75"
                  >
                    Use a different account
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="login-password"
                    className="text-sm font-semibold text-foreground/90"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    title="Forgot Password"
                    // Kept out of the Tab sequence so Tab from the username field lands on the
                    // password input (its natural next field), not on this link which sits
                    // before the input in the DOM. Still clickable, and reachable by Tab after
                    // the password field.
                    tabIndex={-1}
                    className="text-xs font-semibold text-primary transition-colors hover:text-primary/75"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="group relative">
                  <LockKeyhole size={18} className={fieldIconClass} />
                  <input
                    id="login-password"
                    ref={passwordRef}
                    type={showPassword || maskWithCss ? "text" : "password"}
                    style={maskWithCss && !showPassword ? ({ WebkitTextSecurity: "disc" } as React.CSSProperties) : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`${fieldClass} bg-muted/50 pr-12`}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                </div>
              </div>

              <button
                disabled={loading || !password || !emailOrUserName}
                className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-primary to-indigo-600 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/35 hover:brightness-110 active:scale-[0.99] disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:brightness-100"
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
            </form>
          </div>
        </section>
      </div>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-center text-xs text-muted-foreground sm:px-8 lg:text-left">
        © {new Date().getFullYear()} Yoton Health. All rights reserved. · v{pkg.version}
      </footer>
    </main>
  );
}
