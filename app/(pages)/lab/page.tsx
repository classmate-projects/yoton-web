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
        <div className="lg:col-span-2 card p-6 rounded-xl shadow-lg border-t">
          <h2 className="text-2xl font-semibold mb-4">Lab Requests</h2>
          <hr className="text-neutral-400/50 mb-4" />
          
          {isLoading ? (
            <LoadingSpinner />
          ) : labRequests.length === 0 ? (
            <p className="text-gray-500">No lab requests available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 border-b">Req ID</th>
                    <th className="p-3 border-b">Patient</th>
                    <th className="p-3 border-b">Test Type</th>
                    <th className="p-3 border-b">Priority</th>
                    <th className="p-3 border-b">Status</th>
                    <th className="p-3 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {labRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b font-medium">#{req.id}</td>
                      <td className="p-3 border-b">ID: {req.patientId}</td>
                      <td className="p-3 border-b">{req.testType}</td>
                      <td className="p-3 border-b">
                        <span className={`px-2 py-1 text-xs rounded-full ${req.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="p-3 border-b font-semibold text-blue-600">{req.status || "Pending"}</td>
                      <td className="p-3 border-b">
                        <select 
                          className="p-1 text-sm border rounded"
                          value={req.status || "Pending"}
                          onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Processing">Processing</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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