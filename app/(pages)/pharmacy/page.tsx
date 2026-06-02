"use client";

import { useEffect, useState } from "react";
import { MdLocalPharmacy, MdWarning } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Medicine {
  id: number;
  name: string;
  category: string;
  stock: number;
  price: number;
  expiryDate: string;
}

export default function PharmacyPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [lowStock, setLowStock] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Medicine Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState("");

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [medsRes, lowStockRes] = await Promise.all([
        fetch("/api/pharmacy/medicine"),
        fetch("/api/pharmacy/medicine/low-stock")
      ]);

      const medsData = await medsRes.json();
      const lowStockData = await lowStockRes.json();

      setMedicines(Array.isArray(medsData) ? medsData : []);
      setLowStock(Array.isArray(lowStockData) ? lowStockData : []);
    } catch (error) {
      console.error("Failed to fetch pharmacy data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
    });
  }, []);

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/pharmacy/medicine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, stock, price, expiryDate }),
      });

      if (res.ok) {
        alert("Medicine added successfully");
        fetchData();
        // Reset form
        setName("");
        setCategory("");
        setStock(0);
        setPrice(0);
        setExpiryDate("");
      } else {
        alert("Failed to add medicine");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="py-8 px-10">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3">
          <MdLocalPharmacy className="text-blue-500" /> Pharmacy Inventory
        </h1>
        <p className="text-sm text-gray-500">
          Manage medicines, check stock levels, and add new inventory.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Medicine List */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-2xl font-semibold mb-4">All Medicines</h2>
          <hr className="text-neutral-400/50 mb-4" />
          
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Price ($)</th>
                  <th>Expiry Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <LoadingSpinner />
                    </td>
                  </tr>
                ) : medicines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      No medicines available.
                    </td>
                  </tr>
                ) : (
                  medicines.map((med, i) => (
                    <tr key={i}>
                      <td className="font-semibold">{med.name}</td>
                      <td>{med.category}</td>
                      <td>{med.stock}</td>
                      <td>${med.price}</td>
                      <td>{new Date(med.expiryDate).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar panels */}
        <div className="flex flex-col gap-8">
          {/* Low Stock Alerts */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-600">
              <MdWarning size={24} /> Low Stock Alerts
            </h2>
            <hr className="text-neutral-400/50 mb-4" />
            
            {isLoading ? (
              <LoadingSpinner />
            ) : lowStock.length === 0 ? (
              <p className="text-green-600 font-medium">All stocks are sufficient.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {lowStock.map((med, i) => (
                  <li key={i} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="font-semibold text-gray-800">{med.name}</span>
                    <span className="bg-red-500 text-white px-2 py-1 text-xs rounded-full">{med.stock} left</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add Medicine Form */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Add Medicine</h2>
            <hr className="text-neutral-400/50 mb-4" />
            
            <form onSubmit={handleAddMedicine} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-bold text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700">Category</label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
                />
              </div>
              <div className="flex gap-4">
                <div className="w-full">
                  <label className="text-sm font-bold text-gray-700">Stock</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
                  />
                </div>
                <div className="w-full">
                  <label className="text-sm font-bold text-gray-700">Price</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={0.01}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700">Expiry Date</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
                />
              </div>
              <button 
                type="submit"
                className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Save Medicine
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}