"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { toast } from "sonner";
import { X } from "lucide-react";
import { MdClose } from "react-icons/md";
import { countryDetails } from "@/helpers/countyDetails";
import { passportNumberRegex } from "@/lib/validation";
import {
  addressErrors,
  defaultDialCode,
  hasAnyAddressValue,
  nationalIdError,
  nationalIdLabel,
  phoneError,
  useRegion,
  type AddressValues,
} from "@/lib/region";
import RegionAddressFields from "@/components/patients/RegionAddressFields";
import { ReceptionService } from "@/services/reception.service";
import { ConfigListService } from "@/services/configList.service";
import { isValidEmail } from "@/lib/validation";
import { toDateInputValue } from "@/lib/date";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import ToggleButton from "@/components/ToggleButton";
import DatePicker from "@/components/DatePicker";
import LoadingSpinner from "@/components/LoadingSpinner";
import { AppointmentSlotType, DoctorDaySlotsType, SpecializationDoctorsType } from "@/types/appointment.type";
import { InsuranceCoverageRow, PatientFullDetailsType, ReceptionCreatePatientType } from "@/types/reception.type";
import { ListItemType } from "@/types/configList.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { useExistingPatientMatches } from "@/hooks/useExistingPatientMatches";
import ExistingPatientNotice from "@/components/patients/ExistingPatientNotice";
import DuplicatePatientPrompt from "@/components/patients/DuplicatePatientPrompt";
import type { PatientMatchType } from "@/types/patient.type";
import { apiErrorMessage } from "@/lib/apiError";
import SearchableSelect from "@/components/SearchableSelect";

const INSURANCE_SERVICE_CATEGORIES = [
  "Consultation", "Lab", "Radiology", "Treatment", "Medicine", "Dental", "Maternity",
] as const;

type CoverageFormRow = {
  deductible: string; deductibleAppliesTo: string;
  coPayPercent: string; coPayMin: string; coPayMax: string; coPayAppliesTo: string;
};
const emptyCoverageRow: CoverageFormRow = {
  deductible: "", deductibleAppliesTo: "", coPayPercent: "", coPayMin: "", coPayMax: "", coPayAppliesTo: "",
};
const emptyCoverages = (): Record<string, CoverageFormRow> =>
  Object.fromEntries(INSURANCE_SERVICE_CATEGORIES.map((c) => [c, { ...emptyCoverageRow }]));

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBooked: () => void;
  presetDoctorId: string;
  presetSpecId: string;
  presetDeptId: string;
  presetSlotStart: string;
  presetDate: string;
  doctorName: string;
  slotDisplayTime: string;
  specializations: SpecializationDoctorsType[];
}

// Phone fields start on the installation's own dialing code (lib/region.ts).
const initialForm = () => ({
  name: "", sex: "", dateOfBirth: "", phone: "", phoneCode: defaultDialCode(), email: "",
  address: "", nationality: "", passportNumber: "", nationalID: "",
  fatherName: "", motherName: "", patientType: "Normal", visaType: "",
  maritalStatus: "", designation: "", referralStatus: false, chronicStatus: false,
  emergencyContact: "", emergencyContactPhone: "", emergencyContactPhoneCode: defaultDialCode(),
  paymentType: "Cash", eligibilityMode: "", eligibilityCheckedDate: "",
  eligibilityID: "", eligibilityVisitID: "", insuranceProvider: "", subInsurance: "",
  networkType: "", insuranceCardNo: "", extraCardNo: "", insuranceEffectiveFrom: "",
  insuranceExpiryDate: "", certificateNo: "", dependentsNo: "", insuranceClaimNo: "",
  maxInsuranceLiability: "", insuranceApprovalLimit: "", maxInsuranceCopay: "",
  coPayPatientPercent: "", password: "",
});

export default function PatientRegistrationModal({
  isOpen, onClose, onBooked,
  presetDoctorId, presetSpecId, presetDeptId, presetSlotStart, presetDate,
  doctorName, slotDisplayTime, specializations,
}: Props) {
  // ── Registration form state ──
  const [formData, setFormData] = useState(initialForm);
  // The installation's country: phone code, national ID format and the address structure.
  const region = useRegion();
  const structuredAddress = (region?.addressFields.length ?? 0) > 0;
  const [addressFields, setAddressFields] = useState<AddressValues>({});
  const [showAddressErrors, setShowAddressErrors] = useState(false);
  const [coverages, setCoverages] = useState<Record<string, CoverageFormRow>>(emptyCoverages());
  const [insuranceProviders, setInsuranceProviders] = useState<ListItemType[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isInsuranceOrCorporate = formData.paymentType !== "Cash";
  const emailInvalid = formData.email.length > 0 && !isValidEmail(formData.email);
  const idLabel = nationalIdLabel(region);
  const phoneLengthFor = (code: string) =>
    region && code === region.phone.dialCode
      ? region.phone.nationalNumberLength
      : countryDetails.find((c) => c.phoneCode === code)?.phoneLength ?? 15;
  const phonePlaceholderFor = (code: string) =>
    region && code === region.phone.dialCode ? region.phone.example.replace(/\s/g, "") : "".padEnd(phoneLengthFor(code), "0");
  const selectedPhoneLength = phoneLengthFor(formData.phoneCode);
  const selectedEmergencyPhoneLength = phoneLengthFor(formData.emergencyContactPhoneCode);

  // ── Post-registration consultation state ──
  const [registeredPatient, setRegisteredPatient] = useState<{ opId: string; name: string } | null>(null);
  const [showConsultForm, setShowConsultForm] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedSpecializationId, setSelectedSpecializationId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [consultDate, setConsultDate] = useState(() => toDateInputValue(new Date()));
  const [daySlots, setDaySlots] = useState<DoctorDaySlotsType | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlotType | null>(null);
  const [consultNotes, setConsultNotes] = useState("");
  const [isBookingConsult, setIsBookingConsult] = useState(false);

  // ── Already registered? ──
  // Someone on file with the same ID / mobile / email (e.g. a walk-in from the pharmacy or
  // lab) is offered instead of creating a duplicate - live while typing, and again on submit.
  const { visibleMatches, dismiss: dismissMatches } = useExistingPatientMatches({
    nationalID: formData.nationalID,
    passportNumber: formData.passportNumber,
    phone: formData.phone,
    phoneCode: formData.phoneCode,
    email: formData.email,
    enabled: isOpen && !registeredPatient,
  });
  const [submitMatches, setSubmitMatches] = useState<PatientMatchType[] | null>(null);
  const [pendingPayload, setPendingPayload] = useState<ReceptionCreatePatientType | null>(null);
  const [openingMatchId, setOpeningMatchId] = useState<string | null>(null);

  // Whether the consultation form was opened / pre-filled for this registration - declared
  // before the reset below, which clears them.
  const presetApplied = useRef(false);
  const presetsFilledRef = useRef(false);

  const resetConsult = () => {
    setSelectedDepartmentId(""); setSelectedSpecializationId(""); setSelectedDoctorId("");
    setDaySlots(null); setSelectedSlot(null); setConsultNotes("");
    setConsultDate(toDateInputValue(new Date()));
  };

  // Reset everything when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(initialForm());
      setAddressFields({});
      setShowAddressErrors(false);
      setCoverages(emptyCoverages());
      setError("");
      setRegisteredPatient(null);
      setShowConsultForm(false);
      setSubmitMatches(null);
      setPendingPayload(null);
      resetConsult();
      presetApplied.current = false;
      presetsFilledRef.current = false;
    }
  }, [isOpen]);

  // Lazy-load insurance providers
  useEffect(() => {
    if (!isInsuranceOrCorporate || insuranceProviders.length > 0) return;
    (async () => {
      try {
        setIsLoadingProviders(true);
        const data = await ConfigListService.get("InsuranceProvider");
        setInsuranceProviders(data.data ?? []);
      } catch {
        toast.error("Failed to load insurance providers");
      } finally {
        setIsLoadingProviders(false);
      }
    })();
  }, [isInsuranceOrCorporate]);

  // ── Consultation flow ──
  const consultDepartments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of specializations) {
      if (s.departmentId && !seen.has(s.departmentId)) seen.set(s.departmentId, s.departmentName ?? s.departmentId);
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [specializations]);

  const consultSpecializations = useMemo(
    () => specializations.filter((s) => !selectedDepartmentId || s.departmentId === selectedDepartmentId),
    [specializations, selectedDepartmentId]
  );

  useEffect(() => {
    if (selectedSpecializationId && !consultSpecializations.some((s) => s.specializationId === selectedSpecializationId)) {
      setSelectedSpecializationId("");
    }
  }, [selectedDepartmentId, specializations]);

  const doctorsForSpecialization = specializations.find((s) => s.specializationId === selectedSpecializationId)?.doctors ?? [];

  const fetchSlots = async () => {
    if (!selectedDoctorId || !consultDate) { setDaySlots(null); return; }
    try {
      setIsLoadingSlots(true);
      const data = await ReceptionService.getDoctorSlots(selectedDoctorId, consultDate);
      setDaySlots(data.data ?? null);
    } catch {
      toast.error("Failed to load slots for this doctor");
      setDaySlots(null);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => { fetchSlots(); }, [selectedDoctorId, consultDate]);
  useSignalRRefetch(["appointmentCreated", "appointmentCancelled"], fetchSlots);

  // Auto-start consultation after registration
  useEffect(() => {
    if (!registeredPatient || presetApplied.current) return;
    presetApplied.current = true;
    setShowConsultForm(true);
  }, [registeredPatient]);

  // Pre-fill doctor/spec/dept/date once consult form opens
  useEffect(() => {
    if (!showConsultForm || presetsFilledRef.current || !presetDoctorId) return;
    presetsFilledRef.current = true;
    if (presetDeptId) setSelectedDepartmentId(presetDeptId);
    if (presetSpecId) setSelectedSpecializationId(presetSpecId);
    setSelectedDoctorId(presetDoctorId);
    if (presetDate) setConsultDate(presetDate);
  }, [showConsultForm]);

  // Auto-select preset slot when slots load
  useEffect(() => {
    if (!presetSlotStart || !daySlots) return;
    const match = (daySlots.slots ?? []).find((s) => s.start === presetSlotStart);
    if (match) setSelectedSlot(match);
  }, [daySlots]);

  const closeAll = () => {
    onClose();
  };

  // ── Form handlers ──
  const digitsOnly = (raw: string, max: number) => raw.replace(/\D/g, "").slice(0, max);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
    setError("");
  };

  const updateCoverage = (category: string, field: keyof CoverageFormRow, value: string) =>
    setCoverages((prev) => ({ ...prev, [category]: { ...prev[category], [field]: value } }));

  const resetForm = () => {
    setFormData(initialForm());
    setAddressFields({});
    setShowAddressErrors(false);
    setCoverages(emptyCoverages());
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const missingSelections = [
      !formData.sex && "Sex",
      !formData.nationality && "Nationality",
      !formData.maritalStatus && "Marital Status",
      !formData.visaType && "Visa Type",
    ].filter(Boolean);
    if (missingSelections.length > 0) { toast.error(`Please select: ${missingSelections.join(", ")}`); return; }
    if (!isValidEmail(formData.email)) { setError("Enter a valid email address (e.g. john@example.com)."); return; }
    if (!formData.nationalID && !formData.passportNumber) { setError(`Please provide either ${idLabel} or Passport Number`); return; }
    const idProblem = nationalIdError(region, formData.nationalID);
    if (idProblem) { setError(idProblem); return; }
    const phoneProblem = phoneError(region, formData.phoneCode, formData.phone);
    if (phoneProblem) { setError(phoneProblem); toast.error(phoneProblem); return; }
    if (structuredAddress && Object.keys(addressErrors(region?.addressFields ?? [], addressFields)).length > 0) {
      setShowAddressErrors(true);
      toast.error("Check the highlighted address fields");
      return;
    }
    if (formData.passportNumber && !passportNumberRegex.test(formData.passportNumber)) {
      setError("Passport Number format looks incorrect. Expected 6-9 letters/digits."); return;
    }
    if (isInsuranceOrCorporate && (!formData.insuranceProvider || !formData.insuranceCardNo || !formData.insuranceExpiryDate)) {
      toast.error(`${formData.paymentType} Provider, Card No and Expiry Date are required`); return;
    }

    const registeredBy = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").userId ?? null;
    const toNum = (v: string) => v.trim() === "" ? undefined : Number(v);
    const toDate = (v: string) => v.trim() === "" ? undefined : v;

    const payload: ReceptionCreatePatientType = {
      ...formData,
      registeredBy,
      emergencyContactPhone: formData.emergencyContactPhoneCode + formData.emergencyContactPhone,
      // Structured fields when any are filled - the API builds the address line from them.
      ...(structuredAddress
        ? hasAnyAddressValue(addressFields) ? { address: "", addressFields } : { address: "" }
        : { address: formData.address }),
      eligibilityCheckedDate: toDate(formData.eligibilityCheckedDate),
      insuranceEffectiveFrom: toDate(formData.insuranceEffectiveFrom),
      insuranceExpiryDate: toDate(formData.insuranceExpiryDate),
      maxInsuranceLiability: toNum(formData.maxInsuranceLiability),
      insuranceApprovalLimit: toNum(formData.insuranceApprovalLimit),
      maxInsuranceCopay: toNum(formData.maxInsuranceCopay),
      coPayPatientPercent: toNum(formData.coPayPatientPercent),
      insuranceCoverages: isInsuranceOrCorporate
        ? INSURANCE_SERVICE_CATEGORIES.map((category): InsuranceCoverageRow => ({
            serviceCategory: category,
            deductible: toNum(coverages[category].deductible),
            deductibleAppliesTo: coverages[category].deductibleAppliesTo || undefined,
            coPayPercent: toNum(coverages[category].coPayPercent),
            coPayMin: toNum(coverages[category].coPayMin),
            coPayMax: toNum(coverages[category].coPayMax),
            coPayAppliesTo: coverages[category].coPayAppliesTo || undefined,
          }))
        : undefined,
    };

    try {
      setLoading(true);
      const res = await ReceptionService.matchPatients({
        nationalID: formData.nationalID || undefined,
        passportNumber: formData.passportNumber || undefined,
        phone: formData.phone || undefined,
        phoneCode: formData.phoneCode,
        email: formData.email || undefined,
      });
      const found: PatientMatchType[] = res.data ?? [];
      if (found.length > 0) {
        setSubmitMatches(found);
        setPendingPayload(payload);
        setLoading(false);
        return;
      }
    } catch {
      // Carry on - the server still refuses an ID that's already registered.
    }
    await createNewPatient(payload);
  };

  const createNewPatient = async (payload: ReceptionCreatePatientType) => {
    try {
      setLoading(true);
      const data = await ReceptionService.createPatinet(payload);
      toast.success(data.message);
      resetForm();
      setRegisteredPatient({ opId: data.data.opId, name: data.data.name });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.duplicate && err.response.data.data?.length) {
        setSubmitMatches(err.response.data.data);
        setPendingPayload(null);
      }
      toast.error(apiErrorMessage(err, "Failed to register patient"));
    } finally {
      setLoading(false);
      setError("");
    }
  };

  // A walk-in's minimal record is completed with the details just typed - only where it has
  // nothing yet, except payment, where a walk-in's "Cash" was only ever a default.
  const completeWalkInRecord = async (patientId: string, typed: ReceptionCreatePatientType) => {
    const res = await ReceptionService.getPatientById(patientId);
    const existing: PatientFullDetailsType = res.data;
    const merged: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(typed)) {
      if (key === "password" || key === "registeredBy" || value === undefined || value === "") continue;
      if (merged[key] === "" || merged[key] == null) merged[key] = value;
    }
    if (typed.paymentType !== "Cash") {
      for (const [key, value] of Object.entries(typed)) {
        if (key === "paymentType" || key === "insuranceCoverages" || /^(eligibility|insurance|subInsurance|networkType|extraCardNo|certificateNo|dependentsNo|maxInsurance|coPay)/.test(key))
          if (value !== undefined && value !== "") merged[key] = value;
      }
    }
    await ReceptionService.updatePatient(patientId, {
      ...(merged as Omit<ReceptionCreatePatientType, "password">),
      registrationType: "Full",
    });
  };

  // Books the consultation for the existing record instead of creating a second one.
  const continueWithExisting = async (match: PatientMatchType) => {
    setOpeningMatchId(match.opId);
    if (pendingPayload && match.registrationType === "External") {
      try {
        await completeWalkInRecord(match.opId, pendingPayload);
        toast.success(`${match.name}'s walk-in record is now fully registered`);
      } catch {
        toast.warning(`Continuing with ${match.name}'s existing record - complete their details from Patient Records.`);
      }
    } else {
      toast.success(`Continuing with ${match.name}'s existing record`);
    }
    setSubmitMatches(null);
    setPendingPayload(null);
    setOpeningMatchId(null);
    resetForm();
    setRegisteredPatient({ opId: match.opId, name: match.name });
  };

  const handleBookConsultation = async () => {
    if (!registeredPatient || !selectedDoctorId || !selectedSlot) return;
    try {
      setIsBookingConsult(true);
      const userId = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").userId ?? undefined;
      const data = await ReceptionService.createAppointment({
        patientId: registeredPatient.opId,
        doctorId: selectedDoctorId,
        appointmentDate: selectedSlot.start,
        notes: consultNotes,
        userId,
      });
      if (data.status === false) { toast.error(data.message || "Could not book this slot"); return; }
      toast.success(data.message || "Consultation booked");
      onBooked();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to book consultation"));
    } finally {
      setIsBookingConsult(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = "px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent";
  const selectCls = "flex h-11 w-full items-center justify-between gap-1 px-4 border border-border rounded-lg text-left text-foreground bg-card transition-colors hover:border-primary/60";
  const labelCls = "font-semibold text-foreground/90 text-sm";

  // ── Post-registration consultation UI ──
  if (registeredPatient) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card w-full max-w-2xl rounded-xl border border-border shadow-2xl p-6">
          {!showConsultForm ? (
            <>
              <h2 className="text-xl font-bold text-foreground">Patient registered successfully</h2>
              <p className="mt-2 text-sm text-foreground/80">
                {registeredPatient.name} has been added to the system. Do you want to add a consultation appointment for them now?
              </p>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={closeAll} className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer">No, skip</button>
                <button type="button" onClick={() => setShowConsultForm(true)} className="flex-1 bg-primary hover:opacity-90 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer">Yes, add consultation</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Book consultation</h2>
                  <p className="text-sm text-foreground/80 mt-1">for {registeredPatient.name}</p>
                </div>
                <button type="button" onClick={closeAll} className="text-muted-foreground hover:text-foreground cursor-pointer"><MdClose size={20} /></button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Department</label>
                    <SearchableSelect value={selectedDepartmentId} onChange={(v) => { setSelectedDepartmentId(v); setSelectedDoctorId(""); setDaySlots(null); setSelectedSlot(null); }} className={selectCls} preserveCase
                      options={[{ value: "", label: "Select department" }, ...consultDepartments]} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Specialty</label>
                    <SearchableSelect value={selectedSpecializationId} onChange={(v) => { setSelectedSpecializationId(v); setSelectedDoctorId(""); setDaySlots(null); setSelectedSlot(null); }} className={selectCls} preserveCase
                      options={[{ value: "", label: "Select specialty" }, ...consultSpecializations.map((s) => ({ value: s.specializationId, label: s.specializationName }))]} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Doctor</label>
                    <SearchableSelect value={selectedDoctorId} onChange={(v) => { setSelectedDoctorId(v); setSelectedSlot(null); }} disabled={!selectedSpecializationId} className={selectCls} preserveCase
                      options={[{ value: "", label: "Select doctor" }, ...doctorsForSpecialization.map((d) => ({ value: d.doctorId, label: d.name }))]} />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:w-56">
                  <label className={labelCls}>Date</label>
                  <DatePicker value={consultDate} onChange={(v) => { setConsultDate(v); setSelectedSlot(null); }} min={toDateInputValue(new Date())} dateFormat="dd-MM-yyyy" placeholder="DD-MM-YYYY"
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                </div>

                {selectedDoctorId && (
                  <div className="flex flex-col gap-2">
                    <label className={labelCls}>Available slots</label>
                    {isLoadingSlots ? <LoadingSpinner /> : (daySlots?.slots.filter((s) => s.isAvailable).length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">No open slots for this doctor on this day.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                        {daySlots!.slots.filter((s) => s.isAvailable).map((slot) => (
                          <button key={slot.start} type="button" onClick={() => setSelectedSlot(slot)}
                            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${selectedSlot?.start === slot.start ? "border-primary bg-primary text-white" : "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"}`}>
                            {format(new Date(slot.start), "h:mm a")}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className={labelCls}>Notes</label>
                  <textarea value={consultNotes} onChange={(e) => setConsultNotes(e.target.value)} placeholder="Reason for visit"
                    className="w-full min-h-16 px-4 py-2 rounded-lg border border-border bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={closeAll} className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer">Cancel</button>
                <button type="button" onClick={handleBookConsultation} disabled={!selectedDoctorId || !selectedSlot || isBookingConsult}
                  className="flex-1 bg-primary hover:opacity-90 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer">
                  {isBookingConsult ? "Booking..." : "Book"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Registration form ──
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-5xl max-h-[95vh] rounded-xl border border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">New Patient Registration</h2>
            {presetDoctorId && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Slot with <span className="font-semibold text-foreground">{doctorName}</span> on <span className="font-semibold text-foreground">{slotDisplayTime}</span> will be pre-filled after registration
              </p>
            )}
          </div>
          <button type="button" onClick={closeAll} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 flex flex-col gap-6">

          {/* Personal Information */}
          <div className="bg-background rounded-lg border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="John Doe" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Sex <span className="text-red-500">*</span></label>
                <SearchableSelect value={formData.sex} onChange={(v) => setFormData((p) => ({ ...p, sex: v }))} className={selectCls} preserveCase
                  options={[{ value: "", label: "Select Gender" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }]} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Date of Birth <span className="text-red-500">*</span></label>
                <DatePicker name="dateOfBirth" value={formData.dateOfBirth} onChange={(v) => setFormData((p) => ({ ...p, dateOfBirth: v }))} max={toDateInputValue(new Date())} required dateFormat="dd-MM-yyyy" placeholder="DD-MM-YYYY"
                  className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Nationality <span className="text-red-500">*</span></label>
                <SearchableSelect value={formData.nationality} onChange={(v) => setFormData((p) => ({ ...p, nationality: v }))} className={selectCls} preserveCase placeholder="Select Country"
                  options={countryDetails.map((c) => ({ value: c.country, label: c.country }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Father Name</label>
                <input type="text" name="fatherName" value={formData.fatherName} onChange={handleInputChange} placeholder="Father's Name" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Mother Name</label>
                <input type="text" name="motherName" value={formData.motherName} onChange={handleInputChange} placeholder="Mother's Name" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Marital Status <span className="text-red-500">*</span></label>
                <SearchableSelect value={formData.maritalStatus} onChange={(v) => setFormData((p) => ({ ...p, maritalStatus: v }))} className={selectCls} preserveCase
                  options={[{ value: "", label: "Select Status" }, ...["Single", "Married", "Divorced", "Widowed"].map((v) => ({ value: v, label: v }))]} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Designation</label>
                <input type="text" name="designation" value={formData.designation} onChange={handleInputChange} placeholder="Engineer" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-background rounded-lg border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Phone Number <span className="text-red-500">*</span></label>
                <div className="flex border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent overflow-hidden">
                  <CountryCodeSelect name="phoneCode" value={formData.phoneCode} onChange={(code) => setFormData((p) => ({ ...p, phoneCode: code }))} required
                    className="flex h-11 shrink-0 items-center gap-1 border-r border-border px-3 text-foreground transition-colors hover:bg-muted" />
                  <input type="tel" name="phone" inputMode="numeric" value={formData.phone} onChange={(e) => { setFormData((p) => ({ ...p, phone: digitsOnly(e.target.value, selectedPhoneLength) })); setError(""); }}
                    required maxLength={selectedPhoneLength} placeholder={phonePlaceholderFor(formData.phoneCode)} className="flex-1 px-4 py-2.5 focus:outline-none text-foreground bg-transparent" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="john@example.com" aria-invalid={emailInvalid}
                  className={`px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-foreground bg-transparent ${emailInvalid ? "border-red-500 focus:ring-red-500" : "border-border focus:ring-primary"}`} />
                {emailInvalid && <p className="text-red-500 text-xs">Enter a valid email address.</p>}
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className={labelCls}>Address</label>
                {structuredAddress ? (
                  <RegionAddressFields region={region} values={addressFields} onChange={setAddressFields} showErrors={showAddressErrors} />
                ) : (
                  <textarea name="address" value={formData.address} onChange={handleInputChange} placeholder="Address" rows={2} className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent resize-y min-h-11" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Emergency Contact Name <span className="text-red-500">*</span></label>
                <input type="text" name="emergencyContact" value={formData.emergencyContact} onChange={handleInputChange} required placeholder="Contact Name" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Emergency Contact Phone <span className="text-red-500">*</span></label>
                <div className="flex border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent overflow-hidden">
                  <CountryCodeSelect name="emergencyContactPhoneCode" value={formData.emergencyContactPhoneCode} onChange={(code) => setFormData((p) => ({ ...p, emergencyContactPhoneCode: code }))} required
                    className="flex h-11 shrink-0 items-center gap-1 border-r border-border px-3 text-foreground transition-colors hover:bg-muted" />
                  <input type="tel" name="emergencyContactPhone" inputMode="numeric" value={formData.emergencyContactPhone} onChange={(e) => { setFormData((p) => ({ ...p, emergencyContactPhone: digitsOnly(e.target.value, selectedEmergencyPhoneLength) })); setError(""); }}
                    required maxLength={selectedEmergencyPhoneLength} placeholder={phonePlaceholderFor(formData.emergencyContactPhoneCode)} className="flex-1 px-4 py-2.5 focus:outline-none text-foreground bg-transparent" />
                </div>
              </div>
            </div>
          </div>

          {/* Identification */}
          <div className="bg-background rounded-lg border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-1">Identification</h3>
            <p className="text-xs text-muted-foreground mb-4"><span className="text-red-500">*</span> Please provide either {idLabel} or Passport Number</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>{idLabel}</label>
                <input type="text" name="nationalID" value={formData.nationalID} onChange={handleInputChange} placeholder={region?.nationalId.placeholder ?? "National ID"} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Passport Number</label>
                <input type="text" name="passportNumber" value={formData.passportNumber} onChange={handleInputChange} placeholder="A1234567" className={inputCls} />
                {error && <p className="text-red-500 text-sm">{error}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Visa Type <span className="text-red-500">*</span></label>
                <SearchableSelect value={formData.visaType} onChange={(v) => setFormData((p) => ({ ...p, visaType: v }))} className={selectCls} preserveCase
                  options={[{ value: "", label: "Select Visa Type" }, ...["Residency", "Tourist", "Business", "Student"].map((v) => ({ value: v, label: v }))]} />
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div className="bg-background rounded-lg border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-4">Medical Information</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5 w-48">
                <label className={labelCls}>Patient Type <span className="text-red-500">*</span></label>
                <SearchableSelect value={formData.patientType} onChange={(v) => setFormData((p) => ({ ...p, patientType: v }))} className={selectCls} preserveCase
                  options={["Normal", "VIP", "Emergency"].map((v) => ({ value: v, label: v }))} />
              </div>
              <div className="flex items-center gap-3">
                <label className={`${labelCls} cursor-pointer`}>Chronic Status</label>
                <ToggleButton id="chronicStatus" checked={formData.chronicStatus} onChange={(checked) => setFormData((p) => ({ ...p, chronicStatus: checked }))} />
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-background rounded-lg border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-4">Payment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Payment Type <span className="text-red-500">*</span></label>
                <SearchableSelect value={formData.paymentType} onChange={(v) => setFormData((p) => ({ ...p, paymentType: v }))} className={selectCls} preserveCase
                  options={["Cash", "Insurance", "Corporate"].map((v) => ({ value: v, label: v }))} />
              </div>
            </div>

            {isInsuranceOrCorporate && (
              <div className="flex flex-col gap-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Eligibility Mode</label>
                    <SearchableSelect value={formData.eligibilityMode} onChange={(v) => setFormData((p) => ({ ...p, eligibilityMode: v }))} className={selectCls} preserveCase
                  options={[{ value: "", label: "Not Done" }, { value: "Online", label: "Online" }, { value: "Manual", label: "Manual" }]} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Eligibility Checked Date</label>
                    <DatePicker value={formData.eligibilityCheckedDate} onChange={(v) => setFormData((p) => ({ ...p, eligibilityCheckedDate: v }))} max={toDateInputValue(new Date())} dateFormat="dd-MM-yyyy" placeholder="DD-MM-YYYY"
                      className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Eligibility ID</label>
                    <input type="text" name="eligibilityID" value={formData.eligibilityID} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Eligibility Visit ID</label>
                    <input type="text" name="eligibilityVisitID" value={formData.eligibilityVisitID} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>{formData.paymentType} Provider <span className="text-red-500">*</span></label>
                    <SearchableSelect value={formData.insuranceProvider} onChange={(v) => setFormData((p) => ({ ...p, insuranceProvider: v }))} className={selectCls} preserveCase
                  options={[{ value: "", label: isLoadingProviders ? "Loading..." : "Select Provider" }, ...insuranceProviders.map((ip) => ({ value: ip.name, label: ip.name }))]} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Sub Insurance</label>
                    <input type="text" name="subInsurance" value={formData.subInsurance} onChange={handleInputChange} placeholder="Plan / sub-category" className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Network Type</label>
                    <SearchableSelect value={formData.networkType} onChange={(v) => setFormData((p) => ({ ...p, networkType: v }))} className={selectCls} preserveCase
                  options={[{ value: "", label: "Select Network Type" }, ...["Open Network", "Restricted Network", "Copay Network"].map((v) => ({ value: v, label: v }))]} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>{formData.paymentType} Card No <span className="text-red-500">*</span></label>
                    <input type="text" name="insuranceCardNo" value={formData.insuranceCardNo} onChange={handleInputChange} required className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Extra Card No</label>
                    <input type="text" name="extraCardNo" value={formData.extraCardNo} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>{formData.paymentType} Effective From</label>
                    <DatePicker value={formData.insuranceEffectiveFrom} onChange={(v) => setFormData((p) => ({ ...p, insuranceEffectiveFrom: v }))} dateFormat="dd-MM-yyyy" placeholder="DD-MM-YYYY"
                      className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>{formData.paymentType} Expiry Date <span className="text-red-500">*</span></label>
                    <DatePicker value={formData.insuranceExpiryDate} onChange={(v) => setFormData((p) => ({ ...p, insuranceExpiryDate: v }))} required dateFormat="dd-MM-yyyy" placeholder="DD-MM-YYYY"
                      className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Certificate No.</label>
                    <input type="text" name="certificateNo" value={formData.certificateNo} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Dependents No.</label>
                    <input type="text" name="dependentsNo" value={formData.dependentsNo} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Insurance Claim No.</label>
                    <input type="text" name="insuranceClaimNo" value={formData.insuranceClaimNo} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Max. Insurance Liability (AED)</label>
                    <input type="number" min="0" step="0.01" name="maxInsuranceLiability" value={formData.maxInsuranceLiability} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Insurance Approval Limit (AED)</label>
                    <input type="number" min="0" step="0.01" name="insuranceApprovalLimit" value={formData.insuranceApprovalLimit} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Max. Insurance Copay (AED)</label>
                    <input type="number" min="0" step="0.01" name="maxInsuranceCopay" value={formData.maxInsuranceCopay} onChange={handleInputChange} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelCls}>Co-Pay Patient (%)</label>
                    <input type="number" min="0" max="100" step="0.01" name="coPayPatientPercent" value={formData.coPayPatientPercent} onChange={handleInputChange} className={inputCls} />
                  </div>
                </div>

                {/* Fee Schedule */}
                <div className="flex flex-col gap-3">
                  <h4 className="font-semibold text-foreground/90 text-sm">Fee Schedule</h4>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table>
                      <thead>
                        <tr>
                          <th>Category</th><th>Deductible (AED)</th><th>Applies To</th>
                          <th>Co-Pay %</th><th>Min (AED)</th><th>Max (AED)</th><th>Applies To</th>
                        </tr>
                      </thead>
                      <tbody>
                        {INSURANCE_SERVICE_CATEGORIES.map((category) => {
                          const row = coverages[category];
                          const toggle = (field: "deductibleAppliesTo" | "coPayAppliesTo") => (
                            <div className="flex w-fit rounded-md border border-border overflow-hidden text-xs">
                              {(["All", "Each"] as const).map((opt) => (
                                <button key={opt} type="button" onClick={() => updateCoverage(category, field, opt)}
                                  className={`px-2 py-1.5 transition-colors cursor-pointer ${row[field] === opt ? "bg-primary text-white" : "bg-transparent text-foreground/70 hover:bg-muted"}`}>{opt}</button>
                              ))}
                            </div>
                          );
                          return (
                            <tr key={category}>
                              <td className="font-semibold whitespace-nowrap">{category}</td>
                              <td><input type="number" min="0" step="0.01" value={row.deductible} onChange={(e) => updateCoverage(category, "deductible", e.target.value)} className="w-24 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent" /></td>
                              <td>{toggle("deductibleAppliesTo")}</td>
                              <td><input type="number" min="0" max="100" step="0.01" value={row.coPayPercent} onChange={(e) => updateCoverage(category, "coPayPercent", e.target.value)} className="w-20 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent" /></td>
                              <td><input type="number" min="0" step="0.01" value={row.coPayMin} onChange={(e) => updateCoverage(category, "coPayMin", e.target.value)} className="w-20 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent" /></td>
                              <td><input type="number" min="0" step="0.01" value={row.coPayMax} onChange={(e) => updateCoverage(category, "coPayMax", e.target.value)} className="w-20 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent" /></td>
                              <td>{toggle("coPayAppliesTo")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 pb-2">
            <button type="button" onClick={resetForm} className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-bold py-3 px-6 rounded-lg transition duration-200">Clear Form</button>
            <button type="submit" disabled={loading} className="flex-1 bg-primary hover:opacity-90 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-lg transition duration-200 cursor-pointer">
              {loading ? "Registering..." : "Register Patient"}
            </button>
          </div>
        </form>
      </div>

      {submitMatches ? (
        <DuplicatePatientPrompt
          matches={submitMatches}
          busyId={openingMatchId}
          continueLabel="Use this patient"
          onContinue={continueWithExisting}
          onCreateNew={
            pendingPayload
              ? () => {
                  const toCreate = pendingPayload;
                  setSubmitMatches(null);
                  setPendingPayload(null);
                  createNewPatient(toCreate);
                }
              : undefined
          }
          onCancel={() => {
            setSubmitMatches(null);
            setPendingPayload(null);
          }}
        />
      ) : (
        <ExistingPatientNotice
          matches={visibleMatches}
          onContinue={continueWithExisting}
          onDismiss={dismissMatches}
          busyId={openingMatchId}
        />
      )}
    </div>
  );
}
