"use client";

import { useState, useEffect } from "react";
import { MdAssignmentInd } from "react-icons/md";
import ToggleButton from "@/components/ToggleButton";
import { baseUrl } from "@/lib/constants";
import { toast } from "sonner";

interface Doctor {
  id: number;
  name: string;
  specialization: string;
  licenseNumber: string;
  consultationFee: number;
  experienceYears: number;
  isAssigned?: boolean;
}

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
}

interface Specialization {
  specializationId: number;
  name: string;
}

export default function AssignDoctor() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [assignments, setAssignments] = useState<Record<number, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal form state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchUsername, setSearchUsername] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [experience, setExperience] = useState("");
  
  const [users, setUsers] = useState<User[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);

  // Fetch users and specializations
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, specsRes] = await Promise.all([
          fetch(`${baseUrl}/api/user/users`),
          fetch(`${baseUrl}/api/specialization`),
        ]);
        
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users.filter((user: User) => user.role === "doctor"));
        }
        
        if (specsRes.ok) {
          const specsData = await specsRes.json();
          setSpecializations(Array.isArray(specsData) ? specsData : []);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    
    fetchData();
  }, []);

  // Compute filtered users based on search
  const filteredUsers = searchUsername.trim()
    ? users.filter(
        (user) =>
          user.username.toLowerCase().includes(searchUsername.toLowerCase()) ||
          user.name.toLowerCase().includes(searchUsername.toLowerCase())
      )
    : [];

  const handleToggle = (doctorId: number) => {
    setAssignments((prev) => ({
      ...prev,
      [doctorId]: !prev[doctorId],
    }));
  };

  const handleAssignDoctor = () => {
    setIsModalOpen(true);
    setSearchUsername("");
    setSelectedUser(null);
    setSelectedSpecialization("");
    setLicenseNumber("");
    setConsultationFee("");
    setExperience("");
  };

  const handleSave = async () => {
    if (!selectedUser || !selectedSpecialization || !licenseNumber || !consultationFee || !experience) {
      alert("Please fill in all fields");
      return;
    }

    try {

      const payload = {
          UserId: selectedUser.id,
          SpecializationId: parseInt(selectedSpecialization),
          LicenseNumber: licenseNumber,
          ConsultationFee: parseFloat(consultationFee),
          ExperienceYears: parseInt(experience),
        };

      const response = await fetch(`${baseUrl}/api/user/AssignDoctor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setIsModalOpen(false);
        console.log("Doctor assigned successfully: ", data);
      } else {
        toast.error("Failed to assign doctor");
      }
    } catch (error) {
      console.error("Error assigning doctor:", error);
      toast.error("Error assigning doctor");
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setSearchUsername("");
    setSelectedUser(null);
    setSelectedSpecialization("");
    setLicenseNumber("");
    setConsultationFee("");
    setExperience("");
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

      {/* Assign Doctor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Assign Doctor</h2>
              <p className="text-sm text-gray-500 mt-1">
                Fill in the details to assign a new doctor
              </p>
            </div>

            {/* Form Content */}
            <div className="space-y-4">
              {/* Username Search */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchUsername}
                    onChange={(e) => {
                      setSearchUsername(e.target.value);
                      setShowUserDropdown(true);
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Search by username or name..."
                    className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:border-teal-500"
                  />
                  {selectedUser && (
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchUsername("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown for users */}
                {showUserDropdown && filteredUsers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchUsername(user.username);
                          setShowUserDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-teal-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-800">{user.name}</div>
                        <div className="text-sm text-gray-500">@{user.username}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Show selected user info */}
                {selectedUser && (
                  <div className="mt-2 p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Selected: </span>{selectedUser.name} ({selectedUser.username})
                    </p>
                    <p className="text-xs text-gray-600">{selectedUser.email}</p>
                  </div>
                )}
              </div>

              {/* Specialization Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specialization
                </label>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select Specialization</option>
                  {specializations.map((spec) => (
                    <option key={spec.specializationId} value={String(spec.specializationId)}>
                      {spec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* License Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Licence Number
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g., MD123456"
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Consultation Fee */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Consultation Fee
                </label>
                <input
                  type="number"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  placeholder="e.g., 50"
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Experience */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Experience (Years)
                </label>
                <input
                  type="number"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g., 5"
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}