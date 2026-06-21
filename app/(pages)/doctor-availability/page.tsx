"use client";

import { useState } from "react";
import { MdOutlineDateRange, MdSave } from "react-icons/md";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DUMMY_DOCTORS = [
    { id: 1, name: "Dr. Alice Johnson", specialization: "Cardiology" },
    { id: 2, name: "Dr. Bob Smith", specialization: "Neurology" },
    { id: 3, name: "Dr. Carol White", specialization: "Pediatrics" },
];

interface DoctorSchedule {
    days: string[];
    startTime: string;
    endTime: string;
}

export default function DoctorAvailability() {
  const [schedules, setSchedules] = useState<Record<number, DoctorSchedule>>(
    DUMMY_DOCTORS.reduce((acc, doc) => ({
        ...acc,
        [doc.id]: { days: [], startTime: "09:00", endTime: "17:00" }
    }), {})
  );

  const updateSchedule = (doctorId: number, updates: Partial<DoctorSchedule>) => {
      setSchedules(prev => ({
          ...prev,
          [doctorId]: { ...prev[doctorId], ...updates }
      }));
  };

  const toggleDay = (doctorId: number, day: string) => {
      const currentDays = schedules[doctorId].days;
      const newDays = currentDays.includes(day) 
          ? currentDays.filter(d => d !== day)
          : [...currentDays, day];
      updateSchedule(doctorId, { days: newDays });
  };

  const handleUpdate = (doctorId: number) => {
      alert(`Updating schedule for ${DUMMY_DOCTORS.find(d => d.id === doctorId)?.name}: \nDays: ${schedules[doctorId].days.join(", ")} \nTime: ${schedules[doctorId].startTime} - ${schedules[doctorId].endTime}`);
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <MdOutlineDateRange className="text-primary" /> Doctor Availability
        </h1>
        <p className="text-sm text-muted-foreground">
          Set availability for each doctor individually.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Available Doctors</h2>
        <hr className="border-border mb-4" />
        
        <div className="overflow-x-auto">
            <table className="w-full table-no-row-hover">
              <thead>
                <tr className="text-left">
                  <th className="p-2 text-foreground/90">Doctor</th>
                  <th className="p-2 text-foreground/90">Specialization</th>
                  <th className="p-2 text-foreground/90">Days</th>
                  <th className="p-2 text-foreground/90">Start Time</th>
                  <th className="p-2 text-foreground/90">End Time</th>
                  <th className="p-2 text-foreground/90">Action</th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_DOCTORS.map((doc) => {
                      const schedule = schedules[doc.id];
                      return (
                        <tr key={doc.id} className="border-b border-border">
                          <td className="p-2 font-semibold text-foreground">{doc.name}</td>
                          <td className="p-2 text-primary font-semibold">{doc.specialization}</td>
                          <td className="p-2">
                              <div className="flex gap-1">
                                  {DAYS.map(day => (
                                      <button
                                        key={day}
                                        onClick={() => toggleDay(doc.id, day)}
                                        className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${schedule.days.includes(day) ? "bg-primary text-white" : "bg-muted text-foreground"}`}
                                      >
                                          {day}
                                      </button>
                                  ))}
                              </div>
                          </td>
                          <td className="p-2">
                              <input type="time" value={schedule.startTime} onChange={e => updateSchedule(doc.id, { startTime: e.target.value })} className="p-1 rounded bg-muted border border-border text-sm cursor-pointer" />
                          </td>
                          <td className="p-2">
                              <input type="time" value={schedule.endTime} onChange={e => updateSchedule(doc.id, { endTime: e.target.value })} className="p-1 rounded bg-muted border border-border text-sm cursor-pointer" />
                          </td>
                          <td className="p-2">
                              <button 
                                onClick={() => handleUpdate(doc.id)}
                                className="flex items-center gap-1 bg-primary text-white px-3 py-1 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                              >
                                  <MdSave /> Update
                              </button>
                          </td>
                        </tr>
                      );
                  })}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
