"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  MdOutlinePersonOutline,
  MdOutlineLocalPhone,
  MdOutlineFilePresent,
  MdOutlinePayment,
  MdClose,
} from "react-icons/md";
import { format } from "date-fns";
import { countryDetails } from "@/helpers/countyDetails";
import { getNationalIdFormat, passportNumberRegex } from "@/helpers/nationalIdFormats";
import { ReceptionService } from "@/services/reception.service";
import { ConfigListService } from "@/services/configList.service";
import { toast } from "sonner";
import { ReceptionCreatePatientType, InsuranceCoverageRow, PatientFullDetailsType } from "@/types/reception.type";
import { ListItemType } from "@/types/configList.type";
import {
  AppointmentSlotType,
  DoctorDaySlotsType,
  SpecializationDoctorsType,
} from "@/types/appointment.type";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import SearchableSelect from "@/components/SearchableSelect";
import ToggleButton from "@/components/ToggleButton";
import { toDateInputValue } from "@/lib/date";
import { isValidEmail } from "@/lib/validation";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { backendAssetUrl } from "@/lib/backendAsset";
import { Eye, Paperclip, Trash2, Upload } from "lucide-react";

// Cash needs nothing further; Insurance and Corporate share the exact same
// eligibility + fee-schedule template, entered once off the patient's card.
const INSURANCE_SERVICE_CATEGORIES = [
  "Consultation",
  "Lab",
  "Radiology",
  "Treatment",
  "Medicine",
  "Dental",
  "Maternity",
] as const;

type CoverageFormRow = {
  deductible: string;
  deductibleAppliesTo: string;
  coPayPercent: string;
  coPayMin: string;
  coPayMax: string;
  coPayAppliesTo: string;
};

const emptyCoverageRow: CoverageFormRow = {
  deductible: "",
  deductibleAppliesTo: "",
  coPayPercent: "",
  coPayMin: "",
  coPayMax: "",
  coPayAppliesTo: "",
};

const emptyCoverages = (): Record<string, CoverageFormRow> =>
  Object.fromEntries(
    INSURANCE_SERVICE_CATEGORIES.map((category) => [category, { ...emptyCoverageRow }])
  );

export default function PatientEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Present only when reached via Patient Records' "Edit" action (see that page's
  // renderActions) - reuses this same registration form instead of a second one, matching
  // how Staff Registration already handles create+edit with one form.
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;
  const [isLoadingPatient, setIsLoadingPatient] = useState(isEditMode);
  const [formData, setFormData] = useState({
    name: "",
    sex: "",
    dateOfBirth: "",
    phone: "",
    phoneCode: "+971",
    email: "",
    address: "",
    nationality: "",
    passportNumber: "",
    nationalID: "",
    fatherName: "",
    motherName: "",
    patientType: "Normal",
    visaType: "",
    maritalStatus: "",
    designation: "",
    referralStatus: false,
    chronicStatus: false,
    emergencyContact: "",
    emergencyContactPhone: "",
    emergencyContactPhoneCode: "+971",
    paymentType: "Cash",
    eligibilityMode: "",
    eligibilityCheckedDate: "",
    eligibilityID: "",
    eligibilityVisitID: "",
    insuranceProvider: "",
    subInsurance: "",
    networkType: "",
    insuranceCardNo: "",
    extraCardNo: "",
    insuranceEffectiveFrom: "",
    insuranceExpiryDate: "",
    certificateNo: "",
    dependentsNo: "",
    insuranceClaimNo: "",
    maxInsuranceLiability: "",
    insuranceApprovalLimit: "",
    maxInsuranceCopay: "",
    coPayPatientPercent: "",
    password: "",
  });
  const [coverages, setCoverages] = useState<Record<string, CoverageFormRow>>(emptyCoverages);
  const [insuranceProviders, setInsuranceProviders] = useState<ListItemType[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [companyCountry, setCompanyCountry] = useState<string | undefined>(undefined);
  const isInsuranceOrCorporate = formData.paymentType !== "Cash";
  // Only flagged once something's actually been typed - an empty required field is caught
  // by the browser's own `required` validation on submit, not this live format check.
  const emailInvalid = formData.email.length > 0 && !isValidEmail(formData.email);
  // National ID format follows the clinic's own admin-configured Country (Settings), not
  // whichever nationality is picked for this particular patient - a UAE clinic always
  // expects Emirates ID, regardless of the patient's own nationality.
  const nationalIdFormat = getNationalIdFormat(companyCountry);
  // National significant number length for whichever dialing code is currently selected -
  // caps how many digits the phone field accepts. Falls back to 15 (E.164's global max
  // significant-digit count) if the code somehow isn't in the list.
  const selectedPhoneLength =
    countryDetails.find((c) => c.phoneCode === formData.phoneCode)?.phoneLength ?? 15;
  const selectedEmergencyPhoneLength =
    countryDetails.find((c) => c.phoneCode === formData.emergencyContactPhoneCode)?.phoneLength ?? 15;

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    setCompanyCountry(stored.country);
  }, []);

  // Prefills the whole form from the existing patient's saved details when reached in edit
  // mode - the API has no separate dialing-code field for the emergency contact (see
  // handleSubmit's own comment), so its stored value ("+97112345678") is split back into
  // code + number here by matching the longest known dialing code prefix, the inverse of
  // how it was joined on save.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        setIsLoadingPatient(true);
        const res = await ReceptionService.getPatientById(editId);
        const p: PatientFullDetailsType = res.data;

        const emergencyCode = [...countryDetails]
          .sort((a, b) => b.phoneCode.length - a.phoneCode.length)
          .find((c) => p.emergencyContactPhone?.startsWith(c.phoneCode));
        const emergencyContactPhoneCode = emergencyCode?.phoneCode ?? "+971";
        const emergencyContactPhone = emergencyCode
          ? p.emergencyContactPhone.slice(emergencyCode.phoneCode.length)
          : p.emergencyContactPhone ?? "";

        setFormData({
          name: p.name ?? "",
          sex: p.sex ?? "",
          dateOfBirth: p.dateOfBirth ?? "",
          phone: p.phone ?? "",
          phoneCode: p.phoneCode || "+971",
          email: p.email ?? "",
          address: p.address ?? "",
          nationality: p.nationality ?? "",
          passportNumber: p.passportNumber ?? "",
          nationalID: p.nationalID ?? "",
          fatherName: p.fatherName ?? "",
          motherName: p.motherName ?? "",
          patientType: p.patientType || "Normal",
          visaType: p.visaType ?? "",
          maritalStatus: p.maritalStatus ?? "",
          designation: p.designation ?? "",
          referralStatus: p.referralStatus ?? false,
          chronicStatus: p.chronicStatus ?? false,
          emergencyContact: p.emergencyContact ?? "",
          emergencyContactPhone,
          emergencyContactPhoneCode,
          paymentType: p.paymentType || "Cash",
          eligibilityMode: p.eligibilityMode ?? "",
          eligibilityCheckedDate: p.eligibilityCheckedDate ?? "",
          eligibilityID: p.eligibilityID ?? "",
          eligibilityVisitID: p.eligibilityVisitID ?? "",
          insuranceProvider: p.insuranceProvider ?? "",
          subInsurance: p.subInsurance ?? "",
          networkType: p.networkType ?? "",
          insuranceCardNo: p.insuranceCardNo ?? "",
          extraCardNo: p.extraCardNo ?? "",
          insuranceEffectiveFrom: p.insuranceEffectiveFrom ?? "",
          insuranceExpiryDate: p.insuranceExpiryDate ?? "",
          certificateNo: p.certificateNo ?? "",
          dependentsNo: p.dependentsNo ?? "",
          insuranceClaimNo: p.insuranceClaimNo ?? "",
          maxInsuranceLiability: p.maxInsuranceLiability?.toString() ?? "",
          insuranceApprovalLimit: p.insuranceApprovalLimit?.toString() ?? "",
          maxInsuranceCopay: p.maxInsuranceCopay?.toString() ?? "",
          coPayPatientPercent: p.coPayPatientPercent?.toString() ?? "",
          password: "",
        });

        if (p.insuranceCoverages && p.insuranceCoverages.length > 0) {
          setCoverages((prev) => {
            const next = { ...prev };
            for (const row of p.insuranceCoverages!) {
              if (!(row.serviceCategory in next)) continue;
              next[row.serviceCategory] = {
                deductible: row.deductible?.toString() ?? "",
                deductibleAppliesTo: row.deductibleAppliesTo ?? "",
                coPayPercent: row.coPayPercent?.toString() ?? "",
                coPayMin: row.coPayMin?.toString() ?? "",
                coPayMax: row.coPayMax?.toString() ?? "",
                coPayAppliesTo: row.coPayAppliesTo ?? "",
              };
            }
            return next;
          });
        }
      } catch (err) {
        console.error("Failed to load patient for editing:", err);
        toast.error("Failed to load patient details");
      } finally {
        setIsLoadingPatient(false);
      }
    })();
  }, [editId]);

  // Re-clamps an already-typed phone number if switching to a dialing code with a shorter
  // national number length leaves it over the new limit (e.g. 10 digits typed for +234
  // Nigeria, then the code is changed to +974 Qatar's 8-digit numbers).
  useEffect(() => {
    setFormData((prev) =>
      prev.phone.length > selectedPhoneLength
        ? { ...prev, phone: prev.phone.slice(0, selectedPhoneLength) }
        : prev,
    );
  }, [selectedPhoneLength]);

  useEffect(() => {
    setFormData((prev) =>
      prev.emergencyContactPhone.length > selectedEmergencyPhoneLength
        ? { ...prev, emergencyContactPhone: prev.emergencyContactPhone.slice(0, selectedEmergencyPhoneLength) }
        : prev,
    );
  }, [selectedEmergencyPhoneLength]);

  const updateCoverage = (
    category: string,
    field: keyof CoverageFormRow,
    value: string,
  ) => {
    setCoverages((prev) => ({ ...prev, [category]: { ...prev[category], [field]: value } }));
  };

  // Loaded lazily the first time the payment type flips to Insurance/Corporate,
  // rather than on every page load — most registrations are Cash.
  useEffect(() => {
    if (!isInsuranceOrCorporate || insuranceProviders.length > 0) return;
    (async () => {
      try {
        setIsLoadingProviders(true);
        const data = await ConfigListService.get("InsuranceProvider");
        setInsuranceProviders(data.data ?? []);
      } catch (err) {
        console.error("Failed to fetch insurance providers:", err);
        toast.error("Failed to load insurance providers");
      } finally {
        setIsLoadingProviders(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInsuranceOrCorporate]);

  // ---------------- Post-registration "add consultation?" flow ----------------
  const [registeredPatient, setRegisteredPatient] = useState<{
    opId: string;
    name: string;
  } | null>(null);
  const [showConsultForm, setShowConsultForm] = useState(false);
  // Shown as the first screen after registration when eligibilityMode was "Manual" — gives
  // reception a chance to attach the offline eligibility form immediately. Skippable; it can
  // also be attached later from Patient Records' own document upload (same DocumentType).
  const [needsEligibilityDoc, setNeedsEligibilityDoc] = useState(false);
  const [eligibilityFile, setEligibilityFile] = useState<File | null>(null);
  const [uploadingEligibilityDoc, setUploadingEligibilityDoc] = useState(false);
  const [specializations, setSpecializations] = useState<
    SpecializationDoctorsType[]
  >([]);
  const [isLoadingSpecializations, setIsLoadingSpecializations] =
    useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedSpecializationId, setSelectedSpecializationId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [consultDate, setConsultDate] = useState(() =>
    toDateInputValue(new Date())
  );
  const [daySlots, setDaySlots] = useState<DoctorDaySlotsType | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlotType | null>(
    null
  );
  const [consultNotes, setConsultNotes] = useState("");
  const [isBookingConsult, setIsBookingConsult] = useState(false);

  // ---------------- Attachments (edit mode only) ----------------
  type PatientDocItem = {
    patientDocumentId: string;
    documentType: string;
    filePath: string | null;
    createdAt: string;
    visitId: string | null;
  };
  const DOC_TYPE_LABELS: Record<string, string> = {
    ExternalLabReport: "External Lab Report",
    ExternalRadiologyReport: "External Radiology Report",
    InsuranceEligibility: "Insurance Eligibility",
    Other: "Other",
  };
  const PREVIEWABLE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "pdf"];
  const [patientDocs, setPatientDocs] = useState<PatientDocItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docUploadType, setDocUploadType] = useState("Other");
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !editId) return;
    setIsLoadingDocs(true);
    ReceptionService.getPatientDocuments(editId)
      .then((res) => setPatientDocs(res.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoadingDocs(false));
  }, [editId, isEditMode]);

  const handleUploadDoc = async () => {
    if (!editId || !docUploadFile) return;
    setIsUploadingDoc(true);
    try {
      await ReceptionService.uploadDocument(editId, { documentType: docUploadType, file: docUploadFile });
      const updated = await ReceptionService.getPatientDocuments(editId);
      setPatientDocs(updated.data ?? []);
      setDocUploadFile(null);
      toast.success("Document uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (doc: PatientDocItem) => {
    if (!editId) return;
    setDeletingDocId(doc.patientDocumentId);
    try {
      await ReceptionService.deletePatientDocument(editId, doc.patientDocumentId);
      setPatientDocs((prev) => prev.filter((d) => d.patientDocumentId !== doc.patientDocumentId));
      toast.success("Document deleted");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to delete document");
    } finally {
      setDeletingDocId(null);
    }
  };

  // Deduped from `specializations` itself rather than a separate department fetch - every
  // specialization here already carries its own department, and this modal only ever needs
  // departments that actually have an active, doctor-staffed specialization under them.
  // Mirrors patient-records/page.tsx's Walk-in modal (walkInDepartments) exactly.
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

  // A previously-picked specialization may no longer be valid once the department changes.
  useEffect(() => {
    if (selectedSpecializationId && !consultSpecializations.some((s) => s.specializationId === selectedSpecializationId)) {
      setSelectedSpecializationId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartmentId, specializations]);

  const doctorsForSpecialization =
    specializations.find((s) => s.specializationId === selectedSpecializationId)
      ?.doctors ?? [];

  const fetchSlots = async () => {
    if (!selectedDoctorId || !consultDate) {
      setDaySlots(null);
      return;
    }
    try {
      setIsLoadingSlots(true);
      const data = await ReceptionService.getDoctorSlots(
        selectedDoctorId,
        consultDate
      );
      setDaySlots(data.data ?? null);
    } catch (err) {
      console.error("Failed to fetch doctor slots:", err);
      toast.error("Failed to load slots for this doctor");
      setDaySlots(null);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctorId, consultDate]);

  useSignalRRefetch(["appointmentCreated", "appointmentCancelled"], fetchSlots);


  const closeConsultFlow = () => {
    setRegisteredPatient(null);
    setShowConsultForm(false);
    setSelectedDepartmentId("");
    setSelectedSpecializationId("");
    setSelectedDoctorId("");
    setDaySlots(null);
    setSelectedSlot(null);
    setConsultNotes("");
    setConsultDate(toDateInputValue(new Date()));
    setNeedsEligibilityDoc(false);
    setEligibilityFile(null);
  };

  const handleUploadEligibilityDoc = async () => {
    if (!registeredPatient || !eligibilityFile) return;
    setUploadingEligibilityDoc(true);
    try {
      await ReceptionService.uploadDocument(registeredPatient.opId, {
        documentType: "InsuranceEligibility",
        file: eligibilityFile,
      });
      toast.success("Eligibility document attached");
      setNeedsEligibilityDoc(false);
      setEligibilityFile(null);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to attach document");
      } else {
        toast.error("Failed to attach document");
      }
    } finally {
      setUploadingEligibilityDoc(false);
    }
  };

  const handleWantsConsultation = async () => {
    setShowConsultForm(true);
    if (specializations.length === 0) {
      try {
        setIsLoadingSpecializations(true);
        const data = await ReceptionService.getSpecializationsWithDoctors();
        setSpecializations(data.specializations ?? []);
      } catch (err) {
        console.error("Failed to fetch specializations/doctors:", err);
        toast.error("Failed to load departments/doctors");
      } finally {
        setIsLoadingSpecializations(false);
      }
    }
  };

  const handleBookConsultation = async () => {
    if (!registeredPatient || !selectedDoctorId || !selectedSlot) return;

    try {
      setIsBookingConsult(true);
      const userId =
        JSON.parse(localStorage.getItem("yoton_user_detail") || "{}")
          .userId ?? undefined;

      const data = await ReceptionService.createAppointment({
        patientId: registeredPatient.opId,
        doctorId: selectedDoctorId,
        appointmentDate: selectedSlot.start,
        notes: consultNotes,
        userId,
      });

      if (data.status === false) {
        toast.error(data.message || "Could not book this slot");
        return;
      }

      toast.success(data.message || "Consultation booked");
      closeConsultFlow();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(
          err.response?.data?.message || "Failed to book consultation"
        );
      } else {
        toast.error("Failed to book consultation");
      }
    } finally {
      setIsBookingConsult(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const inputElement = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? inputElement.checked : value,
    }));
    setError("");
  };

  // Strips anything that isn't a digit and caps the result to `maxDigits`, so pasted or typed
  // text can never leave letters/symbols behind or overrun the selected country's phone length.
  const digitsOnly = (raw: string, maxDigits: number) => raw.replace(/\D/g, "").slice(0, maxDigits);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, phone: digitsOnly(e.target.value, selectedPhoneLength) }));
    setError("");
  };

  const handleEmergencyContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContactPhone: digitsOnly(e.target.value, selectedEmergencyPhoneLength),
    }));
    setError("");
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    if (!isValidEmail(formData.email)) {
      setError("Enter a valid email address (e.g. john@example.com).");
      setLoading(false);
      return;
    }

    // Validate that at least one of National ID or Passport Number is filled
    if (!formData.nationalID && !formData.passportNumber) {
      setError("Please provide either National ID or Passport Number");
      setLoading(false);
      return;
    }

    // Format is nationality-specific for National ID (Emirates ID for UAE, Aadhaar for
    // India, ...) and one standard pattern for Passport Number regardless of nationality.
    if (formData.nationalID && nationalIdFormat.regex && !nationalIdFormat.regex.test(formData.nationalID)) {
      setError(
        `${nationalIdFormat.label} format looks incorrect. Expected format: ${nationalIdFormat.placeholder}`
      );
      setLoading(false);
      return;
    }

    if (formData.passportNumber && !passportNumberRegex.test(formData.passportNumber)) {
      setError("Passport Number format looks incorrect. Expected 6-9 letters/digits.");
      setLoading(false);
      return;
    }

    // Cash needs nothing further; Insurance and Corporate share the same
    // required fields (mirrors ReceptionController.CreatePatient's own check).
    if (isInsuranceOrCorporate) {
      if (!formData.insuranceProvider || !formData.insuranceCardNo || !formData.insuranceExpiryDate) {
        toast.error(
          `${formData.paymentType} Provider, Card No and Expiry Date are required`
        );
        setLoading(false);
        return;
      }
    }

    const registeredBy =
      JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").userId ??
      null;

    const toNumberOrUndefined = (value: string) =>
      value.trim() === "" ? undefined : Number(value);

    // Cash registrations never touch the eligibility/insurance date inputs, so they stay at
    // their "" default - sending that raw would fail DateOnly? conversion server-side.
    const toDateOrUndefined = (value: string) =>
      value.trim() === "" ? undefined : value;

    const payload: ReceptionCreatePatientType = {
      ...formData,
      registeredBy,
      // The API has no separate dialing-code field for the emergency contact (unlike the
      // patient's own phone/phoneCode pair), so the selected code is folded into the one
      // string field it does expect.
      emergencyContactPhone: formData.emergencyContactPhoneCode + formData.emergencyContactPhone,
      eligibilityCheckedDate: toDateOrUndefined(formData.eligibilityCheckedDate),
      insuranceEffectiveFrom: toDateOrUndefined(formData.insuranceEffectiveFrom),
      insuranceExpiryDate: toDateOrUndefined(formData.insuranceExpiryDate),
      maxInsuranceLiability: toNumberOrUndefined(formData.maxInsuranceLiability),
      insuranceApprovalLimit: toNumberOrUndefined(formData.insuranceApprovalLimit),
      maxInsuranceCopay: toNumberOrUndefined(formData.maxInsuranceCopay),
      coPayPatientPercent: toNumberOrUndefined(formData.coPayPatientPercent),
      insuranceCoverages: isInsuranceOrCorporate
        ? INSURANCE_SERVICE_CATEGORIES.map(
            (category): InsuranceCoverageRow => ({
              serviceCategory: category,
              deductible: toNumberOrUndefined(coverages[category].deductible),
              deductibleAppliesTo: coverages[category].deductibleAppliesTo || undefined,
              coPayPercent: toNumberOrUndefined(coverages[category].coPayPercent),
              coPayMin: toNumberOrUndefined(coverages[category].coPayMin),
              coPayMax: toNumberOrUndefined(coverages[category].coPayMax),
              coPayAppliesTo: coverages[category].coPayAppliesTo || undefined,
            })
          )
        : undefined,
    };

    const wasManualEligibility = formData.eligibilityMode === "Manual";

    try {
      if (isEditMode) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...updatePayload } = payload;
        const data = await ReceptionService.updatePatient(editId!, updatePayload);
        toast.success(data.message || "Patient updated successfully");
        router.push("/patient-records");
        return;
      }
      const data = await ReceptionService.createPatinet(payload)
      toast.success(data.message)
      resetForm();
      setRegisteredPatient({ opId: data.data.opId, name: data.data.name });
      setNeedsEligibilityDoc(wasManualEligibility);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || `Failed to ${isEditMode ? "update" : "register"} patient`);
      } else {
        toast.error(`Failed to ${isEditMode ? "update" : "register"} patient`);
      }
    } finally {
      setLoading(false)
    }
    setError("");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sex: "",
      dateOfBirth: "",
      phone: "",
      phoneCode: "+971",
      email: "",
      address: "",
      nationality: "",
      passportNumber: "",
      nationalID: "",
      fatherName: "",
      motherName: "",
      patientType: "Normal",
      visaType: "",
      maritalStatus: "",
      designation: "",
      referralStatus: false,
      chronicStatus: false,
      emergencyContact: "",
      emergencyContactPhone: "",
      emergencyContactPhoneCode: "+971",
      paymentType: "Cash",
      eligibilityMode: "",
      eligibilityCheckedDate: "",
      eligibilityID: "",
      eligibilityVisitID: "",
      insuranceProvider: "",
      subInsurance: "",
      networkType: "",
      insuranceCardNo: "",
      extraCardNo: "",
      insuranceEffectiveFrom: "",
      insuranceExpiryDate: "",
      certificateNo: "",
      dependentsNo: "",
      insuranceClaimNo: "",
      maxInsuranceLiability: "",
      insuranceApprovalLimit: "",
      maxInsuranceCopay: "",
      coPayPatientPercent: "",
      password: "",
    });
    setCoverages(emptyCoverages());
  };

  if (isLoadingPatient) {
    return (
      <div className="mainPage flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-foreground">Edit Patient</h1>
          <p className="text-base text-foreground/80">Loading patient details…</p>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg shadow-md border border-border p-8">
            <div className="h-5 w-40 mb-6 animate-pulse rounded bg-muted/60" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-10 animate-pulse rounded-md bg-muted/50" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mainPage flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-foreground">
            {isEditMode ? "Edit Patient" : "New Patient Entry"}
          </h1>
          <p className="text-base text-foreground/80">
            {isEditMode
              ? "Update this patient's registration details. All fields marked with * are required."
              : "Complete patient registration form. All fields marked with * are required."}
          </p>
        </div>

        {/* Personal Information Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <MdOutlinePersonOutline className="text-primary" size={28} />
            <h2 className="text-2xl font-bold text-foreground">
              Personal Information
            </h2>
          </div>
          <hr className="mb-6 border-border" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="font-semibold text-foreground/90">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="John Doe"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Sex */}
            <div className="flex flex-col gap-2">
              <label htmlFor="sex" className="font-semibold text-foreground/90">
                Sex <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.sex}
                onChange={(v) => setFormData((prev) => ({ ...prev, sex: v }))}
                options={[
                  { value: "", label: "Select Gender" },
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" },
                ]}
              />
            </div>

            {/* Date of Birth */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="dateOfBirth"
                className="font-semibold text-foreground/90"
              >
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <DatePicker
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={(v) =>
                  setFormData((prev) => ({ ...prev, dateOfBirth: v }))
                }
                max={toDateInputValue(new Date())}
                required
                dateFormat="dd-MM-yyyy"
                placeholder="DD-MM-YYYY"
                className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            {/* Nationality */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="nationality"
                className="font-semibold text-foreground/90"
              >
                Nationality <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.nationality}
                onChange={(v) => setFormData((prev) => ({ ...prev, nationality: v }))}
                options={[
                  { value: "", label: "Select Country" },
                  ...countryDetails.map((country) => ({ value: country.country, label: country.country })),
                ]}
              />
            </div>

            {/* Father Name */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="fatherName"
                className="font-semibold text-foreground/90"
              >
                Father Name
              </label>
              <input
                type="text"
                id="fatherName"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleInputChange}
                placeholder="Father's Name"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Mother Name */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="motherName"
                className="font-semibold text-foreground/90"
              >
                Mother Name
              </label>
              <input
                type="text"
                id="motherName"
                name="motherName"
                value={formData.motherName}
                onChange={handleInputChange}
                placeholder="Mother's Name"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Marital Status */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="maritalStatus"
                className="font-semibold text-foreground/90"
              >
                Marital Status <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.maritalStatus}
                onChange={(v) => setFormData((prev) => ({ ...prev, maritalStatus: v }))}
                options={[
                  { value: "", label: "Select Status" },
                  { value: "Single", label: "Single" },
                  { value: "Married", label: "Married" },
                  { value: "Divorced", label: "Divorced" },
                  { value: "Widowed", label: "Widowed" },
                ]}
              />
            </div>

            {/* Designation */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="designation"
                className="font-semibold text-foreground/90"
              >
                Designation
              </label>
              <input
                type="text"
                id="designation"
                name="designation"
                value={formData.designation}
                onChange={handleInputChange}
                placeholder="Engineer"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <MdOutlineLocalPhone className="text-primary" size={28} />
            <h2 className="text-2xl font-bold text-foreground">
              Contact Information
            </h2>
          </div>
          <hr className="mb-6 border-border" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phone Code and Phone Number - Combined */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-foreground/90">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="flex border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent overflow-hidden">
                <CountryCodeSelect
                  id="phoneCode"
                  name="phoneCode"
                  value={formData.phoneCode}
                  onChange={(code) => setFormData((prev) => ({ ...prev, phoneCode: code }))}
                  required
                  className="flex h-11 shrink-0 items-center gap-1 border-r border-border px-3 text-foreground transition-colors hover:bg-muted"
                />

                {/* Phone Input */}
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  required
                  maxLength={selectedPhoneLength}
                  placeholder={"5".padEnd(selectedPhoneLength, "0")}
                  className="flex-1 px-4 py-2.5 focus:outline-none text-foreground bg-transparent rounded-none!"
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="Email" className="font-semibold text-foreground/90">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="john@example.com"
                aria-invalid={emailInvalid}
                className={`px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-foreground bg-transparent ${
                  emailInvalid
                    ? "border-red-500 focus:ring-red-500"
                    : "border-border focus:ring-primary"
                }`}
              />
              {emailInvalid && (
                <p className="text-red-500 text-xs">Enter a valid email address (e.g. john@example.com).</p>
              )}
            </div>

            {/* Address */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label htmlFor="Address" className="font-semibold text-foreground/90">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Abu Dhabi"
                rows={2}
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent resize-y min-h-11"
              />
            </div>

            {/* Emergency Contact */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="emergencyContact"
                className="font-semibold text-foreground/90"
              >
                Emergency Contact Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleInputChange}
                required
                placeholder="Contact Name"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Emergency Contact Phone */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="emergencyContactPhone"
                className="font-semibold text-foreground/90"
              >
                Emergency Contact Phone <span className="text-red-500">*</span>
              </label>
              <div className="flex border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent overflow-hidden">
                <CountryCodeSelect
                  id="emergencyContactPhoneCode"
                  name="emergencyContactPhoneCode"
                  value={formData.emergencyContactPhoneCode}
                  onChange={(code) =>
                    setFormData((prev) => ({ ...prev, emergencyContactPhoneCode: code }))
                  }
                  required
                  className="flex h-11 shrink-0 items-center gap-1 border-r border-border px-3 text-foreground transition-colors hover:bg-muted"
                />
                <input
                  type="tel"
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  inputMode="numeric"
                  value={formData.emergencyContactPhone}
                  onChange={handleEmergencyContactPhoneChange}
                  required
                  maxLength={selectedEmergencyPhoneLength}
                  placeholder={"5".padEnd(selectedEmergencyPhoneLength, "0")}
                  className="flex-1 px-4 py-2.5 focus:outline-none text-foreground bg-transparent rounded-none!"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Identification Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <MdOutlineFilePresent className="text-primary" size={28} />
            <h2 className="text-2xl font-bold text-foreground">Identification</h2>
          </div>
          <hr className="mb-6 border-border" />
          <p className="mb-6 text-sm text-foreground/80">
            <span className="text-red-500">*</span> Please provide either{" "}
            {nationalIdFormat.label} or Passport Number
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* National ID */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="nationalID"
                className="font-semibold text-foreground/90"
              >
                {nationalIdFormat.label}
              </label>
              <input
                type="text"
                id="nationalID"
                name="nationalID"
                value={formData.nationalID}
                onChange={handleInputChange}
                placeholder={nationalIdFormat.placeholder ?? "National ID"}
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Passport Number */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="passportNumber"
                className="font-semibold text-foreground/90"
              >
                Passport Number
              </label>
              <input
                type="text"
                id="passportNumber"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleInputChange}
                placeholder="A1234567"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {/* Visa Type */}
            <div className="flex flex-col gap-2">
              <label htmlFor="visaType" className="font-semibold text-foreground/90">
                Visa Type <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.visaType}
                onChange={(v) => setFormData((prev) => ({ ...prev, visaType: v }))}
                options={[
                  { value: "", label: "Select Visa Type" },
                  { value: "Residency", label: "Residency" },
                  { value: "Tourist", label: "Tourist" },
                  { value: "Business", label: "Business" },
                  { value: "Student", label: "Student" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Medical Information Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-4 sm:p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Medical Information
          </h2>
          <hr className="mb-6 border-border" />

          <div className="flex flex-wrap gap-6 items-end">
            {/* Patient Type */}
            <div className="flex flex-col gap-2 w-1/2">
              <label
                htmlFor="patientType"
                className="font-semibold text-foreground/90"
              >
                Patient Type <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.patientType}
                onChange={(v) => setFormData((prev) => ({ ...prev, patientType: v }))}
                options={[
                  { value: "Normal", label: "Normal" },
                  { value: "VIP", label: "VIP" },
                  { value: "Emergency", label: "Emergency" },
                ]}
              />
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <label
                  htmlFor="chronicStatus"
                  className="font-semibold text-foreground/90 cursor-pointer"
                >
                  Chronic Status
                </label>
                <ToggleButton
                  id="chronicStatus"
                  checked={formData.chronicStatus}
                  onChange={(checked) =>
                    setFormData((prev) => ({ ...prev, chronicStatus: checked }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-4 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <MdOutlinePayment className="text-primary" size={28} />
            <h2 className="text-2xl font-bold text-foreground">Payment Details</h2>
          </div>
          <hr className="mb-6 border-border" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Payment Type */}
            <div className="flex flex-col gap-2">
              <label htmlFor="paymentType" className="font-semibold text-foreground/90">
                Payment Type <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={formData.paymentType}
                onChange={(v) => setFormData((prev) => ({ ...prev, paymentType: v }))}
                options={[
                  { value: "Cash", label: "Cash" },
                  { value: "Insurance", label: "Insurance" },
                  { value: "Corporate", label: "Corporate" },
                ]}
              />
            </div>
          </div>

          {isInsuranceOrCorporate && (
            <div className="flex flex-col gap-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Eligibility Mode */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="eligibilityMode" className="font-semibold text-foreground/90">
                    Eligibility Mode
                  </label>
                  <SearchableSelect
                    value={formData.eligibilityMode}
                    onChange={(v) => setFormData((prev) => ({ ...prev, eligibilityMode: v }))}
                    options={[
                      { value: "", label: "Not Done" },
                      { value: "Online", label: "Online" },
                      { value: "Manual", label: "Manual" },
                    ]}
                  />
                </div>

                {/* Eligibility Checked Date */}
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-foreground/90">Eligibility Checked Date</label>
                  <DatePicker
                    value={formData.eligibilityCheckedDate}
                    onChange={(v) => setFormData((prev) => ({ ...prev, eligibilityCheckedDate: v }))}
                    max={toDateInputValue(new Date())}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                {/* Eligibility ID */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="eligibilityID" className="font-semibold text-foreground/90">Eligibility ID</label>
                  <input
                    type="text"
                    id="eligibilityID"
                    name="eligibilityID"
                    value={formData.eligibilityID}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Eligibility Visit ID */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="eligibilityVisitID" className="font-semibold text-foreground/90">Eligibility Visit ID</label>
                  <input
                    type="text"
                    id="eligibilityVisitID"
                    name="eligibilityVisitID"
                    value={formData.eligibilityVisitID}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Insurance / Corporate Provider */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="insuranceProvider" className="font-semibold text-foreground/90">
                    {formData.paymentType} Provider <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    value={formData.insuranceProvider}
                    onChange={(v) => setFormData((prev) => ({ ...prev, insuranceProvider: v }))}
                    options={[
                      { value: "", label: isLoadingProviders ? "Loading..." : "Select Provider" },
                      ...insuranceProviders.map((p) => ({ value: p.name, label: p.name })),
                    ]}
                  />
                </div>

                {/* Sub Insurance */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="subInsurance" className="font-semibold text-foreground/90">Sub Insurance</label>
                  <input
                    type="text"
                    id="subInsurance"
                    name="subInsurance"
                    value={formData.subInsurance}
                    onChange={handleInputChange}
                    placeholder="Plan / sub-category"
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Network Type */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="networkType" className="font-semibold text-foreground/90">Network Type</label>
                  <SearchableSelect
                    value={formData.networkType}
                    onChange={(v) => setFormData((prev) => ({ ...prev, networkType: v }))}
                    options={[
                      { value: "", label: "Select Network Type" },
                      { value: "Open Network", label: "Open Network" },
                      { value: "Restricted Network", label: "Restricted Network" },
                      { value: "Copay Network", label: "Copay Network" },
                    ]}
                  />
                </div>

                {/* Insurance/Corporate Card No */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="insuranceCardNo" className="font-semibold text-foreground/90">
                    {formData.paymentType} Card No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="insuranceCardNo"
                    name="insuranceCardNo"
                    value={formData.insuranceCardNo}
                    onChange={handleInputChange}
                    required
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Extra Card No */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="extraCardNo" className="font-semibold text-foreground/90">Extra Card No</label>
                  <input
                    type="text"
                    id="extraCardNo"
                    name="extraCardNo"
                    value={formData.extraCardNo}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Effective From */}
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-foreground/90">{formData.paymentType} Effective From</label>
                  <DatePicker
                    value={formData.insuranceEffectiveFrom}
                    onChange={(v) => setFormData((prev) => ({ ...prev, insuranceEffectiveFrom: v }))}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                {/* Expiry Date */}
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-foreground/90">
                    {formData.paymentType} Expiry Date <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    value={formData.insuranceExpiryDate}
                    onChange={(v) => setFormData((prev) => ({ ...prev, insuranceExpiryDate: v }))}
                    required
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                {/* Certificate No */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="certificateNo" className="font-semibold text-foreground/90">Certificate No.</label>
                  <input
                    type="text"
                    id="certificateNo"
                    name="certificateNo"
                    value={formData.certificateNo}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Dependents No */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="dependentsNo" className="font-semibold text-foreground/90">Dependents No.</label>
                  <input
                    type="text"
                    id="dependentsNo"
                    name="dependentsNo"
                    value={formData.dependentsNo}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Insurance Claim No */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="insuranceClaimNo" className="font-semibold text-foreground/90">Insurance Claim No.</label>
                  <input
                    type="text"
                    id="insuranceClaimNo"
                    name="insuranceClaimNo"
                    value={formData.insuranceClaimNo}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Max Insurance Liability */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="maxInsuranceLiability" className="font-semibold text-foreground/90">Max. Insurance Liability (AED)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    id="maxInsuranceLiability"
                    name="maxInsuranceLiability"
                    value={formData.maxInsuranceLiability}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Insurance Approval Limit */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="insuranceApprovalLimit" className="font-semibold text-foreground/90">Insurance Approval Limit (AED)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    id="insuranceApprovalLimit"
                    name="insuranceApprovalLimit"
                    value={formData.insuranceApprovalLimit}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Max Insurance Copay */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="maxInsuranceCopay" className="font-semibold text-foreground/90">Max. Insurance Copay (AED)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    id="maxInsuranceCopay"
                    name="maxInsuranceCopay"
                    value={formData.maxInsuranceCopay}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>

                {/* Co-Pay Patient % */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="coPayPatientPercent" className="font-semibold text-foreground/90">Co-Pay Patient (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    id="coPayPatientPercent"
                    name="coPayPatientPercent"
                    value={formData.coPayPatientPercent}
                    onChange={handleInputChange}
                    className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
                  />
                </div>
              </div>

              {/* Fee Schedule Grid */}
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold text-foreground/90">Fee Schedule</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Deductible (AED)</th>
                        <th>Applies To</th>
                        <th>Co-Pay %</th>
                        <th>Min (AED)</th>
                        <th>Max (AED)</th>
                        <th>Applies To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {INSURANCE_SERVICE_CATEGORIES.map((category) => {
                        const row = coverages[category];
                        const appliesToToggle = (
                          field: "deductibleAppliesTo" | "coPayAppliesTo",
                        ) => (
                          <div className="flex w-fit rounded-md border border-border overflow-hidden text-xs">
                            {(["All", "Each"] as const).map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => updateCoverage(category, field, option)}
                                className={`px-2 py-1.5 transition-colors cursor-pointer ${
                                  row[field] === option
                                    ? "bg-primary text-white"
                                    : "bg-transparent text-foreground/70 hover:bg-muted"
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        );

                        return (
                          <tr key={category}>
                            <td className="font-semibold whitespace-nowrap">{category}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.deductible}
                                onChange={(e) => updateCoverage(category, "deductible", e.target.value)}
                                className="w-24 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent"
                              />
                            </td>
                            <td>{appliesToToggle("deductibleAppliesTo")}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={row.coPayPercent}
                                onChange={(e) => updateCoverage(category, "coPayPercent", e.target.value)}
                                className="w-20 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.coPayMin}
                                onChange={(e) => updateCoverage(category, "coPayMin", e.target.value)}
                                className="w-20 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.coPayMax}
                                onChange={(e) => updateCoverage(category, "coPayMax", e.target.value)}
                                className="w-20 h-9 px-2 py-1 border border-border rounded-md text-sm bg-transparent"
                              />
                            </td>
                            <td>{appliesToToggle("coPayAppliesTo")}</td>
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

        {/* Attachments (edit mode only) */}
        {isEditMode && (
          <div className="card p-5 flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Paperclip size={16} className="text-primary" /> Attachments
            </h2>

            {/* Document list */}
            {isLoadingDocs ? (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            ) : patientDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No documents attached yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {patientDocs.map((doc) => {
                  const fileUrl = backendAssetUrl(doc.filePath);
                  const ext = doc.filePath?.split(".").pop()?.toLowerCase() ?? "";
                  const canPreview = PREVIEWABLE_EXTS.includes(ext);
                  return (
                    <div key={doc.patientDocumentId} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                      <Paperclip size={14} className="shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(doc.createdAt), "dd MMM yyyy, h:mm a")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {fileUrl && canPreview && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View"
                            className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            <Eye size={13} />
                          </a>
                        )}
                        {fileUrl && !canPreview && (
                          <a
                            href={fileUrl}
                            download
                            title="Download"
                            className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                          >
                            <Eye size={13} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc)}
                          disabled={deletingDocId === doc.patientDocumentId}
                          title="Delete"
                          className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload form */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add document</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={docUploadType}
                  onChange={(e) => setDocUploadType(e.target.value)}
                  className="h-9 sm:w-52 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <label className="flex-1 flex items-center gap-2 h-9 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/50 px-3 text-sm text-muted-foreground cursor-pointer transition-colors">
                  <Upload size={14} />
                  <span className="truncate">{docUploadFile ? docUploadFile.name : "Choose file…"}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => setDocUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleUploadDoc}
                  disabled={!docUploadFile || isUploadingDoc}
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {isUploadingDoc ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 my-8">
          <button
            type="submit"
            className="flex-1 bg-primary hover:opacity-90 text-white font-bold py-3 px-6 rounded-lg transition duration-200 shadow-md cursor-pointer"
          >
            {isEditMode
              ? loading ? "Saving..." : "Save Changes"
              : loading ? "Registering..." : "Register Patient"}
          </button>
          <button
            type="button"
            onClick={isEditMode ? () => router.push("/patient-records") : resetForm}
            className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-bold py-3 px-6 rounded-lg transition duration-200 shadow-md"
          >
            {isEditMode ? "Cancel" : "Clear Form"}
          </button>
        </div>
      </form>

      {/* Post-registration "add consultation?" popup */}
      {registeredPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className={`bg-card rounded-xl shadow-2xl w-full p-6 border border-border transition-all ${
              showConsultForm
                ? "max-w-2xl max-h-[90vh] overflow-y-auto"
                : "max-w-md"
            }`}
          >
            {needsEligibilityDoc ? (
              <>
                <h2 className="text-xl font-bold text-foreground">
                  Attach offline eligibility document
                </h2>
                <p className="mt-2 text-sm text-foreground/80">
                  {registeredPatient.name}&apos;s eligibility was marked as checked manually. Attach the
                  scanned/photographed eligibility form now, or skip and add it later from Patient Records.
                </p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setEligibilityFile(e.target.files?.[0] ?? null)}
                  className="mt-4 w-full text-sm text-foreground"
                />
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setNeedsEligibilityDoc(false)}
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadEligibilityDoc}
                    disabled={!eligibilityFile || uploadingEligibilityDoc}
                    className="flex-1 bg-primary hover:opacity-90 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {uploadingEligibilityDoc ? "Attaching..." : "Attach document"}
                  </button>
                </div>
              </>
            ) : !showConsultForm ? (
              <>
                <h2 className="text-xl font-bold text-foreground">
                  Patient registered successfully
                </h2>
                <p className="mt-2 text-sm text-foreground/80">
                  {registeredPatient.name} has been added to the system. Do
                  you want to add a consultation appointment for them now?
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeConsultFlow}
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                  >
                    No, skip
                  </button>
                  <button
                    type="button"
                    onClick={handleWantsConsultation}
                    className="flex-1 bg-primary hover:opacity-90 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                  >
                    Yes, add consultation
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      Book consultation
                    </h2>
                    <p className="text-sm text-foreground/80 mt-1">
                      for {registeredPatient.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeConsultFlow}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <MdClose size={20} />
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-foreground/90 text-sm">
                        Department
                      </label>
                      <SearchableSelect
                        value={selectedDepartmentId}
                        onChange={(v) => {
                          setSelectedDepartmentId(v);
                          setSelectedDoctorId("");
                          setDaySlots(null);
                          setSelectedSlot(null);
                        }}
                        options={[
                          { value: "", label: isLoadingSpecializations ? "Loading..." : "Select department" },
                          ...consultDepartments.map((d) => ({ value: d.value, label: d.label })),
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-foreground/90 text-sm">
                        Specialty
                      </label>
                      <SearchableSelect
                        value={selectedSpecializationId}
                        onChange={(v) => {
                          setSelectedSpecializationId(v);
                          setSelectedDoctorId("");
                          setDaySlots(null);
                          setSelectedSlot(null);
                        }}
                        options={[
                          { value: "", label: isLoadingSpecializations ? "Loading..." : "Select specialty" },
                          ...consultSpecializations.map((s) => ({ value: String(s.specializationId), label: s.specializationName })),
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-foreground/90 text-sm">
                        Doctor
                      </label>
                      <SearchableSelect
                        value={selectedDoctorId}
                        onChange={(v) => {
                          setSelectedDoctorId(v);
                          setSelectedSlot(null);
                        }}
                        disabled={!selectedSpecializationId}
                        options={[
                          { value: "", label: "Select doctor" },
                          ...doctorsForSpecialization.map((d) => ({ value: String(d.doctorId), label: d.name })),
                        ]}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:w-56">
                    <label className="font-semibold text-foreground/90 text-sm">
                      Date
                    </label>
                    <DatePicker
                      value={consultDate}
                      onChange={(v) => {
                        setConsultDate(v);
                        setSelectedSlot(null);
                      }}
                      min={toDateInputValue(new Date())}
                      dateFormat="dd-MM-yyyy"
                      placeholder="DD-MM-YYYY"
                      className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-left text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>

                  {selectedDoctorId && (
                    <div className="flex flex-col gap-2">
                      <label className="font-semibold text-foreground/90 text-sm">
                        Available slots
                      </label>
                      {isLoadingSlots ? (
                        <LoadingSpinner />
                      ) : (daySlots?.slots.filter((s) => s.isAvailable)
                          .length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No open slots for this doctor on this day.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                          {daySlots!.slots
                            .filter((s) => s.isAvailable)
                            .map((slot) => (
                              <button
                                key={slot.start}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                  selectedSlot?.start === slot.start
                                    ? "border-primary bg-primary text-white"
                                    : "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                                }`}
                              >
                                {format(new Date(slot.start), "h:mm a")}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-foreground/90 text-sm">
                      Notes
                    </label>
                    <textarea
                      value={consultNotes}
                      onChange={(e) => setConsultNotes(e.target.value)}
                      placeholder="Reason for visit"
                      className="w-full min-h-16 px-4 py-2 rounded-lg border border-border bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeConsultFlow}
                    className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBookConsultation}
                    disabled={!selectedSlot || isBookingConsult}
                    className="flex-1 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
                  >
                    {isBookingConsult ? "Booking..." : "Book consultation"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
