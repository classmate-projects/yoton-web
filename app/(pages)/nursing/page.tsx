"use client";

import { useEffect, useState } from "react";
import { MdOutlineLocalHospital, MdCheck } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";

interface NursingTask {
  id: number;
  patientId: number;
  nurseId: number;
  taskType: string;
  notes: string;
  status: string;
}

export default function NursingPage() {
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/nursing/pending");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch nursing tasks", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleUpdateStatus = async (id: number, status: string, notes: string = "") => {
    try {
      const res = await fetch("/api/nursing/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, status, notes }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3">
          <MdOutlineLocalHospital className="text-blue-500" /> Nursing Station
        </h1>
        <p className="text-sm text-gray-500">
          View assigned tasks and update patient vitals.
        </p>
      </div>

      <div className="card p-6 rounded-xl shadow-lg border-t">
        <h2 className="text-2xl font-semibold mb-4">Pending Tasks</h2>
        <hr className="text-neutral-400/50 mb-4" />
        
        {isLoading ? (
          <LoadingSpinner />
        ) : tasks.length === 0 ? (
          <p className="text-gray-500">No pending tasks. Great job!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <div key={task.id} className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg text-gray-800">{task.taskType}</span>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-semibold">
                    {task.status || "Pending"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1"><strong>Patient ID:</strong> {task.patientId}</p>
                <p className="text-sm text-gray-600 mb-4"><strong>Notes:</strong> {task.notes || "None"}</p>
                
                <div className="flex gap-2 mt-auto">
                  <button 
                    onClick={() => handleUpdateStatus(task.id, "InProgress")}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold py-2 rounded-lg text-sm transition-colors"
                  >
                    Start
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(task.id, "Completed")}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                  >
                    <MdCheck /> Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}