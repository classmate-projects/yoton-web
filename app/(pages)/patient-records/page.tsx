"use client";

import DeleteIcon from "@/public/icons/deleteIcon";
import { useEffect, useState } from "react";
import { MdContacts, MdSearch, MdDelete } from "react-icons/md";
import { toast } from "sonner";

interface Patient {
  id: number;
  fullName: string;
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
      const res = await fetch("/api/patient");
      const data = await res.json();
      setPatients(data);
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
      p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
  );

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3">
          <MdContacts className="text-blue-500" /> Patient Records
        </h1>
        <p className="text-sm text-gray-500">
          View, search, and manage all registered patients in the system.
        </p>
      </div>

      <div className="card p-6 rounded-xl shadow-lg border-t">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Patient Directory</h2>
          <div className="relative w-64">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-(--color-highlight) border border-(--color-border) focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <hr className="text-neutral-400/50 mb-4" />
        
        {isLoading ? (
          <p>Loading records...</p>
        ) : filteredPatients.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No patients found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-3 border-b">Full Name</th>
                  <th className="p-3 border-b">Email</th>
                  <th className="p-3 border-b">Phone</th>
                  <th className="p-3 border-b">Address</th>
                  <th className="p-3 border-b text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 border-b font-semibold text-gray-800">{patient.fullName}</td>
                    <td className="p-3 border-b">{patient.email}</td>
                    <td className="p-3 border-b">{patient.phone}</td>
                    <td className="p-3 border-b text-sm text-gray-600 truncate max-w-xs">{patient.address || "N/A"}</td>
                    <td className="p-3 border-b text-center">
                      <button 
                        onClick={() => confirmDelete(patient.id, patient.fullName)}
                        className="hover:bg-red-50 p-2 rounded transition-colors cursor-pointer"
                        title="Delete Patient"
                      >
                        <DeleteIcon color="red" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}