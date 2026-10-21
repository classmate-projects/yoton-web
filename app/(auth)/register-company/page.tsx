"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import logo from "@/public/yoton_logo.png";
import { RegisterCompanyPayload } from "@/types/company.type";
import { clearOtherUsersViewModes } from "@/lib/viewModeCache";

const inputClass =
  "h-12 rounded-2xl border-border! bg-muted/40! pl-12! pr-4 text-base! text-foreground placeholder:text-muted-foreground! focus-visible:bg-card! focus-visible:ring-transparent!";

export default function RegisterCompanyPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RegisterCompanyPayload>({
    name: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    adminName: "",
    adminUsername: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
  });

  const setField =
    (field: keyof RegisterCompanyPayload) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/company/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

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
          userImage: data.body.userImage,
          allowedModules: data.body.allowedModules ?? [],
          // The installation's country, chosen by the super administrator before any clinic
          // could be registered (see lib/region.ts).
          region: data.body.region ?? null,
          systemConfigured: true,
          country: data.body.region?.country,
          currencyCode: data.body.currencyCode,
          currencySymbol: data.body.currencySymbol,
          idleTimeoutMinutes: data.body.idleTimeoutMinutes,
        }),
      );

      toast.success(`Welcome to Yoton, ${data.body.name}!`);
      router.push("/");
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background px-5 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="card grid w-full overflow-hidden rounded-4xl shadow-[0_24px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[0.8fr_1.2fr]">
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
                <p className="mt-1 text-sm text-white/70">New workspace</p>
              </div>
            </div>

            <div className="max-w-sm">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/85">
                <ShieldCheck size={16} />
                Fully isolated workspace
              </div>
              <h1 className="text-4xl font-bold leading-tight">
                Bring your clinic onto Yoton.
              </h1>
              <p className="mt-5 text-sm leading-6 text-white/72">
                Register your hospital or clinic and get your own private
                workspace instantly — your patients, staff, and records stay
                completely separate from every other organization on Yoton.
              </p>
            </div>

            <p className="text-sm text-white/60">
              © {new Date().getFullYear()} Yoton Health. All rights reserved.
            </p>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-xl">
              <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-md">
                  <Image
                    src={logo}
                    alt="Yoton Health"
                    className="h-8 w-8 object-contain"
                    priority
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-none">Yoton Health</p>
                  <p className="mt-1 text-sm text-muted-foreground">New workspace</p>
                </div>
              </div>

              <div className="mb-7">
                <p className="text-sm font-semibold uppercase text-primary">
                  Get started
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                  Register your organization
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  This creates your organization and an admin account for you
                  to sign in with right away.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Organization details
                  </p>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                      <Building2 size={18} />
                    </span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={setField("name")}
                      placeholder="Organization name"
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                        <Mail size={18} />
                      </span>
                      <input
                        type="email"
                        value={form.contactEmail}
                        onChange={setField("contactEmail")}
                        placeholder="Contact email"
                        className={inputClass}
                        required
                      />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                        <Phone size={18} />
                      </span>
                      <input
                        type="tel"
                        value={form.contactPhone}
                        onChange={setField("contactPhone")}
                        placeholder="Contact phone (optional)"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                      <MapPin size={18} />
                    </span>
                    <input
                      type="text"
                      value={form.address}
                      onChange={setField("address")}
                      placeholder="Address (optional)"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-border pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Your admin account
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                        <UserRound size={18} />
                      </span>
                      <input
                        type="text"
                        value={form.adminName}
                        onChange={setField("adminName")}
                        placeholder="Your full name"
                        className={inputClass}
                        required
                      />
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                        <UserRound size={18} />
                      </span>
                      <input
                        type="text"
                        value={form.adminUsername}
                        onChange={setField("adminUsername")}
                        placeholder="Choose a username"
                        className={inputClass}
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      value={form.adminEmail}
                      onChange={setField("adminEmail")}
                      placeholder="Your email"
                      className={inputClass}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                        <LockKeyhole size={18} />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.adminPassword}
                        onChange={setField("adminPassword")}
                        placeholder="Choose a password"
                        className={`${inputClass} pr-12!`}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                      </button>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                        <Phone size={18} />
                      </span>
                      <input
                        type="tel"
                        value={form.adminPhone}
                        onChange={setField("adminPhone")}
                        placeholder="Your phone (optional)"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  type="submit"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Creating your workspace
                    </>
                  ) : (
                    <>
                      Create workspace
                      <ArrowRight
                        size={17}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-muted-foreground">
                Already have a workspace?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-primary transition-colors hover:text-primary/75"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
