"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { MdPayment, MdAdd } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BillingService } from "@/services/billing.service";
import { ReceptionService } from "@/services/reception.service";
import { BillingSummaryType, BillType, ChargeableItemType } from "@/types/billing.type";
import { PatientListItemType } from "@/types/appointment.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—";

const currency = (value: number) => `$${value.toFixed(2)}`;

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
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [isLoading, setIsLoading] = useState(true);

  const [patients, setPatients] = useState<PatientListItemType[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientListItemType | null>(null);
  const [appointmentId, setAppointmentId] = useState("");
  const [visitId, setVisitId] = useState(visitIdParam);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);

  const [detailBill, setDetailBill] = useState<BillType | null>(null);
  const [itemDescription, setItemDescription] = useState("");
  const [itemAmount, setItemAmount] = useState<number>(0);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [payMethod, setPayMethod] = useState("Cash");
  const [isPaying, setIsPaying] = useState(false);

  const [chargeableItems, setChargeableItems] = useState<ChargeableItemType[]>([]);
  const [isLoadingChargeable, setIsLoadingChargeable] = useState(false);
  const [addingSourceId, setAddingSourceId] = useState<string | null>(null);

  // ---------------- ROLE GUARD ----------------
  useEffect(() => {
    const detail = JSON.parse(localStorage.getItem("yoton_user_detail") || "{}");
    const currentRole = (detail.role || "").toLowerCase();
    if (currentRole !== "billing team" && currentRole !== "admin") {
      router.replace("/");
      return;
    }
    setCheckedAuth(true);
  }, [router]);

  // ---------------- DATA ----------------
  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [summaryRes, listRes] = await Promise.all([
        BillingService.getSummary(),
        filter === "pending" ? BillingService.getPending() : BillingService.getAll(),
      ]);
      setSummary(summaryRes.data ?? null);
      setBills(listRes.data ?? []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load bills"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, filter]);

  useSignalRRefetch(["billCreated", "billPaid", "billCancelled", "billItemAdded"], fetchAll);

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

  // keep the detail drawer in sync whenever the bill list refreshes
  useEffect(() => {
    if (!detailBill) return;
    const fresh = bills.find((b) => b.billId === detailBill.billId);
    if (fresh) setDetailBill(fresh);
  }, [bills, detailBill]);

  // fetch dispensed/completed items not yet billed for this bill's visit
  const fetchChargeableItems = async (targetVisitId: string) => {
    try {
      setIsLoadingChargeable(true);
      const data = await BillingService.getChargeableItems(targetVisitId);
      setChargeableItems(data.data ?? []);
    } catch (error) {
      console.error("Failed to load chargeable items:", error);
      setChargeableItems([]);
    } finally {
      setIsLoadingChargeable(false);
    }
  };

  useEffect(() => {
    if (detailBill?.visitId) {
      fetchChargeableItems(detailBill.visitId);
    } else {
      setChargeableItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailBill?.billId, detailBill?.visitId]);

  useSignalRRefetch(["prescriptionDispensed", "labStatusUpdated", "radiologyStatusUpdated"], () => {
    if (detailBill?.visitId) fetchChargeableItems(detailBill.visitId);
  });

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
      if (detailBill.visitId) await fetchChargeableItems(detailBill.visitId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add item"));
    } finally {
      setAddingSourceId(null);
    }
  };

  const resetForm = () => {
    setPatientSearch("");
    setSelectedPatient(null);
    setAppointmentId("");
    setVisitId(visitIdParam);
    setDiscount(0);
    setTax(0);
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

    try {
      setIsSubmitting(true);
      const data = await BillingService.create({
        patientId: selectedPatient.opId,
        appointmentId: appointmentId || undefined,
        visitId: visitId || undefined,
        discount,
        tax,
      });
      toast.success(data.message || "Bill created");
      closeModal();
      fetchAll();
      setDetailBill(data.data);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create bill"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailBill || !itemDescription.trim() || itemAmount <= 0) {
      toast.warning("Please enter a description and amount");
      return;
    }

    try {
      setIsAddingItem(true);
      const data = await BillingService.addItem({
        billId: detailBill.billId,
        description: itemDescription,
        amount: itemAmount,
      });
      toast.success(data.message || "Item added");
      setItemDescription("");
      setItemAmount(0);
      setDetailBill(data.data);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add item"));
    } finally {
      setIsAddingItem(false);
    }
  };

  const handlePay = async () => {
    if (!detailBill) return;
    try {
      setIsPaying(true);
      const data = await BillingService.pay(detailBill.billId, payMethod);
      toast.success(data.message || "Payment recorded");
      setDetailBill(data.data);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to record payment"));
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancelBill = (bill: BillType) => {
    toast(
      <span>
        Cancel bill for <b className="text-red-500 ml-1">{bill.patientName}</b>?
      </span>,
      {
        action: {
          label: "Cancel Bill",
          onClick: async () => {
            try {
              const data = await BillingService.cancel(bill.billId);
              toast.success(data.message || "Bill cancelled");
              if (detailBill?.billId === bill.billId) setDetailBill(data.data);
              fetchAll();
            } catch (error) {
              toast.error(errorMessage(error, "Failed to cancel bill"));
            }
          },
        },
      }
    );
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
            <MdPayment size={34} className="text-primary" />
            Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            Create patient bills, itemize charges, and record payments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-primary px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:opacity-90 transition duration-150 shrink-0"
        >
          <MdAdd size={22} />
          New Bill
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Pending Bills</p>
          <p className="text-3xl font-bold text-foreground mt-1">{summary?.pendingCount ?? "—"}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Pending Amount</p>
          <p className="text-3xl font-bold text-destructive mt-1">
            {summary ? currency(summary.pendingAmount) : "—"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Paid Today</p>
          <p className="text-3xl font-bold text-emerald-500 mt-1">{summary?.paidToday ?? "—"}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted-foreground">Revenue Today</p>
          <p className="text-3xl font-bold text-primary mt-1">
            {summary ? currency(summary.revenueToday) : "—"}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
              filter === f ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "pending" ? "Pending Bills" : "All Bills"}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-foreground/90">Patient</th>
                <th className="text-foreground/90">Net Amount</th>
                <th className="text-foreground/90">Created</th>
                <th className="text-foreground/90">Status</th>
                <th className="text-center text-foreground/90">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : bills.length > 0 ? (
                bills.map((bill) => (
                  <tr key={bill.billId} className="hover:bg-muted/30 transition-colors">
                    <td className="font-semibold text-foreground">{bill.patientName}</td>
                    <td className="text-foreground font-semibold">{currency(bill.netAmount)}</td>
                    <td className="text-foreground/70 text-sm">{formatDateTime(bill.createdAt)}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(bill.status)}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => setDetailBill(bill)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          Manage
                        </button>
                        {bill.status === "Pending" && (
                          <button
                            onClick={() => handleCancelBill(bill)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    No bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-2xl font-semibold mb-1 text-foreground">New Bill</h2>
            <p className="text-sm text-muted-foreground mb-6">Start a new bill for a patient.</p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
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
                  <label className="text-sm font-bold text-foreground/90">Discount</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="w-full">
                  <label className="text-sm font-bold text-foreground/90">Tax</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={tax}
                    onChange={(e) => setTax(Number(e.target.value))}
                    className="w-full mt-1 p-3 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-lg rounded-xl border border-border p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-2xl font-semibold text-foreground">{detailBill.patientName}</h2>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(detailBill.status)}`}>
                {detailBill.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Bill #{detailBill.billId}</p>

            <div className="space-y-1 mb-4">
              {detailBill.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added yet.</p>
              ) : (
                detailBill.items.map((item) => (
                  <div key={item.billItemId} className="flex justify-between text-sm py-1 border-b border-border">
                    <span className="text-foreground/90">{item.description}</span>
                    <span className="text-foreground font-medium">{currency(item.amount)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1 text-sm mb-6">
              <div className="flex justify-between text-foreground/70">
                <span>Subtotal</span>
                <span>{currency(detailBill.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-foreground/70">
                <span>Discount</span>
                <span>-{currency(detailBill.discount)}</span>
              </div>
              <div className="flex justify-between text-foreground/70">
                <span>Tax</span>
                <span>+{currency(detailBill.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-foreground pt-1 border-t border-border">
                <span>Net Amount</span>
                <span>{currency(detailBill.netAmount)}</span>
              </div>
            </div>

            {detailBill.status === "Pending" && detailBill.visitId && (
              <div className="mb-6">
                <p className="text-sm font-bold text-foreground/90 mb-2">Chargeable Items</p>
                {isLoadingChargeable ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : chargeableItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing dispensed or completed for this visit yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {chargeableItems.map((item) => (
                      <div
                        key={`${item.sourceType}-${item.sourceId}`}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-foreground">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{currency(item.suggestedAmount)}</p>
                        </div>
                        <button
                          onClick={() => handleAddFromSource(item)}
                          disabled={addingSourceId === item.sourceId}
                          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {addingSourceId === item.sourceId ? "Adding..." : "Add to bill"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailBill.status === "Pending" && (
              <>
                <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
                  <input
                    type="text"
                    placeholder="Description"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    className="flex-1 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Amount"
                    value={itemAmount || ""}
                    onChange={(e) => setItemAmount(Number(e.target.value))}
                    className="w-28 p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isAddingItem}
                    className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-semibold cursor-pointer disabled:opacity-60"
                  >
                    Add
                  </button>
                </form>

                <div className="flex gap-2">
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="p-2.5 rounded-lg bg-muted border border-border outline-none focus:border-primary text-foreground text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Insurance">Insurance</option>
                  </select>
                  <button
                    onClick={handlePay}
                    disabled={isPaying || detailBill.items.length === 0}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:opacity-90 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isPaying ? "Processing..." : "Mark as Paid"}
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => setDetailBill(null)}
              className="w-full mt-4 px-5 py-2.5 rounded-md border border-border hover:bg-muted transition-all duration-200 cursor-pointer text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}
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
