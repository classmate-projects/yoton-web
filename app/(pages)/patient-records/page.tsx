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
import DatePicker from "@/components/DatePicker";
import SearchableSelect from "@/components/SearchableSelect";
import { ReceptionService } from "@/services/reception.service";
import { PatientGetAllType, VisitListItemType } from "@/types/reception.type";
import {
  AppointmentSlotType,
  DoctorDaySlotsType,
  DoctorGridType,
  SpecializationDoctorsType,
} from "@/types/appointment.type";
import { toDateInputValue } from "@/lib/date";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const DOCUMENT_TYPES = ["ExternalLabReport", "ExternalRadiologyReport", "InsuranceEligibility", "Other"];

type PatientListMode = "register" | "visit";
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
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // ---------------- Register List / Visit List toggle ----------------
  const [listMode, setListMode] = useState<PatientListMode>("register");
  const [visits, setVisits] = useState<VisitListItemType[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const todayValue = toDateInputValue(new Date());
  const [fromDate, setFromDate] = useState(todayValue);
  const [toDate, setToDate] = useState(todayValue);
  const [currentPage, setCurrentPage] = useState(1);

  const [uploadTarget, setUploadTarget] = useState<PatientGetAllType | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // ---------------- Walk-in visit modal state ----------------
  // Also reused for "Edit Visit" (see openEditVisitModal) - both are the exact same
  // department -> specialty -> doctor -> slot picker, just walkInPatient starts a brand new
  // visit while editingVisit reassigns an existing one's doctor via ReassignVisit instead of
  // WalkIn. Only one of the two is ever set at a time; modalPatient/modalTitle below read
  // whichever it is without the rest of the modal needing to care which.
  const [walkInPatient, setWalkInPatient] = useState<PatientGetAllType | null>(null);
  const [editingVisit, setEditingVisit] = useState<VisitListItemType | null>(null);
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
  }, [listMode, fromDate, toDate]);

  // Search/date/mode changes all invalidate whatever page the user was on - e.g. a filter
  // that now only matches 10 records shouldn't leave them stranded on page 3.
  useEffect(() => {
    setCurrentPage(1);
  }, [listMode, searchTerm, fromDate, toDate]);

  useSignalRRefetch(["patientRegistered", "PatientUpdated", "patientSoftDeleted"], fetchPatients);
  useSignalRRefetch(["visitCheckedIn", "visitStatusUpdated"], () => {
    if (listMode === "visit") fetchVisits(fromDate, toDate);
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
    setSelectedDoctor(null);
    setDaySlots(null);
    setSelectedSlot(null);
  };

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

  const handleConfirmWalkIn = async () => {
    if (!modalPatient || !selectedDoctor || !selectedSlot) {
      toast.warning("Please select a doctor and an available time slot");
      return;
    }

    try {
      setIsBookingWalkIn(true);
      const data = editingVisit
        ? await ReceptionService.reassignVisit(editingVisit.visitId, {
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
        toast.success(data.message || (editingVisit ? "Visit updated" : "Walk-in visit registered"));
        closeWalkInModal();
        if (editingVisit) fetchVisits(fromDate, toDate);
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

  const filteredPatients = useMemo(
    () => patients.filter((p) => matchesPatientSearch(p, searchTerm)),
    [patients, searchTerm]
  );
  const filteredVisits = useMemo(
    () => visits.filter((v) => matchesPatientSearch(v, searchTerm)),
    [visits, searchTerm]
  );

  const activeFilteredCount = listMode === "register" ? filteredPatients.length : filteredVisits.length;
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

  // Shared by both list modes' rows - a VisitListItemType is structurally a
  // PatientGetAllType (plus its own visit fields), so a Visit List row's patient identity
  // works here unchanged for the actions that operate on the patient rather than the visit.
  // Edit is the one exception: Register List edits the patient (Patient Entry's own form,
  // reused in edit mode - see that page), Visit List edits *this* visit (department/
  // specialty/doctor reassignment, see openEditVisitModal) - "visitId" in the row is what
  // tells the two apart, since a plain PatientGetAllType never has one.
  const renderActions = (patient: PatientGetAllType | VisitListItemType) => (
    <div className="flex items-center justify-center gap-1">
      {"visitId" in patient ? (
        <button
          onClick={() => openEditVisitModal(patient)}
          className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer"
          title="Edit Visit"
        >
          <MdOutlineEdit className="text-blue-600" size={18} />
        </button>
      ) : (
        <Link
          href={`/patient-entry?edit=${patient.opId}`}
          className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer inline-flex"
          title="Edit Patient"
        >
          <MdOutlineEdit className="text-blue-600" size={18} />
        </Link>
      )}
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
      <button
        onClick={() => handleResendWelcomeEmail(patient.opId, patient.name)}
        disabled={resendingEmailId === patient.opId}
        className="hover:bg-blue-50 dark:hover:bg-blue-950/30 p-2 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        title="Resend App Login Email"
      >
        {resendingEmailId === patient.opId ? (
          <Loader2 className="text-blue-600 animate-spin" size={18} />
        ) : (
          <MdOutlineMailOutline className="text-blue-600" size={18} />
        )}
      </button>
      <button
        onClick={() => confirmDelete(patient.opId, patient.name)}
        className="hover:bg-red-50 p-2 rounded transition-colors cursor-pointer"
        title="Delete Patient"
      >
        <DeleteIcon color="red" />
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
              <input
                type="text"
                placeholder="Search by name, MRN, mobile number, or national ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <hr className="text-neutral-400/50 mb-4" />

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>MRN</th>
                {listMode === "register" ? (
                  <>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Address</th>
                  </>
                ) : (
                  <>
                    <th>Phone</th>
                    <th>Visit Date</th>
                    <th>Visit Type</th>
                  </>
                )}
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(listMode === "register" ? isLoading : isLoadingVisits) ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : listMode === "register" ? (
                pagedPatients.length > 0 ? (
                  pagedPatients.map((patient) => (
                    <tr key={patient.opId}>
                      <td className="font-semibold">{patient.name}</td>
                      <td className="font-mono text-xs">{patient.opNumber || patient.opId}</td>
                      <td>{patient.email}</td>
                      <td>{patient.phone}</td>
                      <td className="truncate max-w-xs">{patient.address || "N/A"}</td>
                      <td className="text-center">{renderActions(patient)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-500">
                      No patients found.
                    </td>
                  </tr>
                )
              ) : pagedVisits.length > 0 ? (
                pagedVisits.map((visit) => (
                  <tr key={visit.visitId}>
                    <td className="font-semibold">{visit.name}</td>
                    <td className="font-mono text-xs">{visit.opNumber || visit.opId}</td>
                    <td>{visit.phone}</td>
                    <td>{format(new Date(visit.checkedInAt), "dd MMM yyyy")}</td>
                    <td>{visit.visitType === "WalkIn" ? "Walk-in" : "Appointment"}</td>
                    <td className="text-center">{renderActions(visit)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500">
                    No visits found for the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
                  {editingVisit ? "Edit visit" : "Walk-in visit"}
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
                          onClick={() => setSelectedDoctor(doctor)}
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
    </div>
  );
}