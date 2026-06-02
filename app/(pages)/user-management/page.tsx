"use client";

interface getAllResponse {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
}

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SelectRole from "@/components/selectRole";
import ToggleButton from "@/components/ToggleButton";
import DeleteIcon from "@/public/icons/deleteIcon";
import SettingsIcon from "@/public/icons/SettingsIcon";
import AddUserIcon from "@/public/icons/AddUserIcon";
import SearchIcon from "@/public/icons/SearchIcon";
import { baseUrl } from "@/lib/constants";
import EditIcon from "@/public/icons/EditIcon";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function UserManagement() {

  const router = useRouter();
  const [users, setUsers] = useState<getAllResponse[]>([]);
  const [role, setRole] = useState("allRole");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

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

      return matchesSearch && matchesRole && matchesActiveStatus;
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
      const res = await fetch(`${baseUrl}/api/user/users`);
      const data = await res.json();
      setUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      await fetchAllUsers();
    };

    loadUser();
  }, []);

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
  const handleDeleteUser = async (id: number) => {
    try {
      const res = await fetch(`${baseUrl}/api/user/${id}`, {
        method: "DELETE",
      });
      const data = await res.json()
      if (!res.ok) throw new Error("Failed to delete user")

      toast.success(data?.message)
      fetchAllUsers();
    } catch {
      console.log("Error: error with deleting user");
    }
  };

  // show toast for permission to delete user 
  const handleDelete = (id: number, name: string) => {
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

  // toggle user
  const handleToggleUser = async (user: getAllResponse) => {
    const payload = {
      ...user,
      isActive: !user.isActive,
    };

    try {
      const res = await fetch(`${baseUrl}/api/user/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to Toggle user")

      toast.success(`Status changed to ${!user.isActive ? "active" : "inactive"}`)

      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isActive: !user.isActive }
            : u
        )
      );
    } catch {
      console.log("Error: error with toggling user");
    }
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
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-3 py-2 shadow-sm">
          <Link
            href={"/role-management"}
            title="Manage Roles"
            aria-label="Manage Roles"
            className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <SettingsIcon size={20} />
          </Link>
          <Link
            href={"/user-registration"}
            onClick={() => sessionStorage.removeItem("editUser")}
            title="User Registration"
            aria-label="User Registration"
            className="grid h-11 w-11 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-sm transition-all duration-200 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 "
          >
            <AddUserIcon size={20} />
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

            {/* <select
              name="date"
              id="date"
              className="border border-neutral-500 px-4 py-2 rounded-md outline-0"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select> */}

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
          <h3>Total Users: {users.length}</h3>
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
            ) : filteredUsers.length > 0 ? (
              filteredUsers
                .slice()
                .sort((a, b) => b.id - a.id)
                .map((user) => (
                  <tr key={user.id} className={!user.isActive ? "bg-red-50/50 opacity-80" : ""}>
                    <td className="font-semibold">{user.name}</td>
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
                          onClick={() => handleDelete(user.id, user.name)}
                          title="Delete User"
                          className="hover:bg-red-100 p-2 rounded-full transition-colors cursor-pointer"
                        >
                          <DeleteIcon color="red" />
                        </button>

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
    </div>
  );
}
