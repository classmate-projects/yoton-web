"use client";

interface getAllResponse {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
}

import { IoPersonAddSharp } from "react-icons/io5";
import { FaGear } from "react-icons/fa6";
import { RiDeleteBinLine } from "react-icons/ri";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import SelectRole from "@/components/selectRole";
import ToggleButton from "@/components/ToggleButton";
import DeleteIcon from "@/public/icons/deleteIcon";
import SettingsIcon from "@/public/icons/SettingsIcon";
import AddUserIcon from "@/public/icons/AddUserIcon";
import SearchIcon from "@/public/icons/SearchIcon";

export default function UserManagement() {
  const [users, setUsers] = useState<getAllResponse[]>([]);
  const [role, setRole] = useState("allRole");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.fullName.toLowerCase().includes(query) ||
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

  const fetchAllUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.body.users);
    } catch (error) {
      console.error("Error fetching users:", error);
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

  const handleDeleteUser = async (id: number) => {
    try {
      await fetch(`/api/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchAllUsers();
    } catch {
      console.log("Error: error with deleting user");
    }
  };

  const handleDelete = (id: number, fullname: string) => {
    toast(
      <span>
        Are you sure, you want to delete{" "}
        <b className="text-red-500 ml-1">{fullname}</b>
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

  const handleToggleUser = async (
    id: number,
    fullName: string,
    email: string,
    role: string,
    phone: string,
    isActive: boolean,
  ) => {

    const payload = {
      id,
      isActive: !isActive,
      fullName,
      email,
      role,
      phone,
    }

    try {
      await fetch(`/api/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === id
            ? { ...user, isActive: !isActive }
            : user
        )
      );
    } catch {
      console.log("Error: error with toggling user");
    }
  }

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

      <div className="w-full mt-8">
        <table className="w-full rounded-xl overflow-hidden border border-neutral-500 border-separate border-spacing-0">
          <thead>
            <tr className="bg-neutral-300">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Last loggedin</th>
              <th className="px-4 py-3 text-left">Created at</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>

          {filteredUsers.length > 0 ? (
            <tbody>
              {filteredUsers
                .slice()
                .sort((a, b) => b.id - a.id)
                .map((user) => (
                  <tr key={user.id} className={`bg-neutral-100 ring ${!user.isActive ? "bg-red-100/80" : ""}`}>
                    <td className="px-4 py-3">{user.fullName}</td>
                    <td className="px-4 py-3">{user.username}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 capitalize">{user.role}</td>
                    <td className="px-4 py-3">{user.phone}</td>
                    <td className="px-4 py-3">{getTime(user.lastLogin)}</td>
                    <td className="px-4 py-3">{getTime(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-4">

                        <ToggleButton
                          checked={user.isActive}
                          onChange={() => handleToggleUser(user.id, user.fullName, user.email, user.role, user.phone, user.isActive,)}
                        />

                        <button
                          onClick={() => handleDelete(user.id, user.fullName)}
                          title="Delete User"
                          className="hover:bg-red-100 p-2 rounded transition-colors cursor-pointer"
                        >
                          <DeleteIcon color="red" />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td colSpan={8} className="text-center py-20 text-gray-600">
                  No users found
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
