"use client";

import DeleteIcon from "@/public/icons/deleteIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MdContacts } from "react-icons/md";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { baseUrl } from "@/lib/constants";

interface Patient {
  opId: number;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export default function PatientRecordsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${baseUrl}/api/reception/patient`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      console.log("Data: ", data.data.patients)
      setPatients(data.data.patients || []);
    } catch (error) {
      console.error("Failed to fetch patients", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const callFetchPatientApi = () => {
      fetchPatients();
    }

    callFetchPatientApi()
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/patient`, {
        method: "DELETE",
        body: JSON.stringify({ id })

      });
      if (res.ok) {
        fetchPatients();
      } else {
        toast.error("Failed to delete patient");
      }
    } catch (error) {
      console.error("Failed to delete patient", error);
    }
  };

  const confirmDelete = (id: number, name: string) => {
    toast(
      <span>
        Are you sure you want to delete {" "}
        <b className="text-red-500 ml-1">{name}</b>
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => handleDelete(id)
        }
      }
    )
  }

  const filteredPatients = patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
  );

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex justify-between items-center gap-1 mb-8">
        <div>
          <h1 className="text-4xl font-semibold flex items-center gap-3">
            <MdContacts className="text-blue-500" /> Patient Records
          </h1>
          <p className="text-sm text-gray-500">
            View, search, and manage all registered patients in the system.
          </p>
        </div>
        <Link href={"/patient-entry"} className="bg-blue-500 px-4 py-2 rounded-md text-white text-lg flex gap-2 items-center cursor-pointer hover:bg-blue-600 transition duration-150">
          Add Patient</Link>
      </div>

      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Patient Directory</h2>
          <div className="relative w-64">
            {/* <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} /> */}
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <SearchIcon color="#555" />
            </span>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12! pr-4 py-2 rounded-lg bg-(--color-highlight) border border-border focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <hr className="text-neutral-400/50 mb-4" />

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <tr key={patient.opId}>
                    <td className="font-semibold">{patient.name}</td>
                    <td>{patient.email}</td>
                    <td>{patient.phone}</td>
                    <td className="truncate max-w-xs">{patient.address || "N/A"}</td>
                    <td className="text-center">
                      <button
                        onClick={() => confirmDelete(patient.opId, patient.name)}
                        className="hover:bg-red-50 p-2 rounded transition-colors cursor-pointer"
                        title="Delete Patient"
                      >
                        <DeleteIcon color="red" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-500">
                    No patients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}