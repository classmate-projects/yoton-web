"use client";

interface getAllResponse {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
  // True when inactive because Terminate closed the current employment stint - distinct
  // from a plain manual deactivate. Drives both the row styling and whether reactivating
  // goes through the plain toggle or the password-gated Rehire flow below.
  isTerminated: boolean;
}

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import SelectRole from "@/components/selectRole";
import ToggleButton from "@/components/ToggleButton";
import DeleteIcon from "@/public/icons/deleteIcon";
import SettingsIcon from "@/public/icons/SettingsIcon";
import AddUserIcon from "@/public/icons/AddUserIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import EditIcon from "@/public/icons/EditIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { CalendarClock, History as HistoryIcon, UserX } from "lucide-react";
import { UserService } from "@/services/user.service";
import { NursingService } from "@/services/nursing.service";
import { NurseShiftInput } from "@/types/nursing.type";
import { StaffEmploymentEventType } from "@/types/user.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

const TERMINATION_REASONS = [
  { value: "Retired60Plus", label: "Retired (60+ years)" },
  { value: "EarlyRetirement", label: "Early retirement (<60 years)" },
  { value: "VoluntaryResignation", label: "Left willingly (resignation)" },
  { value: "ForcedTermination", label: "Forced to leave" },
  { value: "Death", label: "Deceased" },
  { value: "TempContractEnded", label: "Temporary/locum contract ended" },
  { value: "TransferredDepartment", label: "Transferred to another department" },
  { value: "Other", label: "Other" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayShiftRow {
  active: boolean;
  startTime: string;
  endTime: string;
}

const emptyWeek = (): DayShiftRow[] =>
  DAY_NAMES.map(() => ({ active: false, startTime: "08:00", endTime: "16:00" }));

export default function UserManagement() {

  const router = useRouter();
  const [users, setUsers] = useState<getAllResponse[]>([]);
  const [role, setRole] = useState("allRole");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const [shiftsTarget, setShiftsTarget] = useState<getAllResponse | null>(null);
  const [shiftsWeek, setShiftsWeek] = useState<DayShiftRow[]>(emptyWeek());
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [savingShifts, setSavingShifts] = useState(false);

  const [historyTarget, setHistoryTarget] = useState<getAllResponse | null>(null);
  const [employmentHistory, setEmploymentHistory] = useState<StaffEmploymentEventType[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [terminateTarget, setTerminateTarget] = useState<getAllResponse | null>(null);
  const [terminationDate, setTerminationDate] = useState("");
  const [terminationReason, setTerminationReason] = useState("");
  const [terminationReasonOtherText, setTerminationReasonOtherText] = useState("");
  const [isTerminating, setIsTerminating] = useState(false);

  // Set when the status toggle is clicked for a terminated user - routes reactivation
  // through Rehire's password-gated confirm instead of the plain toggle (see
  // handleToggleUser below).
  const [rehireTarget, setRehireTarget] = useState<getAllResponse | null>(null);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!users) return [];

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query);

      const matchesRole =
        !role || role === "allRole" || user.role.toLowerCase() === role.toLowerCase();


      const matchesActiveStatus =
        activeStatus === "all" ||
        (activeStatus === "active" && user.isActive) ||
        (activeStatus === "inactive" && !user.isActive);

      const notAdmin = user.role.toLowerCase() !== "admin";

      return matchesSearch && matchesRole && matchesActiveStatus && notAdmin;
    });
  }, [users, searchQuery, role, activeStatus]);

  const clearFilters = () => {
    setSearchQuery("");
    setRole("allRole");
    setActiveStatus("all");
  };

  // fetch all users
  const fetchAllUsers = async () => {
    try {
      setIsLoading(true);
      const res = await UserService.getAll()
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  useSignalRRefetch(["userCreated", "userUpdated", "userDeleted"], fetchAllUsers);

  // get formatted time
  const getTime = (time?: string) => {
    if (!time) return "N/A";

    return new Date(`${time}Z`)
      .toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: true,
      })
      .replace("am", "AM")
      .replace("pm", "PM");
  };


  // delete user
  const handleDeleteUser = async (id: string) => {
    try {
      const data = await UserService.delete(id)

      toast.success(data?.message)
      fetchAllUsers();
    } catch {
      console.log("Error: error with deleting user");
    }
  };

  // show toast for permission to delete user 
  const handleDelete = (id: string, name: string) => {
    toast(
      <span>
        Are you sure, you want to delete{" "}
        <b className="text-red-500 ml-1">{name}</b>
      </span>,
      {
        action: {
          label: "Delete",
          onClick: () => {
            handleDeleteUser(id);
          },
        },
      },
    );
  };

  // ---------------- NURSE SHIFTS ----------------
  const openShiftsManager = async (user: getAllResponse) => {
    setShiftsTarget(user);
    setShiftsWeek(emptyWeek());
    setLoadingShifts(true);
    try {
      const res = await NursingService.getNurseShifts(user.id);
      const week = emptyWeek();
      for (const s of res.data ?? []) {
        // TimeSpan serializes as "hh:mm:ss" — <input type="time"> wants "hh:mm".
        week[s.day] = { active: s.isActive, startTime: s.startTime.slice(0, 5), endTime: s.endTime.slice(0, 5) };
      }
      setShiftsWeek(week);
    } catch {
      toast.error("Failed to load shifts");
    } finally {
      setLoadingShifts(false);
    }
  };

  const closeShiftsManager = () => {
    setShiftsTarget(null);
    setShiftsWeek(emptyWeek());
  };

  const saveShifts = async () => {
    if (!shiftsTarget) return;
    setSavingShifts(true);
    try {
      const shifts: NurseShiftInput[] = shiftsWeek
        .map((row, day) => ({ day, startTime: `${row.startTime}:00`, endTime: `${row.endTime}:00`, isActive: row.active }))
        .filter((row) => row.isActive);
      await NursingService.setNurseShifts(shiftsTarget.id, shifts);
      toast.success("Shifts updated");
      closeShiftsManager();
    } catch {
      toast.error("Failed to update shifts");
    } finally {
      setSavingShifts(false);
    }
  };

  // ---------------- EMPLOYMENT HISTORY ----------------
  const openHistory = async (user: getAllResponse) => {
    setHistoryTarget(user);
    setLoadingHistory(true);
    try {
      const res = await UserService.getEmploymentHistory(user.id);
      setEmploymentHistory(res.data ?? []);
    } catch {
      toast.error("Failed to load employment history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistory = () => {
    setHistoryTarget(null);
    setEmploymentHistory([]);
  };

  // ---------------- TERMINATE EMPLOYMENT ----------------
  const openTerminate = (user: getAllResponse) => {
    setTerminateTarget(user);
    setTerminationDate("");
    setTerminationReason("");
    setTerminationReasonOtherText("");
  };

  const closeTerminate = () => {
    setTerminateTarget(null);
  };

  const submitTerminate = async () => {
    if (!terminateTarget) return;
    if (!terminationDate || !terminationReason) {
      toast.error("Termination date and reason are required");
      return;
    }
    setIsTerminating(true);
    try {
      await UserService.terminate(terminateTarget.id, {
        terminationDate,
        terminationReason,
        terminationReasonOtherText: terminationReasonOtherText || undefined,
      });
      toast.success("Employment terminated");
      closeTerminate();
      fetchAllUsers();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) ? error.response?.data?.message || "Failed to terminate employment" : "Failed to terminate employment"
      );
    } finally {
      setIsTerminating(false);
    }
  };

  // toggle user - a terminated employee can't be reactivated by this plain flip (the
  // backend refuses it): they go through the Rehire confirm below instead, so
  // reactivating always opens a fresh employment stint rather than just flipping the flag.
  const handleToggleUser = async (user: getAllResponse) => {
    if (!user.isActive && user.isTerminated) {
      setRehireTarget(user);
      return;
    }

    const payload = {
      ...user,
      isActive: !user.isActive,
    };

    try {
      await UserService.update(user.id, payload)
      toast.success(`Status changed to ${!user.isActive ? "active" : "inactive"}`)

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isActive: !user.isActive }
            : u
        )
      );
    } catch (error) {
      toast.error(
        axios.isAxiosError(error) ? error.response?.data?.message || "Failed to update status" : "Failed to update status"
      );
    }
  };

  // Confirmed from the Rehire prompt below - reactivates the account and opens a new
  // employment stint (backend). Left throwing on failure so the prompt itself can show
  // "incorrect password" and let the admin retry.
  const handleRehireConfirm = async (adminPassword: string) => {
    if (!rehireTarget) return;
    await UserService.rehire(rehireTarget.id, adminPassword);
    toast.success(`${rehireTarget.name} has been rehired`);
    setRehireTarget(null);
    fetchAllUsers();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-bold">User Management</h1>
          <p>
            Efficiently manage hospital staff access, roles, and administrative
            permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={"/role-management"}
            aria-label="Manage roles and their module permissions"
            className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <SettingsIcon size={18} />
            Manage Roles
          </Link>
          <Link
            href={"/user-registration"}
            onClick={() => sessionStorage.removeItem("editUser")}
            aria-label="Register a new staff member"
            className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <AddUserIcon size={18} />
            Add Staff
          </Link>
        </div>
      </div>

      <div className="mt-8 flex items-center w-full justify-between gap-6">
        <div className="card flex-1 px-6 py-4 flex items-center justify-between gap-6">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-muted-foreground">
              <SearchIcon size={18} />
            </span>
            <input
              type="text"
              placeholder="Filter by name or username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border-input pl-12! pr-4 "
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <SelectRole
              role={role}
              setRole={setRole}
              allRole={true}
              selectRole={false}
            />

            <select
              name="isActive"
              id="isActive"
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="border border-neutral-500 px-4 py-2 rounded-md outline-0">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              title="Clear filters"
              className="border border-neutral-500 px-4 py-1.25 rounded-md hover:scale-95 transition-all duration-200 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="bg-gray-500 p-6 rounded-xl text-white">
          <h3>Total Users: {filteredUsers?.length}</h3>
        </div>
      </div>

      <div className="card mt-8">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Last loggedin</th>
              <th>Created at</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="text-center py-20">
                  <LoadingSpinner />
                </td>
              </tr>
            ) : filteredUsers
              .length > 0 ? (
              filteredUsers
                .slice()
                .map((user) => (
                  <tr
                    key={user.id}
                    className={
                      user.isTerminated
                        ? "bg-red-100/80 dark:bg-red-950/30 text-muted-foreground line-through decoration-red-400"
                        : !user.isActive
                        ? "bg-red-50/50 opacity-80"
                        : ""
                    }
                  >
                    <td className="font-semibold">
                      <span className="inline-flex items-center gap-2">
                        {user.name}
                        {user.isTerminated && (
                          <span className="no-underline rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Terminated
                          </span>
                        )}
                      </span>
                    </td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td className="capitalize">{user.role}</td>
                    <td>{user.phone}</td>
                    <td>{getTime(user.lastLogin)}</td>
                    <td>{getTime(user.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-4">

                        <ToggleButton
                          checked={user.isActive}
                          onChange={() => handleToggleUser(user)}
                        />

                        <button
                          onClick={() => openHistory(user)}
                          title="Employment History"
                          className="hover:bg-blue-100 p-2 rounded-full transition-colors cursor-pointer text-blue-600"
                        >
                          <HistoryIcon size={18} />
                        </button>

                        {user.isActive && (
                          <button
                            onClick={() => openTerminate(user)}
                            title="Terminate Employment"
                            className="hover:bg-orange-100 p-2 rounded-full transition-colors cursor-pointer text-orange-600"
                          >
                            <UserX size={18} />
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          title="Delete User"
                          className="hover:bg-red-100 p-2 rounded-full transition-colors cursor-pointer"
                        >
                          <DeleteIcon color="red" />
                        </button>

                        {!user.isTerminated && (
                          <button
                            onClick={() => {
                              sessionStorage.setItem("editUser", JSON.stringify(user));
                              router.push("/user-registration?edit=true");
                            }}
                            title="Edit User"
                            className="hover:bg-blue-100 p-2 rounded-full transition-colors cursor-pointer"
                          >
                            <EditIcon color="blue" />
                          </button>
                        )}

                        {user.role.toLowerCase() === "nurse" && (
                          <button
                            onClick={() => openShiftsManager(user)}
                            title="Manage Shifts"
                            className="hover:bg-purple-100 p-2 rounded-full transition-colors cursor-pointer text-purple-600"
                          >
                            <CalendarClock size={18} />
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-20 text-gray-600">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {shiftsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-lg rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Shifts for {shiftsTarget.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Recurring weekly on-duty windows — informational only, does not restrict which patients this nurse can access.
            </p>

            {loadingShifts ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {DAY_NAMES.map((dayName, day) => (
                  <div key={day} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2 w-28 shrink-0 text-sm font-medium">
                      <ToggleButton
                        checked={shiftsWeek[day].active}
                        onChange={(checked) =>
                          setShiftsWeek((prev) => prev.map((r, i) => (i === day ? { ...r, active: checked } : r)))
                        }
                      />
                      {dayName}
                    </div>
                    <input
                      type="time"
                      disabled={!shiftsWeek[day].active}
                      value={shiftsWeek[day].startTime}
                      onChange={(e) =>
                        setShiftsWeek((prev) => prev.map((r, i) => (i === day ? { ...r, startTime: e.target.value } : r)))
                      }
                      className="h-9 text-sm flex-1 disabled:opacity-40"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input
                      type="time"
                      disabled={!shiftsWeek[day].active}
                      value={shiftsWeek[day].endTime}
                      onChange={(e) =>
                        setShiftsWeek((prev) => prev.map((r, i) => (i === day ? { ...r, endTime: e.target.value } : r)))
                      }
                      className="h-9 text-sm flex-1 disabled:opacity-40"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={closeShiftsManager}
                className="w-1/3 border border-neutral-400 text-gray-700 font-semibold py-3 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveShifts}
                disabled={loadingShifts || savingShifts}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
              >
                {savingShifts ? "Saving..." : "Save Shifts"}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-lg rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Employment History for {historyTarget.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Each stint is one hire-to-termination period — a rehire opens a new stint rather than overwriting the old one.
            </p>

            {loadingHistory ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : employmentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No employment history recorded.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                {employmentHistory.map((e) => (
                  <div key={e.staffEmploymentEventId} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {new Date(e.hireDate).toLocaleDateString()} —{" "}
                        {e.terminationDate ? new Date(e.terminationDate).toLocaleDateString() : "Present"}
                      </span>
                      {e.departmentName && <span className="text-xs text-muted-foreground">{e.departmentName}</span>}
                    </div>
                    {e.terminationReason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reason: {TERMINATION_REASONS.find((r) => r.value === e.terminationReason)?.label ?? e.terminationReason}
                        {e.terminationReasonOtherText ? ` — ${e.terminationReasonOtherText}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={closeHistory}
                className="w-full border border-neutral-400 text-gray-700 font-semibold py-3 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {terminateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md">
          <div className="bg-card w-full max-w-md rounded-xl border border-border p-6 shadow-2xl mx-4">
            <h2 className="text-xl font-semibold text-foreground">Terminate Employment</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Closes {terminateTarget.name}&apos;s current employment stint and deactivates the account. Distinct from the
              status toggle above (temporary suspension) — a rehire later opens a new stint.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-semibold text-foreground/90">Last working date</label>
                <input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="h-10 text-sm w-full mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground/90">Reason</label>
                <select
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  className="h-10 text-sm w-full mt-1"
                >
                  <option value="">Select a reason</option>
                  {TERMINATION_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {terminationReason === "Other" && (
                <input
                  type="text"
                  placeholder="Specify reason"
                  value={terminationReasonOtherText}
                  onChange={(e) => setTerminationReasonOtherText(e.target.value)}
                  className="h-10 text-sm w-full"
                />
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={closeTerminate}
                className="w-1/3 border border-neutral-400 text-gray-700 font-semibold py-3 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTerminate}
                disabled={isTerminating}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
              >
                {isTerminating ? "Terminating..." : "Confirm Termination"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rehireTarget && (
        <AdminPasswordConfirm
          title="Rehire this employee?"
          description={
            <>
              <b className="text-foreground">{rehireTarget.name}</b> was terminated. Enter your
              admin password to reactivate their account and open a new employment stint.
            </>
          }
          confirmLabel="Rehire"
          confirmingLabel="Rehiring..."
          onCancel={() => setRehireTarget(null)}
          onConfirm={handleRehireConfirm}
        />
      )}
    </div>
  );
}
