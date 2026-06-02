"use client";

import { useEffect, useState } from "react";
import { MdOutlineScience, MdSearch, MdAdd } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";

interface LabRequest {
  id: number;
  patientId: number;
  doctorId: number;
  testType: string;
  priority: string;
  status: string;
}

export default function LabPage() {
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Request Form
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [testType, setTestType] = useState("");
  const [priority, setPriority] = useState("Normal");

  const fetchLabRequests = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/lab");
      const data = await res.json();
      setLabRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch lab requests", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLabRequests();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(patientId),
          doctorId: Number(doctorId),
          testType,
          priority
        }),
      });

      if (res.ok) {
        alert("Lab request created successfully");
        setPatientId("");
        setDoctorId("");
        setTestType("");
        setPriority("Normal");
        fetchLabRequests();
      } else {
        alert("Failed to create lab request");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch("/api/lab/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labRequestId: id, status }),
      });
      if (res.ok) {
        fetchLabRequests();
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3">
          <MdOutlineScience className="text-rose-500" /> Laboratory
        </h1>
        <p className="text-sm text-gray-500">
          Manage lab requests, update test statuses, and process samples.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-6 rounded-xl shadow-lg border border-neutral-300/80 overflow-hidden">
          <h2 className="text-2xl font-semibold mb-4">Lab Requests</h2>
          <hr className="text-neutral-400/50 mb-4" />
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-200">
                  <th className="px-5 py-4 text-sm font-bold text-neutral-700">Req ID</th>
                  <th className="px-5 py-4 text-sm font-bold text-neutral-700">Patient</th>
                  <th className="px-5 py-4 text-sm font-bold text-neutral-700">Test Type</th>
                  <th className="px-5 py-4 text-sm font-bold text-neutral-700">Priority</th>
                  <th className="px-5 py-4 text-sm font-bold text-neutral-700">Status</th>
                  <th className="px-5 py-4 text-sm font-bold text-neutral-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <LoadingSpinner />
                    </td>
                  </tr>
                ) : labRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No lab requests available.
                    </td>
                  </tr>
                ) : (
                  labRequests.map((req) => (
                    <tr key={req.id} className="border-b border-neutral-200/80 last:border-b-0 hover:bg-neutral-50/60 transition-colors duration-150">
                      <td className="px-5 py-4 text-sm font-semibold text-neutral-850">#{req.id}</td>
                      <td className="px-5 py-4 text-sm text-neutral-800">ID: {req.patientId}</td>
                      <td className="px-5 py-4 text-sm text-neutral-800">{req.testType}</td>
                      <td className="px-5 py-4 text-sm text-neutral-800">
                        <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${req.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-blue-600">{req.status || "Pending"}</td>
                      <td className="px-5 py-4 text-sm">
                        <select 
                          className="p-1.5 text-sm border rounded bg-white outline-none focus:border-blue-500"
                          value={req.status || "Pending"}
                          onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Processing">Processing</option>
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

        <div className="card p-6 rounded-xl shadow-lg border-t">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MdAdd className="text-green-500" /> New Lab Request
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
              <label className="text-sm font-bold text-gray-700">Test Type</label>
              <input
                type="text"
                required
                placeholder="e.g. Blood Test"
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
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
              className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Submit Request
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}