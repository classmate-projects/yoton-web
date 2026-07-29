"use client";

import DeleteIcon from "@/public/icons/deleteIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import Link from "next/link";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { MdContacts, MdOutlinePersonAddAlt1, MdOutlineUploadFile } from "react-icons/md";
import { CalendarDays, Clock, Stethoscope, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ReceptionService } from "@/services/reception.service";
import { PatientGetAllType } from "@/types/reception.type";
import {
  AppointmentSlotType,
  DoctorDaySlotsType,
  DoctorGridType,
  SpecializationDoctorsType,
} from "@/types/appointment.type";

const DOCUMENT_TYPES = ["ExternalLabReport", "ExternalRadiologyReport", "Other"];

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function PatientRecordsPage() {
  const [patients, setPatients] = useState<PatientGetAllType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [uploadTarget, setUploadTarget] = useState<PatientGetAllType | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // ---------------- Walk-in visit modal state ----------------
  const [walkInPatient, setWalkInPatient] = useState<PatientGetAllType | null>(null);
  const [specializations, setSpecializations] = useState<SpecializationDoctorsType[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorGridType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [daySlots, setDaySlots] = useState<DoctorDaySlotsType | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlotType | null>(null);
  const [isBookingWalkIn, setIsBookingWalkIn] = useState(false);

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

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const data = await ReceptionService.softDelete(id)
      toast.success(data.message)
      fetchPatients();
    } catch (error) {
      console.error("Failed to delete patient", error);
    }
  };

  const openWalkInModal = async (patient: PatientGetAllType) => {
    setWalkInPatient(patient);
    setDoctorSearch("");
    setSelectedDoctor(null);
    setSelectedDate(new Date());
    setDaySlots(null);
    setSelectedSlot(null);

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

  const closeWalkInModal = () => {
    setWalkInPatient(null);
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
    if (selectedDoctor && walkInPatient) {
      fetchWalkInSlots(selectedDoctor.doctorId, selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, selectedDate]);

  const flattenedDoctors = useMemo(() => {
    const term = doctorSearch.trim().toLowerCase();
    return specializations.flatMap((s) =>
      s.doctors
        .filter(
          (d) =>
            term.length === 0 ||
            d.name.toLowerCase().includes(term) ||
            s.specializationName.toLowerCase().includes(term)
        )
        .map((d) => ({ ...d, specializationName: s.specializationName }))
    );
  }, [specializations, doctorSearch]);

  const handleConfirmWalkIn = async () => {
    if (!walkInPatient || !selectedDoctor || !selectedSlot) {
      toast.warning("Please select a doctor and an available time slot");
      return;
    }

    try {
      setIsBookingWalkIn(true);
      const data = await ReceptionService.walkIn({
        patientId: walkInPatient.opId,
        doctorId: selectedDoctor.doctorId,
        appointmentDate: selectedSlot.start,
      });

      if (data.status === false) {
        toast.error(data.message || "This slot has just been booked. Please choose another slot.");
        fetchWalkInSlots(selectedDoctor.doctorId, selectedDate);
      } else {
        toast.success(data.message || "Walk-in visit registered");
        closeWalkInModal();
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to register walk-in visit");
      } else {
        toast.error("Failed to register walk-in visit");
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

  const confirmDelete = (id: string, name: string) => {
    toast(
      <span>
        Are you sure you want to delete {" "}
        <b className="text-red-500 ml-1">{name}</b>
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => handleDelete(id)
        }
      }
    )
  }

  const filteredPatients = patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
  );

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Patient Directory</h2>
          <div className="relative w-64">
            {/* <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} /> */}
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <SearchIcon color="#555" />
            </span>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <hr className="text-neutral-400/50 mb-4" />

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <tr key={patient.opId}>
                    <td className="font-semibold">{patient.name}</td>
                    <td>{patient.email}</td>
                    <td>{patient.phone}</td>
                    <td className="truncate max-w-xs">{patient.address || "N/A"}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openWalkInModal(patient)}
                          className="hover:bg-blue-50 p-2 rounded transition-colors cursor-pointer"
                          title="Register Walk-in Visit"
                        >
                          <MdOutlinePersonAddAlt1 className="text-blue-600" size={18} />
                        </button>
                        <button
                          onClick={() => setUploadTarget(patient)}
                          className="hover:bg-blue-50 p-2 rounded transition-colors cursor-pointer"
                          title="Upload External Document"
                        >
                          <MdOutlineUploadFile className="text-blue-600" size={18} />
                        </button>
                        <button
                          onClick={() => confirmDelete(patient.opId, patient.name)}
                          className="hover:bg-red-50 p-2 rounded transition-colors cursor-pointer"
                          title="Delete Patient"
                        >
                          <DeleteIcon color="red" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-500">
                    No patients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {walkInPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Walk-in visit
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {walkInPatient.name}
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
                  <div className="mt-2 flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
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
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
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
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <Stethoscope size={14} className="text-blue-600 shrink-0" />
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
                    <input
                      type="date"
                      value={toDateInputValue(selectedDate)}
                      min={toDateInputValue(new Date())}
                      onChange={(event) => {
                        if (event.target.value) {
                          setSelectedDate(new Date(`${event.target.value}T00:00:00`));
                        }
                      }}
                      className="h-9 w-40 text-sm px-2 rounded-lg bg-muted border border-border text-foreground"
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
                {isBookingWalkIn ? "Registering..." : "Register walk-in visit"}
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