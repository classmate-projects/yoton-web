"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { Pencil, Pill, Trash2 } from "lucide-react";
import { notifySaveStatus } from "@/lib/saveStatus";
import { MdAdd, MdWarning } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import DatePicker from "@/components/DatePicker";
import SearchableSelect from "@/components/SearchableSelect";
import CorrectedFromNote from "@/components/CorrectedFromNote";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { PharmacyService } from "@/services/pharmacy.service";
import { ReceptionService } from "@/services/reception.service";
import { UserService } from "@/services/user.service";
import PrescriptionPrintout, { PrescriptionMedicineLine } from "@/components/prescription/PrescriptionPrintout";
import DispenseLabelPrintout from "@/components/prescription/DispenseLabelPrintout";
import {
  MedicineAlternativeType,
  MedicineType,
  PharmacyMedicationType,
  PharmacySummaryType,
  PrescriptionType,
} from "@/types/pharmacy.type";
import { PatientListItemType, DoctorGridType } from "@/types/appointment.type";
import { UserType } from "@/types/user.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";

const PRIORITIES = ["Routine", "STAT", "PRN"];

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

const currency = (value: number) => formatCurrency(value);

export default function PharmacyPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tab, setTab] = useState<"prescriptions" | "inventory">("prescriptions");

  const [summary, setSummary] = useState<PharmacySummaryType | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionType[]>([]);
  const [medicationQueue, setMedicationQueue] = useState<PharmacyMedicationType[]>([]);
  const [medicines, setMedicines] = useState<MedicineType[]>([]);
  const [lowStock, setLowStock] = useState<MedicineType[]>([]);

  // Inventory tab's own browsable/searchable catalog table — decoupled from `medicines`
  // above (which stays a flat picker list for the walk-in-sale/alternatives dropdowns)
  // since the catalog can now hold tens of thousands of bulk-imported rows.
  const [invMedicines, setInvMedicines] = useState<MedicineType[]>([]);
  const [invSearch, setInvSearch] = useState("");
  const [invDebouncedSearch, setInvDebouncedSearch] = useState("");
  const [invSource, setInvSource] = useState<"" | "DDC" | "Riayati" | "none">("");
  const [invPage, setInvPage] = useState(1);
  const [invTotalCount, setInvTotalCount] = useState(0);
  const [invLoading, setInvLoading] = useState(false);
  const INV_PAGE_SIZE = 100;
  const invTotalPages = Math.max(1, Math.ceil(invTotalCount / INV_PAGE_SIZE));
  const [prescriptionFilter, setPrescriptionFilter] = useState<"pending" | "all">("pending");
  const [prescriptionView, setPrescriptionView] = useState<"doctorOrders" | "walkIn">("doctorOrders");
  const [isLoading, setIsLoading] = useState(true);

  // Doctor-order dispense workflow (Prepared -> Dispensed, per Medication)
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [medDispenseTarget, setMedDispenseTarget] = useState<PharmacyMedicationType | null>(null);
  const [medCollectedBy, setMedCollectedBy] = useState("Patient");
  const [medCollectorUserId, setMedCollectorUserId] = useState("");
  const [isDispensingMed, setIsDispensingMed] = useState(false);

  // Printable prescription — one patient's medications at a time
  const [printGroup, setPrintGroup] = useState<{
    patientName: string;
    patientNumber: string;
    doctorName: string;
    items: PharmacyMedicationType[];
  } | null>(null);

  // Dispense label (small per-medicine printable, distinct from the full prescription above)
  const [labelTarget, setLabelTarget] = useState<PharmacyMedicationType | null>(null);

  // Alternative medicines management (inventory tab)
  const [alternativesTarget, setAlternativesTarget] = useState<MedicineType | null>(null);
  const [alternativesList, setAlternativesList] = useState<MedicineAlternativeType[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [addAlternativeId, setAddAlternativeId] = useState("");
  const [savingAlternative, setSavingAlternative] = useState(false);

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
  // Set while correcting an existing Pending prescription - reuses the same modal/form as
  // creating a new one, matching every other add-form-doubles-as-edit-form in this feature.
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);

  // New medicine form
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);
  const [medName, setMedName] = useState("");
  const [medGenericName, setMedGenericName] = useState("");
  const [medIngredient, setMedIngredient] = useState("");
  const [medDosageForm, setMedDosageForm] = useState("");
  const [medCategory, setMedCategory] = useState("");
  const [medStock, setMedStock] = useState<number>(0);
  const [medPrice, setMedPrice] = useState<number>(0);
  const [medExpiry, setMedExpiry] = useState("");
  const [medIsHighRisk, setMedIsHighRisk] = useState(false);
  const [medCode, setMedCode] = useState("");
  const [medManufacturer, setMedManufacturer] = useState("");
  const [medRoute, setMedRoute] = useState("");
  const [medIsControlled, setMedIsControlled] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState<string | null>(null);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    const allowedModules: string[] = detail.allowedModules || [];
    if (currentRole !== "admin" && !allowedModules.includes("/pharmacy")) {
      router.replace("/");
      return;
    }
    setCheckedAuth(true);
  }, [router]);

  // ---------------- DATA ----------------
  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [summaryRes, rxRes, medsRes, lowStockRes, queueRes] = await Promise.all([
        PharmacyService.getSummary(),
        prescriptionFilter === "pending"
          ? PharmacyService.getPendingPrescriptions()
          : PharmacyService.getPrescriptions(),
        // Flat picker list for the walk-in-sale/alternatives <select> dropdowns below -
        // capped at the max page size rather than left unbounded now that the catalog can
        // hold tens of thousands of bulk-imported rows. The searchable/paginated Inventory
        // tab table is fetched separately, see fetchInventory().
        PharmacyService.getMedicines({ pageSize: 500 }),
        PharmacyService.getLowStock(),
        PharmacyService.getMedicationQueue(prescriptionFilter),
      ]);
      setSummary(summaryRes.data ?? null);
      setPrescriptions(rxRes.data ?? []);
      setMedicines(medsRes.data ?? []);
      setLowStock(lowStockRes.data ?? []);
      setMedicationQueue(queueRes.data ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load pharmacy data"));
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced so the Inventory tab's search box doesn't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setInvDebouncedSearch(invSearch.trim()), 350);
    return () => clearTimeout(handle);
  }, [invSearch]);

  useEffect(() => {
    setInvPage(1);
  }, [invDebouncedSearch, invSource]);

  const fetchInventory = async () => {
    try {
      setInvLoading(true);
      const res = await PharmacyService.getMedicines({
        search: invDebouncedSearch || undefined,
        source: invSource || undefined,
        page: invPage,
        pageSize: INV_PAGE_SIZE,
      });
      setInvMedicines(res.data ?? []);
      setInvTotalCount(res.totalCount ?? 0);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load medicine catalog"));
      setInvMedicines([]);
      setInvTotalCount(0);
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "inventory" || !checkedAuth) return;
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, checkedAuth, invDebouncedSearch, invSource, invPage]);

  // Pharmacy's queue is a flat list of Medication rows across every patient — grouped here
  // so it reads as one prescription per patient (matching how a doctor actually orders and
  // how a printed prescription should look) rather than an undifferentiated drug list.
  const medicationGroups = useMemo(() => {
    const map = new Map<string, { patientId: string; patientName: string; doctorName: string; items: PharmacyMedicationType[] }>();
    for (const m of medicationQueue) {
      if (!map.has(m.patientId)) {
        map.set(m.patientId, { patientId: m.patientId, patientName: m.patientName, doctorName: m.doctorName, items: [] });
      }
      map.get(m.patientId)!.items.push(m);
    }
    return Array.from(map.values());
  }, [medicationQueue]);

  const handlePrepare = async (medicationId: string) => {
    try {
      setPreparingId(medicationId);
      const data = await PharmacyService.prepareMedication(medicationId);
      toast.success(data.message || "Marked as prepared");
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to mark as prepared"));
    } finally {
      setPreparingId(null);
    }
  };

  const openMedDispenseModal = (item: PharmacyMedicationType) => {
    setMedDispenseTarget(item);
    setMedCollectedBy("Patient");
    setMedCollectorUserId("");
  };

  const closeMedDispenseModal = () => {
    setMedDispenseTarget(null);
    setMedCollectedBy("Patient");
    setMedCollectorUserId("");
  };

  const handleMedDispense = async () => {
    if (!medDispenseTarget) return;
    if (medCollectedBy === "Nurse" && !medCollectorUserId) {
      toast.warning("Please select which nurse collected the medicine");
      return;
    }
    try {
      setIsDispensingMed(true);
      const data = await PharmacyService.dispenseMedication(medDispenseTarget.medicationId, {
        collectedBy: medCollectedBy,
        collectorUserId: medCollectedBy === "Nurse" ? medCollectorUserId : undefined,
      });
      toast.success(data.message || "Medicine dispensed");
      closeMedDispenseModal();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to dispense medicine"));
    } finally {
      setIsDispensingMed(false);
    }
  };

  const openLabelPrint = (item: PharmacyMedicationType) => setLabelTarget(item);

  const openAlternativesManager = async (medicine: MedicineType) => {
    setAlternativesTarget(medicine);
    setLoadingAlternatives(true);
    try {
      const data = await PharmacyService.getAlternatives(medicine.medicineId);
      setAlternativesList(data.data ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load alternatives"));
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const closeAlternativesManager = () => {
    setAlternativesTarget(null);
    setAlternativesList([]);
    setAddAlternativeId("");
  };

  const handleAddAlternative = async () => {
    if (!alternativesTarget || !addAlternativeId) return;
    setSavingAlternative(true);
    try {
      await PharmacyService.addAlternative(alternativesTarget.medicineId, addAlternativeId);
      const data = await PharmacyService.getAlternatives(alternativesTarget.medicineId);
      setAlternativesList(data.data ?? []);
      setAddAlternativeId("");
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add alternative"));
    } finally {
      setSavingAlternative(false);
    }
  };

  const handleRemoveAlternative = async (alternativeId: string) => {
    if (!alternativesTarget) return;
    try {
      await PharmacyService.removeAlternative(alternativesTarget.medicineId, alternativeId);
      setAlternativesList((prev) => prev.filter((a) => a.medicineId !== alternativeId));
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to remove alternative"));
    }
  };

  const openPrintForGroup = (group: { patientName: string; doctorName: string; items: PharmacyMedicationType[] }) => {
    setPrintGroup({
      patientName: group.patientName,
      patientNumber: group.items[0]?.patientOPNumber || group.items[0]?.patientId || "",
      doctorName: group.doctorName,
      items: group.items,
    });
  };

  const toPrintLine = (m: PharmacyMedicationType): PrescriptionMedicineLine => ({
    drugName: m.drugName,
    drugType: m.drugType,
    dosage: m.dosage,
    dosageUnit: m.dosageUnit,
    frequency: m.frequency,
    route: m.route,
    orderType: m.orderType,
    durationDays: m.durationDays,
    instructions: m.instructions,
    totalQuantity: m.totalQuantity,
    unitPrice: m.unitPrice,
  });

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, prescriptionFilter]);

  useSignalRRefetch(
    ["prescriptionCreated", "prescriptionDispensed", "medicineAdded", "medicineUpdated", "medicineStockUpdated"],
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
        p.opNumber?.toLowerCase().includes(q) ||
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
    setEditingPrescriptionId(null);
    setIsRxModalOpen(true);
  };

  const openEditRxModal = (prescription: PrescriptionType) => {
    resetRxForm();
    setEditingPrescriptionId(prescription.prescriptionId);
    const matchedPatient = patients.find((p) => p.opId === prescription.patientId);
    if (matchedPatient) {
      setSelectedPatient(matchedPatient);
      setPatientSearch(matchedPatient.name);
    }
    setSelectedDoctorId(prescription.doctorId || "");
    setNotes(prescription.notes || "");
    setItems(
      prescription.items.length > 0
        ? prescription.items.map((i) => ({ medicineId: i.medicineId || "", quantity: i.quantity, priority: i.priority }))
        : [{ medicineId: "", quantity: 1, priority: "Routine" }]
    );
    setIsRxModalOpen(true);
  };

  const closeRxModal = () => {
    setIsRxModalOpen(false);
    setEditingPrescriptionId(null);
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

    notifySaveStatus("saving");
    try {
      setIsSubmittingRx(true);
      const payload = {
        patientId: selectedPatient.opId,
        doctorId: selectedDoctorId || undefined,
        notes: notes || undefined,
        items: validItems,
      };
      const data = editingPrescriptionId
        ? await PharmacyService.updatePrescription(editingPrescriptionId, payload)
        : await PharmacyService.createPrescription(payload);
      toast.success(data.message || (editingPrescriptionId ? "Prescription corrected" : "Prescription created"));
      notifySaveStatus("saved");
      closeRxModal();
      fetchAll();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, editingPrescriptionId ? "Failed to correct prescription" : "Failed to create prescription"));
    } finally {
      setIsSubmittingRx(false);
    }
  };

  const removePrescriptionEntry = (prescription: PrescriptionType) => {
    confirmDeleteToast(
      <span>Delete this prescription for <b className="text-red-500 ml-1">{prescription.patientName}</b>?</span>,
      async () => {
        try {
          await PharmacyService.removePrescription(prescription.prescriptionId);
          toast.success("Prescription removed");
          fetchAll();
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove prescription"));
        }
      }
    );
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
    notifySaveStatus("saving");
    try {
      setIssuingId(dispenseTarget.prescriptionId);
      const data = await PharmacyService.issue(dispenseTarget.prescriptionId, {
        collectedBy,
        collectorUserId: collectedBy === "Nurse" ? collectorUserId : undefined,
      });
      toast.success(data.message || "Medicine issued");
      notifySaveStatus("saved");
      closeDispenseModal();
      fetchAll();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to issue medicine"));
    } finally {
      setIssuingId(null);
    }
  };

  // ---------------- MEDICINE FORM ----------------
  // Refreshes both the flat picker list (fetchAll) and, if it's the visible one, the
  // Inventory tab's own searchable/paginated table - a mutation there wouldn't otherwise
  // show up since that table no longer reads from fetchAll's `medicines` state.
  const refreshMedicines = () => {
    fetchAll();
    if (tab === "inventory") fetchInventory();
  };

  const resetMedForm = () => {
    setMedName("");
    setMedGenericName("");
    setMedIngredient("");
    setMedDosageForm("");
    setMedCategory("");
    setMedStock(0);
    setMedPrice(0);
    setMedExpiry("");
    setMedIsHighRisk(false);
    setMedCode("");
    setMedManufacturer("");
    setMedRoute("");
    setMedIsControlled(false);
  };

  const openEditMedModal = (medicine: MedicineType) => {
    setEditingMedicineId(medicine.medicineId);
    setMedName(medicine.name);
    setMedGenericName(medicine.genericName || "");
    setMedIngredient(medicine.ingredient || "");
    setMedDosageForm(medicine.dosageForm || "");
    setMedCategory(medicine.category || "");
    setMedStock(medicine.stock);
    setMedPrice(medicine.price);
    setMedExpiry(medicine.expiryDate ? medicine.expiryDate.slice(0, 10) : "");
    setMedIsHighRisk(medicine.isHighRisk);
    setMedCode(medicine.code || "");
    setMedManufacturer(medicine.manufacturer || "");
    setMedRoute(medicine.route || "");
    setMedIsControlled(medicine.isControlled);
    setIsMedModalOpen(true);
  };

  const closeMedModal = () => {
    setIsMedModalOpen(false);
    setEditingMedicineId(null);
    resetMedForm();
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) {
      toast.warning("Please fill in the required fields");
      return;
    }

    try {
      setIsSubmittingMed(true);
      const payload = {
        name: medName,
        genericName: medGenericName || undefined,
        ingredient: medIngredient || undefined,
        dosageForm: medDosageForm || undefined,
        category: medCategory || undefined,
        stock: medStock,
        price: medPrice,
        expiryDate: medExpiry || undefined,
        isHighRisk: medIsHighRisk,
        code: medCode || undefined,
        manufacturer: medManufacturer || undefined,
        route: medRoute || undefined,
        isControlled: medIsControlled,
      };
      const data = editingMedicineId
        ? await PharmacyService.updateMedicine(editingMedicineId, payload)
        : await PharmacyService.addMedicine(payload);
      toast.success(data.message || (editingMedicineId ? "Medicine updated" : "Medicine added"));
      closeMedModal();
      refreshMedicines();
    } catch (error) {
      toast.error(errorMessage(error, editingMedicineId ? "Failed to update medicine" : "Failed to add medicine"));
    } finally {
      setIsSubmittingMed(false);
    }
  };

  const removeMedicineEntry = (medicine: MedicineType) => {
    confirmDeleteToast(
      <span>Delete medicine <b className="text-red-500 ml-1">{medicine.name}</b>?</span>,
      async () => {
        try {
          await PharmacyService.removeMedicine(medicine.medicineId);
          toast.success("Medicine removed");
          refreshMedicines();
        } catch (error) {
          toast.error(errorMessage(error, "Failed to remove medicine"));
        }
      }
    );
  };

  const adjustStock = async (medicine: MedicineType, delta: number) => {
    try {
      const data = await PharmacyService.updateStock(medicine.medicineId, delta);
      toast.success(data.message || "Stock updated");
      refreshMedicines();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update stock"));
    }
  };

  const toggleHighRisk = async (medicine: MedicineType) => {
    try {
      await PharmacyService.setHighRisk(medicine.medicineId, !medicine.isHighRisk);
      toast.success(medicine.isHighRisk ? "Unflagged as high-risk" : "Flagged as high-risk");
      refreshMedicines();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update medicine"));
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
    <div className="py-6 px-4 sm:py-8 sm:px-10 h-full overflow-y-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <Pill size={34} className="text-primary" />
            Pharmacy
          </h1>
          <p className="text-sm text-muted-foreground">
            Dispense prescriptions and manage medicine inventory.
          </p>
        </div>
        {(tab === "inventory" || (tab === "prescriptions" && prescriptionView === "walkIn")) && (
          <button
            type="button"
            onClick={tab === "prescriptions" ? openRxModal : () => { setEditingMedicineId(null); resetMedForm(); setIsMedModalOpen(true); }}
            className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
          >
            <MdAdd size={22} />
            {tab === "prescriptions" ? "New Walk-in Sale" : "Add Medicine"}
          </button>
        )}
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-2">
              {(
                [
                  { key: "doctorOrders", label: "Doctor Orders" },
                  { key: "walkIn", label: "Walk-in Sales" },
                ] as const
              ).map((v) => (
                <button
                  key={v.key}
                  onClick={() => setPrescriptionView(v.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                    prescriptionView === v.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
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
                  {f === "pending" ? "Pending Only" : "All"}
                </button>
              ))}
            </div>
          </div>

          {prescriptionView === "doctorOrders" ? (
            <div className="flex flex-col gap-4">
              {isLoading ? (
                <div className="card py-16 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : medicationGroups.length === 0 ? (
                <div className="card">
                  <EmptyState
                    illustration="pharmacy"
                    title="No doctor orders found"
                    description="Medication orders from doctors will appear here to be dispensed."
                  />
                </div>
              ) : (
                medicationGroups.map((group) => {
                  const eligibility = group.items[0];
                  return (
                  <div key={group.patientId} className="card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                      <div>
                        <p className="font-semibold text-foreground">{group.patientName}</p>
                        <p className="text-xs text-muted-foreground">{group.doctorName}</p>
                        {eligibility?.eligibilityMode && eligibility.eligibilityMode !== "Not Done" && (
                          <p className="mt-1 text-xs">
                            <span className="font-semibold text-foreground/80">Insurance ({eligibility.eligibilityMode}):</span>{" "}
                            {eligibility.eligibilityMode === "Online" ? (
                              <span className="text-muted-foreground">
                                {eligibility.insuranceProvider || "—"}
                                {eligibility.eligibilityID ? ` · ID ${eligibility.eligibilityID}` : ""}
                              </span>
                            ) : eligibility.eligibilityDocumentPath ? (
                              <a
                                href={eligibility.eligibilityDocumentPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                View attached document
                              </a>
                            ) : (
                              <span className="text-amber-600">No document on file yet</span>
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => openPrintForGroup(group)}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Print Prescription
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                      {group.items.map((item) => (
                        <div key={item.medicationId} className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{item.drugName}</p>
                              {item.alternatives.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  Alt: {item.alternatives.map((a) => `${a.name} (${a.stock})`).join(", ")}
                                </p>
                              )}
                            </div>
                            <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${
                              item.dispenseStatus === "Dispensed"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : item.dispenseStatus === "Prepared"
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-amber-500/10 text-amber-500"
                            }`}>
                              {item.dispenseStatus}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Dosage</p>
                              <p className="text-foreground/80">{item.dosage ? `${item.dosage}${item.dosageUnit ? ` ${item.dosageUnit}` : ""}` : "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Frequency</p>
                              <p className="text-foreground/80">{item.frequency || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Route</p>
                              <p className="text-foreground/80">{item.route || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Price</p>
                              <p className="text-foreground/80">{item.unitPrice != null ? currency(item.unitPrice) : "—"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-border">
                            {item.dispenseStatus === "Pending" && (
                              <button
                                onClick={() => handlePrepare(item.medicationId)}
                                disabled={preparingId === item.medicationId}
                                className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-60"
                              >
                                {preparingId === item.medicationId ? "Preparing..." : "Mark Prepared"}
                              </button>
                            )}
                            {item.dispenseStatus === "Prepared" && (
                              <button
                                onClick={() => openMedDispenseModal(item)}
                                className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:opacity-90 transition-colors cursor-pointer"
                              >
                                Dispense
                              </button>
                            )}
                            {item.dispenseStatus !== "Pending" && (
                              <button
                                onClick={() => openLabelPrint(item)}
                                className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-border text-foreground/80 hover:bg-muted transition-colors cursor-pointer"
                              >
                                Print Label
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          ) : (
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
                            <div className="flex justify-center items-center gap-1">
                              {rx.status === "Pending" ? (
                                <>
                                  <button
                                    onClick={() => openDispenseModal(rx)}
                                    disabled={issuingId === rx.prescriptionId}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
                                  >
                                    {issuingId === rx.prescriptionId ? "Dispensing..." : "Dispense"}
                                  </button>
                                  <button
                                    onClick={() => openEditRxModal(rx)}
                                    title="Correct prescription"
                                    className="p-1.5 hover:bg-primary/10 rounded-full text-primary cursor-pointer"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => removePrescriptionEntry(rx)}
                                    title="Delete prescription"
                                    className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive cursor-pointer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                            {rx.correctedFrom && (
                              <CorrectedFromNote>
                                <div>
                                  Previous:{" "}
                                  {rx.correctedFrom.items
                                    .map((i) => `${i.medicineName} x${i.quantity}`)
                                    .join(", ")}
                                  {rx.correctedFrom.notes ? ` — ${rx.correctedFrom.notes}` : ""}
                                </div>
                                <div>Recorded {formatDate(rx.correctedFrom.createdAt)}</div>
                              </CorrectedFromNote>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          illustration="documents"
                          title="No prescriptions found"
                          description="Prescriptions written by doctors will be listed here."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <p className="text-xs text-muted-foreground px-4 pt-4">
              Bulk-importing the DDC/Riayati medication registries is managed by admin under Configurable Lists →
              Medication. This table is for day-to-day stock, pricing, and dispensing management.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
              <input
                type="text"
                placeholder="Search by name, generic name, or code..."
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                className="flex-1 min-w-52 h-10 text-sm"
              />
              <div className="h-10">
                <SearchableSelect
                  value={invSource}
                  onChange={(v) => setInvSource(v as "" | "DDC" | "Riayati" | "none")}
                  options={[
                    { value: "", label: "All sources" },
                    { value: "DDC", label: "DDC" },
                    { value: "Riayati", label: "Riayati" },
                    { value: "none", label: "Manually added" },
                  ]}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-foreground/90">Name</th>
                    <th className="text-foreground/90">Code</th>
                    <th className="text-foreground/90">Manufacturer</th>
                    <th className="text-foreground/90">Route</th>
                    <th className="text-foreground/90">Stock</th>
                    <th className="text-foreground/90">Price</th>
                    <th className="text-center text-foreground/90">Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invLoading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <LoadingSpinner />
                      </td>
                    </tr>
                  ) : invMedicines.length > 0 ? (
                    invMedicines.map((med) => (
                      <tr
                        key={med.medicineId}
                        className={`hover:bg-muted/30 transition-colors ${
                          med.stock < 10 ? "bg-destructive/5" : ""
                        }`}
                      >
                        <td className="font-semibold text-foreground">
                          {med.name}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {med.source && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                {med.source}
                              </span>
                            )}
                            {med.isHighRisk && (
                              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                                High-risk
                              </span>
                            )}
                            {med.isControlled && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                Controlled
                              </span>
                            )}
                            {med.isDiscontinued && (
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                                Discontinued
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-foreground/80">{med.code || "—"}</td>
                        <td className="text-foreground/80">{med.manufacturer || "—"}</td>
                        <td className="text-foreground/80">{med.route || "—"}</td>
                        <td className={med.stock < 10 ? "text-destructive font-semibold" : "text-foreground/80"}>
                          {med.stock}
                        </td>
                        <td className="text-foreground/80">{currency(med.price)}</td>
                        <td>
                          <div className="flex justify-center items-center gap-1">
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
                            <button
                              onClick={() => openAlternativesManager(med)}
                              className="ml-1 px-2 py-1 text-xs font-semibold rounded-md border border-border text-foreground/80 hover:bg-muted cursor-pointer"
                              title="Manage alternative medicines"
                            >
                              Alternatives
                            </button>
                            <button
                              onClick={() => toggleHighRisk(med)}
                              className={`px-2 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                                med.isHighRisk
                                  ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                                  : "border-border text-foreground/80 hover:bg-muted"
                              }`}
                              title="Toggle high-risk (requires witnessed administration)"
                            >
                              {med.isHighRisk ? "Unflag" : "High-risk"}
                            </button>
                            <button
                              onClick={() => openEditMedModal(med)}
                              title="Edit medicine"
                              className="p-1.5 hover:bg-primary/10 rounded-full text-primary cursor-pointer"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => removeMedicineEntry(med)}
                              title="Delete medicine"
                              className="p-1.5 hover:bg-destructive/10 rounded-full text-destructive cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        {invDebouncedSearch ? (
                          <EmptyState
                            illustration="search"
                            title="No matching medicines"
                            description={`Nothing in stock matches "${invDebouncedSearch}".`}
                          />
                        ) : (
                          <EmptyState
                            illustration="pharmacy"
                            title="No medicines found"
                            description="Medicines added to inventory will be listed here."
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                {invTotalCount === 0
                  ? "0 results"
                  : `Showing ${(invPage - 1) * INV_PAGE_SIZE + 1}–${Math.min(invPage * INV_PAGE_SIZE, invTotalCount)} of ${invTotalCount}`}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setInvPage((p) => Math.max(1, p - 1))}
                  disabled={invPage <= 1 || invLoading}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span>
                  Page {invPage} of {invTotalPages}
                </span>
                <button
                  onClick={() => setInvPage((p) => Math.min(invTotalPages, p + 1))}
                  disabled={invPage >= invTotalPages || invLoading}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
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
            <h2 className="text-2xl font-semibold mb-1 text-foreground">{editingPrescriptionId ? "Correct Prescription" : "New Prescription"}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {editingPrescriptionId ? "Correcting a pending prescription before it's dispensed." : "Log a new prescription to be dispensed for a patient."}
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
                  placeholder="Search by name, phone or MRN..."
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
                          {p.opNumber || p.opId} • {p.phone}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90">Prescribing Doctor</label>
                <div className="mt-1">
                  <SearchableSelect
                    value={selectedDoctorId}
                    onChange={setSelectedDoctorId}
                    options={[
                      { value: "", label: "Not specified" },
                      ...doctors.map((d) => ({ value: d.doctorId, label: `${d.name} — ${d.specializationName}` })),
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90 required">Medicines</label>
                <div className="flex flex-col gap-2 mt-1">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          value={item.medicineId}
                          onChange={(v) => updateItem(index, "medicineId", v)}
                          options={[
                            { value: "", label: "Select medicine" },
                            ...medicines.map((m) => ({ value: m.medicineId, label: `${m.name} (${m.stock} in stock)` })),
                          ]}
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        required
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        className="w-20 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm"
                      />
                      <div className="w-28">
                        <SearchableSelect
                          value={item.priority}
                          onChange={(v) => updateItem(index, "priority", v)}
                          options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                        />
                      </div>
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
                  {isSubmittingRx ? "Saving..." : editingPrescriptionId ? "Save Correction" : "Create Prescription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">{editingMedicineId ? "Edit Medicine" : "Add Medicine"}</h2>
            <p className="text-sm text-muted-foreground mb-6">{editingMedicineId ? "Correct this medicine's catalog details." : "Add a new medicine to the inventory."}</p>

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
              <div className="flex gap-4">
                <div className="w-full">
                  <label className="text-sm font-bold text-foreground/90">Generic Name</label>
                  <input
                    type="text"
                    value={medGenericName}
                    onChange={(e) => setMedGenericName(e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="w-full">
                  <label className="text-sm font-bold text-foreground/90">Dosage Form</label>
                  <input
                    type="text"
                    placeholder="Tablet, Syrup, Injection..."
                    value={medDosageForm}
                    onChange={(e) => setMedDosageForm(e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-foreground/90">Ingredient [Strength]</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg"
                  value={medIngredient}
                  onChange={(e) => setMedIngredient(e.target.value)}
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
                  <label className="text-sm font-bold text-foreground/90">Code</label>
                  <input
                    type="text"
                    placeholder="Catalog code"
                    value={medCode}
                    onChange={(e) => setMedCode(e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="w-full">
                  <label className="text-sm font-bold text-foreground/90">Route</label>
                  <input
                    type="text"
                    placeholder="Oral, IV, Topical..."
                    value={medRoute}
                    onChange={(e) => setMedRoute(e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-foreground/90">Manufacturer</label>
                <input
                  type="text"
                  value={medManufacturer}
                  onChange={(e) => setMedManufacturer(e.target.value)}
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
                <label className="text-sm font-bold text-foreground/90">Expiry Date</label>
                <DatePicker
                  value={medExpiry}
                  onChange={(v) => setMedExpiry(v)}
                  className="flex w-full items-center justify-between gap-2 mt-1 p-3 rounded-lg border border-border bg-muted text-left text-foreground outline-none transition-all focus-visible:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank until a real batch has been stocked.</p>
              </div>

              <label className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <input type="checkbox" checked={medIsHighRisk} onChange={(e) => setMedIsHighRisk(e.target.checked)} />
                High-risk medication — requires a second nurse to witness administration
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-foreground">
                <input type="checkbox" checked={medIsControlled} onChange={(e) => setMedIsControlled(e.target.checked)} />
                Controlled substance
              </label>

              <div className="flex items-center justify-end gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={closeMedModal}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMed}
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
                >
                  {isSubmittingMed ? "Saving..." : editingMedicineId ? "Save Changes" : "Save Medicine"}
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
                <div>
                  <SearchableSelect
                    value={collectorUserId}
                    onChange={setCollectorUserId}
                    options={[
                      { value: "", label: "Select nurse" },
                      ...nurses.map((n) => ({ value: n.id, label: n.name })),
                    ]}
                  />
                </div>
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

      {medDispenseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Dispense medicine</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {medDispenseTarget.drugName} — {medDispenseTarget.patientName}
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm font-bold text-foreground/90">Who is collecting?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={medCollectedBy === "Patient"} onChange={() => setMedCollectedBy("Patient")} />
                  Patient
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={medCollectedBy === "Nurse"} onChange={() => setMedCollectedBy("Nurse")} />
                  Nurse
                </label>
              </div>
              {medCollectedBy === "Nurse" && (
                <div>
                  <SearchableSelect
                    value={medCollectorUserId}
                    onChange={setMedCollectorUserId}
                    options={[
                      { value: "", label: "Select nurse" },
                      ...nurses.map((n) => ({ value: n.id, label: n.name })),
                    ]}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 w-full">
              <button
                type="button"
                onClick={closeMedDispenseModal}
                className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMedDispense}
                disabled={isDispensingMed}
                className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
              >
                {isDispensingMed ? "Dispensing..." : "Confirm Dispense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {printGroup && (
        <PrescriptionPrintout
          patientName={printGroup.patientName}
          patientNumber={printGroup.patientNumber}
          doctorName={printGroup.doctorName}
          visitDate={new Date().toLocaleDateString()}
          medicines={printGroup.items.map(toPrintLine)}
          preparedByName={printGroup.items.find((i) => i.preparedByName)?.preparedByName}
          dispensedByName={printGroup.items.find((i) => i.dispensedByName)?.dispensedByName}
          showPricing
          onClose={() => setPrintGroup(null)}
        />
      )}

      {labelTarget && (
        <DispenseLabelPrintout
          patientName={labelTarget.patientName}
          drugName={labelTarget.drugName}
          drugType={labelTarget.drugType}
          dosage={labelTarget.dosage}
          dosageUnit={labelTarget.dosageUnit}
          frequency={labelTarget.frequency}
          instructions={labelTarget.instructions}
          dispensedDate={labelTarget.dispensedAt ? formatDate(labelTarget.dispensedAt) : new Date().toLocaleDateString()}
          onClose={() => setLabelTarget(null)}
        />
      )}

      {alternativesTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Alternatives for {alternativesTarget.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Substitute medicines a pharmacist can offer if this one is out of stock.
            </p>

            {loadingAlternatives ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                <ul className="flex flex-col gap-2 max-h-52 overflow-y-auto mb-4">
                  {alternativesList.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No alternatives linked yet.</li>
                  ) : (
                    alternativesList.map((alt) => (
                      <li
                        key={alt.medicineId}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">
                          {alt.name} <span className="text-muted-foreground">({alt.stock} in stock, {currency(alt.price)})</span>
                        </span>
                        <button
                          onClick={() => handleRemoveAlternative(alt.medicineId)}
                          className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </li>
                    ))
                  )}
                </ul>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      value={addAlternativeId}
                      onChange={setAddAlternativeId}
                      options={[
                        { value: "", label: "Select a medicine to link..." },
                        ...medicines
                          .filter(
                            (m) =>
                              m.medicineId !== alternativesTarget.medicineId &&
                              !alternativesList.some((a) => a.medicineId === m.medicineId)
                          )
                          .map((m) => ({ value: m.medicineId, label: m.name })),
                      ]}
                    />
                  </div>
                  <button
                    onClick={handleAddAlternative}
                    disabled={!addAlternativeId || savingAlternative}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              </>
            )}

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={closeAlternativesManager}
                className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
