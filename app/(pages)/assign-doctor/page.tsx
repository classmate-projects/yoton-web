"use client";

import { useState } from "react";
import { MdAssignmentInd } from "react-icons/md";
import ToggleButton from "@/components/ToggleButton";

interface Doctor {
  id: number;
  name: string;
  specialization: string;
  licenseNumber: string;
  consultationFee: number;
  experienceYears: number;
  isAssigned?: boolean;
}

export default function AssignDoctor() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assignments, setAssignments] = useState<Record<number, boolean>>({});

  const handleToggle = (doctorId: number) => {
    setAssignments((prev) => ({
      ...prev,
      [doctorId]: !prev[doctorId],
    }));
  };

  const handleAssignDoctor = () => {
    // This will be connected to a modal or form for assigning doctors
    alert("Open assign doctor form");
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold flex items-center gap-3">
            <MdAssignmentInd className="text-teal-500" /> Assign Doctor
          </h1>
          <p className="text-sm text-gray-500">
            Manage doctor assignments and availability for departments and specializations.
          </p>
        </div>
        <button
          onClick={handleAssignDoctor}
          className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md transition-colors"
        >
          + Assign Doctor
        </button>
      </div>

      {/* Table Section */}
      <div className="card rounded-xl shadow-lg border border-neutral-300 overflow-hidden">
        <table className="w-full rounded-xl overflow-hidden border border-neutral-500 border-separate border-spacing-0">
          <thead>
            <tr className="bg-neutral-300">
              <th className="px-4 py-4 text-left font-semibold">Doctor Name</th>
              <th className="px-4 py-4 text-left font-semibold">Specialization</th>
              <th className="px-4 py-4 text-left font-semibold">Licence Number</th>
              <th className="px-4 py-4 text-left font-semibold">Consultation Fee</th>
              <th className="px-4 py-4 text-left font-semibold">Experience</th>
              <th className="px-4 py-4 text-left font-semibold">Action</th>
            </tr>
          </thead>

          {doctors.length > 0 ? (
            <tbody>
              {doctors.map((doctor) => (
                <tr
                  key={doctor.id}
                  className="border-t border-neutral-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-4 font-medium text-gray-800">
                    {doctor.name}
                  </td>
                  <td className="px-4 py-4 text-teal-700 font-medium">
                    {doctor.specialization}
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    {doctor.licenseNumber}
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    ${doctor.consultationFee}
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    {doctor.experienceYears} years
                  </td>
                  <td className="px-4 py-4">
                    <ToggleButton
                      checked={assignments[doctor.id] || false}
                      onChange={() => handleToggle(doctor.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <MdAssignmentInd className="text-4xl text-gray-300" />
                    <p className="text-lg font-medium">No doctors available</p>
                    <p className="text-sm">No doctors have been registered yet.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}