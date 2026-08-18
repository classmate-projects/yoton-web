"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Settings as SettingsIcon, Upload, UserRound } from "lucide-react";
import { AuthService } from "@/services/auth.service";
import { CompanyService } from "@/services/company.service";
import { getInitials } from "@/lib/getInitials";
import { patchUserDetail } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import LoadingSpinner from "@/components/LoadingSpinner";

interface MeResponse {
  userId: string;
  name: string;
  username: string;
  role: string;
  email: string | null;
  userImage: string | null;
  companyId: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  maxDiscountPercent: number | null;
  currencyCode: string;
  currencySymbol: string;
}

export default function SettingsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [maxDiscountInput, setMaxDiscountInput] = useState("");
  const [savingDiscountCap, setSavingDiscountCap] = useState(false);

  const [currencyCode, setCurrencyCode] = useState("INR");
  const [savingCurrency, setSavingCurrency] = useState(false);

  useEffect(() => {
    AuthService.getMe()
      .then((data) => {
        setMe(data);
        setMaxDiscountInput(data.maxDiscountPercent != null ? String(data.maxDiscountPercent) : "");
        setCurrencyCode(data.currencyCode || "INR");
      })
      .catch(() => toast.error("Failed to load your profile"))
      .finally(() => setLoading(false));
  }, []);

  const handleAvatarUpload = async () => {
    if (!avatarFile || !me) return;
    setUploadingAvatar(true);
    try {
      const data = await AuthService.uploadAvatar(avatarFile);
      setMe({ ...me, userImage: data.userImage });
      patchUserDetail({ userImage: data.userImage });
      setAvatarFile(null);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !me) return;
    setUploadingLogo(true);
    try {
      const data = await CompanyService.uploadLogo(logoFile);
      setMe({ ...me, companyLogoUrl: data.logoPath });
      patchUserDetail({ companyLogoUrl: data.logoPath });
      setLogoFile(null);
      toast.success("Company logo updated");
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveDiscountCap = async () => {
    if (!me) return;
    const trimmed = maxDiscountInput.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("Enter a number between 0 and 100, or leave it blank for no cap");
      return;
    }

    setSavingDiscountCap(true);
    try {
      await CompanyService.updateSettings({ maxDiscountPercent: parsed });
      setMe({ ...me, maxDiscountPercent: parsed });
      toast.success("Discount cap updated");
    } catch {
      toast.error("Failed to update discount cap");
    } finally {
      setSavingDiscountCap(false);
    }
  };

  const handleSaveCurrency = async () => {
    if (!me) return;
    setSavingCurrency(true);
    try {
      const data = await CompanyService.updateSettings({ currencyCode });
      setMe({ ...me, currencyCode: data.currencyCode, currencySymbol: data.currencySymbol });
      // Every other open tab/page reads the symbol from this same localStorage key
      // (see lib/currency.ts) - patch it so amounts update without a re-login.
      patchUserDetail({ currencyCode: data.currencyCode, currencySymbol: data.currencySymbol });
      toast.success("Currency updated");
    } catch {
      toast.error("Failed to update currency");
    } finally {
      setSavingCurrency(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="py-6 px-4 sm:py-8 sm:px-10">
        <p className="text-muted-foreground">Couldn&apos;t load your profile.</p>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <SettingsIcon size={36} className="text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile photo{me.role === "admin" ? " and your organization's branding" : ""}.
        </p>
      </div>

      <div className="flex flex-col gap-6 max-w-xl">
        {/* PROFILE PHOTO */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-1">Your profile</h2>
          <p className="text-sm text-muted-foreground mb-5">
            This photo appears in the sidebar once the menu is expanded.
          </p>

          <div className="flex items-center gap-5">
            {me.userImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
              <img
                src={avatarFile ? URL.createObjectURL(avatarFile) : (backendAssetUrl(me.userImage) ?? undefined)}
                alt={me.name}
                className="h-16 w-16 rounded-xl object-cover shadow-sm shrink-0"
              />
            ) : avatarFile ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not eligible for next/image
              <img
                src={URL.createObjectURL(avatarFile)}
                alt="Preview"
                className="h-16 w-16 rounded-xl object-cover shadow-sm shrink-0"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
                {me.name ? getInitials(me.name) : <UserRound size={24} />}
              </div>
            )}

            <div className="flex-1">
              <p className="font-semibold text-foreground">{me.name}</p>
              <p className="text-sm text-muted-foreground">
                {me.role} • {me.username}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-foreground max-w-[220px]"
                />
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={!avatarFile || uploadingAvatar}
                  className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadingAvatar ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COMPANY BRANDING - admin only */}
        {me.role === "admin" && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Company branding</h2>
            <p className="text-sm text-muted-foreground mb-5">
              This logo replaces the default Yoton logo in the sidebar for every user at{" "}
              {me.companyName ?? "your organization"} once the menu is collapsed.
            </p>

            <div className="flex items-center gap-5">
              {me.companyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
                <img
                  src={logoFile ? URL.createObjectURL(logoFile) : (backendAssetUrl(me.companyLogoUrl) ?? undefined)}
                  alt={me.companyName ?? "Company logo"}
                  className="h-16 w-16 rounded-xl object-cover shadow-sm shrink-0"
                />
              ) : logoFile ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not eligible for next/image
                <img
                  src={URL.createObjectURL(logoFile)}
                  alt="Preview"
                  className="h-16 w-16 rounded-xl object-cover shadow-sm shrink-0"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-sm">
                  <Building2 size={24} />
                </div>
              )}

              <div className="flex-1">
                <p className="font-semibold text-foreground">{me.companyName ?? "Your organization"}</p>

                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                    className="text-sm text-foreground max-w-[220px]"
                  />
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    disabled={!logoFile || uploadingLogo}
                    className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploadingLogo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Upload
                  </button>
                </div>
              </div>
            </div>

            <hr className="my-5 border-border" />

            <h3 className="font-semibold text-foreground mb-1">Maximum billing discount</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Caps how large a discount billing staff can apply to a bill. Leave blank for no limit.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative w-32">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={maxDiscountInput}
                  onChange={(e) => setMaxDiscountInput(e.target.value)}
                  placeholder="No limit"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 pr-7 text-sm text-foreground"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <button
                type="button"
                onClick={handleSaveDiscountCap}
                disabled={savingDiscountCap}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingDiscountCap && <Loader2 size={15} className="animate-spin" />}
                Save
              </button>
            </div>

            <hr className="my-5 border-border" />

            <h3 className="font-semibold text-foreground mb-1">Currency</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Controls how amounts are displayed across billing, pharmacy, appointments, and
              prescription printouts for every user at {me.companyName ?? "your organization"}.
            </p>
            <div className="flex items-center gap-3">
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSaveCurrency}
                disabled={savingCurrency}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingCurrency && <Loader2 size={15} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
