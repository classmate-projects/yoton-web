"use client";

import DeleteIcon from "@/public/icons/deleteIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import Link from "next/link";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { MdContacts, MdOutlinePersonAddAlt1, MdOutlineUploadFile, MdOutlineMailOutline, MdOutlineEdit } from "react-icons/md";
import { CalendarDays, Clock, Loader2, Stethoscope, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import PasswordInput from "@/components/PasswordInput";
import DatePicker from "@/components/DatePicker";
import SearchableSelect from "@/components/SearchableSelect";
import { ReceptionService } from "@/services/reception.service";
import { AuthService } from "@/services/auth.service";
import { ConfigListService } from "@/services/configList.service";
import { PatientFullDetailsType, PatientGetAllType, PendingReferralType, VisitListItemType } from "@/types/reception.type";
import {
  AppointmentSlotType,
  DoctorDaySlotsType,
  DoctorGridType,
  SpecializationDoctorsType,
} from "@/types/appointment.type";
import { ListItemType } from "@/types/configList.type";
import { toDateInputValue } from "@/lib/date";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const DOCUMENT_TYPES = ["ExternalLabReport", "ExternalRadiologyReport", "InsuranceEligibility", "Other"];

// Walk-in-only payment/insurance touch-up (see openWalkInModal) - a lighter version of
// patient-entry's own Payment Details section, same field set minus the per-category Fee
// Schedule grid (that's a negotiated-rate config, not something reception fills in per visit).
const emptyInsuranceForm = {
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
};

type PatientListMode = "register" | "visit" | "referral";
const PATIENTS_PAGE_SIZE = 50;

// Shared by both list modes - VisitListItemType extends PatientGetAllType, so this one
// predicate covers both without needing a second copy. "Mobile Number" = phone; "MRN" =
// opNumber (opId itself stays internal - never shown to or searched by a user, see the app-
// wide MRN convention this mirrors).
const matchesPatientSearch = (p: PatientGetAllType, term: string) => {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return !!(
    p.name?.toLowerCase().includes(q) ||
    p.opNumber?.toLowerCase().includes(q) ||
    p.phone?.toLowerCase().includes(q) ||
    p.nationalID?.toLowerCase().includes(q)
  );
};

export default function PatientRecordsPage() {
  const [patients, setPatients] = useState<PatientGetAllType[]>([]);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  // Company setting (Settings > Company settings > Patient registration email): whether
  // patient emails carry mobile-app login details. When it's off there's nothing to send, so
  // the "email login details" button is hidden rather than left to fail. Stays hidden until
  // the setting has actually been read.
  const [loginDetailsEmailEnabled, setLoginDetailsEmailEnabled] = useState(false);
  useEffect(() => {
    AuthService.getMe()
      .then((me) => setLoginDetailsEmailEnabled(!!me?.includeLoginCredentialsInPatientEmail))
      .catch(() => {});
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // ---------------- Register List / Visit List toggle ----------------
  const [listMode, setListMode] = useState<PatientListMode>("register");
  const [visits, setVisits] = useState<VisitListItemType[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [pendingReferrals, setPendingReferrals] = useState<PendingReferralType[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [referralSearchTerm, setReferralSearchTerm] = useState("");
  // External referrals are hidden by default so reception can focus on in-clinic workflow.
  const [showExternalReferrals, setShowExternalReferrals] = useState(false);
  // Tracks referral IDs successfully registered this session so reception sees "In Queue" feedback
  // without waiting for the doctor to open an encounter. Cleared on page refresh (intentional).
  const [registeredReferralIds, setRegisteredReferralIds] = useState<Set<string>>(new Set());
  const todayValue = toDateInputValue(new Date());
  const [fromDate, setFromDate] = useState(todayValue);
  const [toDate, setToDate] = useState(todayValue);
  const [currentPage, setCurrentPage] = useState(1);

  const [uploadTarget, setUploadTarget] = useState<PatientGetAllType | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // ---------------- Cancel Visit modal state ----------------
  const [cancelVisitTarget, setCancelVisitTarget] = useState<VisitListItemType | null>(null);
  const [cancelPassword, setCancelPassword] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // ---------------- Walk-in visit modal state ----------------
  // Also reused for "Edit Visit" (see openEditVisitModal) - both are the exact same
  // department -> specialty -> doctor -> slot picker, just walkInPatient starts a brand new
  // visit while editingVisit reassigns an existing one's doctor via ReassignVisit instead of
  // WalkIn. Only one of the two is ever set at a time; modalPatient/modalTitle below read
  // whichever it is without the rest of the modal needing to care which.
  const [walkInPatient, setWalkInPatient] = useState<PatientGetAllType | null>(null);
  const [editingVisit, setEditingVisit] = useState<VisitListItemType | null>(null);
  // Set when the modal is opened from the Referral List - drives which endpoint is called on submit.
  const [walkInReferralId, setWalkInReferralId] = useState<string | null>(null);
  const [specializations, setSpecializations] = useState<SpecializationDoctorsType[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [walkInDepartmentId, setWalkInDepartmentId] = useState("");
  const [walkInSpecializationId, setWalkInSpecializationId] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorGridType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [daySlots, setDaySlots] = useState<DoctorDaySlotsType | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlotType | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [isBookingWalkIn, setIsBookingWalkIn] = useState(false);

  // Payment & Insurance touch-up - walk-in only (not Edit Visit), since the underlying data
  // lives on the patient's own record, not a per-visit concept. walkInPatientDetails holds
  // everything else about the patient (name/sex/etc.) untouched, fetched once so the
  // eventual update call doesn't blank out fields this form never shows.
  const [walkInPatientDetails, setWalkInPatientDetails] = useState<PatientFullDetailsType | null>(null);
  const [isLoadingWalkInPatient, setIsLoadingWalkInPatient] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState(emptyInsuranceForm);
  const [insuranceProviders, setInsuranceProviders] = useState<ListItemType[]>([]);
  const [isLoadingInsuranceProviders, setIsLoadingInsuranceProviders] = useState(false);
  const isInsuranceOrCorporate = insuranceForm.paymentType !== "Cash";

  const modalPatient = walkInPatient ?? editingVisit;

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const data = await ReceptionService.getAllPatients()
      setPatients(data.patients || []);
    } catch (error) {
      console.error("Failed to fetch patients", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVisits = async (from: string, to: string) => {
    try {
      setIsLoadingVisits(true);
      const data = await ReceptionService.getVisitList(from, to);
      setVisits(data.visits || []);
    } catch (error) {
      console.error("Failed to fetch visit list", error);
      toast.error("Failed to load visit list");
    } finally {
      setIsLoadingVisits(false);
    }
  };

  const fetchPendingReferrals = async () => {
    try {
      setIsLoadingReferrals(true);
      const data = await ReceptionService.getPendingReferrals();
      setPendingReferrals(data.data || []);
    } catch (error) {
      console.error("Failed to fetch pending referrals", error);
      toast.error("Failed to load referral list");
    } finally {
      setIsLoadingReferrals(false);
    }
  };

  // Register List is fetched eagerly (it's the default view, and other pages' patient-search
  // widgets share the underlying data too via the same signalR-driven refresh below) - Visit
  // List is fetched lazily, only once the toggle actually switches to it, and again whenever
  // From/To changes while it's active. Both together satisfy "switching toggles/date filters
  // immediately refreshes the displayed data."
  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (listMode === "visit") fetchVisits(fromDate, toDate);
    if (listMode === "referral") fetchPendingReferrals();
  }, [listMode, fromDate, toDate]);

  // Search/date/mode changes all invalidate whatever page the user was on - e.g. a filter
  // that now only matches 10 records shouldn't leave them stranded on page 3.
  useEffect(() => {
    setCurrentPage(1);
  }, [listMode, searchTerm, referralSearchTerm, fromDate, toDate]);

  useSignalRRefetch(["patientRegistered", "PatientUpdated", "patientSoftDeleted"], fetchPatients);
  useSignalRRefetch(["visitCheckedIn", "visitStatusUpdated"], () => {
    if (listMode === "visit") fetchVisits(fromDate, toDate);
  });
  useSignalRRefetch(["referralAdded", "referralUpdated", "referralRemoved", "visitCheckedIn"], () => {
    if (listMode === "referral") fetchPendingReferrals();
  });

  const handleDelete = async (id: string) => {
    try {
      const data = await ReceptionService.softDelete(id)
      toast.success(data.message)
      fetchPatients();
    } catch (error) {
      console.error("Failed to delete patient", error);
    }
  };

  // Shared setup for both openWalkInModal and openEditVisitModal - clears whichever picker
  // state a previous open left behind and lazily loads the department/specialty/doctor
  // catalog once, same as before.
  const resetVisitModalPickers = async () => {
    setWalkInDepartmentId("");
    setWalkInSpecializationId("");
    setDoctorSearch("");
    setSelectedDoctor(null);
    setSelectedDate(new Date());
    setDaySlots(null);
    setSelectedSlot(null);
    setVisitNotes("");

    if (specializations.length === 0) {
      try {
        setIsLoadingDoctors(true);
        const data = await ReceptionService.getSpecializationsWithDoctors();
        setSpecializations(data.specializations ?? []);
      } catch (error) {
        console.error("Failed to fetch specializations/doctors:", error);
        toast.error("Failed to load doctors");
      } finally {
        setIsLoadingDoctors(false);
      }
    }
  };

  const openWalkInModal = async (patient: PatientGetAllType) => {
    setWalkInPatient(patient);
    await resetVisitModalPickers();

    setInsuranceForm(emptyInsuranceForm);
    setIsLoadingWalkInPatient(true);
    try {
      const res = await ReceptionService.getPatientById(patient.opId);
      const details: PatientFullDetailsType = res.data;
      setWalkInPatientDetails(details);
      setInsuranceForm({
        paymentType: details.paymentType || "Cash",
        eligibilityMode: details.eligibilityMode || "",
        eligibilityCheckedDate: details.eligibilityCheckedDate || "",
        eligibilityID: details.eligibilityID || "",
        eligibilityVisitID: details.eligibilityVisitID || "",
        insuranceProvider: details.insuranceProvider || "",
        subInsurance: details.subInsurance || "",
        networkType: details.networkType || "",
        insuranceCardNo: details.insuranceCardNo || "",
        extraCardNo: details.extraCardNo || "",
        insuranceEffectiveFrom: details.insuranceEffectiveFrom || "",
        insuranceExpiryDate: details.insuranceExpiryDate || "",
        certificateNo: details.certificateNo || "",
        dependentsNo: details.dependentsNo || "",
        insuranceClaimNo: details.insuranceClaimNo || "",
        maxInsuranceLiability: details.maxInsuranceLiability != null ? String(details.maxInsuranceLiability) : "",
        insuranceApprovalLimit: details.insuranceApprovalLimit != null ? String(details.insuranceApprovalLimit) : "",
        maxInsuranceCopay: details.maxInsuranceCopay != null ? String(details.maxInsuranceCopay) : "",
        coPayPatientPercent: details.coPayPatientPercent != null ? String(details.coPayPatientPercent) : "",
      });
    } catch (error) {
      console.error("Failed to fetch patient payment/insurance details:", error);
      toast.error("Failed to load patient's payment/insurance details");
    } finally {
      setIsLoadingWalkInPatient(false);
    }
  };

  // Reassigning a visit always starts the doctor/slot picker from scratch (see
  // ReceptionController.ReassignVisit's own comment) - the point is picking a *different*
  // doctor, so there's no need to look up and prefill whoever it's currently assigned to.
  const openEditVisitModal = async (visit: VisitListItemType) => {
    setEditingVisit(visit);
    await resetVisitModalPickers();
  };

  const closeWalkInModal = () => {
    setWalkInPatient(null);
    setEditingVisit(null);
    setWalkInReferralId(null);
    setSelectedDoctor(null);
    setDaySlots(null);
    setSelectedSlot(null);
    setWalkInPatientDetails(null);
    setInsuranceForm(emptyInsuranceForm);
  };

  // Lazily loaded on first actual need, like patient-entry's own copy of this - most walk-ins
  // are Cash and never touch this list.
  useEffect(() => {
    if (!isInsuranceOrCorporate || insuranceProviders.length > 0) return;
    (async () => {
      try {
        setIsLoadingInsuranceProviders(true);
        const data = await ConfigListService.get("InsuranceProvider");
        setInsuranceProviders(data.data ?? []);
      } catch (error) {
        console.error("Failed to fetch insurance providers:", error);
        toast.error("Failed to load insurance providers");
      } finally {
        setIsLoadingInsuranceProviders(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInsuranceOrCorporate]);

  const fetchWalkInSlots = async (doctorId: string, date: Date) => {
    try {
      setIsLoadingSlots(true);
      setSelectedSlot(null);
      const data = await ReceptionService.getDoctorSlots(doctorId, toDateInputValue(date));
      setDaySlots(data.data ?? null);
    } catch (error) {
      console.error("Failed to fetch doctor slots:", error);
      toast.error("Failed to load slots for this doctor");
      setDaySlots(null);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor && modalPatient) {
      fetchWalkInSlots(selectedDoctor.doctorId, selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, selectedDate]);

  useSignalRRefetch(["appointmentCreated", "appointmentCancelled"], () => {
    if (selectedDoctor && modalPatient) fetchWalkInSlots(selectedDoctor.doctorId, selectedDate);
  });

  // Deduped from `specializations` itself rather than a separate department fetch - every
  // specialization here already carries its own department, and this modal only ever needs
  // departments that actually have an active, doctor-staffed specialization under them.
  const walkInDepartments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of specializations) {
      if (s.departmentId && !seen.has(s.departmentId)) seen.set(s.departmentId, s.departmentName ?? s.departmentId);
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [specializations]);

  const walkInSpecializations = useMemo(
    () => specializations.filter((s) => !walkInDepartmentId || s.departmentId === walkInDepartmentId),
    [specializations, walkInDepartmentId]
  );

  // A previously-picked specialization may no longer be valid once the department changes.
  useEffect(() => {
    if (walkInSpecializationId && !walkInSpecializations.some((s) => s.specializationId === walkInSpecializationId)) {
      setWalkInSpecializationId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkInDepartmentId, specializations]);

  const flattenedDoctors = useMemo(() => {
    const term = doctorSearch.trim().toLowerCase();
    return specializations
      .filter((s) => !walkInDepartmentId || s.departmentId === walkInDepartmentId)
      .filter((s) => !walkInSpecializationId || s.specializationId === walkInSpecializationId)
      .flatMap((s) =>
        s.doctors
          .filter(
            (d) =>
              term.length === 0 ||
              d.name.toLowerCase().includes(term) ||
              s.specializationName.toLowerCase().includes(term)
          )
          .map((d) => ({ ...d, specializationName: s.specializationName }))
      );
  }, [specializations, doctorSearch, walkInDepartmentId, walkInSpecializationId]);

  // Picking a doctor straight from the search results (without narrowing via the Department/
  // Specialisation dropdowns first) should still leave those dropdowns showing the doctor's own
  // department and specialisation, not "All departments" / "All specialisations".
  const selectDoctor = (doctor: DoctorGridType) => {
    const group = specializations.find((s) => s.doctors.some((d) => d.doctorId === doctor.doctorId));
    setWalkInDepartmentId(group?.departmentId ?? "");
    setWalkInSpecializationId(doctor.specializationId);
    setSelectedDoctor(doctor);
    setDaySlots(null);
  };

  const handleConfirmWalkIn = async () => {
    if (!modalPatient || !selectedDoctor || !selectedSlot) {
      toast.warning("Please select a doctor and an available time slot");
      return;
    }

    if (!editingVisit && isInsuranceOrCorporate) {
      if (!insuranceForm.insuranceProvider || !insuranceForm.insuranceCardNo || !insuranceForm.insuranceExpiryDate) {
        toast.warning(`${insuranceForm.paymentType} Provider, Card No and Expiry Date are required`);
        return;
      }
    }

    try {
      setIsBookingWalkIn(true);

      // Payment/insurance lives on the patient's own record, not a per-visit concept - saved
      // via the same UpdatePatient endpoint the full Edit Patient form uses, just scoped to
      // this one section. Walk-in only (not Edit Visit) per how this form is entered.
      if (!editingVisit && walkInPatientDetails) {
        const toNumberOrUndefined = (value: string) => (value.trim() === "" ? undefined : Number(value));
        const toDateOrUndefined = (value: string) => (value.trim() === "" ? undefined : value);
        const registeredBy = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").userId ?? "";

        await ReceptionService.updatePatient(walkInPatientDetails.opId, {
          ...walkInPatientDetails,
          registeredBy,
          paymentType: insuranceForm.paymentType,
          eligibilityMode: insuranceForm.eligibilityMode || undefined,
          eligibilityCheckedDate: toDateOrUndefined(insuranceForm.eligibilityCheckedDate),
          eligibilityID: insuranceForm.eligibilityID || undefined,
          eligibilityVisitID: insuranceForm.eligibilityVisitID || undefined,
          insuranceProvider: insuranceForm.insuranceProvider || undefined,
          subInsurance: insuranceForm.subInsurance || undefined,
          networkType: insuranceForm.networkType || undefined,
          insuranceCardNo: insuranceForm.insuranceCardNo || undefined,
          extraCardNo: insuranceForm.extraCardNo || undefined,
          insuranceEffectiveFrom: toDateOrUndefined(insuranceForm.insuranceEffectiveFrom),
          insuranceExpiryDate: toDateOrUndefined(insuranceForm.insuranceExpiryDate),
          certificateNo: insuranceForm.certificateNo || undefined,
          dependentsNo: insuranceForm.dependentsNo || undefined,
          insuranceClaimNo: insuranceForm.insuranceClaimNo || undefined,
          maxInsuranceLiability: toNumberOrUndefined(insuranceForm.maxInsuranceLiability),
          insuranceApprovalLimit: toNumberOrUndefined(insuranceForm.insuranceApprovalLimit),
          maxInsuranceCopay: toNumberOrUndefined(insuranceForm.maxInsuranceCopay),
          coPayPatientPercent: toNumberOrUndefined(insuranceForm.coPayPatientPercent),
        });
      }

      const data = editingVisit
        ? await ReceptionService.reassignVisit(editingVisit.visitId, {
            doctorId: selectedDoctor.doctorId,
            appointmentDate: selectedSlot.start,
            notes: visitNotes || undefined,
          })
        : walkInReferralId
        ? await ReceptionService.registerFromReferral(walkInReferralId, {
            doctorId: selectedDoctor.doctorId,
            appointmentDate: selectedSlot.start,
            notes: visitNotes || undefined,
          })
        : await ReceptionService.walkIn({
            patientId: modalPatient.opId,
            doctorId: selectedDoctor.doctorId,
            appointmentDate: selectedSlot.start,
            notes: visitNotes || undefined,
          });

      if (data.status === false) {
        toast.error(data.message || "This slot has just been booked. Please choose another slot.");
        fetchWalkInSlots(selectedDoctor.doctorId, selectedDate);
      } else {
        toast.success(data.message || (editingVisit ? "Visit updated" : "Patient registered successfully"));
        const wasReferral = !!walkInReferralId;
        const wasEditingVisit = !!editingVisit;
        const completedReferralId = walkInReferralId;
        closeWalkInModal();
        if (wasEditingVisit) fetchVisits(fromDate, toDate);
        if (wasReferral) {
          fetchPendingReferrals();
          if (completedReferralId) setRegisteredReferralIds((prev) => new Set(prev).add(completedReferralId));
        }
      }
    } catch (error) {
      const fallback = `Failed to ${editingVisit ? "update visit" : "register walk-in visit"}`;
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || fallback);
      } else {
        toast.error(fallback);
      }
    } finally {
      setIsBookingWalkIn(false);
    }
  };

  const closeUploadModal = () => {
    setUploadTarget(null);
    setUploadFile(null);
    setDocumentType(DOCUMENT_TYPES[0]);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTarget || !uploadFile) {
      toast.warning("Please choose a file to upload");
      return;
    }
    try {
      setIsUploading(true);
      const data = await ReceptionService.uploadDocument(uploadTarget.opId, {
        documentType,
        file: uploadFile,
      });
      toast.success(data.message || "Document uploaded");
      closeUploadModal();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to upload document");
      } else {
        toast.error("Failed to upload document");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleResendWelcomeEmail = async (id: string, name: string) => {
    try {
      setResendingEmailId(id);
      const data = await ReceptionService.resendWelcomeEmail(id);
      if (data.status === false) {
        toast.error(data.message || `Couldn't resend the login email to ${name}`);
      } else {
        toast.success(data.message || `Login email resent to ${name}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to resend the login email");
      } else {
        toast.error("Failed to resend the login email");
      }
    } finally {
      setResendingEmailId(null);
    }
  };

  const confirmDelete = (id: string, name: string) => {
    confirmDeleteToast(
      <span>
        Are you sure you want to delete {" "}
        <b className="text-red-500 ml-1">{name}</b>
      </span>,
      () => handleDelete(id)
    )
  }

  const handleCancelVisit = async () => {
    if (!cancelVisitTarget || !cancelPassword.trim()) return;
    setIsCancelling(true);
    try {
      await ReceptionService.cancelVisit(cancelVisitTarget.visitId, cancelPassword);
      toast.success("Visit cancelled successfully");
      setCancelVisitTarget(null);
      setCancelPassword("");
      fetchVisits(fromDate, toDate);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg?.toLowerCase().includes("password")) {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error(msg ?? "Failed to cancel visit");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredPatients = useMemo(
    () => patients.filter((p) => matchesPatientSearch(p, searchTerm)),
    [patients, searchTerm]
  );
  const filteredVisits = useMemo(
    () => visits.filter((v) => matchesPatientSearch(v, searchTerm)),
    [visits, searchTerm]
  );
  const filteredReferrals = useMemo(() => {
    const q = referralSearchTerm.trim().toLowerCase();
    return pendingReferrals
      .filter((r) => showExternalReferrals || !r.externalFacility)
      .filter(
        (r) =>
          !q ||
          r.patientName?.toLowerCase().includes(q) ||
          r.patientOpNumber?.toLowerCase().includes(q) ||
          r.patientPhone?.toLowerCase().includes(q) ||
          r.targetSpecializationName?.toLowerCase().includes(q)
      );
  }, [pendingReferrals, referralSearchTerm, showExternalReferrals]);

  const activeFilteredCount =
    listMode === "register"
      ? filteredPatients.length
      : listMode === "visit"
      ? filteredVisits.length
      : filteredReferrals.length;
  const totalPages = Math.max(1, Math.ceil(activeFilteredCount / PATIENTS_PAGE_SIZE));
  // Clamped fallback for the one case the reset-to-1 effect above doesn't cover: the result
  // set shrinking (e.g. a patient deleted, or a signalR-driven visit refetch) while the user
  // sits on a page number that's no longer valid, with nothing else changing to re-trigger
  // that effect.
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PATIENTS_PAGE_SIZE;
  const pagedPatients = useMemo(
    () => filteredPatients.slice(pageStart, pageStart + PATIENTS_PAGE_SIZE),
    [filteredPatients, pageStart]
  );
  const pagedVisits = useMemo(
    () => filteredVisits.slice(pageStart, pageStart + PATIENTS_PAGE_SIZE),
    [filteredVisits, pageStart]
  );
  const pagedReferrals = useMemo(
    () => filteredReferrals.slice(pageStart, pageStart + PATIENTS_PAGE_SIZE),
    [filteredReferrals, pageStart]
  );

  // Register List row actions — operate on the patient record itself.
  const renderRegisterActions = (patient: PatientGetAllType) => (
    <div className="flex items-center justify-center gap-1">
      <Link
        href={`/patient-entry?edit=${patient.opId}`}
        className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer inline-flex"
        title="Edit Patient"
      >
        <MdOutlineEdit className="text-blue-600" size={18} />
      </Link>
      <button
        onClick={() => openWalkInModal(patient)}
        className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer"
        title="Register Walk-in Visit"
      >
        <MdOutlinePersonAddAlt1 className="text-blue-600" size={18} />
      </button>
      <button
        onClick={() => setUploadTarget(patient)}
        className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer"
        title="Upload External Document"
      >
        <MdOutlineUploadFile className="text-blue-600" size={18} />
      </button>
      {loginDetailsEmailEnabled && (
        <button
          onClick={() => handleResendWelcomeEmail(patient.opId, patient.name)}
          disabled={resendingEmailId === patient.opId}
          className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Email login details to patient"
        >
          {resendingEmailId === patient.opId ? (
            <Loader2 className="text-blue-600 animate-spin" size={18} />
          ) : (
            <MdOutlineMailOutline className="text-blue-600" size={18} />
          )}
        </button>
      )}
      <button
        onClick={() => confirmDelete(patient.opId, patient.name)}
        className="hover:bg-red-50 p-2 rounded transition-colors cursor-pointer"
        title="Delete Patient"
      >
        <DeleteIcon color="red" />
      </button>
    </div>
  );

  // Visit List row actions — operate on this specific visit, not the patient record.
  const renderVisitActions = (visit: VisitListItemType) => (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => openEditVisitModal(visit)}
        className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer"
        title="Change Doctor"
        disabled={visit.status === "Completed" || visit.status === "Cancelled"}
      >
        <MdOutlineEdit className={visit.status === "Completed" || visit.status === "Cancelled" ? "text-blue-300" : "text-blue-600"} size={18} />
      </button>
      <button
        onClick={() => { setCancelVisitTarget(visit); setCancelPassword(""); }}
        className="hover:bg-red-50 p-2 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title="Cancel Visit"
        disabled={visit.status === "Completed" || visit.status === "Cancelled"}
      >
        <DeleteIcon color={visit.status === "Completed" || visit.status === "Cancelled" ? "#fca5a5" : "red"} />
      </button>
    </div>
  );

  return (
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex justify-between items-center gap-1 mb-8">
        <div>
          <h1 className="text-4xl font-semibold flex items-center gap-3">
            <MdContacts className="text-blue-500" /> Patient Records
          </h1>
          <p className="text-sm text-gray-500">
            View, search, and manage all registered patients in the system.
          </p>
        </div>
        <Link href={"/patient-entry"} className="bg-blue-500 px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:bg-blue-600 transition duration-150">
          Add Patient</Link>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          {/* Toggle - switching modes immediately swaps the data below (Visit List also
              triggers its own fetch, see the effect keyed on listMode/fromDate/toDate). */}
          <div role="tablist" aria-label="Patient list view" className="inline-flex rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              role="tab"
              aria-selected={listMode === "register"}
              onClick={() => setListMode("register")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                listMode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Patient Register List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={listMode === "visit"}
              onClick={() => setListMode("visit")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                listMode === "visit" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Patient Visit List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={listMode === "referral"}
              onClick={() => setListMode("referral")}
              className={`relative px-4 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                listMode === "referral" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Referral List
              {pendingReferrals.filter((r) => !r.externalFacility).length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4">
                  {pendingReferrals.filter((r) => !r.externalFacility).length}
                </span>
              )}
            </button>
          </div>

          {/* From/To sit immediately left of the search bar (both pushed to the row's right
              side by the justify-between above), not next to the toggle. */}
          <div className="flex flex-wrap items-center gap-4">
            {listMode === "visit" && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-foreground/80">From</label>
                  {/* Typeable + calendar, same as Date of Birth on Patient Entry. */}
                  <DatePicker
                    value={fromDate}
                    onChange={(v) => v && setFromDate(v)}
                    max={toDate}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-10 w-36 items-center justify-between gap-2 rounded-lg border border-border bg-(--color-highlight) px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-foreground/80">To</label>
                  <DatePicker
                    value={toDate}
                    onChange={(v) => v && setToDate(v)}
                    min={fromDate}
                    max={todayValue}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                    className="flex h-10 w-36 items-center justify-between gap-2 rounded-lg border border-border bg-(--color-highlight) px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </>
            )}

            <div className="relative w-72">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <SearchIcon color="#555" />
              </span>
              {listMode === "referral" ? (
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Search by name, MRN, phone, or specialty..."
                  value={referralSearchTerm}
                  onChange={(e) => setReferralSearchTerm(e.target.value)}
                  className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500"
                />
              ) : (
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Search by name, MRN, mobile number, or national ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          </div>
        </div>

        <hr className="text-neutral-400/50 mb-4" />

        {/* ---- Patient / Visit / Referral card grid ---- */}
        {(listMode === "register" ? isLoading : listMode === "visit" ? isLoadingVisits : isLoadingReferrals) ? (
          <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
        ) : listMode === "register" ? (
          pagedPatients.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground text-sm">No patients found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedPatients.map((patient) => {
                const initials = patient.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <div key={patient.opId} className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{patient.name}</p>
                        <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {patient.opNumber || patient.opId}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                      {patient.email && (
                        <div className="flex items-center gap-2 truncate">
                          <MdOutlineMailOutline size={13} className="shrink-0 text-muted-foreground/60" />
                          <span className="truncate">{patient.email}</span>
                        </div>
                      )}
                      {patient.phone && (
                        <div className="flex items-center gap-2">
                          <MdContacts size={13} className="shrink-0 text-muted-foreground/60" />
                          <span>{patient.phone}</span>
                        </div>
                      )}
                      {patient.address && (
                        <div className="flex items-center gap-2 truncate">
                          <svg className="shrink-0 text-muted-foreground/60" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                          <span className="truncate">{patient.address}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 pt-2 border-t border-border mt-auto">
                      {renderRegisterActions(patient)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : listMode === "visit" ? (
          pagedVisits.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground text-sm">No visits found for the selected date range.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedVisits.map((visit) => {
                const initials = visit.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                const statusColor =
                  visit.status === "Completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : visit.status === "Cancelled"
                    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                return (
                  <div key={visit.visitId} className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{visit.name}</p>
                        <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {visit.opNumber || visit.opId}
                        </span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                        {visit.status}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                      {visit.phone && (
                        <div className="flex items-center gap-2">
                          <MdContacts size={13} className="shrink-0 text-muted-foreground/60" />
                          <span>{visit.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <CalendarDays size={13} className="shrink-0 text-muted-foreground/60" />
                        <span>{format(new Date(visit.checkedInAt), "dd MMM yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="shrink-0 text-muted-foreground/60" />
                        <span>
                          {visit.visitType === "WalkIn" ? "Walk-in" : visit.visitType === "Referral" ? "Referral" : "Appointment"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pt-2 border-t border-border mt-auto">
                      {renderVisitActions(visit)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <>
            {/* External referral toggle row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExternalReferrals((p) => !p)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showExternalReferrals ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${showExternalReferrals ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-xs text-muted-foreground">Show external referrals</span>
              </div>
              {pendingReferrals.filter((r) => !!r.externalFacility).length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {pendingReferrals.filter((r) => !!r.externalFacility).length} external
                  {!showExternalReferrals && " (hidden)"}
                </span>
              )}
            </div>

            {pagedReferrals.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground text-sm">No pending referrals.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pagedReferrals.map((r) => {
                  const isExternal = !!r.externalFacility;
                  const isRegistered = registeredReferralIds.has(r.referralId);
                  return (
                    <div
                      key={r.referralId}
                      className={`card p-4 flex flex-col gap-3 transition-shadow ${isExternal ? "opacity-50" : "hover:shadow-md"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center shrink-0 ${isExternal ? "bg-muted text-muted-foreground" : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"}`}>
                          {(r.patientName ?? "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{r.patientName ?? "—"}</p>
                          <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {r.patientOpNumber ?? "—"}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.priority === "Urgent" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                            {r.priority}
                          </span>
                          {isExternal && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              External
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        {r.patientPhone && (
                          <div className="flex items-center gap-2">
                            <MdContacts size={13} className="shrink-0 text-muted-foreground/60" />
                            <span>{r.patientPhone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Stethoscope size={13} className="shrink-0 text-muted-foreground/60" />
                          <span className="truncate">
                            {r.targetSpecializationName ?? "—"}
                            {r.cancerSiteName && <span className="ml-1">({r.cancerSiteName})</span>}
                            {r.externalFacility && <span className="ml-1 font-medium text-slate-500 dark:text-slate-400">· {r.externalFacility}</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays size={13} className="shrink-0 text-muted-foreground/60" />
                          <span>{format(new Date(r.createdAt), "dd MMM yyyy")}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border mt-auto">
                        {isExternal ? (
                          <p className="text-center text-xs text-muted-foreground py-1">Referred to external facility</p>
                        ) : isRegistered ? (
                          <div className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-400">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            In Queue
                          </div>
                        ) : (
                          <button
                            onClick={async () => {
                              setWalkInReferralId(r.referralId);
                              await openWalkInModal({
                                opId: r.patientId,
                                opNumber: r.patientOpNumber ?? undefined,
                                name: r.patientName ?? "",
                                email: "",
                                phone: r.patientPhone ?? "",
                                address: "",
                              });
                            }}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                          >
                            <Stethoscope size={13} /> Register Visit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeFilteredCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {pageStart + 1}-{Math.min(pageStart + PATIENTS_PAGE_SIZE, activeFilteredCount)} of {activeFilteredCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {modalPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  {editingVisit ? "Edit visit" : walkInReferralId ? "Register referral" : "Walk-in visit"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {modalPatient.name}
                </p>
              </div>
              <button
                onClick={closeWalkInModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground/90 mb-2">
                    Department
                  </label>
                  <SearchableSelect
                    value={walkInDepartmentId}
                    onChange={(value) => {
                      setWalkInDepartmentId(value);
                      setSelectedDoctor(null);
                      setDaySlots(null);
                    }}
                    options={walkInDepartments}
                    placeholder="All departments"
                    className="flex h-10 w-full items-center justify-between gap-1 rounded-lg border border-border bg-muted px-4 text-left text-foreground hover:bg-muted/80 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground/90 mb-2">
                    Specialisation
                  </label>
                  <SearchableSelect
                    value={walkInSpecializationId}
                    onChange={(value) => {
                      setWalkInSpecializationId(value);
                      setSelectedDoctor(null);
                      setDaySlots(null);
                    }}
                    options={walkInSpecializations.map((s) => ({ value: s.specializationId, label: s.specializationName }))}
                    placeholder="All specialisations"
                    className="flex h-10 w-full items-center justify-between gap-1 rounded-lg border border-border bg-muted px-4 text-left text-foreground hover:bg-muted/80 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Doctor
                </label>
                <input
                  type="text"
                  value={doctorSearch}
                  onChange={(event) => {
                    setDoctorSearch(event.target.value);
                    setSelectedDoctor(null);
                    setDaySlots(null);
                  }}
                  placeholder="Search by doctor name or specialization..."
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-blue-500 text-foreground"
                />

                {isLoadingDoctors ? (
                  <div className="py-6">
                    <LoadingSpinner />
                  </div>
                ) : selectedDoctor ? (
                  <div className="mt-2 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedDoctor.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDoctor.specializationName}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDoctor(null);
                        setDaySlots(null);
                      }}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {flattenedDoctors.length > 0 ? (
                      flattenedDoctors.map((doctor) => (
                        <button
                          key={doctor.doctorId}
                          onClick={() => selectDoctor(doctor)}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <Stethoscope size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>
                            <span className="font-medium text-foreground">{doctor.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {doctor.specializationName}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        No doctors found.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedDoctor && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground/90">
                      <CalendarDays size={16} /> Time slot
                    </label>
                    <DatePicker
                      value={toDateInputValue(selectedDate)}
                      min={toDateInputValue(new Date())}
                      onChange={(v) => {
                        if (v) {
                          setSelectedDate(new Date(`${v}T00:00:00`));
                        }
                      }}
                      dateFormat="dd-MM-yyyy"
                      placeholder="DD-MM-YYYY"
                      className="flex h-9 w-40 items-center justify-between gap-2 rounded-lg border border-border bg-muted px-2 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {isLoadingSlots ? (
                    <LoadingSpinner />
                  ) : (daySlots?.slots.length ?? 0) === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                      This doctor has no schedule configured for this day.
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3 max-h-56 overflow-y-auto pr-1">
                      {daySlots!.slots.map((slot) => {
                        const isSelected = selectedSlot?.start === slot.start;
                        const isSelectable = slot.isAvailable && !slot.isPast;
                        return (
                          <button
                            key={slot.start}
                            onClick={() => isSelectable && setSelectedSlot(slot)}
                            disabled={!isSelectable}
                            title={
                              slot.isPast
                                ? "This slot has already passed"
                                : !slot.isAvailable
                                ? slot.patientName || "Booked"
                                : undefined
                            }
                            className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-sm font-semibold transition-colors ${
                              !isSelectable
                                ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground opacity-60"
                                : isSelected
                                ? "border-blue-600 bg-blue-600 text-white cursor-pointer"
                                : "border-emerald-600/30 bg-emerald-50 text-emerald-700 hover:-translate-y-0.5 hover:shadow-md cursor-pointer dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                            }`}
                          >
                            <Clock size={13} />
                            {format(new Date(slot.start), "h:mm a")}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Notes
                </label>
                <textarea
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder={editingVisit ? "Reason for switching doctors..." : "Reason for visit..."}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Payment & Insurance - walk-in only (see openWalkInModal's own comment on
                  why this doesn't apply to Edit Visit). Saved via UpdatePatient, same as the
                  full Edit Patient form - this is just a quicker way in for the common case
                  of fixing/adding insurance right when the patient walks in. */}
              {!editingVisit && (
                <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-foreground/90">Payment & Insurance</p>
                  {isLoadingWalkInPatient ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Payment Type</label>
                        <select
                          value={insuranceForm.paymentType}
                          onChange={(e) => setInsuranceForm((p) => ({ ...p, paymentType: e.target.value }))}
                          className="w-full h-10 text-sm"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Insurance">Insurance</option>
                          <option value="Corporate">Corporate</option>
                        </select>
                      </div>

                      {isInsuranceOrCorporate && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                              {insuranceForm.paymentType} Provider <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={insuranceForm.insuranceProvider}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, insuranceProvider: e.target.value }))}
                              required
                              className="w-full h-10 text-sm"
                            >
                              <option value="">{isLoadingInsuranceProviders ? "Loading..." : "Select Provider"}</option>
                              {insuranceProviders.map((p) => (
                                <option key={p.listItemId} value={p.name}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Sub Insurance</label>
                            <input
                              type="text"
                              value={insuranceForm.subInsurance}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, subInsurance: e.target.value }))}
                              placeholder="Plan / sub-category"
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Network Type</label>
                            <select
                              value={insuranceForm.networkType}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, networkType: e.target.value }))}
                              className="w-full h-10 text-sm"
                            >
                              <option value="">Select Network Type</option>
                              <option value="Open Network">Open Network</option>
                              <option value="Restricted Network">Restricted Network</option>
                              <option value="Copay Network">Copay Network</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                              {insuranceForm.paymentType} Card No <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={insuranceForm.insuranceCardNo}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, insuranceCardNo: e.target.value }))}
                              required
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Extra Card No</label>
                            <input
                              type="text"
                              value={insuranceForm.extraCardNo}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, extraCardNo: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">{insuranceForm.paymentType} Effective From</label>
                            <DatePicker
                              value={insuranceForm.insuranceEffectiveFrom}
                              onChange={(v) => setInsuranceForm((p) => ({ ...p, insuranceEffectiveFrom: v }))}
                              dateFormat="dd-MM-yyyy"
                              placeholder="DD-MM-YYYY"
                              className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
                              {insuranceForm.paymentType} Expiry Date <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                              value={insuranceForm.insuranceExpiryDate}
                              onChange={(v) => setInsuranceForm((p) => ({ ...p, insuranceExpiryDate: v }))}
                              required
                              dateFormat="dd-MM-yyyy"
                              placeholder="DD-MM-YYYY"
                              className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3 text-left text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Certificate No.</label>
                            <input
                              type="text"
                              value={insuranceForm.certificateNo}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, certificateNo: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Dependents No.</label>
                            <input
                              type="text"
                              value={insuranceForm.dependentsNo}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, dependentsNo: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Insurance Claim No.</label>
                            <input
                              type="text"
                              value={insuranceForm.insuranceClaimNo}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, insuranceClaimNo: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Max. Insurance Liability</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={insuranceForm.maxInsuranceLiability}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, maxInsuranceLiability: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Insurance Approval Limit</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={insuranceForm.insuranceApprovalLimit}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, insuranceApprovalLimit: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Max. Insurance Copay</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={insuranceForm.maxInsuranceCopay}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, maxInsuranceCopay: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Co-Pay Patient (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={insuranceForm.coPayPatientPercent}
                              onChange={(e) => setInsuranceForm((p) => ({ ...p, coPayPatientPercent: e.target.value }))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={closeWalkInModal}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWalkIn}
                disabled={isBookingWalkIn || !selectedDoctor || !selectedSlot}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isBookingWalkIn
                  ? editingVisit ? "Saving..." : "Registering..."
                  : editingVisit ? "Save changes" : "Register walk-in visit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-sm w-full p-6 border border-border">
            <h2 className="text-xl font-semibold text-foreground">
              Upload document
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {uploadTarget.name}
            </p>
            <form onSubmit={handleUploadDocument} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Document type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-blue-500 text-foreground"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  File
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-foreground"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Visit — password confirmation modal */}
      {cancelVisitTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card mx-4 w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">Cancel Visit</h2>
            <p className="mt-1 mb-1 text-sm text-muted-foreground">
              You are about to cancel the visit for{" "}
              <span className="font-semibold text-foreground">{cancelVisitTarget.name}</span>.
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Enter your password to confirm this action.
            </p>
            <PasswordInput
              autoFocus
              autoComplete="new-password"
              value={cancelPassword}
              onChange={(e) => setCancelPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCancelVisit()}
              placeholder="Your password"
            />
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setCancelVisitTarget(null); setCancelPassword(""); }}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelVisit}
                disabled={isCancelling || !cancelPassword.trim()}
                className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isCancelling ? "Verifying..." : "Cancel Visit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}