"use client";

import { useEffect, useState } from "react";
import { MdOutlineScience, MdAdd } from "react-icons/md";
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
    queueMicrotask(() => {
      fetchLabRequests();
    });
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
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <MdOutlineScience className="text-rose-500" /> Laboratory
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage lab requests, update test statuses, and process samples.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Lab Requests</h2>
          <hr className="border-border mb-4" />
          
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="text-foreground/90">Req ID</th>
                  <th className="text-foreground/90">Patient</th>
                  <th className="text-foreground/90">Test Type</th>
                  <th className="text-foreground/90">Priority</th>
                  <th className="text-foreground/90">Status</th>
                  <th className="text-foreground/90">Actions</th>
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
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      No lab requests available.
                    </td>
                  </tr>
                ) : (
                  labRequests.map((req) => (
                    <tr key={req.id}>
                      <td className="font-semibold text-foreground">#{req.id}</td>
                      <td className="text-foreground/80">ID: {req.patientId}</td>
                      <td className="text-foreground/80">{req.testType}</td>
                      <td>
                        <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${req.priority === 'High' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground/70'}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="font-semibold text-primary">{req.status || "Pending"}</td>
                      <td>
                        <select 
                          className="p-1.5 text-sm border border-border rounded bg-card text-foreground outline-none focus:border-primary"
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

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <MdAdd className="text-green-500" /> New Lab Request
          </h2>
          <hr className="border-border mb-4" />
          
          <form onSubmit={handleCreateRequest} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold text-foreground/90">Patient ID</label>
              <input
                type="number"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground/90">Doctor ID</label>
              <input
                type="number"
                required
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground/90">Test Type</label>
              <input
                type="text"
                required
                placeholder="e.g. Blood Test"
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground/90">Priority</label>
              <select
                required
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
              </select>
            </div>
            <button 
              type="submit"
              className="w-full mt-4 bg-primary hover:opacity-90 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Submit Request
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}