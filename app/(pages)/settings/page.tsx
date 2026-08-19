"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Loader2,
  Settings as SettingsIcon,
  Upload,
  UserRound,
} from "lucide-react";
import { AuthService } from "@/services/auth.service";
import { CompanyService } from "@/services/company.service";
import { getInitials } from "@/lib/getInitials";
import { patchUserDetail } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { countryDetails } from "@/helpers/countyDetails";
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
  country: string | null;
  currencyCode: string;
  currencySymbol: string;
  currencyIsManual: boolean;
  pediatricMaxAgeYears: number;
  geriatricMinAgeYears: number;
  idleTimeoutMinutes: number;
}

// Each tile on the landing grid drills into one settings category. Adding a new
// category later (e.g. Notifications, Security) is just another entry here plus a
// matching case in the detail view below - the grid never needs manual layout work.
type SettingsSection = "profile" | "company";

export default function SettingsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [maxDiscountInput, setMaxDiscountInput] = useState("");
  const [savingDiscountCap, setSavingDiscountCap] = useState(false);

  const [country, setCountry] = useState("");
  const [savingCountry, setSavingCountry] = useState(false);

  const [currencyCode, setCurrencyCode] = useState("INR");
  const [currencyIsManual, setCurrencyIsManual] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  const [pediatricMaxAgeInput, setPediatricMaxAgeInput] = useState("18");
  const [geriatricMinAgeInput, setGeriatricMinAgeInput] = useState("65");
  const [savingAgeRanges, setSavingAgeRanges] = useState(false);

  const [idleTimeoutInput, setIdleTimeoutInput] = useState("15");
  const [savingIdleTimeout, setSavingIdleTimeout] = useState(false);

  useEffect(() => {
    AuthService.getMe()
      .then((data) => {
        setMe(data);
        setMaxDiscountInput(data.maxDiscountPercent != null ? String(data.maxDiscountPercent) : "");
        setCountry(data.country || "");
        setCurrencyCode(data.currencyCode || "INR");
        setCurrencyIsManual(!!data.currencyIsManual);
        setPediatricMaxAgeInput(String(data.pediatricMaxAgeYears ?? 18));
        setGeriatricMinAgeInput(String(data.geriatricMinAgeYears ?? 65));
        setIdleTimeoutInput(String(data.idleTimeoutMinutes ?? 15));
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

  const handleSaveCountry = async () => {
    if (!me || !country) return;
    setSavingCountry(true);
    try {
      const data = await CompanyService.updateSettings({ country });
      // The backend auto-derives the currency from the country unless one was already
      // picked manually - sync every field it returns so the Currency dropdown reflects
      // that immediately instead of only updating after a page reload.
      setMe({
        ...me,
        country: data.country,
        currencyCode: data.currencyCode,
        currencySymbol: data.currencySymbol,
        currencyIsManual: data.currencyIsManual,
      });
      setCurrencyCode(data.currencyCode);
      setCurrencyIsManual(!!data.currencyIsManual);
      patchUserDetail({ currencyCode: data.currencyCode, currencySymbol: data.currencySymbol });
      toast.success(
        data.currencyIsManual ? "Country updated" : `Country updated — currency set to ${data.currencyCode}`
      );
    } catch {
      toast.error("Failed to update country");
    } finally {
      setSavingCountry(false);
    }
  };

  const handleSaveCurrency = async () => {
    if (!me) return;
    setSavingCurrency(true);
    try {
      const data = await CompanyService.updateSettings({ currencyCode });
      setMe({ ...me, currencyCode: data.currencyCode, currencySymbol: data.currencySymbol, currencyIsManual: data.currencyIsManual });
      setCurrencyIsManual(!!data.currencyIsManual);
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

  const handleSaveAgeRanges = async () => {
    if (!me) return;
    const pediatricMaxAge = Number(pediatricMaxAgeInput.trim());
    const geriatricMinAge = Number(geriatricMinAgeInput.trim());
    if (!Number.isInteger(pediatricMaxAge) || !Number.isInteger(geriatricMinAge) || pediatricMaxAge < 0 || geriatricMinAge < 0) {
      toast.error("Enter whole numbers of years for both ages");
      return;
    }
    if (pediatricMaxAge >= geriatricMinAge) {
      toast.error("Pediatric max age must be less than the Geriatric min age");
      return;
    }

    setSavingAgeRanges(true);
    try {
      const data = await CompanyService.updateSettings({
        pediatricMaxAgeYears: pediatricMaxAge,
        geriatricMinAgeYears: geriatricMinAge,
      });
      setMe({ ...me, pediatricMaxAgeYears: data.pediatricMaxAgeYears, geriatricMinAgeYears: data.geriatricMinAgeYears });
      toast.success("Age category ranges updated");
    } catch {
      toast.error("Failed to update age category ranges");
    } finally {
      setSavingAgeRanges(false);
    }
  };

  const handleSaveIdleTimeout = async () => {
    if (!me) return;
    const minutes = Number(idleTimeoutInput.trim());
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
      toast.error("Enter a whole number of minutes between 1 and 480");
      return;
    }

    setSavingIdleTimeout(true);
    try {
      const data = await CompanyService.updateSettings({ idleTimeoutMinutes: minutes });
      setMe({ ...me, idleTimeoutMinutes: data.idleTimeoutMinutes });
      // Applies to every signed-in user, this browser included - useIdleLogout picks this
      // up immediately via onUserDetailChange rather than waiting for a reload.
      patchUserDetail({ idleTimeoutMinutes: data.idleTimeoutMinutes });
      toast.success("Idle timeout updated");
    } catch {
      toast.error("Failed to update idle timeout");
    } finally {
      setSavingIdleTimeout(false);
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

  const isAdmin = me.role === "admin";

  const sectionTitle = activeSection === "profile" ? "Your profile" : activeSection === "company" ? "Company profile" : null;

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="mb-8 flex flex-col gap-1">
        {activeSection ? (
          <button
            type="button"
            onClick={() => setActiveSection(null)}
            className="flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Settings
          </button>
        ) : null}
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <SettingsIcon size={36} className="text-primary" />
          {sectionTitle ?? "Settings"}
        </h1>
        {!activeSection && (
          <p className="text-sm text-muted-foreground">
            Manage your profile{isAdmin ? " and your organization's settings" : ""}.
          </p>
        )}
      </div>

      {/* LANDING GRID */}
      {!activeSection && (
        <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsTile
            icon={<UserRound size={22} />}
            title="Your profile"
            description="Profile photo and account details."
            onClick={() => setActiveSection("profile")}
          />
          {isAdmin && (
            <SettingsTile
              icon={<Building2 size={22} />}
              title="Company profile"
              description="Branding, billing, currency, and age category ranges."
              onClick={() => setActiveSection("company")}
            />
          )}
        </div>
      )}

      {/* YOUR PROFILE */}
      {activeSection === "profile" && (
        <div className="grid max-w-4xl grid-cols-1 gap-5 lg:grid-cols-2">
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
        </div>
      )}

      {/* COMPANY PROFILE - admin only */}
      {activeSection === "company" && isAdmin && (
        <div className="grid max-w-4xl grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Branding */}
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
          </div>

          {/* Maximum billing discount */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Maximum billing discount</h2>
            <p className="text-sm text-muted-foreground mb-5">
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
          </div>

          {/* Country & Currency */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Country & currency</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Currency controls how amounts are displayed across billing, pharmacy, appointments,
              and prescription printouts for every user at {me.companyName ?? "your organization"}.
              Picking a country fills in its currency automatically, unless one has already been
              set below.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Country
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  >
                    <option value="" disabled>
                      Select country
                    </option>
                    {countryDetails.map((c) => (
                      <option key={c.country} value={c.country}>
                        {c.country}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveCountry}
                    disabled={savingCountry || !country}
                    className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingCountry && <Loader2 size={15} className="animate-spin" />}
                    Save
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Currency
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
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
                <p className="mt-2 text-xs text-muted-foreground">
                  {currencyIsManual
                    ? "Set manually — changing country above won't override it."
                    : "Following the selected country. Saving a currency here locks it in."}
                </p>
              </div>
            </div>
          </div>

          {/* Age category ranges */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Age category ranges</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Sets the age cutoffs (in whole years) used to categorize patients as Pediatric,
              Adult, or Geriatric.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Pediatric: 0 to
                </label>
                <div className="relative w-28">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={pediatricMaxAgeInput}
                    onChange={(e) => setPediatricMaxAgeInput(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 pr-14 text-sm text-foreground"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    yrs
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Geriatric: from
                </label>
                <div className="relative w-28">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={geriatricMinAgeInput}
                    onChange={(e) => setGeriatricMinAgeInput(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 pr-14 text-sm text-foreground"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    yrs+
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveAgeRanges}
                disabled={savingAgeRanges}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingAgeRanges && <Loader2 size={15} className="animate-spin" />}
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Adult: {pediatricMaxAgeInput || "0"} to {geriatricMinAgeInput || "0"} years.
            </p>
          </div>

          {/* Idle timeout */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Idle timeout</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Minutes of inactivity before a signed-in session is automatically logged out —
              staff on the web app and patients on the mobile app alike. One value for
              everyone; there&apos;s no per-user override.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative w-32">
                <input
                  type="number"
                  min={1}
                  max={480}
                  step="1"
                  value={idleTimeoutInput}
                  onChange={(e) => setIdleTimeoutInput(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 pr-12 text-sm text-foreground"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  min
                </span>
              </div>
              <button
                type="button"
                onClick={handleSaveIdleTimeout}
                disabled={savingIdleTimeout}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingIdleTimeout && <Loader2 size={15} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight size={16} className="mt-1.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </button>
  );
}
