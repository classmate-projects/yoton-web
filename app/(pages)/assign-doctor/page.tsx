"use client";

import { useState, useEffect } from "react";
import { MdAssignmentInd } from "react-icons/md";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Specialization, User } from "@/types/Specializations.type";
import { AssignedDoctorsInfo } from "@/types/assignedDoctors.type";
import { UserService } from "@/services/user.service";
import { SpecializationService } from "@/services/specialization.service";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";


export default function AssignDoctor() {
  const [doctors, setDoctors] = useState<AssignedDoctorsInfo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modal form state
  const [editingDoctor, setEditingDoctor] = useState<AssignedDoctorsInfo | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchUsername, setSearchUsername] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [consultationFee, setConsultationFee] = useState<string>("");
  const [experience, setExperience] = useState<string>("");

  const [users, setUsers] = useState<User[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);


  // fetch assigned doctors
  const fetchAssignedDoctors = async () => {
    try {
      const res = await UserService.get_assigned_doctors()
      setDoctors(res.data)
    } catch (error) {
      console.error("Error", error)
    }
  }

  useEffect(() => {
    fetchAssignedDoctors()
  }, [])

  useSignalRRefetch(["doctorAssigned"], fetchAssignedDoctors);

  // Fetch users and specializations
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [usersRes, specsRes] = await Promise.all([
          await UserService.getAll(),
          await SpecializationService.getAll(),
        ]);

        if (usersRes) {
          setUsers(usersRes.data.filter((user: User) => user.role === "doctor"));
        }

        if (specsRes) {
          setSpecializations(Array.isArray(specsRes) ? specsRes : []);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
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

  const handleAssignDoctor = () => {
    setEditingDoctor(null);
    setIsModalOpen(true);
    setSearchUsername("");
    setSelectedUser(null);
    setSelectedSpecialization("");
    setLicenseNumber("");
    setConsultationFee("");
    setExperience("");
  };

  const handleEditDoctor = (doctor: AssignedDoctorsInfo) => {
    // The assign-doctor endpoint upserts by UserId, so editing reuses the same
    // save flow — but the user (which doctor this profile belongs to) is
    // locked, since changing it here would silently edit a different doctor's
    // profile instead of this one.
    const matchedUser = users.find((u) => u.id === doctor.userId);
    const user: User = matchedUser ?? {
      id: doctor.userId,
      name: doctor.userName,
      username: doctor.userName,
      email: doctor.userEmail,
      role: "doctor",
    };

    setEditingDoctor(doctor);
    setSelectedUser(user);
    setSearchUsername(user.username);
    setShowUserDropdown(false);
    setSelectedSpecialization(doctor.specializationId);
    setLicenseNumber(doctor.licenseNumber);
    setConsultationFee(String(doctor.consultationFee));
    setExperience(String(doctor.experienceYears));
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser || !selectedSpecialization || !licenseNumber || !consultationFee || !experience) {
      toast.warning("Please enter all the fields")
      return;
    }

    try {
      const payload = {
        UserId: selectedUser.id,
        SpecializationId: selectedSpecialization,
        LicenseNumber: licenseNumber,
        ConsultationFee: parseFloat(consultationFee),
        ExperienceYears: parseInt(experience),
      };

      const data = await UserService.create_assign_doctor(payload)

      toast.success(data.message);
      setIsModalOpen(false);
      setEditingDoctor(null);
      fetchAssignedDoctors();
    } catch (error) {
      console.error("Error assigning doctor:", error);
      toast.error("Error assigning doctor");
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingDoctor(null);
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
          <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
            <MdAssignmentInd className="text-primary" /> Assign Doctor
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Linking a doctor account here creates their clinical profile — specialization, license number,
            consultation fee, and experience — which drives how they appear in appointment booking, referral
            targets, and the Doctor Workbench. A user must have the &quot;doctor&quot; role before they can be assigned.
          </p>
        </div>
        <button
          onClick={handleAssignDoctor}
          className="bg-primary hover:opacity-90 text-white font-semibold px-6 py-3 rounded-lg shadow-md transition-colors"
        >
          + Assign Doctor
        </button>
      </div>

      {/* Table Section */}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="text-foreground/90">Doctor Name</th>
              <th className="text-foreground/90">Specialization</th>
              <th className="text-foreground/90">Licence Number</th>
              <th className="text-foreground/90">Consultation Fee</th>
              <th className="text-foreground/90">Experience</th>
              <th className="text-foreground/90">Action</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : doctors.length > 0 ? (
              doctors.map((doctor) => (
                <tr key={doctor.doctorId}>
                  <td className="font-semibold text-foreground flex items-center gap-2">
                    <span className={` w-[8px] h-[8px] block rounded-full ${doctor.isActive ? "bg-green-500" : "bg-red-500"}`}></span>
                    {doctor.userName}
                  </td>
                  <td className="text-primary font-semibold">
                    {doctor.specializationName}
                  </td>
                  <td className="text-foreground/80">
                    {doctor.licenseNumber}
                  </td>
                  <td className="text-foreground/80">
                    {doctor.consultationFee}
                  </td>
                  <td className="text-foreground/80">
                    {doctor.experienceYears} years
                  </td>
                  <td>
                    <button
                      onClick={() => handleEditDoctor(doctor)}
                      className="text-primary font-semibold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <MdAssignmentInd className="text-4xl text-muted-foreground/40" />
                    <p className="text-lg font-medium text-foreground/80">No doctors available</p>
                    <p className="text-sm text-muted-foreground">No doctors have been registered yet.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Assign Doctor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-border">
            {/* Modal Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-foreground">
                {editingDoctor ? "Edit Doctor Assignment" : "Assign Doctor"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {editingDoctor
                  ? "Update this doctor's specialization, licence or fee."
                  : "Fill in the details to assign a new doctor"}
              </p>
            </div>

            {/* Form Content */}
            <div className="space-y-4">
              {/* Username Search */}
              <div className="relative">
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
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
                    disabled={!!editingDoctor}
                    className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                  {selectedUser && !editingDoctor && (
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchUsername("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown for users */}
                {showUserDropdown && filteredUsers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchUsername(user.username);
                          setShowUserDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-primary/5 border-b border-border last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-sm text-muted-foreground">@{user.username}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Show selected user info */}
                {selectedUser && (
                  <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-foreground/90">
                      <span className="font-semibold">Selected: </span>{selectedUser.name} ({selectedUser.username})
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                )}
              </div>

              {/* Specialization Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Specialization
                </label>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground"
                >
                  <option value="" disabled>Select Specialization</option>
                  {specializations.map((spec) => (
                    <option key={spec.specializationId} value={String(spec.specializationId)}>
                      {spec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* License Number */}
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Licence Number
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g., MD123456"
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground"
                />
              </div>

              {/* Consultation Fee */}
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Consultation Fee
                </label>
                <input
                  type="number"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  placeholder="e.g., 50"
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground"
                />
              </div>

              {/* Experience */}
              <div>
                <label className="block text-sm font-semibold text-foreground/90 mb-2">
                  Experience (Years)
                </label>
                <input
                  type="number"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g., 5"
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-primary text-foreground"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-primary hover:opacity-90 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {editingDoctor ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}