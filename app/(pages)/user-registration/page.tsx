"use client";

import SelectRole from "@/components/selectRole";
import ToggleButton from "@/components/ToggleButton";
import DatePicker from "@/components/DatePicker";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { toDateInputValue } from "@/lib/date";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import CountrySearchSelect from "@/components/CountrySearchSelect";
import SearchableSelect from "@/components/SearchableSelect";
import { countryDetails } from "@/helpers/countyDetails";
import { SpecializationService } from "@/services/specialization.service";
import { UserService } from "@/services/user.service";
import { DepartmentSerivce } from "@/services/department.service";
import { BranchService } from "@/services/branch.service";
import { Specialization } from "@/types/Specializations.type";
import { UserAssignedDoctorCreateType } from "@/types/user.type";
import { AssignedDoctorsInfo } from "@/types/assignedDoctors.type";
import { DepartmentTypes } from "@/types/department.type";
import { BranchType } from "@/types/branch.type";
import { getUserDetail } from "@/lib/userDetail";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, Suspense } from "react";
import { toast } from "sonner";
import axios from "axios";

function UserRegistrationForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("+971");
  const [isActive, setIsActive] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [departments, setDepartments] = useState<DepartmentTypes[]>([]);
  // Defaults to the signed-in admin's own branch (edit mode overwrites this from the loaded
  // user a moment later anyway, so defaulting unconditionally here is harmless for that path).
  const [branchId, setBranchId] = useState(() => getUserDetail()?.branchId || "");
  const [branches, setBranches] = useState<BranchType[]>([]);


  // Set when Create comes back 409 "a deleted user already owns this identity" - offers
  // RestoreUserPrompt instead of just failing (see handleUserReg's catch below).
  const [deletedUserConflict, setDeletedUserConflict] = useState<{
    userId: string;
    name: string;
    field: string;
  } | null>(null);

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

  // Same dial-code + phone-length behavior as the Patient Entry form's phone field -
  // caps how many digits fit the selected country's dialing code, and re-clamps an
  // already-typed number if the code changes to one with a shorter max length.
  const selectedPhoneLength =
    countryDetails.find((c) => c.phoneCode === phoneCode)?.phoneLength ?? 15;

  useEffect(() => {
    setPhone((prev) => (prev.length > selectedPhoneLength ? prev.slice(0, selectedPhoneLength) : prev));
  }, [selectedPhoneLength]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value.replace(/\D/g, "").slice(0, selectedPhoneLength));
  };



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
    BranchService.getAll().then((res) => setBranches(res.data || [])).catch(() => {});
  }, [])

  // Optional while the company has only its one main branch, mandatory the moment a second
  // branch exists - mirrors UserController.ValidateBranchAsync exactly (counts every branch,
  // not just active ones) so this hint never disagrees with what the server will accept.
  const branchIsRequired = branches.length > 1;
  const activeBranches = branches.filter((b) => b.isActive);


  useEffect(() => {
    if (role === "doctor") setShowAssignDoctor(true)
    if (role !== "doctor") setShowAssignDoctor(false)
  }, [role])

  // Active-only, and specialities are further scoped to whichever department is
  // currently selected - a deactivated department/speciality, or one belonging to a
  // different department, must never be pickable here.
  const activeDepartments = departments.filter((d) => d.isActive);
  const availableSpecializations = specializations.filter(
    (s) => s.isActive && s.departmentId === departmentId,
  );

  // The previously-picked speciality may no longer be valid once the department
  // changes (wrong department, or the list above just filtered it out) - clear it
  // rather than silently submitting a mismatched selection.
  useEffect(() => {
    if (selectedSpecialization && !availableSpecializations.some((s) => s.specializationId === selectedSpecialization)) {
      setSelectedSpecialization("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, specializations]);

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

          // The stored phone is one combined string (no separate code column on User) -
          // split it back into code + digits by matching the longest known dialing code
          // prefix, same convention as Patient Entry's emergencyContactPhone.
          const storedPhone: string = user.phone || "";
          const matchedCode = [...countryDetails]
            .sort((a, b) => b.phoneCode.length - a.phoneCode.length)
            .find((c) => storedPhone.startsWith(c.phoneCode));
          if (matchedCode) {
            setPhoneCode(matchedCode.phoneCode);
            setPhone(storedPhone.slice(matchedCode.phoneCode.length));
          } else {
            setPhone(storedPhone);
          }

          setIsActive(user.isActive !== undefined ? user.isActive : true);
          setGender(user.gender || "");
          setNationality(user.nationality || "");
          setDepartmentId(user.departmentId || "");
          setBranchId(user.branchId || "");
        }
      } catch (error) {
        console.error("Error loading user edit data from sessionStorage:", error);
      }
    }
  }, [editMode]);

  // Hire date lives on the current open employment stint, not on the stored editUser
  // snapshot - fetch it separately, same reasoning as the doctor-info effect below.
  useEffect(() => {
    if (!editMode) return;
    const storedUser = sessionStorage.getItem("editUser");
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    if (!user.id) return;

    UserService.getEmploymentHistory(user.id)
      .then((res) => {
        const openStint = res?.data?.find((e: { terminationDate: string | null }) => !e.terminationDate);
        if (openStint?.hireDate) setHireDate(openStint.hireDate.slice(0, 10));
      })
      .catch(() => {});
  }, [editMode]);

  // Doctor-only fields (specialization/licence/fee/experience) aren't part of the
  // stored editUser snapshot - fetch them separately from the assigned-doctors list.
  // Waits on `specializations` too so departmentId's own "clear if no longer valid"
  // effect doesn't race this and wipe the just-loaded selection before it can settle.
  useEffect(() => {
    if (!editMode || specializations.length === 0) return;
    const storedUser = sessionStorage.getItem("editUser");
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    if (user.role !== "doctor" || !user.id) return;

    UserService.get_assigned_doctors()
      .then((res) => {
        const doctorInfo = res?.data?.find((d: AssignedDoctorsInfo) => d.userId === user.id);
        if (!doctorInfo) return;
        setSelectedSpecialization(doctorInfo.specializationId);
        setLicenseNumber(doctorInfo.licenseNumber);
        setConsultationFee(doctorInfo.consultationFee);
        setExperience(doctorInfo.experienceYears);
      })
      .catch(() => {});
  }, [editMode, specializations]);

  // reset data
  const resetdata = () => {
    setEmail("");
    setName("");
    setUsername("");
    setPhone("");
    setPhoneCode("+971");
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
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || "Failed to save the doctor profile"
          : "Failed to save the doctor profile"
      );
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

      if (!departmentId) {
        toast.warning("Select a department");
        return;
      }

      if (role === "doctor" && !selectedSpecialization) {
        toast.warning("Select a specialisation - it's required for doctors");
        return;
      }

      if (branchIsRequired && !branchId) {
        toast.warning("Select a branch - this company has more than one");
        return;
      }

      const payload = {
        name,
        username,
        email,
        password,
        role,
        phone: phoneCode + phone,
        gender: gender || undefined,
        nationality: nationality || undefined,
        departmentId,
        specializationId: role === "doctor" ? selectedSpecialization : undefined,
        branchId: branchId || undefined,
        hireDate: hireDate || undefined,
      }

      const data = await UserService.create(payload)

      if (data.data.role === "doctor") {
        await handleDoctorAssign(data.data.userId)
      }

      resetdata()
      sessionStorage.removeItem("editUser");
      toast.success(data.message);

      router.push("/user-management");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const body = error.response?.data;
        if (error.response?.status === 409 && body?.code === "DELETED_USER_EXISTS") {
          setDeletedUserConflict({
            userId: body.data.userId,
            name: body.data.name,
            field: body.data.conflictingField,
          });
        } else {
          toast.error(body?.message || "Failed to create user");
        }
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setLoading(false)
    }
  };

  // Confirmed from the RestoreUserPrompt shown after handleUserReg's 409 - brings the
  // original (soft-deleted) account back instead of creating a new one. Left throwing on
  // failure so the prompt itself can show "incorrect password" and let the admin retry.
  const handleRestoreConfirm = async (adminPassword: string) => {
    if (!deletedUserConflict) return;
    const data = await UserService.restore(deletedUserConflict.userId, adminPassword);
    toast.success(data.message);
    setDeletedUserConflict(null);
    resetdata();
    sessionStorage.removeItem("editUser");
    router.push("/user-management");
  };

  const handleUserUpdate = async () => {
    try {
      if (!name || !username || !email || !role || !phone) {
        toast.warning("Please fill all the required fields");
        return;
      }

      if (role === "doctor" && !selectedSpecialization) {
        toast.warning("Select a specialisation - it's required for doctors");
        return;
      }

      if (branchIsRequired && !branchId) {
        toast.warning("Select a branch - this company has more than one");
        return;
      }

      const payload = {
        name,
        username,
        email,
        role,
        phone: phoneCode + phone,
        isActive,
        gender: gender || undefined,
        nationality: nationality || undefined,
        departmentId: departmentId || undefined,
        branchId: branchId || undefined,
        hireDate: hireDate || undefined,
        password: password || undefined,
      }

      if (!userId) return;

      const data = await UserService.update(userId, payload)

      if (role === "doctor") {
        await handleDoctorAssign(userId);
      }

      toast.success(data.message);

      sessionStorage.removeItem("editUser");
      router.push("/user-management");
    } catch (error) {
      console.log("Error updating user:", error);
    }
  };

  return (
    <div className="h-dvh overflow-y-auto flex flex-col py-6 px-4 sm:py-8 sm:px-10 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="w-full">
                <label htmlFor="phone" className="font-bold">
                  Phone Number
                </label>
                <div
                  className="outline-0 rounded-xl w-full mt-2 h-14 flex overflow-hidden"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <CountryCodeSelect
                    id="phoneCode"
                    name="phoneCode"
                    value={phoneCode}
                    onChange={setPhoneCode}
                    required
                    className="flex h-14 shrink-0 items-center gap-1 px-3 border-r border-[var(--color-border)]"
                  />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={selectedPhoneLength}
                    placeholder={"5".padEnd(selectedPhoneLength, "0")}
                    className="outline-0 h-14 px-4 flex-1 min-w-0 bg-transparent rounded-none border-0"
                  />
                </div>
              </div>

              <div className="w-full">
                <label htmlFor="new-password" className="font-bold">
                  New Password
                </label>
                <input
                  type="password"
                  id="new-password"
                  name="newPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  autoComplete="new-password"
                  className="outline-0 p-4 rounded-xl w-full mt-2"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </div>

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
                <div
                  className="outline-0 rounded-xl w-full mt-2"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <CountrySearchSelect
                    id="nationality"
                    name="nationality"
                    value={nationality}
                    onChange={setNationality}
                    placeholder="Select nationality"
                    className="flex h-11 w-full items-center justify-between gap-1 px-4 py-4 text-left"
                  />
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <label htmlFor="department" className="font-bold text-sm">Department</label>
                <SearchableSelect
                  id="department"
                  name="department"
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder="Unspecified"
                  options={activeDepartments.map((d) => ({ value: d.departmentId, label: d.name }))}
                  className="flex h-11 w-full items-center justify-between gap-1 rounded-xl border border-border bg-card px-4 text-left text-foreground hover:bg-muted transition-colors"
                />
              </div>

              {branches.length > 0 && (
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="branch" className={`font-bold text-sm ${branchIsRequired ? "required" : ""}`}>Branch</label>
                  <SearchableSelect
                    id="branch"
                    name="branch"
                    value={branchId}
                    onChange={setBranchId}
                    placeholder={branchIsRequired ? "Select a branch" : "Unspecified"}
                    options={activeBranches.map((b) => ({ value: b.branchId, label: b.name }))}
                    className="flex h-11 w-full items-center justify-between gap-1 rounded-xl border border-border bg-card px-4 text-left text-foreground hover:bg-muted transition-colors"
                  />
                </div>
              )}

              <div className="w-full">
                <label htmlFor="hireDate" className="font-bold text-sm">Hire Date</label>
                <div className="mt-2">
                  <DatePicker
                    id="hireDate"
                    name="hireDate"
                    value={hireDate}
                    onChange={setHireDate}
                    max={toDateInputValue(new Date())}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                  />
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <label htmlFor="isActive" className="font-bold text-sm">Status</label>
                <div className="flex items-center gap-3 bg-neutral-100/50 p-4 rounded-xl border border-neutral-200 w-fit">
                  <label htmlFor="isActive" className="font-bold cursor-pointer select-none text-sm">
                    {isActive ? "Active" : "Inactive"}
                  </label>
                  <ToggleButton
                    checked={isActive}
                    onChange={() => setIsActive(!isActive)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="w-full">
                <label htmlFor="phone" className="font-bold">
                  Phone Number
                </label>
                <div
                  className="outline-0 rounded-xl w-full mt-2 h-14 flex overflow-hidden"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <CountryCodeSelect
                    id="phoneCode"
                    name="phoneCode"
                    value={phoneCode}
                    onChange={setPhoneCode}
                    required
                    className="flex h-14 shrink-0 items-center gap-1 px-3 border-r border-[var(--color-border)]"
                  />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={selectedPhoneLength}
                    placeholder={"5".padEnd(selectedPhoneLength, "0")}
                    className="outline-0 h-14 px-4 flex-1 min-w-0 bg-transparent rounded-none border-0"
                  />
                </div>
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
                <div
                  className="outline-0 rounded-xl w-full mt-2"
                  style={{
                    backgroundColor: "var(--color-highlight)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <CountrySearchSelect
                    id="nationality"
                    name="nationality"
                    value={nationality}
                    onChange={setNationality}
                    placeholder="Select nationality"
                    className="flex h-11 w-full items-center justify-between gap-1 px-4 py-4 text-left"
                  />
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                <label htmlFor="department" className="font-bold text-sm required">Department</label>
                <SearchableSelect
                  id="department"
                  name="department"
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder="Select department"
                  options={activeDepartments.map((d) => ({ value: d.departmentId, label: d.name }))}
                  className="flex h-11 w-full items-center justify-between gap-1 rounded-xl border border-border bg-card px-4 text-left text-foreground hover:bg-muted transition-colors"
                />
              </div>

              {branches.length > 0 && (
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="branch" className={`font-bold text-sm ${branchIsRequired ? "required" : ""}`}>Branch</label>
                  <SearchableSelect
                    id="branch"
                    name="branch"
                    value={branchId}
                    onChange={setBranchId}
                    placeholder={branchIsRequired ? "Select a branch" : "Unspecified"}
                    options={activeBranches.map((b) => ({ value: b.branchId, label: b.name }))}
                    className="flex h-11 w-full items-center justify-between gap-1 rounded-xl border border-border bg-card px-4 text-left text-foreground hover:bg-muted transition-colors"
                  />
                </div>
              )}

              <div className="w-full">
                <label htmlFor="hireDate" className="font-bold text-sm">Hire Date</label>
                <div className="mt-2">
                  <DatePicker
                    id="hireDate"
                    name="hireDate"
                    value={hireDate}
                    onChange={setHireDate}
                    max={toDateInputValue(new Date())}
                    dateFormat="dd-MM-yyyy"
                    placeholder="DD-MM-YYYY"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Doctor-only fields (Specialisation, Licence, Fee, Experience) - shown for
              both creating a new doctor and editing an existing one, since a doctor's
              specialization/licence/fee/experience can change after initial creation
              too, not just at signup. */}
          {showAssignDoctor && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div className="flex flex-col gap-1 w-full">
                <label htmlFor="specialization" className="font-bold text-sm required">Specialisation</label>
                <SearchableSelect
                  id="specialization"
                  name="specialization"
                  value={selectedSpecialization}
                  onChange={setSelectedSpecialization}
                  options={availableSpecializations.map((s) => ({ value: s.specializationId, label: s.name }))}
                  placeholder={departmentId ? "Select" : "Select a department first"}
                  disabled={!departmentId}
                  className="flex h-11 w-full items-center justify-between gap-1 rounded-xl border border-border bg-card px-4 text-left text-foreground hover:bg-muted transition-colors"
                />
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

      {deletedUserConflict && (
        <AdminPasswordConfirm
          title="Restore deleted user?"
          description={
            <>
              A previously deleted user, <b className="text-foreground">{deletedUserConflict.name}</b>,
              already has this {deletedUserConflict.field}. Enter your admin password to restore
              their account instead of creating a new one.
            </>
          }
          confirmLabel="Restore user"
          confirmingLabel="Restoring..."
          onCancel={() => setDeletedUserConflict(null)}
          onConfirm={handleRestoreConfirm}
        />
      )}
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
