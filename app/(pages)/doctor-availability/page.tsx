"use client";

import { ReceptionService } from "@/services/reception.service";
import axios from "axios";
import { useEffect, useState } from "react";
import { MdOutlineDateRange, MdSave, MdExpandMore, MdExpandLess } from "react-icons/md";
import { toast } from "sonner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DoctorSchedule {
    days: string[];
    startTime: string;
    endTime: string;
}

interface ApiScheduleItem {
    day: number;
    start: string;
    end: string;
}

interface ApiDoctor {
    doctorId: string;
    doctorName: string;
    specialization?: string;
    schedules: ApiScheduleItem[];
}

interface ApiDepartment {
    departmentId: string;
    departmentName: string;
    doctors: ApiDoctor[];
}

export default function DoctorAvailability() {
    const [doctorAvailability, setDoctorAvailability] = useState<ApiDepartment[]>([])
    const [loading, setLoading] = useState(true)
    const [schedules, setSchedules] = useState<Record<string, DoctorSchedule>>({});
    const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchDoctorAvailability = async () => {
            try {
                const data = await ReceptionService.getDoctorAvailability();
                console.log("DoctorAvailability: ", data)
                setDoctorAvailability(data)
                
                // Initialize schedules from fetched data
                const initialSchedules: Record<string, DoctorSchedule> = {};
                data.forEach((dept: ApiDepartment) => {
                    dept.doctors.forEach((doc: ApiDoctor) => {
                        const days = doc.schedules.map(s => DAYS[s.day]);
                        const startTime = doc.schedules[0]?.start || "09:00";
                        const endTime = doc.schedules[0]?.end || "18:00";
                        initialSchedules[doc.doctorId] = { days, startTime, endTime };
                    });
                });
                setSchedules(initialSchedules);
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    console.log("error: ", error.response?.data)
                } else {
                    console.log("Something went wrong")
                }
            } finally {
                setLoading(false)
            }
        }

        fetchDoctorAvailability()
    }, [])

    const updateSchedule = (doctorId: string, updates: Partial<DoctorSchedule>) => {
        setSchedules(prev => ({
            ...prev,
            [doctorId]: { 
                ...(prev[doctorId] || { days: [], startTime: "09:00", endTime: "18:00" }), 
                ...updates 
            }
        }));
    };

    const toggleDay = (doctorId: string, day: string) => {
        const currentDays = schedules[doctorId]?.days || [];
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day];
        updateSchedule(doctorId, { days: newDays });
    };

    const handleUpdateChanges = async (doctorId: string) => {
        try {
            const schedule = schedules[doctorId];
        const payload = {
            doctorId: doctorId,
            days: (schedule?.days || []).map(day => DAYS.indexOf(day)),
            startTime: schedule?.startTime,
            endTime: schedule?.endTime
        }

        const data = await ReceptionService.updateSchedule(payload)
        toast.success(data.message)
        console.log("Update: ", data)
        } catch (error) {
            if(axios.isAxiosError(error)) {
                console.log("Error: ", error.response?.data)
            } else console.log("Something went wrong.")
        }
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
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : doctorAvailability.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">No doctor availability data found.</div>
                ) : (
                    doctorAvailability.map((dept) => {
                        const isExpanded = expandedDepartments.has(dept.departmentId);
                        const deptDoctors = dept.doctors;

                        return (
                            <div key={dept.departmentId} className="card overflow-hidden">
                                <button
                                    onClick={() => toggleDepartment(dept.departmentId)}
                                    className="w-full flex items-center justify-between p-6 hover:bg-muted/30 transition-colors cursor-pointer text-left"
                                >
                                    <span className="text-2xl font-semibold text-foreground">{dept.departmentName}</span>
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
                                                                const schedule = schedules[doc.doctorId] || { days: [], startTime: "09:00", endTime: "18:00" };
                                                                return (
                                                                    <tr key={doc.doctorId} className="border-b border-border">
                                                                        <td className="p-2 font-semibold text-foreground">{doc.doctorName}</td>
                                                                        <td className="p-2 text-primary font-semibold">{doc.specialization || dept.departmentName}</td>
                                                                        <td className="p-2">
                                                                            <div className="flex gap-1">
                                                                                {DAYS.map(day => (
                                                                                    <button
                                                                                        key={day}
                                                                                        onClick={() => toggleDay(doc.doctorId, day)}
                                                                                        className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${schedule.days.includes(day) ? "bg-primary text-white" : "bg-muted text-foreground"}`}
                                                                                    >
                                                                                        {day}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-2">
                                                                            <input type="time" value={schedule.startTime} onChange={e => updateSchedule(doc.doctorId, { startTime: e.target.value })} className="p-1 rounded bg-muted border border-border text-sm cursor-pointer" />
                                                                        </td>
                                                                        <td className="p-2">
                                                                            <input type="time" value={schedule.endTime} onChange={e => updateSchedule(doc.doctorId, { endTime: e.target.value })} className="p-1 rounded bg-muted border border-border text-sm cursor-pointer" />
                                                                        </td>
                                                                        <td className="p-2">
                                                                            <button
                                                                                onClick={() => handleUpdateChanges(doc.doctorId)}
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
                    })
                )}
            </div>
        </div>
    );
}
