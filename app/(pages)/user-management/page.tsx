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
  branchId: string | null;
  userImage?: string | null;
}

import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import SelectRole from "@/components/selectRole";
import SearchableSelect from "@/components/SearchableSelect";
import DatePicker from "@/components/DatePicker";
import ToggleButton from "@/components/ToggleButton";
import DeleteIcon from "@/public/icons/deleteIcon";
import SettingsIcon from "@/public/icons/SettingsIcon";
import AddUserIcon from "@/public/icons/AddUserIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import EditIcon from "@/public/icons/EditIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { History as HistoryIcon, UserX } from "lucide-react";
import { UserService } from "@/services/user.service";
import { NursingService } from "@/services/nursing.service";
import { NurseShiftInput } from "@/types/nursing.type";
import { notifySaveStatus } from "@/lib/saveStatus";
import { StaffEmploymentEventType } from "@/types/user.type";
import { useSignalRRefetch } from "@/hooks/useSignalRRefetch";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { confirmDeleteToast } from "@/lib/confirmDeleteToast";
import { BranchService } from "@/services/branch.service";
import { BranchType } from "@/types/branch.type";
import { getUserDetail } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";

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

// Shows the uploaded profile photo, falling back to initials when there isn't one or it
// fails to load (e.g. the file was removed from the server).
function UserAvatar({ name, image }: { name: string; image?: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = backendAssetUrl(image);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
      {initials}
    </div>
  );
}

export default function UserManagement() {

  const router = useRouter();
  const [users, setUsers] = useState<getAllResponse[]>([]);
  const [role, setRole] = useState("allRole");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);


  const [branches, setBranches] = useState<BranchType[]>([]);
  // Defaults to the signed-in staff member's own branch (not "All") - most admins managing
  // day-to-day staff only care about their own location; "All" is one click away in the
  // dropdown for whoever actually needs the cross-branch view.
  const [branchFilter, setBranchFilter] = useState(() => getUserDetail()?.branchId || "allBranch");

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

  // Set for the ordinary activate/deactivate toggle (any non-terminated user, including
  // admins now that they're shown in this list) - always routed through a password-gated
  // confirm so a stolen/unattended admin session can't silently flip another account's
  // access, same reasoning as Restore/Rehire above.
  const [statusToggleTarget, setStatusToggleTarget] = useState<getAllResponse | null>(null);

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

      const matchesBranch = branchFilter === "allBranch" || user.branchId === branchFilter;

      return matchesSearch && matchesRole && matchesActiveStatus && matchesBranch;
    });
  }, [users, searchQuery, role, activeStatus, branchFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setRole("allRole");
    setActiveStatus("all");
    setBranchFilter("allBranch");
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
    BranchService.getAll()
      .then((res) => setBranches(res.data ?? []))
      .catch(() => {});
  }, []);

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
    confirmDeleteToast(
      <span>
        Are you sure, you want to delete{" "}
        <b className="text-red-500 ml-1">{name}</b>
      </span>,
      () => handleDeleteUser(id)
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
    notifySaveStatus("saving");
    setSavingShifts(true);
    try {
      const shifts: NurseShiftInput[] = shiftsWeek
        .map((row, day) => ({ day, startTime: `${row.startTime}:00`, endTime: `${row.endTime}:00`, isActive: row.active }))
        .filter((row) => row.isActive);
      await NursingService.setNurseShifts(shiftsTarget.id, shifts);
      toast.success("Shifts updated");
      notifySaveStatus("saved");
      closeShiftsManager();
    } catch {
      notifySaveStatus("error");
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
  // Every other case (activating or deactivating any user, admins included) now requires
  // the caller's own password too - see statusToggleTarget above.
  const handleToggleUser = (user: getAllResponse) => {
    if (!user.isActive && user.isTerminated) {
      setRehireTarget(user);
      return;
    }

    setStatusToggleTarget(user);
  };

  // Confirmed from the status-toggle prompt below - same step-up pattern as
  // handleRehireConfirm. Left throwing on failure so the prompt can show "incorrect
  // password" and let the admin retry.
  const handleStatusToggleConfirm = async (adminPassword: string) => {
    if (!statusToggleTarget) return;
    const nextIsActive = !statusToggleTarget.isActive;
    await UserService.updateStatus(statusToggleTarget.id, nextIsActive, adminPassword);
    toast.success(`Status changed to ${nextIsActive ? "active" : "inactive"}`);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === statusToggleTarget.id ? { ...u, isActive: nextIsActive } : u
      )
    );
    setStatusToggleTarget(null);
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

  const renderActions = (user: getAllResponse) => (
    <div className="flex items-center justify-evenly">
      <button
        onClick={() => openHistory(user)}
        title="Employment History"
        className="hover:bg-muted p-2 rounded-full transition-colors cursor-pointer text-blue-600"
      >
        <HistoryIcon size={18} />
      </button>

      {user.isActive && (
        <button
          onClick={() => openTerminate(user)}
          title="Terminate Employment"
          className="hover:bg-muted p-2 rounded-full transition-colors cursor-pointer text-orange-600"
        >
          <UserX size={18} />
        </button>
      )}

      <button
        onClick={() => handleDelete(user.id, user.name)}
        title="Delete User"
        className="hover:bg-muted p-2 rounded-full transition-colors cursor-pointer"
      >
        <DeleteIcon color="red" size={18} />
      </button>

      {!user.isTerminated && (
        <button
          onClick={() => {
            sessionStorage.setItem("editUser", JSON.stringify(user));
            router.push("/user-registration?edit=true");
          }}
          title="Edit User"
          className="hover:bg-muted p-2 rounded-full transition-colors cursor-pointer"
        >
          <EditIcon color="blue" size={18} />
        </button>
      )}


    </div>
  );

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

            <SearchableSelect
              value={activeStatus}
              onChange={setActiveStatus}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />

            <SearchableSelect
              value={branchFilter}
              onChange={setBranchFilter}
              options={[
                { value: "allBranch", label: "All branches" },
                ...branches.map((b) => ({ value: b.branchId, label: b.name + (b.isMain ? " (Main)" : "") })),
              ]}
            />

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

      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {isLoading ? (
          <div className="card col-span-full flex justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className={`card flex flex-col gap-3 p-4 ${
                user.isTerminated
                  ? "bg-red-100/80 dark:bg-red-950/30"
                  : !user.isActive
                  ? "bg-red-50/50 opacity-80"
                  : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <UserAvatar name={user.name} image={user.userImage} />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-semibold ${
                      user.isTerminated ? "text-muted-foreground line-through decoration-red-400" : ""
                    }`}
                    title={user.name}
                  >
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={user.username}>
                    @{user.username}
                  </p>
                </div>
                <ToggleButton checked={user.isActive} onChange={() => handleToggleUser(user)} />
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-primary">
                  {user.role}
                </span>
                {user.isTerminated ? (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Terminated
                  </span>
                ) : !user.isActive ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Inactive
                  </span>
                ) : null}
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate" title={user.email}>{user.email}</dd>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="truncate">{user.phone}</dd>
                <dt className="text-muted-foreground">Last login</dt>
                <dd className="truncate">{getTime(user.lastLogin)}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="truncate">{getTime(user.createdAt)}</dd>
              </dl>

              <div className="mt-auto border-t border-border pt-2.5">
                {renderActions(user)}
              </div>
            </div>
          ))
        ) : (
          <div className="card col-span-full">
            <EmptyState illustration="users" title="No users found" description="Staff accounts you register will appear here." />
          </div>
        )}
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
                <div className="mt-1">
                  <DatePicker
                    value={terminationDate}
                    onChange={setTerminationDate}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground/90">Reason</label>
                <div className="mt-1">
                  <SearchableSelect
                    value={terminationReason}
                    onChange={setTerminationReason}
                    options={[
                      { value: "", label: "Select a reason" },
                      ...TERMINATION_REASONS,
                    ]}
                  />
                </div>
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

      {statusToggleTarget && (
        <AdminPasswordConfirm
          title={statusToggleTarget.isActive ? "Deactivate this user?" : "Activate this user?"}
          description={
            <>
              Enter your admin password to {statusToggleTarget.isActive ? "deactivate" : "activate"}{" "}
              <b className="text-foreground">{statusToggleTarget.name}</b>
              {statusToggleTarget.role.toLowerCase() === "admin" ? " (admin account)" : ""}.
            </>
          }
          confirmLabel={statusToggleTarget.isActive ? "Deactivate" : "Activate"}
          confirmingLabel="Saving..."
          onCancel={() => setStatusToggleTarget(null)}
          onConfirm={handleStatusToggleConfirm}
        />
      )}
    </div>
  );
}
