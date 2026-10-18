"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import EmptyState from "@/components/EmptyState";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { MdPayment, MdAdd } from "react-icons/md";
import HintTooltip from "@/components/HintTooltip";
import { notifySaveStatus } from "@/lib/saveStatus";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BillingService } from "@/services/billing.service";
import { ReceptionService } from "@/services/reception.service";
import SearchableSelect from "@/components/SearchableSelect";
import { AwaitingBillingItemType, BillingSummaryType, BillType, ChargeableItemType, WalkInAwaitingType } from "@/types/billing.type";
import { PatientListItemType } from "@/types/appointment.type";
import { PatientSummaryType } from "@/types/patient.type";
import PatientPicker from "@/components/patients/PatientPicker";
import PatientStreamTabs, { type PatientStream } from "@/components/patients/PatientStreamTabs";
import { WalkInPatientBadge } from "@/components/patients/PatientBadges";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import { formatCurrency } from "@/lib/currency";
import SearchIcon from "@/public/icons/SearchIcon";
import DatePicker from "@/components/DatePicker";
import { toDateInputValue } from "@/lib/date";
import Link from "next/link";
import { FileBarChart, Printer, X } from "lucide-react";
import BillPrintout from "@/components/billing/BillPrintout";
import BillLines, { AddBillLineForm } from "@/components/billing/BillLines";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

const currency = (value: number) => formatCurrency(value);
// " (10%)" next to Discount/Tax - empty for older flat-amount bills, which have no percent.
// " (incl. 10% bill discount)" next to the Discount total - the total also includes any
// per-line discounts, so the bill-level percentage alone would mislead. Empty when none.
const billDiscountNote = (percent: number | null) => (percent != null && percent > 0 ? ` (incl. ${percent}% bill discount)` : "");

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "Paid":
      return "bg-emerald-500/10 text-emerald-500";
    case "Cancelled":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-amber-500/10 text-amber-500";
  }
};

function BillingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitIdParam = searchParams.get("visitId") || "";
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [summary, setSummary] = useState<BillingSummaryType | null>(null);
  const [bills, setBills] = useState<BillType[]>([]);
  const [filter, setFilter] = useState<"awaiting" | "pending" | "all">("awaiting");
  const [billSearch, setBillSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));

  const [awaitingItems, setAwaitingItems] = useState<AwaitingBillingItemType[]>([]);
  const [isOpeningVisit, setIsOpeningVisit] = useState<string | null>(null);
  // Awaiting Billing has two lists: visits from a consultation here, and walk-ins whose
  // outside prescription / lab / radiology orders aren't on a bill yet.
  const [awaitingStream, setAwaitingStream] = useState<PatientStream>("consultation");
  const [walkInAwaiting, setWalkInAwaiting] = useState<WalkInAwaitingType[]>([]);
  const [isOpeningWalkIn, setIsOpeningWalkIn] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientListItemType[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummaryType | null>(null);
  const [appointmentId, setAppointmentId] = useState("");
  const [visitId, setVisitId] = useState(visitIdParam);
  // Kept as the raw text typed so the fields can be cleared (a number state snaps an
  // emptied box straight back to 0); parsed on submit, where empty means 0%.
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");

  const [detailBill, setDetailBill] = useState<BillType | null>(null);
  // Set by a bill card's Print button: renders that bill's print sheet, then the effect
  // below opens the print dialog once it's on the page, and clears it when printing ends.
  const [printBill, setPrintBill] = useState<BillType | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BillType | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!printBill) return;
    const clear = () => setPrintBill(null);
    window.addEventListener("afterprint", clear);
    // Wait a frame so the sheet is actually rendered before the dialog snapshots the page.
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", clear);
    };
  }, [printBill]);
  const [payMethod, setPayMethod] = useState("Cash");
  const [isPaying, setIsPaying] = useState(false);

  const [chargeableItems, setChargeableItems] = useState<ChargeableItemType[]>([]);
  const [isLoadingChargeable, setIsLoadingChargeable] = useState(false);
  const [addingSourceId, setAddingSourceId] = useState<string | null>(null);
  const [isAddingAll, setIsAddingAll] = useState(false);

  // The signed-in user's personal billing discount limit (set by admin in User Management).
  // Null means no personal cap.
  const [userDiscountPercent, setUserDiscountPercent] = useState<number | null>(null);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    const allowedModules: string[] = detail.allowedModules || [];
    if (currentRole !== "admin" && !allowedModules.includes("/billing")) {
      router.replace("/");
      return;
    }
    setUserDiscountPercent(detail.userDiscountPercent ?? null);
    setCheckedAuth(true);
  }, [router]);

  // ---------------- DATA ----------------
  const fetchAwaiting = async () => {
    try {
      const res = await BillingService.getAwaiting();
      setAwaitingItems(res.data ?? []);
    } catch (error) {
      console.error("Failed to load awaiting visits:", error);
    }
  };

  const fetchWalkInAwaiting = async () => {
    try {
      const res = await BillingService.getWalkInAwaiting();
      setWalkInAwaiting(res.data ?? []);
    } catch (error) {
      console.error("Failed to load walk-in patients awaiting billing:", error);
    }
  };

  // The stat cards are page-wide, not per-tab - loaded on mount (below) so they show on the
  // default Awaiting Billing tab too, and refreshed again by every fetchAll.
  const fetchSummary = async () => {
    try {
      const res = await BillingService.getSummary();
      setSummary(res.data ?? null);
    } catch (error) {
      console.error("Failed to load billing summary:", error);
    }
  };

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [, listRes] = await Promise.all([
        fetchSummary(),
        filter === "pending" ? BillingService.getPending(selectedDate || undefined) : BillingService.getAll(selectedDate || undefined),
      ]);
      setBills(listRes.data ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load bills"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAwaiting();
    fetchWalkInAwaiting();
    fetchSummary();
  }, [checkedAuth]);

  useEffect(() => {
    if (!checkedAuth || filter === "awaiting") return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, filter, selectedDate]);

  useSignalRRefetch(["visitStatusUpdated"], fetchAwaiting);

  useSignalRRefetch(["billCreated", "billPaid", "billCancelled", "billItemAdded"], fetchAll);

  // Walk-in orders are billable the moment a department raises them, so the list follows
  // every create/correct/remove in Pharmacy, Lab and Radiology live.
  useSignalRRefetch(
    [
      "labRequestCreated", "labRequestUpdated", "labRequestRemoved", "labStatusUpdated",
      "radiologyRequestCreated", "radiologyRequestUpdated", "radiologyRequestRemoved", "radiologyStatusUpdated",
      "prescriptionCreated", "prescriptionUpdated", "prescriptionRemoved", "prescriptionDispensed",
      "billCreated", "billItemAdded", "billPaid", "billCancelled", "patientRegistered", "PatientUpdated",
    ],
    fetchWalkInAwaiting
  );

  const fetchPatients = async () => {
    try {
      const data = await ReceptionService.getAllPatients();
      setPatients(data.patients ?? []);
    } catch (error) {
      console.error("Failed to load patients:", error);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchPatients();
  }, [checkedAuth]);

  useSignalRRefetch(["patientRegistered", "PatientUpdated", "patientSoftDeleted"], fetchPatients);

  // Front-desk lookup over the bill list: a bill only carries patientId/patientName, so
  // phone and MRN come from the patient list loaded above.
  const filteredBills = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    if (!q) return bills;
    const patientsById = new Map(patients.map((p) => [p.opId, p]));
    return bills.filter((bill) => {
      const patient = bill.patientId ? patientsById.get(bill.patientId) : undefined;
      return !!(
        bill.patientName?.toLowerCase().includes(q) ||
        patient?.phone?.toLowerCase().includes(q) ||
        patient?.opNumber?.toLowerCase().includes(q)
      );
    });
  }, [billSearch, bills, patients]);

  // Keep the detail pop-up in sync whenever the bill LIST refreshes - only on `bills`
  // changing, never on detailBill itself. Running on detailBill too meant that right after
  // Mark as Paid set the pop-up to the paid bill, this copied the list's still-stale
  // Pending copy straight back over it, so the button reappeared. Also never lets a list
  // copy turn a settled (Paid/Cancelled) bill back into Pending, in case a refresh that
  // started before the payment lands after it.
  useEffect(() => {
    setDetailBill((current) => {
      if (!current) return current;
      const fresh = bills.find((b) => b.billId === current.billId);
      if (!fresh) return current;
      if (current.status !== "Pending" && fresh.status === "Pending") return current;
      return fresh;
    });
  }, [bills]);

  // Items not yet billed: a visit bill pulls the visit's dispensed/completed orders; a bill
  // with no visit pulls the patient's walk-in (external service) orders.
  const fetchChargeableItems = async (bill: Pick<BillType, "visitId" | "patientId">) => {
    try {
      setIsLoadingChargeable(true);
      const data = bill.visitId
        ? await BillingService.getChargeableItems(bill.visitId)
        : bill.patientId
          ? await BillingService.getWalkInItems(bill.patientId)
          : { data: [] };
      setChargeableItems(data.data ?? []);
    } catch (error) {
      console.error("Failed to load chargeable items:", error);
      setChargeableItems([]);
    } finally {
      setIsLoadingChargeable(false);
    }
  };

  useEffect(() => {
    if (detailBill && (detailBill.visitId || detailBill.patientId)) {
      fetchChargeableItems(detailBill);
    } else {
      setChargeableItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailBill?.billId, detailBill?.visitId, detailBill?.patientId]);

  // Doctor's orders become chargeable as the departments finish them - dispensed, completed,
  // given by nursing (injections/infusions) or done (procedures) - and walk-in orders as soon
  // as they're raised.
  useSignalRRefetch(
    [
      "prescriptionDispensed", "prescriptionCreated", "prescriptionUpdated", "prescriptionRemoved",
      "labStatusUpdated", "labRequestCreated", "labRequestUpdated", "labRequestRemoved",
      "radiologyStatusUpdated", "radiologyRequestCreated", "radiologyRequestUpdated", "radiologyRequestRemoved",
      "medicationDispensed", "medicationAdministered", "medicationAdministrationCancelled",
      "treatmentMarkedDone", "treatmentReverted", "treatmentUpdated", "treatmentRemoved",
    ],
    () => {
      if (detailBill && detailBill.status === "Pending") fetchChargeableItems(detailBill);
    }
  );

  const handleAddFromSource = async (item: ChargeableItemType) => {
    if (!detailBill) return;
    try {
      setAddingSourceId(item.sourceId);
      const data = await BillingService.addItemFromSource({
        billId: detailBill.billId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
      });
      toast.success(data.message || "Item added to bill");
      setDetailBill(data.data);
      fetchAll();
      await fetchChargeableItems(detailBill);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add item"));
    } finally {
      setAddingSourceId(null);
    }
  };

  // Walk-ins usually settle everything at once - one click instead of one per item.
  const handleAddAllFromSource = async () => {
    if (!detailBill || chargeableItems.length === 0) return;
    setIsAddingAll(true);
    let latest: BillType | null = null;
    let added = 0;
    try {
      for (const item of chargeableItems) {
        const data = await BillingService.addItemFromSource({
          billId: detailBill.billId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        });
        latest = data.data;
        added++;
      }
      toast.success(`${added} item${added === 1 ? "" : "s"} added to the bill`);
    } catch (error) {
      toast.error(errorMessage(error, added > 0 ? `Added ${added}, then failed` : "Failed to add items"));
    } finally {
      if (latest) setDetailBill(latest);
      fetchAll();
      await fetchChargeableItems(detailBill);
      setIsAddingAll(false);
    }
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setAppointmentId("");
    setVisitId(visitIdParam);
    setDiscount("");
    setTax("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.warning("Please select a patient");
      return;
    }

    // Both are percentages now - checkable up front, no total needed (the API re-checks).
    const discountPercent = Number(discount) || 0;
    const taxPercent = Number(tax) || 0;
    if (discountPercent < 0 || discountPercent > 100 || taxPercent < 0 || taxPercent > 100) {
      toast.error("Discount and tax must be between 0 and 100%");
      return;
    }
    if (userDiscountPercent !== null && discountPercent > userDiscountPercent) {
      toast.error(`You have only ${userDiscountPercent}% billing discount privilege.`);
      return;
    }

    notifySaveStatus("saving");
    try {
      setIsSubmitting(true);
      const data = await BillingService.create({
        patientId: selectedPatient.opId,
        appointmentId: appointmentId || undefined,
        visitId: visitId || undefined,
        discountPercent,
        taxPercent,
      });
      toast.success(data.message || "Bill created");
      notifySaveStatus("saved");
      closeModal();
      fetchAll();
      setDetailBill(data.data);
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to create bill"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // BillLines added, adjusted or removed a line. Removing a medicine/test line frees it to be
  // billed again, so the visit's chargeable list is refreshed too.
  const handleBillLinesUpdated = (bill: BillType) => {
    setDetailBill(bill);
    fetchAll();
    fetchChargeableItems(bill);
  };

  const handlePay = async () => {
    if (!detailBill) return;
    notifySaveStatus("saving");
    try {
      setIsPaying(true);
      const data = await BillingService.pay(detailBill.billId, payMethod);
      toast.success(data.message || "Payment recorded");
      notifySaveStatus("saved");
      setDetailBill(data.data);
      fetchAll();
    } catch (error) {
      notifySaveStatus("error");
      toast.error(errorMessage(error, "Failed to record payment"));
    } finally {
      setIsPaying(false);
    }
  };

  // Opens the walk-in patient's pending bill (or starts one) with their unbilled services
  // listed alongside, ready to add.
  const handleOpenWalkIn = async (patientId: string) => {
    try {
      setIsOpeningWalkIn(patientId);
      const res = await BillingService.openWalkInBill(patientId);
      setDetailBill(res.data);
      fetchWalkInAwaiting();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to open bill"));
    } finally {
      setIsOpeningWalkIn(null);
    }
  };

  const handleOpenVisit = async (visitId: string) => {
    try {
      setIsOpeningVisit(visitId);
      const res = await BillingService.openVisitBill(visitId);
      setDetailBill(res.data);
      fetchAwaiting();
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to open bill"));
    } finally {
      setIsOpeningVisit(null);
    }
  };

  // Opens the cancel dialog - a reason is required (the API rejects a cancel without one),
  // so a toast's one-click confirm isn't enough any more.
  const handleCancelBill = (bill: BillType) => {
    setCancelTarget(bill);
    setCancelReason("");
  };

  const confirmCancelBill = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      setIsCancelling(true);
      const data = await BillingService.cancel(cancelTarget.billId, cancelReason.trim());
      toast.success(data.message || "Bill cancelled");
      if (detailBill?.billId === cancelTarget.billId) setDetailBill(data.data);
      setCancelTarget(null);
      fetchAll();
      // A cancelled visit bill leaves the visit waiting for a fresh bill; a cancelled walk-in
      // bill puts the patient's services back on the walk-in list.
      if (cancelTarget.visitId) fetchAwaiting();
      else fetchWalkInAwaiting();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to cancel bill"));
    } finally {
      setIsCancelling(false);
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
            <MdPayment size={34} className="text-primary" />
            Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            Create patient bills, itemize charges, and record payments.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/billing/reports"
            className="px-4 py-2 rounded-md border border-border text-foreground text-lg flex gap-2 items-center hover:bg-muted transition duration-150"
          >
            <FileBarChart size={20} />
            Reports
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150"
          >
            <MdAdd size={22} />
            New Bill
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <BillingStatCard label="Pending Bills" hint="Number of invoices that have been created but not yet paid by the patient.">
          <p className="text-3xl font-bold text-foreground mt-1">{summary?.pendingCount ?? "—"}</p>
        </BillingStatCard>
        <BillingStatCard label="Pending Amount" hint="Total outstanding balance across all unpaid bills. This is the amount still owed to the clinic.">
          <p className="text-3xl font-bold text-destructive mt-1">{summary ? currency(summary.pendingAmount) : "—"}</p>
        </BillingStatCard>
        <BillingStatCard label="Paid Today" hint="Number of bills that were fully settled today, regardless of when they were originally created.">
          <p className="text-3xl font-bold text-emerald-500 mt-1">{summary?.paidToday ?? "—"}</p>
        </BillingStatCard>
        <BillingStatCard label="Revenue Today" hint="Total amount collected from all payments received today, including partial and full payments.">
          <p className="text-3xl font-bold text-primary mt-1">{summary ? currency(summary.revenueToday) : "—"}</p>
        </BillingStatCard>
      </div>

      {/* Filter tabs + date picker + patient search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(["awaiting", "pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "awaiting" ? (
              <span className="flex items-center gap-1.5">
                Awaiting Billing
                {awaitingItems.length + walkInAwaiting.length > 0 && (
                  <span className="bg-white/20 text-inherit rounded-full px-1.5 py-0 text-xs font-bold leading-4">
                    {awaitingItems.length + walkInAwaiting.length}
                  </span>
                )}
              </span>
            ) : f === "pending" ? "Pending Bills" : "All Bills"}
          </button>
        ))}
        {filter !== "awaiting" && (
          <>
            <div className="w-48">
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                max={toDateInputValue(new Date())}
                placeholder="All dates"
                className="flex h-9 w-full items-center gap-2 overflow-hidden rounded-lg border border-border bg-(--color-highlight) px-3 py-1.5 text-sm text-foreground ring-offset-background transition-all focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              />
            </div>
            <div className="relative w-full sm:flex-1 sm:min-w-64 sm:max-w-xl sm:ml-auto">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <SearchIcon color="#555" />
              </span>
              <input
                type="text"
                autoComplete="off"
                placeholder="Search by patient name, phone or MRN..."
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}
      </div>

      {filter === "awaiting" && (
        <div className="mb-4">
          <PatientStreamTabs
            value={awaitingStream}
            onChange={setAwaitingStream}
            consultationCount={awaitingItems.length}
            walkInCount={walkInAwaiting.length}
          />
        </div>
      )}

      {filter === "awaiting" && awaitingStream === "walkIn" ? (
        walkInAwaiting.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {walkInAwaiting.map((item) => (
              <div key={item.patientId} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{item.patientName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      MRN {item.patientOPNumber || "—"}
                      {item.phone ? ` · ${item.phone}` : ""}
                    </p>
                  </div>
                  <WalkInPatientBadge registrationType={item.registrationType} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.departments.map((d) => (
                    <span key={d} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {item.itemCount} unbilled service{item.itemCount === 1 ? "" : "s"}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{currency(item.suggestedTotal)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.latestOrderAt)}</p>
                </div>
                <div className="pt-1 border-t border-border">
                  <button
                    onClick={() => handleOpenWalkIn(item.patientId)}
                    disabled={isOpeningWalkIn === item.patientId}
                    className="w-full py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isOpeningWalkIn === item.patientId ? "Opening..." : item.openBill ? "Manage Bill" : "Open Bill"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              illustration="billing"
              title="No walk-in patients awaiting billing"
              description="Outside prescriptions, lab and radiology requests raised for walk-ins show up here until they're billed."
            />
          </div>
        )
      ) : filter === "awaiting" ? (
        awaitingItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {awaitingItems.map((item) => (
              <div key={item.visitId} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground truncate">{item.patientName}</p>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {item.visitType === "WalkIn" ? "Walk-in" : "Appointment"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Checked in: {formatDateTime(item.checkedInAt)}</p>
                {item.bill && (
                  <p className="text-sm font-semibold text-foreground">{currency(item.bill.netAmount)}</p>
                )}
                <div className="pt-1 border-t border-border">
                  <button
                    onClick={() => handleOpenVisit(item.visitId)}
                    disabled={isOpeningVisit === item.visitId}
                    className="w-full py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isOpeningVisit === item.visitId ? "Opening..." : item.bill ? "Manage Bill" : "Open Bill"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              illustration="billing"
              title="No patients awaiting billing"
              description="Visits show up here once the doctor, lab and pharmacy steps are done."
            />
          </div>
        )
      ) : isLoading ? (
        <div className="py-16 flex justify-center"><LoadingSpinner /></div>
      ) : filteredBills.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBills.map((bill) => (
            <div key={bill.billId} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground truncate">{bill.patientName}</p>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(bill.status)}`}>
                  {bill.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-foreground">{currency(bill.netAmount)}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(bill.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <button
                  onClick={() => setDetailBill(bill)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  Manage
                </button>
                <button
                  onClick={() => setPrintBill(bill)}
                  title="Print bill"
                  className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <Printer size={13} /> Print
                </button>
                {bill.status === "Pending" && (
                  <button
                    onClick={() => handleCancelBill(bill)}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          {billSearch.trim() ? (
            <EmptyState
              illustration="billing"
              title={`No bills match "${billSearch.trim()}"`}
              description="Try a different patient name."
              action={{ label: "Clear search", onClick: () => setBillSearch("") }}
            />
          ) : (
            <EmptyState
              illustration="billing"
              title={filter === "pending" ? "No pending bills" : "No bills found"}
              description={
                selectedDate
                  ? "Nothing was billed on this date. Pick another day or show all dates."
                  : filter === "pending"
                    ? "Every bill has been paid or cancelled."
                    : "Bills you create will appear here."
              }
              action={selectedDate ? { label: "Show all dates", onClick: () => setSelectedDate("") } : undefined}
            />
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">New Bill</h2>
            <p className="text-sm text-muted-foreground mb-6">Start a new bill for a patient.</p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <PatientPicker value={selectedPatient} onChange={setSelectedPatient} required />

              <div>
                <label className="text-sm font-bold text-foreground/90">Appointment ID (optional)</label>
                <input
                  type="text"
                  value={appointmentId}
                  onChange={(e) => setAppointmentId(e.target.value)}
                  placeholder="e.g. APT-xxxxxxxx"
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-foreground/90">Visit ID (optional)</label>
                <input
                  type="text"
                  value={visitId}
                  onChange={(e) => setVisitId(e.target.value)}
                  placeholder="e.g. VIS-xxxxxxxx"
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Linking a visit lets you pull dispensed medicines, labs, and scans into this bill.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-foreground/90">Discount (%)</label>
                    {userDiscountPercent !== null && (
                      <span className="text-xs text-muted-foreground">Your limit: {userDiscountPercent}%</span>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={0}
                      max={userDiscountPercent ?? 100}
                      step={0.01}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full p-3 pr-9 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="w-full">
                  <label className="text-sm font-bold text-foreground/90">Default tax (%)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={tax}
                      onChange={(e) => setTax(e.target.value)}
                      placeholder="0"
                      className="w-full p-3 pr-9 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                Discount applies to every line on this bill. Default tax is pre-filled on each line and can be changed per line; it is always charged on the discounted amount.
              </p>

              <div className="flex items-center justify-end gap-3 mt-2 w-full">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground w-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-md bg-primary text-white hover:opacity-90 transition-all duration-200 cursor-pointer w-full disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailBill && (
        // Bill window. Pending bills: two panels - add items on the left, the bill on the
        // right. Paid/cancelled bills have nothing to add, so it's the bill alone, narrower.
        // Each panel scrolls on its own; totals + payment stay pinned at the bottom right.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4">
          <div
            className={`flex h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl ${
              detailBill.status === "Pending" ? "max-w-6xl" : "max-w-3xl"
            }`}
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="truncate text-2xl font-semibold text-foreground">{detailBill.patientName}</h2>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-sm font-semibold ${statusBadgeClass(detailBill.status)}`}>
                    {detailBill.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Bill #{detailBill.billId} · {formatDateTime(detailBill.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setDetailBill(null)}
                title="Close"
                className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div
              className={`grid min-h-0 flex-1 grid-cols-1 ${
                detailBill.status === "Pending" ? "lg:grid-cols-[400px_1fr]" : ""
              }`}
            >
              {/* ---- Left: add items (pending bills only) ---- */}
              {detailBill.status === "Pending" && (
                <div className="min-h-0 overflow-y-auto border-b border-border p-5 lg:border-b-0 lg:border-r bg-muted/20">
                  {(detailBill.visitId || detailBill.patientId) && (
                    <div className="mb-5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-foreground/90">
                          {detailBill.visitId ? "Chargeable Items" : "Walk-in services not yet billed"}
                        </p>
                        {chargeableItems.length > 1 && (
                          <button
                            onClick={handleAddAllFromSource}
                            disabled={isAddingAll || addingSourceId != null}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {isAddingAll ? "Adding..." : "Add all"}
                          </button>
                        )}
                      </div>
                      {isLoadingChargeable ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      ) : chargeableItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {detailBill.visitId
                            ? "Nothing dispensed or completed for this visit yet."
                            : "No unbilled walk-in prescriptions, lab or radiology requests for this patient."}
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {chargeableItems.map((item) => (
                            <div
                              key={`${item.sourceType}-${item.sourceId}`}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">{item.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {currency(item.suggestedAmount)}
                                  {!detailBill.visitId && item.status ? ` · ${item.status}` : ""}
                                </p>
                              </div>
                              <button
                                onClick={() => handleAddFromSource(item)}
                                disabled={addingSourceId === item.sourceId || isAddingAll}
                                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
                              >
                                {addingSourceId === item.sourceId ? "Adding..." : "Add to bill"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* keyed by bill so it starts fresh with this bill's default tax */}
                  <AddBillLineForm key={detailBill.billId} bill={detailBill} onBillUpdated={handleBillLinesUpdated} />
                </div>
              )}

              {/* ---- Right: the bill ---- */}
              <div className="flex min-h-0 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {detailBill.status === "Cancelled" && detailBill.cancelReason && (
                    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                      <p className="font-semibold text-destructive">
                        Cancelled{detailBill.cancelledAt ? ` on ${formatDateTime(detailBill.cancelledAt)}` : ""}
                      </p>
                      <p className="mt-0.5 text-foreground/90 whitespace-pre-wrap break-words">{detailBill.cancelReason}</p>
                    </div>
                  )}

                  <BillLines bill={detailBill} onBillUpdated={handleBillLinesUpdated} />
                </div>

                {/* Pinned footer: totals, payment, print */}
                <div className="shrink-0 border-t border-border bg-card px-5 py-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-foreground/70">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{currency(detailBill.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-foreground/70">
                      <span>Discount{billDiscountNote(detailBill.discountPercent)}</span>
                      <span className="tabular-nums">-{currency(detailBill.discount)}</span>
                    </div>
                    <div className="flex justify-between text-foreground/70">
                      <span>Tax</span>
                      <span className="tabular-nums">+{currency(detailBill.tax)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1.5 text-lg font-bold text-foreground">
                      <span>Net Amount</span>
                      <span className="tabular-nums">{currency(detailBill.netAmount)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {detailBill.status === "Pending" && (
                      <>
                        <div className="min-w-40 flex-1">
                          <SearchableSelect
                            value={payMethod}
                            onChange={setPayMethod}
                            options={[
                              { value: "Cash", label: "Cash" },
                              { value: "Card", label: "Card" },
                              { value: "Insurance", label: "Insurance" },
                            ]}
                          />
                        </div>
                        <button
                          onClick={handlePay}
                          disabled={isPaying || !detailBill.items.some((i) => !i.isRemoved)}
                          className="shrink-0 whitespace-nowrap px-6 py-2.5 rounded-lg bg-primary text-white font-semibold hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {isPaying ? "Processing..." : "Mark as Paid"}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => window.print()}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
                        detailBill.status === "Pending"
                          ? "border border-border text-foreground hover:bg-muted"
                          : "flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      <Printer size={16} /> Print
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outside the modal on purpose - see BillPrintout's comment on backdrop-blur. */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Cancel bill</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {cancelTarget.patientName} · Bill #{cancelTarget.billId} · {currency(cancelTarget.netAmount)}
            </p>
            <label className="mt-4 block text-sm font-bold text-foreground/90">Reason</label>
            <textarea
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Why is this bill being cancelled?"
              className="mt-1 w-full resize-none rounded-lg border border-border bg-muted p-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Kept on the bill. {cancelTarget.visitId ? "The visit will go back to Awaiting Billing for a new bill." : ""}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
                className="flex-1 rounded-md border border-border px-5 py-2.5 text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Keep bill
              </button>
              <button
                onClick={confirmCancelBill}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 rounded-md bg-destructive px-5 py-2.5 font-semibold text-white hover:opacity-90 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Cancel bill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The card's Print button wins over an open pop-up; only one sheet ever renders. */}
      {(printBill ?? detailBill) && <BillPrintout bill={(printBill ?? detailBill)!} />}
    </div>
  );
}

function BillingStatCard({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <HintTooltip text={hint} />
      </div>
      {children}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    }>
      <BillingPageInner />
    </Suspense>
  );
}
