"use client";

import { useEffect, useState } from "react";
import { MdOutlineScience, MdAdd } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";

interface RadiologyRequest {
  id: number;
  patientId: number;
  doctorId: number;
  scanType: string;
  priority: string;
  status: string;
}

export default function RadiologyPage() {
  const [requests, setRequests] = useState<RadiologyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [scanType, setScanType] = useState("");
  const [priority, setPriority] = useState("Normal");

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/radiology");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch radiology requests", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchRequests();
    });
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/radiology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(patientId),
          doctorId: Number(doctorId),
          scanType,
          priority
        }),
      });

      if (res.ok) {
        alert("Radiology request created successfully");
        setPatientId("");
        setDoctorId("");
        setScanType("");
        setPriority("Normal");
        fetchRequests();
      } else {
        alert("Failed to create request");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch("/api/radiology/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radiologyRequestId: id, status }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3">
          <MdOutlineScience className="text-purple-500" /> Radiology Department
        </h1>
        <p className="text-sm text-gray-500">
          Manage X-Rays, MRIs, and CT Scans requests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-2xl font-semibold mb-4">Scan Requests</h2>
          <hr className="text-neutral-400/50 mb-4" />
          
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Scan Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <LoadingSpinner />
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No radiology requests available.
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td className="font-semibold">#{req.id}</td>
                      <td>{req.patientId}</td>
                      <td>{req.scanType}</td>
                      <td>
                        <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${req.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="font-semibold">{req.status || "Pending"}</td>
                      <td>
                        <select 
                          className="p-1.5 text-sm border rounded bg-white outline-none focus:border-blue-500"
                          value={req.status || "Pending"}
                          onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MdAdd className="text-green-500" /> New Scan Request
          </h2>
          <hr className="text-neutral-400/50 mb-4" />
          
          <form onSubmit={handleCreateRequest} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold text-gray-700">Patient ID</label>
              <input
                type="number"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700">Doctor ID</label>
              <input
                type="number"
                required
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700">Scan Type</label>
              <input
                type="text"
                required
                placeholder="e.g. MRI Brain"
                value={scanType}
                onChange={(e) => setScanType(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700">Priority</label>
              <select
                required
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-[var(--color-highlight)] border border-[var(--color-border)]"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
              </select>
            </div>
            <button 
              type="submit"
              className="w-full mt-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Submit Request
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}