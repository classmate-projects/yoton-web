"use client";

import { useState } from "react";
import { MdOutlineDateRange, MdSave, MdExpandMore, MdExpandLess } from "react-icons/md";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DUMMY_DEPARTMENTS = [
    { id: "dept1", name: "Cardiology" },
    { id: "dept2", name: "Neurology" },
    { id: "dept3", name: "Pediatrics" },
    { id: "dept4", name: "Orthopedics" },
];

const DUMMY_DOCTORS = [
    { id: 1, name: "Dr. Alice Johnson", specialization: "Cardiology", departmentId: "dept1" },
    { id: 2, name: "Dr. Bob Smith", specialization: "Neurology", departmentId: "dept2" },
    { id: 3, name: "Dr. Carol White", specialization: "Pediatrics", departmentId: "dept3" },
    { id: 4, name: "Dr. David Brown", specialization: "Cardiology", departmentId: "dept1" },
    { id: 5, name: "Dr. Eva Green", specialization: "Neurology", departmentId: "dept2" },
    { id: 6, name: "Dr. Frank Wright", specialization: "Orthopedics", departmentId: "dept4" },
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

    const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

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
        const doctor = DUMMY_DOCTORS.find(d => d.id === doctorId);
        alert(`Updating schedule for ${doctor?.name}: Days: ${schedules[doctorId].days.join(", ")} Time: ${schedules[doctorId].startTime} - ${schedules[doctorId].endTime}`);
    };

    const toggleDepartment = (deptId: string) => {
        setExpandedDepartments(prev => {
            const next = new Set(prev);
            if (next.has(deptId)) {
                next.delete(deptId);
            } else {
                next.add(deptId);
            }
            return next;
        });
    };

    return (
        <div className="py-8 px-10 h-full overflow-y-auto">
            <div className="flex flex-col gap-1 mb-8">
                <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
                    <MdOutlineDateRange className="text-primary" /> Doctor Availability
                </h1>
                <p className="text-sm text-muted-foreground">
                    Set availability for each doctor individually grouped by department.
                </p>
            </div>

            <div className="flex flex-col gap-4">
                {DUMMY_DEPARTMENTS.map((dept) => {
                    const isExpanded = expandedDepartments.has(dept.id);
                    const deptDoctors = DUMMY_DOCTORS.filter(doc => doc.departmentId === dept.id);

                    return (
                        <div key={dept.id} className="card overflow-hidden">
                            <button
                                onClick={() => toggleDepartment(dept.id)}
                                className="w-full flex items-center justify-between p-6 hover:bg-muted/30 transition-colors cursor-pointer text-left"
                            >
                                <span className="text-2xl font-semibold text-foreground">{dept.name}</span>
                                {isExpanded ? (
                                    <MdExpandLess size={28} className="text-muted-foreground" />
                                ) : (
                                    <MdExpandMore size={28} className="text-muted-foreground" />
                                )}
                            </button>

                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                <div className="overflow-hidden">
                                    <div className="p-6 pt-0 border-t border-border">
                                        <div className="overflow-x-auto mt-4">
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
                                                    {deptDoctors.length > 0 ? (
                                                        deptDoctors.map((doc) => {
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
                                                        })
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={6} className="p-4 text-center text-muted-foreground">
                                                                No doctors available in this department.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
