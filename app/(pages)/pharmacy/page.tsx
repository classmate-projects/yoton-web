"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Pill } from "lucide-react";
import { MdAdd, MdWarning } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import { PharmacyService } from "@/services/pharmacy.service";
import { ReceptionService } from "@/services/reception.service";
import { UserService } from "@/services/user.service";
import {
  MedicineType,
  PharmacySummaryType,
  PrescriptionType,
} from "@/types/pharmacy.type";
import { PatientListItemType, DoctorGridType } from "@/types/appointment.type";
import { UserType } from "@/types/user.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const PRIORITIES = ["Routine", "STAT", "PRN"];

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

const currency = (value: number) => `$${value.toFixed(2)}`;

export default function PharmacyPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tab, setTab] = useState<"prescriptions" | "inventory">("prescriptions");

  const [summary, setSummary] = useState<PharmacySummaryType | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionType[]>([]);
  const [medicines, setMedicines] = useState<MedicineType[]>([]);
  const [lowStock, setLowStock] = useState<MedicineType[]>([]);
  const [prescriptionFilter, setPrescriptionFilter] = useState<"pending" | "all">("pending");
  const [isLoading, setIsLoading] = useState(true);

  const [patients, setPatients] = useState<PatientListItemType[]>([]);
  const [doctors, setDoctors] = useState<DoctorGridType[]>([]);

  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [nurses, setNurses] = useState<UserType[]>([]);

  // Dispense confirmation
  const [dispenseTarget, setDispenseTarget] = useState<PrescriptionType | null>(null);
  const [collectedBy, setCollectedBy] = useState("Patient");
  const [collectorUserId, setCollectorUserId] = useState("");

  // New prescription form
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientListItemType | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ medicineId: string; quantity: number; priority: string }[]>([
    { medicineId: "", quantity: 1, priority: "Routine" },
  ]);

  // New medicine form
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);
  const [medName, setMedName] = useState("");
  const [medCategory, setMedCategory] = useState("");
  const [medStock, setMedStock] = useState<number>(0);
  const [medPrice, setMedPrice] = useState<number>(0);
  const [medExpiry, setMedExpiry] = useState("");

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    if (currentRole !== "pharmacist" && currentRole !== "admin") {
      router.replace("/");
      return;
    }
    setCheckedAuth(true);
  }, [router]);

  // ---------------- DATA ----------------
  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [summaryRes, rxRes, medsRes, lowStockRes] = await Promise.all([
        PharmacyService.getSummary(),
        prescriptionFilter === "pending"
          ? PharmacyService.getPendingPrescriptions()
          : PharmacyService.getPrescriptions(),
        PharmacyService.getMedicines(),
        PharmacyService.getLowStock(),
      ]);
      setSummary(summaryRes.data ?? null);
      setPrescriptions(rxRes.data ?? []);
      setMedicines(medsRes.data ?? []);
      setLowStock(lowStockRes.data ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load pharmacy data"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, prescriptionFilter]);

  useSignalRRefetch(
    ["prescriptionCreated", "prescriptionDispensed", "medicineAdded", "medicineStockUpdated"],
    fetchAll
  );

  useEffect(() => {
    if (!checkedAuth) return;
    const fetchPickers = async () => {
      try {
        const [patientsRes, gridRes] = await Promise.all([
          ReceptionService.getAllPatients(),
          ReceptionService.getSpecializationsWithDoctors(),
        ]);
        setPatients(patientsRes.patients ?? []);
        const allDoctors = (gridRes.specializations ?? []).flatMap(
          (s: { doctors: DoctorGridType[] }) => s.doctors
        );
        setDoctors(allDoctors);
      } catch (error) {
        console.error("Failed to load patient/doctor pickers:", error);
      }
    };
    fetchPickers();

    UserService.getAll()
      .then((res) => setNurses((res.data ?? []).filter((u: UserType) => u.role?.toLowerCase() === "nurse")))
      .catch(() => setNurses([]));
  }, [checkedAuth]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.opId?.toLowerCase().includes(q)
    );
  }, [patientSearch, patients]);

  // ---------------- PRESCRIPTION FORM ----------------
  const resetRxForm = () => {
    setPatientSearch("");
    setSelectedPatient(null);
    setSelectedDoctorId("");
    setNotes("");
    setItems([{ medicineId: "", quantity: 1, priority: "Routine" }]);
  };

  const openRxModal = () => {
    resetRxForm();
    setIsRxModalOpen(true);
  };

  const closeRxModal = () => {
    setIsRxModalOpen(false);
    resetRxForm();
  };

  const updateItem = (index: number, field: "medicineId" | "quantity" | "priority", value: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: field === "quantity" ? Number(value) : value } : item
      )
    );
  };

  const addItemRow = () => setItems((prev) => [...prev, { medicineId: "", quantity: 1, priority: "Routine" }]);
  const removeItemRow = (index: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.medicineId && i.quantity > 0);
    if (!selectedPatient || validItems.length === 0) {
      toast.warning("Please select a patient and at least one medicine");
      return;
    }

    try {
      setIsSubmittingRx(true);
      const data = await PharmacyService.createPrescription({
        patientId: selectedPatient.opId,
        doctorId: selectedDoctorId || undefined,
        notes: notes || undefined,
        items: validItems,
      });
      toast.success(data.message || "Prescription created");
      closeRxModal();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create prescription"));
    } finally {
      setIsSubmittingRx(false);
    }
  };

  const openDispenseModal = (prescription: PrescriptionType) => {
    setDispenseTarget(prescription);
    setCollectedBy("Patient");
    setCollectorUserId("");
  };

  const closeDispenseModal = () => {
    setDispenseTarget(null);
    setCollectedBy("Patient");
    setCollectorUserId("");
  };

  const handleIssue = async () => {
    if (!dispenseTarget) return;
    if (collectedBy === "Nurse" && !collectorUserId) {
      toast.warning("Please select which nurse collected the medicine");
      return;
    }
    try {
      setIssuingId(dispenseTarget.prescriptionId);
      const data = await PharmacyService.issue(dispenseTarget.prescriptionId, {
        collectedBy,
        collectorUserId: collectedBy === "Nurse" ? collectorUserId : undefined,
      });
      toast.success(data.message || "Medicine issued");
      closeDispenseModal();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to issue medicine"));
    } finally {
      setIssuingId(null);
    }
  };

  // ---------------- MEDICINE FORM ----------------
  const resetMedForm = () => {
    setMedName("");
    setMedCategory("");
    setMedStock(0);
    setMedPrice(0);
    setMedExpiry("");
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !medExpiry) {
      toast.warning("Please fill in the required fields");
      return;
    }

    try {
      setIsSubmittingMed(true);
      const data = await PharmacyService.addMedicine({
        name: medName,
        category: medCategory || undefined,
        stock: medStock,
        price: medPrice,
        expiryDate: medExpiry,
      });
      toast.success(data.message || "Medicine added");
      setIsMedModalOpen(false);
      resetMedForm();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add medicine"));
    } finally {
      setIsSubmittingMed(false);
    }
  };

  const adjustStock = async (medicine: MedicineType, delta: number) => {
    try {
      const data = await PharmacyService.updateStock(medicine.medicineId, delta);
      toast.success(data.message || "Stock updated");
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update stock"));
    }
  };

  if (!checkedAuth) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex justify-between items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <Pill size={34} className="text-primary" />
            Pharmacy
          </h1>
          <p className="text-sm text-muted-foreground">
            Dispense prescriptions and manage medicine inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={tab === "prescriptions" ? openRxModal : () => setIsMedModalOpen(true)}
          className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
        >
          <MdAdd size={22} />
          {tab === "prescriptions" ? "New Prescription" : "Add Medicine"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Pending Prescriptions</p>
          <p className="text-3xl font-bold text-foreground mt-1">{summary?.pendingPrescriptions ?? "—"}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Low Stock Medicines</p>
          <p className="text-3xl font-bold text-destructive mt-1">{summary?.lowStockCount ?? "—"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(
          [
            { key: "prescriptions", label: "Prescriptions" },
            { key: "inventory", label: "Inventory" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              tab === t.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "prescriptions" ? (
        <>
          <div className="flex gap-2 mb-4">
            {(["pending", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPrescriptionFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  prescriptionFilter === f
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "pending" ? "Pending Only" : "All Prescriptions"}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-foreground/90">Patient</th>
                    <th className="text-foreground/90">Doctor</th>
                    <th className="text-foreground/90">Medicines</th>
                    <th className="text-foreground/90">Total</th>
                    <th className="text-foreground/90">Date</th>
                    <th className="text-foreground/90">Status</th>
                    <th className="text-center text-foreground/90">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <LoadingSpinner />
                      </td>
                    </tr>
                  ) : prescriptions.length > 0 ? (
                    prescriptions.map((rx) => {
                      const total = rx.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
                      return (
                        <tr key={rx.prescriptionId} className="hover:bg-muted/30 transition-colors">
                          <td className="font-semibold text-foreground">{rx.patientName}</td>
                          <td className="text-foreground/80">{rx.doctorName}</td>
                          <td className="text-foreground/80">
                            <div className="flex flex-col gap-0.5">
                              {rx.items.map((i) => (
                                <span key={i.prescriptionItemId} className="text-xs flex items-center gap-1">
                                  {i.medicineName} × {i.quantity}
                                  {i.priority !== "Routine" && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${i.priority === "STAT" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                      {i.priority}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-foreground font-semibold">{currency(total)}</td>
                          <td className="text-foreground/70 text-sm">{formatDate(rx.createdAt)}</td>
                          <td>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                rx.status === "Dispensed"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-amber-500/10 text-amber-500"
                              }`}
                            >
                              {rx.status}
                            </span>
                            {rx.status === "Dispensed" && rx.collectedBy && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Collected by {rx.collectedBy === "Nurse" ? rx.collectorName || "Nurse" : "Patient"}
                              </p>
                            )}
                          </td>
                          <td>
                            <div className="flex justify-center">
                              {rx.status === "Pending" ? (
                                <button
                                  onClick={() => openDispenseModal(rx)}
                                  disabled={issuingId === rx.prescriptionId}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
                                >
                                  {issuingId === rx.prescriptionId ? "Dispensing..." : "Dispense"}
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-muted-foreground">
                        No prescriptions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-foreground/90">Name</th>
                    <th className="text-foreground/90">Category</th>
                    <th className="text-foreground/90">Stock</th>
                    <th className="text-foreground/90">Price</th>
                    <th className="text-foreground/90">Expiry</th>
                    <th className="text-center text-foreground/90">Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <LoadingSpinner />
                      </td>
                    </tr>
                  ) : medicines.length > 0 ? (
                    medicines.map((med) => (
                      <tr
                        key={med.medicineId}
                        className={`hover:bg-muted/30 transition-colors ${
                          med.stock < 10 ? "bg-destructive/5" : ""
                        }`}
                      >
                        <td className="font-semibold text-foreground">{med.name}</td>
                        <td className="text-foreground/80">{med.category || "—"}</td>
                        <td className={med.stock < 10 ? "text-destructive font-semibold" : "text-foreground/80"}>
                          {med.stock}
                        </td>
                        <td className="text-foreground/80">{currency(med.price)}</td>
                        <td className="text-foreground/70 text-sm">{formatDate(med.expiryDate)}</td>
                        <td>
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => adjustStock(med, -1)}
                              className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 text-foreground font-bold cursor-pointer"
                            >
                              −
                            </button>
                            <button
                              onClick={() => adjustStock(med, 1)}
                              className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 text-foreground font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-muted-foreground">
                        No medicines found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-destructive">
              <MdWarning size={22} /> Low Stock Alerts
            </h2>
            {lowStock.length === 0 ? (
              <p className="text-emerald-500 font-medium text-sm">All stocks are sufficient.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {lowStock.map((med) => (
                  <li
                    key={med.medicineId}
                    className="flex justify-between items-center p-3 bg-destructive/5 rounded-lg"
                  >
                    <span className="font-semibold text-foreground text-sm">{med.name}</span>
                    <span className="bg-destructive text-white px-2 py-1 text-xs rounded-full">
                      {med.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isRxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-lg rounded-xl border border-border p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">New Prescription</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Log a new prescription to be dispensed for a patient.
            </p>

            <form onSubmit={handleCreatePrescription} className="flex flex-col gap-4">
              <div className="relative">
                <label className="text-sm font-bold text-foreground/90 required">Patient</label>
                <input
                  type="text"
                  required
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setSelectedPatient(null);
                  }}
                  placeholder="Search by name, phone or OP ID..."
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
                {!selectedPatient && filteredPatients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {filteredPatients.map((p) => (
                      <button
                        type="button"
                        key={p.opId}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch(p.name);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-primary/5 border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-foreground">{p.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {p.opId} • {p.phone}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90">Prescribing Doctor</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                >
                  <option value="">Not specified</option>
                  {doctors.map((d) => (
                    <option key={d.doctorId} value={d.doctorId}>
                      {d.name} — {d.specializationName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90 required">Medicines</label>
                <div className="flex flex-col gap-2 mt-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        required
                        value={item.medicineId}
                        onChange={(e) => updateItem(index, "medicineId", e.target.value)}
                        className="flex-1 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm"
                      >
                        <option value="">Select medicine</option>
                        {medicines.map((m) => (
                          <option key={m.medicineId} value={m.medicineId}>
                            {m.name} ({m.stock} in stock)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        required
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        className="w-20 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm"
                      />
                      <select
                        value={item.priority}
                        onChange={(e) => updateItem(index, "priority", e.target.value)}
                        className="w-28 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="px-2 rounded-lg bg-muted hover:bg-destructive/10 text-destructive text-sm cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-xs font-semibold text-primary hover:underline text-left cursor-pointer"
                  >
                    + Add another medicine
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={closeRxModal}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRx}
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
                >
                  {isSubmittingRx ? "Saving..." : "Create Prescription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">Add Medicine</h2>
            <p className="text-sm text-muted-foreground mb-6">Add a new medicine to the inventory.</p>

            <form onSubmit={handleAddMedicine} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-bold text-foreground/90 required">Name</label>
                <input
                  type="text"
                  required
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-foreground/90">Category</label>
                <input
                  type="text"
                  value={medCategory}
                  onChange={(e) => setMedCategory(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
              </div>
              <div className="flex gap-4">
                <div className="w-full">
                  <label className="text-sm font-bold text-foreground/90">Stock</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={medStock}
                    onChange={(e) => setMedStock(Number(e.target.value))}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="w-full">
                  <label className="text-sm font-bold text-foreground/90">Price</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    required
                    value={medPrice}
                    onChange={(e) => setMedPrice(Number(e.target.value))}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-foreground/90 required">Expiry Date</label>
                <DatePicker
                  required
                  value={medExpiry}
                  onChange={(v) => setMedExpiry(v)}
                  className="flex w-full items-center justify-between gap-2 mt-1 p-3 rounded-lg border border-border bg-muted text-left text-foreground outline-none transition-all focus-visible:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setIsMedModalOpen(false);
                    resetMedForm();
                  }}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMed}
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
                >
                  {isSubmittingMed ? "Saving..." : "Save Medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dispenseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Dispense medicine</h2>
            <p className="text-sm text-muted-foreground mt-1">{dispenseTarget.patientName}</p>

            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground/90">Who is collecting?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={collectedBy === "Patient"} onChange={() => setCollectedBy("Patient")} />
                  Patient
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={collectedBy === "Nurse"} onChange={() => setCollectedBy("Nurse")} />
                  Nurse
                </label>
              </div>
              {collectedBy === "Nurse" && (
                <select
                  value={collectorUserId}
                  onChange={(e) => setCollectorUserId(e.target.value)}
                  className="w-full p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                >
                  <option value="">Select nurse</option>
                  {nurses.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 w-full">
              <button
                type="button"
                onClick={closeDispenseModal}
                className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={issuingId === dispenseTarget.prescriptionId}
                className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
              >
                {issuingId === dispenseTarget.prescriptionId ? "Dispensing..." : "Confirm Dispense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
