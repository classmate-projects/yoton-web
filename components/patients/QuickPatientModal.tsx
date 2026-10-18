"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import DatePicker from "@/components/DatePicker";
import SearchableSelect from "@/components/SearchableSelect";
import { countryDetails } from "@/helpers/countyDetails";
import { getNationalIdFormat, passportNumberRegex } from "@/helpers/nationalIdFormats";
import { toDateInputValue } from "@/lib/date";
import { ReceptionService } from "@/services/reception.service";
import type { PatientMatchType, PatientSummaryType } from "@/types/patient.type";
import { PatientMatchList } from "./DuplicatePatientPrompt";
import { apiErrorMessage } from "@/lib/apiError";

export interface QuickPatientInitial {
  name?: string;
  phone?: string;
  nationalID?: string;
  passportNumber?: string;
}

interface Props {
  initial?: QuickPatientInitial;
  onClose: () => void;
  // The new walk-in, or the existing patient the user chose instead of a duplicate.
  onSelect: (patient: PatientSummaryType) => void;
}

const companyCountry = (): string | undefined => {
  try {
    return JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").country;
  } catch {
    return undefined;
  }
};

// Emirates IDs are often typed as 15 plain digits - put into the 784-XXXX-XXXXXXX-X form the
// rest of the system stores (mirrors PatientIdentityHelper.NormalizeNationalId on the API).
const normalizeNationalId = (raw: string, country?: string) => {
  const trimmed = raw.trim();
  if (country === "United Arab Emirates") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 15 && digits.startsWith("784"))
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
  }
  return trimmed;
};

const inputCls =
  "w-full mt-1 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground";
const labelCls = "text-sm font-bold text-foreground/90";

// Minimal-details registration for a walk-in who only needs an outside prescription filled or
// an outside lab/radiology order done. They join the same patient table (with an MRN), so a
// later consultation continues the same record - and while typing, anyone already registered
// with the same ID or mobile number is offered instead of creating a duplicate.
export default function QuickPatientModal({ initial, onClose, onSelect }: Props) {
  const [country] = useState(companyCountry);
  const idFormat = getNationalIdFormat(country);
  const [name, setName] = useState(initial?.name ?? "");
  const [phoneCode, setPhoneCode] = useState(
    () => countryDetails.find((c) => c.country === country)?.phoneCode ?? "+971"
  );
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [nationalID, setNationalID] = useState(initial?.nationalID ?? "");
  const [passportNumber, setPassportNumber] = useState(initial?.passportNumber ?? "");
  const [sex, setSex] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [matches, setMatches] = useState<PatientMatchType[]>([]);
  // Set once the API has confirmed only weak matches (mobile/email) - the user has seen them
  // and may still go ahead with a new record.
  const [canCreateAnyway, setCanCreateAnyway] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lookupSeq = useRef(0);

  const phoneLength = countryDetails.find((c) => c.phoneCode === phoneCode)?.phoneLength ?? 15;

  // Live "already registered?" check as identifiers are typed.
  useEffect(() => {
    const nid = nationalID.trim();
    const passport = passportNumber.trim();
    const mobile = phone.trim();
    setCanCreateAnyway(false);
    if (nid.length < 6 && passport.length < 6 && mobile.length < 6) {
      setMatches([]);
      return;
    }
    const seq = ++lookupSeq.current;
    const handle = setTimeout(async () => {
      try {
        const res = await ReceptionService.matchPatients({
          nationalID: nid.length >= 6 ? normalizeNationalId(nid, country) : undefined,
          passportNumber: passport.length >= 6 ? passport : undefined,
          phone: mobile.length >= 6 ? mobile : undefined,
          phoneCode,
        });
        if (seq === lookupSeq.current) setMatches(res.data ?? []);
      } catch {
        // Only a hint - creating still re-checks on the server.
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [nationalID, passportNumber, phone, phoneCode, country]);

  const hasStrongMatch = matches.some((m) => m.isStrongMatch);

  const submit = async (confirmNew: boolean) => {
    setError("");
    const trimmedName = name.trim();
    const nid = nationalID.trim() ? normalizeNationalId(nationalID, country) : "";
    const passport = passportNumber.trim().replace(/\s/g, "").toUpperCase();
    if (!trimmedName) {
      setError("Enter the patient's name.");
      return;
    }
    if (!phone.trim() && !nid && !passport) {
      setError(`Enter a mobile number or an ID (${idFormat.label} / passport) so this patient can be found again next time.`);
      return;
    }
    if (phone.trim() && phone.trim().length < 6) {
      setError("Mobile number looks too short.");
      return;
    }
    if (nid && idFormat.regex && !idFormat.regex.test(nid)) {
      setError(`${idFormat.label} format looks incorrect. Expected format: ${idFormat.placeholder}`);
      return;
    }
    if (passport && !passportNumberRegex.test(passport)) {
      setError("Passport number format looks incorrect. Expected 6-9 letters/digits.");
      return;
    }

    try {
      setSaving(true);
      const res = await ReceptionService.createExternalPatient({
        name: trimmedName,
        phone: phone.trim() || undefined,
        phoneCode: phone.trim() ? phoneCode : undefined,
        nationalID: nid || undefined,
        passportNumber: passport || undefined,
        sex: sex || undefined,
        dateOfBirth: dateOfBirth || undefined,
        confirmNewDespiteMatches: confirmNew,
      });
      toast.success(`${trimmedName} registered as a walk-in (MRN ${res.data?.opNumber ?? "—"})`);
      onSelect(res.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409 && err.response.data?.duplicate) {
        setMatches(err.response.data.data ?? []);
        setCanCreateAnyway(!!err.response.data.allowCreate);
        setError(err.response.data.message || "This patient may already be registered.");
      } else {
        setError(apiErrorMessage(err, "Failed to register patient"));
      }
    } finally {
      setSaving(false);
    }
  };

  // Portaled out of whatever form opened it - a <form> nested in another form's DOM would
  // submit the outer one (React still bubbles the submit, hence stopPropagation below).
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <UserPlus size={20} className="text-primary" />
              Register walk-in patient
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Minimal details for an outside prescription or order. Reception can complete the registration later.
            </p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            submit(false);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <div>
              <label className={`${labelCls} required`}>Full name</label>
              <input
                type="text"
                autoFocus
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As on the ID or prescription"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Mobile number</label>
              <div className="mt-1 flex overflow-hidden rounded-lg border border-border bg-muted focus-within:border-primary">
                <CountryCodeSelect
                  value={phoneCode}
                  onChange={setPhoneCode}
                  className="flex h-11 shrink-0 items-center gap-1 border-r border-border px-3 text-foreground transition-colors hover:bg-card"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, phoneLength))}
                  placeholder={"5".padEnd(phoneLength, "0")}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-foreground outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>{idFormat.label}</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={nationalID}
                  onChange={(e) => setNationalID(e.target.value)}
                  onBlur={() => nationalID.trim() && setNationalID(normalizeNationalId(nationalID, country))}
                  placeholder={idFormat.placeholder ?? "ID number"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Passport number</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  placeholder="A1234567"
                  className={inputCls}
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              A mobile number or an ID is needed so the patient is recognised on their next visit.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Sex</label>
                <div className="mt-1">
                  <SearchableSelect
                    value={sex}
                    onChange={setSex}
                    options={[
                      { value: "", label: "Not recorded" },
                      { value: "Male", label: "Male" },
                      { value: "Female", label: "Female" },
                      { value: "Other", label: "Other" },
                    ]}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Date of birth</label>
                <div className="mt-1">
                  <DatePicker
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    max={toDateInputValue(new Date())}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2.5 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>
            </div>

            {matches.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="mb-2 text-sm font-semibold text-foreground">
                  {hasStrongMatch ? "Already registered - use the existing record" : "Is this an existing patient?"}
                </p>
                <PatientMatchList
                  matches={matches}
                  onPick={(m) => {
                    toast.success(`Continuing with ${m.name}'s existing record`);
                    onSelect(m);
                  }}
                />
              </div>
            )}

            {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-5 py-2.5 text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {canCreateAnyway && !hasStrongMatch ? (
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={saving}
                className="rounded-md bg-primary px-5 py-2.5 font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
              >
                {saving ? "Registering..." : "Different person - register new"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving || hasStrongMatch}
                title={hasStrongMatch ? "This ID is already registered - pick the existing record above" : undefined}
                className="rounded-md bg-primary px-5 py-2.5 font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Registering..." : "Register walk-in"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
