"use client";

import SelectRole from "@/components/selectRole";
import ToggleButton from "@/components/ToggleButton";
import DatePicker from "@/components/DatePicker";
import { SpecializationService } from "@/services/specialization.service";
import { UserService } from "@/services/user.service";
import { DepartmentSerivce } from "@/services/department.service";
import { Specialization } from "@/types/Specializations.type";
import { UserAssignedDoctorCreateType } from "@/types/user.type";
import { DepartmentTypes } from "@/types/department.type";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { toast } from "sonner";

function UserRegistrationForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);


  const [showAssignDoctor, setShowAssignDoctor] = useState(false)
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [consultationFee, setConsultationFee] = useState(0);
  const [experience, setExperience] = useState(0);


  const router = useRouter();
  const searchParams = useSearchParams();
  const editMode = searchParams.get("edit") === "true";
  const [loading, setLoading] = useState(false);



  // fetch all specializations
  const fetchAllSpecializations = async () => {
    try {
      const data = await SpecializationService.getAll()
      setSpecializations(data)
    } catch (error) {
      console.error("Error: ", error)
    }
  }

  useEffect(() => {
    fetchAllSpecializations()
    DepartmentSerivce.getAll().then((data) => setDepartments(data || [])).catch(() => {});
  }, [])


  useEffect(() => {
    if (role === "doctor") setShowAssignDoctor(true)
    if (role !== "doctor") setShowAssignDoctor(false)
  }, [role])

  useEffect(() => {
    if (editMode) {
      try {
        const storedUser = sessionStorage.getItem("editUser");
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUserId(user.id?.toString() || null);
          setName(user.name || "");
          setUsername(user.username || "");
          setEmail(user.email || "");
          setRole(user.role || "");
          setPhone(user.phone || "");
          setIsActive(user.isActive !== undefined ? user.isActive : true);
          setGender(user.gender || "");
          setNationality(user.nationality || "");
          setDepartmentId(user.departmentId || "");
        }
      } catch (error) {
        console.error("Error loading user edit data from sessionStorage:", error);
      }
    }
  }, [editMode]);

  // reset data
  const resetdata = () => {
    setEmail("");
    setName("");
    setUsername("");
    setPhone("");
    setPassword("");
    setRole("");
  }

  // handle assign doctor if the role is doctor
  const handleDoctorAssign = async (userId: string) => {
    if (!userId) return;
    const payload: UserAssignedDoctorCreateType = {
      UserId: userId,
      SpecializationId: selectedSpecialization,
      LicenseNumber: licenseNumber,
      ExperienceYears: experience,
      ConsultationFee: consultationFee
    }

    try {
      await UserService.create_assign_doctor(payload)
    } catch (error) {
      console.error(error);
    }
  }

  // register user
  const handleUserReg = async () => {
    setLoading(true);
    try {
      if (!name || !username || !password || !email || !role || !phone) {
        toast.warning("Please fill all the required fields");
        return;
      }

      const payload = {
        name,
        username,
        email,
        password,
        role,
        phone,
        gender: gender || undefined,
        nationality: nationality || undefined,
        departmentId: departmentId || undefined,
        hireDate: hireDate || undefined,
      }

      const data = await UserService.create(payload)

      if (data.data.role === "doctor") {
        handleDoctorAssign(data.data.userId)
      }

      resetdata()
      sessionStorage.removeItem("editUser");
      toast.success(data.message);

      router.push("/user-management");
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false)
    }
  };

  const handleUserUpdate = async () => {
    try {
      if (!name || !username || !email || !role || !phone) {
        toast.warning("Please fill all the required fields");
        return;
      }

      const payload = {
        name,
        email,
        role,
        phone,
        isActive,
        gender: gender || undefined,
        nationality: nationality || undefined,
        departmentId: departmentId || undefined,
      }

      if (!userId) return;

      const data = await UserService.update(userId, payload)
      toast.success(data.message);

      sessionStorage.removeItem("editUser");
      router.push("/user-management");
    } catch (error) {
      console.log("Error updating user:", error);
    }
  };

  return (
    <div className=" h-dvh flex flex-col py-6 px-4 sm:py-8 sm:px-10 gap-4">
      <div>
        <h1 className="text-4xl font-semibold">
          {editMode ? "Edit Staff Details" : "Staff Registration"}
        </h1>
      </div>

      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editMode) {
              handleUserUpdate();
            } else {
              handleUserReg();
            }
          }}
          autoComplete="off"
          className="card rounded-xl shadow-2xl border-t p-8 mt-4 flex flex-col gap-6"
        >
          {editMode ? (
            <>
              {/* Row 1: Full name and Email */}
              <div className="flex items-center w-full gap-4">
                <div className="w-full">
                  <label htmlFor="fullname" className="font-bold required">
                    Full name
                  </label>
                  <input
                    type="text"
                    id="fullname"
                    name="fullname"
                    required
                    placeholder="Johnathan Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>

                <div className="w-full">
                  <label htmlFor="email" className="font-bold required">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="johnathan.doe@example.com"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Role and Phone */}
              <div className="flex items-center gap-4">
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="role" className="font-bold required">
                    Role
                  </label>
                  <SelectRole role={role} setRole={setRole} allRole={false} selectRole={true} />
                </div>

                <div className="w-full">
                  <label htmlFor="phone" className="font-bold">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: IsActive status toggle */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-neutral-100/50 p-4 rounded-xl border border-neutral-200 w-fit">
                  <label htmlFor="isActive" className="font-bold cursor-pointer select-none text-sm">
                    Status: {isActive ? "Active" : "Inactive"}
                  </label>
                  <ToggleButton
                    checked={isActive}
                    onChange={() => setIsActive(!isActive)}
                  />
                </div>
              </div>

              {/* Row 4: Gender, Nationality, Department (HR fields) */}
              <div className="flex items-center gap-4">
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="gender" className="font-bold text-sm">Gender</label>
                  <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Unspecified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="w-full">
                  <label htmlFor="nationality" className="font-bold text-sm">Nationality</label>
                  <input
                    type="text"
                    id="nationality"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="e.g. Qatari"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="department" className="font-bold text-sm">Department</label>
                  <select id="department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">Unspecified</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Row 1: Full name and Username */}
              <div className="flex items-center w-full gap-4">
                <div className="w-full">
                  <label htmlFor="fullname" className="font-bold required">
                    Full name
                  </label>
                  <input
                    type="text"
                    id="fullname"
                    name="fullname"
                    required
                    placeholder="Johnathan Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>

                <div className="w-full">
                  <label htmlFor="staff-username" className="font-bold required">
                    Username
                  </label>
                  <input
                    type="text"
                    id="staff-username"
                    name="staffUsername"
                    required
                    placeholder="johnathandoe123"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Role and Email */}
              <div className="flex items-center gap-4">
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="role" className="font-bold required">
                    Role
                  </label>
                  <SelectRole role={role} setRole={setRole} allRole={false} selectRole={true} />
                </div>

                <div className="w-full">
                  <label htmlFor="email" className="font-bold required">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="johnathan.doe@example.com"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Phone and Password */}
              <div className="flex items-center gap-4">
                <div className="w-full">
                  <label htmlFor="phone" className="font-bold">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>

                <div className="w-full">
                  <label htmlFor="temporary-password" className="font-bold required">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    id="temporary-password"
                    name="temporaryPassword"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    autoComplete="new-password"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>

              {/* Row 4: Gender, Nationality, Department, Hire date (HR fields) */}
              <div className="flex items-center gap-4">
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="gender" className="font-bold text-sm">Gender</label>
                  <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Unspecified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="w-full">
                  <label htmlFor="nationality" className="font-bold text-sm">Nationality</label>
                  <input
                    type="text"
                    id="nationality"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="e.g. Qatari"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="department" className="font-bold text-sm">Department</label>
                  <select id="department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">Unspecified</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full">
                  <label htmlFor="hireDate" className="font-bold text-sm">Hire Date</label>
                  <div className="mt-2">
                    <DatePicker id="hireDate" value={hireDate} onChange={setHireDate} placeholder="Select hire date" />
                  </div>
                </div>
              </div>

              {showAssignDoctor && (
                <div className="flex  gap-4 w-full">
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex flex-col gap-1 w-full">
                      <label htmlFor="specialization" className="font-bold text-sm">Specialisation</label>
                      <select
                        name="specialization"
                        id="specialization"
                        value={selectedSpecialization}
                        onChange={(e) => setSelectedSpecialization(e.target.value)}
                      >
                        <option value="" disabled>Select</option>
                        {specializations.map((specialization) => (
                          <option
                            key={specialization.specializationId}
                            value={specialization.specializationId}>
                            {specialization.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 w-full">
                      <label htmlFor="licence_number" className="font-bold text-sm">Licence Number</label>
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="eg: MD123456"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex flex-col gap-1 w-full">
                      <label htmlFor="consultation_fee" className="font-bold text-sm">Consultation Fee</label>
                      <input
                        type="text"
                        placeholder="eg: 50"
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <label htmlFor="experience" className="font-bold text-sm">Experience (Years)</label>
                      <input
                        type="text"
                        placeholder="eg: 5"
                        value={experience}
                        onChange={(e) => setExperience(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("editUser");
                router.push("/user-management");
              }}
              className="px-6 py-3 rounded-md border border-neutral-400 hover:bg-neutral-200/50 transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 cursor-pointer"
            >
              {editMode ? "Save Changes" : loading ? "Saving..." : "Register User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="h-dvh flex items-center justify-center">
        <p className="text-lg text-gray-500">Loading form...</p>
      </div>
    }>
      <UserRegistrationForm />
    </Suspense>
  );
}
