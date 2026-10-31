"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Globe2,
  IdCard,
  Landmark,
  Loader2,
  MapPin,
  Receipt,
  Smartphone,
  Syringe,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import PasswordInput from "@/components/PasswordInput";
import { SystemService } from "@/services/system.service";
import { apiErrorMessage } from "@/lib/apiError";
import { formatDateTime } from "@/lib/date";
import { patchUserDetail } from "@/lib/userDetail";
import type { Region, SystemStatus } from "@/types/region.type";

// The super administrator's whole dashboard: choosing the country/region this installation
// runs in. Nothing clinical lives here - registration, appointments, billing and every other
// module belong to the clinics' own staff. Until a country is chosen the system stays
// unconfigured and no clinic user (or patient) can sign in.

function taxSummary(r: Region): string {
  if (!r.tax.applicable) return r.tax.note ?? "No tax on bills";
  const parts = [r.tax.name];
  if (r.tax.standardPercent != null) parts.push(`standard ${r.tax.standardPercent}%`);
  if (r.tax.registrationLabel) parts.push(`${r.tax.registrationLabel} on bills`);
  if (r.tax.splitComponents.length > 0) parts.push(`reported as ${r.tax.splitComponents.join(" + ")}`);
  return parts.join(" · ");
}

function vaccineSummary(r: Region): string {
  return r.routineVaccineCount > 0
    ? `${r.vaccineScheduleSource} - ${r.routineVaccineCount} routine vaccines scheduled by age`
    : "No default schedule - every vaccine is ordered on demand";
}

function featureChips(r: Region): string[] {
  const chips: string[] = [];
  if (r.features.includes("qualityKpiReports")) chips.push("MoPH KPI reports & Compliance Data");
  if (r.features.includes("eClaimLink")) chips.push("eClaimLink insurance portal");
  if (r.features.includes("medicationRegistries")) chips.push(`${r.regulatory.medicationRegistries.join(" / ")} medicine import`);
  return chips;
}

function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 text-sm">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="leading-5 text-foreground">{children}</p>
      </div>
    </div>
  );
}

function RegionCard({ region, current, selected, onSelect }: { region: Region; current: boolean; selected: boolean; onSelect: () => void }) {
  const chips = featureChips(region);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`card flex h-full flex-col gap-4 p-5 text-left transition-all hover:border-primary/50 ${selected ? "ring-2 ring-primary border-primary" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
          {region.code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight">{region.country}</p>
          <p className="text-xs text-muted-foreground">{region.regulatory.healthAuthority}</p>
        </div>
        {current && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            <BadgeCheck size={13} />
            Current
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <Row icon={Banknote} label="Currency">
          {region.currency.code} · {region.currency.symbol} ({region.currency.name})
        </Row>
        <Row icon={Smartphone} label="Mobile numbers">
          {region.phone.dialCode} · {region.phone.nationalNumberLength} digits (e.g. {region.phone.example})
        </Row>
        <Row icon={IdCard} label="National ID">
          {region.nationalId.label} · e.g. {region.nationalId.placeholder}
        </Row>
        <Row icon={MapPin} label="Address">
          {region.addressFields.map((f) => f.label).join(", ")}
        </Row>
        <Row icon={Receipt} label="Tax">
          {taxSummary(region)}
        </Row>
        <Row icon={Landmark} label="Facility licence">
          {region.regulatory.facilityLicenseLabel}
        </Row>
        <Row icon={Syringe} label="Vaccines">
          {vaccineSummary(region)}
        </Row>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {chips.length > 0 ? (
          chips.map((c) => (
            <span key={c} className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
              {c}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No country-only features</span>
        )}
      </div>
    </button>
  );
}

export default function SystemSetupPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loadError, setLoadError] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([SystemService.getStatus(), SystemService.getRegions()]);
      setStatus(s);
      setRegions(r);
      setLoadError("");
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Couldn't load the system setup"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentCode = status?.region?.code ?? null;
  const selected = regions.find((r) => r.code === selectedCode) ?? null;
  const switching = selected != null && selected.code !== currentCode;

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !password || applying) return;
    setApplying(true);
    setApplyError("");
    try {
      const res = await SystemService.applyRegion(selected.code, password);
      patchUserDetail({ region: res.data, systemConfigured: true });
      toast.success(res.message);
      setPassword("");
      setSelectedCode(null);
      await load();
    } catch (err) {
      setApplyError(apiErrorMessage(err, "Couldn't apply the country"));
    } finally {
      setApplying(false);
    }
  };

  if (!status && !loadError) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <Globe2 size={20} />
          <p className="text-sm font-semibold uppercase">System setup</p>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Country &amp; region</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Choose the country this installation runs in. Everything country-specific follows it for every clinic:
          currency, mobile number and national ID formats, address fields, tax, the facility licence, the default
          vaccine schedule and country-only features.
        </p>
      </div>

      {loadError && (
        <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {loadError}
        </div>
      )}

      {status && !status.configured && (
        <div className="flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Not set up yet</p>
            <p className="mt-1 leading-5">
              No country has been chosen, so clinic staff and patients can&apos;t sign in. Pick the country below to
              start using the system.
            </p>
          </div>
        </div>
      )}

      {status?.configured && status.region && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-emerald-500/40 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={18} />
            Running as {status.region.country}
          </span>
          {status.configuredAt && (
            <span>
              since {formatDateTime(status.configuredAt)}
              {status.configuredByName ? ` · set by ${status.configuredByName}` : ""}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Building2 size={15} />
            {status.clinics} clinic{status.clinics === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {regions.map((r) => (
          <RegionCard
            key={r.code}
            region={r}
            current={r.code === currentCode}
            selected={r.code === selectedCode}
            onSelect={() => {
              setSelectedCode(r.code);
              setApplyError("");
            }}
          />
        ))}
      </div>

      {selected && !switching && (
        <p className="text-sm text-muted-foreground">{selected.country} is already the system&apos;s country.</p>
      )}

      {switching && selected && (
        <form onSubmit={apply} className="card space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">
              {currentCode ? `Switch the system to ${selected.country}?` : `Set the system up for ${selected.country}?`}
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Amounts show in {selected.currency.code} ({selected.currency.symbol}).</li>
              <li>
                New and edited patients use {selected.phone.dialCode} mobile numbers, the {selected.nationalId.label} and{" "}
                {selected.country} address fields.
              </li>
              <li>Tax: {taxSummary(selected).replace(/\.$/, "")}.</li>
              <li>
                The standard vaccine list follows {selected.routineVaccineCount > 0 ? selected.vaccineScheduleSource : "no default schedule (all on demand)"}
                {" "}- vaccines a clinic added itself aren&apos;t touched.
              </li>
              <li>
                Country-only features: {featureChips(selected).join(", ") || "none"}.
              </li>
              {currentCode && <li>Records already saved keep their values; signed-in staff are asked to reload.</li>}
            </ul>
          </div>
          <div className="max-w-sm space-y-2">
            <label htmlFor="confirm-password" className="required text-sm font-semibold text-foreground/90">
              Confirm with your password
            </label>
            <PasswordInput
              id="confirm-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {applyError && <p role="alert" className="text-sm font-medium text-red-500">{applyError}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!password || applying}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {applying && <Loader2 className="animate-spin" size={16} />}
              {currentCode ? `Switch to ${selected.country}` : `Set up as ${selected.country}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCode(null);
                setPassword("");
                setApplyError("");
              }}
              className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
