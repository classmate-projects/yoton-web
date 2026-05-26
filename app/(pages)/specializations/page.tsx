"use client";

interface DepartmentType {
    departmentId: number;
    name: string;
}

interface SpecializationType {
    specializationId: number;
    name: string;
    description: string;
    isActive: boolean;
    department: DepartmentType;
}

import { useEffect, useState } from "react";
import ToggleButton from "@/components/ToggleButton";
import { baseUrl } from "@/lib/constants";

export default function SpecializationPage() {
  const [specializations, setSpecializations] = useState<SpecializationType[]>([]);

  // fetch specializations
  const fetchSpecializations = async () => {
    try {
        const res = await fetch(`${baseUrl}/api/specialization`)
        const data = await res.json();

        setSpecializations(data);

        console.log("fetched specializations:", data);
    } catch (error) {
        console.error("Error fetching specializations:", error);
    }
  }
  
  useEffect(() => {
    const callApi = () => {
        fetchSpecializations()
    }

    callApi();
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header Section */}
      <div className="mb-8 flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Specializations</h1>
          <p className="mt-2 text-gray-600">
            Manage medical specializations and departments. Add, edit, or modify specialization details to organize your medical staff effectively.
          </p>
        </div>
        <button className="ml-6 rounded-lg bg-emerald-500 px-6 py-2 text-white font-medium hover:bg-emerald-600 transition-colors duration-200 flex items-center gap-2">
          <span className="text-xl">+</span>
          Add Specialization
        </button>
      </div>

      {/* Table Section */}
      <div className="rounded-lg bg-gray-100 shadow-md overflow-hidden">
        <table className="w-full">
          {/* Table Head */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-200">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Description
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Department
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">
                Action
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {specializations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="h-12 w-12 text-gray-400 mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-gray-500 font-medium">
                      No specializations added yet
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      Create your first specialization to get started
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              specializations.map((spec) => (
                <tr
                  key={spec.specializationId}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {spec.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {spec.description || "No description provided"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {spec.department?.name || "No department assigned"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <ToggleButton
                        checked={spec.isActive}
                        onChange={() => {
                          // Handle toggle change
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}