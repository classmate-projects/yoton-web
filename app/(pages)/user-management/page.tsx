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
        <div className="flex items-center gap-4 shadow-lg px-4 py-2 rounded-full">
          <Link
            href={"/role-management"}
            title="Manage Roles"
            className="text-xl p-4 rounded-full text-white hover:bg-gray-200 transition-all duration-200 cursor-pointer"
          >
            <SettingsIcon size={20} />
          </Link>
          <Link
            href={"/user-registration"}
            onClick={() => sessionStorage.removeItem("editUser")}
            title="User Registration"
            className=" text-xl p-4 rounded-full text-white hover:bg-gray-200 transition-all duration-200 cursor-pointer"
          >
            <AddUserIcon size={20} />
          </Link>
        </div>
      </div>

      <div className="mt-8 flex items-center w-full justify-between gap-6">
        <div className="card flex-1 px-6 py-4 rounded-xl flex items-center justify-between gap-6">
          <div className=" flex-1 relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Filter by name or username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border w-full border-neutral-600/50 px-4 pl-10 py-2 rounded-md outline-0"
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
              className="border border-neutral-500 px-4 py-1.25 rounded-md bg-neutral-300/80 hover:bg-neutral-300 transition-all duration-200 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="bg-gray-500 p-6 rounded-xl text-white">
          <h3>Total Users: {users.length}</h3>
        </div>
      </div>

      <div className="card rounded-xl shadow-lg border border-neutral-300/80 overflow-hidden mt-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-200">
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Name</th>
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Username</th>
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Email</th>
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Role</th>
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Phone</th>
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Last loggedin</th>
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Created at</th>
              <th className="px-5 py-4 text-sm font-bold text-neutral-700">Action</th>
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
                  <tr key={user.id} className={`border-b border-neutral-200/80 last:border-b-0 transition-colors ${!user.isActive ? "bg-red-100/80 text-gray-500 hover:bg-red-100" : "bg-white hover:bg-neutral-50/60"}`}>
                    <td className="px-5 py-4 text-sm font-semibold text-neutral-850">{user.name}</td>
                    <td className="px-5 py-4 text-sm text-neutral-800">{user.username}</td>
                    <td className="px-5 py-4 text-sm text-neutral-800">{user.email}</td>
                    <td className="px-5 py-4 text-sm capitalize text-neutral-800">{user.role}</td>
                    <td className="px-5 py-4 text-sm text-neutral-800">{user.phone}</td>
                    <td className="px-5 py-4 text-sm text-neutral-800">{getTime(user.lastLogin)}</td>
                    <td className="px-5 py-4 text-sm text-neutral-805">{getTime(user.createdAt)}</td>
                    <td className="px-5 py-4 text-sm">
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
