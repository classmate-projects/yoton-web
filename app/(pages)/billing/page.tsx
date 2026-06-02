"use client";

import { useState } from "react";
import { MdPayment, MdSearch, MdAdd } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Bill {
  id: number;
  patientId: number;
  appointmentId: number;
  totalAmount: number;
  discount: number;
  tax: number;
  status: string;
  createdAt: string;
}

export default function BillingPage() {
  const [patientIdSearch, setPatientIdSearch] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);

  // New Bill Form
  const [patientId, setPatientId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);

  const handleSearchBills = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientIdSearch) return;

    try {
      setIsLoadingBills(true);
      const res = await fetch(`/api/billing/patient/${patientIdSearch}`);
      const data = await res.json();
      setBills(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch bills", error);
      setBills([]);
    } finally {
      setIsLoadingBills(false);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(patientId),
          appointmentId: Number(appointmentId),
          discount,
          tax,
        }),
      });

      if (res.ok) {
        alert("Bill created successfully!");
        setPatientId("");
        setAppointmentId("");
        setDiscount(0);
        setTax(0);
      } else {
        alert("Failed to create bill.");
      }
    } catch (error) {
      console.error("Error creating bill", error);
    }
  };

  return (
    <div className="py-8 px-10">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <MdPayment className="text-primary" /> Billing Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Create patient bills, manage payments, and view billing history.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create Bill Form */}
        <div className="card p-6 rounded-xl shadow-lg border-t border-border">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <MdAdd className="text-green-500" /> Create New Bill
          </h2>
          <hr className="border-border mb-6" />
          
          <form onSubmit={handleCreateBill} className="flex flex-col gap-5">
            <div className="flex gap-4">
              <div className="w-full">
                <label className="text-sm font-bold text-foreground/90">Patient ID</label>
                <input
                  type="number"
                  required
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
                />
              </div>
              <div className="w-full">
                <label className="text-sm font-bold text-foreground/90">Appointment ID</label>
                <input
                  type="number"
                  required
                  value={appointmentId}
                  onChange={(e) => setAppointmentId(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-full">
                <label className="text-sm font-bold text-foreground/90">Discount (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
                />
              </div>
              <div className="w-full">
                <label className="text-sm font-bold text-foreground/90">Tax (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="mt-4 bg-primary hover:opacity-90 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Generate Bill
            </button>
          </form>
        </div>

        {/* Search Bills */}
        <div className="card p-6 rounded-xl shadow-lg border-t border-border">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <MdSearch className="text-primary" /> Patient Billing History
          </h2>
          <hr className="border-border mb-6" />

          <form onSubmit={handleSearchBills} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="Enter Patient ID"
              value={patientIdSearch}
              onChange={(e) => setPatientIdSearch(e.target.value)}
              className="flex-1 p-3 rounded-lg bg-muted border border-border text-foreground"
            />
            <button 
              type="submit"
              className="bg-muted hover:bg-muted/80 text-foreground font-semibold py-3 px-6 rounded-lg transition-colors border border-border"
            >
              Search
            </button>
          </form>

          {isLoadingBills ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : bills.length > 0 ? (
            <div className="flex flex-col gap-4">
              {bills.map((bill) => (
                <div key={bill.id} className="p-4 border border-border rounded-lg bg-muted flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-lg text-foreground">Bill #{bill.id}</p>
                    <p className="text-sm text-muted-foreground">Appointment: {bill.appointmentId}</p>
                    <p className="text-sm text-muted-foreground">Date: {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : "Pending"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">${bill.totalAmount || "0.00"}</p>
                    <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${bill.status === "Paid" ? "bg-green-100/10 text-green-500" : "bg-orange-100/10 text-orange-500"}`}>
                      {bill.status || "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No bills found for this patient.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}