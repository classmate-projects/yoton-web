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
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function UserManagement() {
  const [users, setUsers] = useState<getAllResponse[]>([]);

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
    const formattedTime = time.replace(/\.(\d{3})\d*Z$/, ".$1Z");

    return new Date(formattedTime).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleDeleteUser = async (id: number) => {
    try {
      // const deleteConfirmation = confirm(`Do you want to delete user "${fullname}" ?`)
      // if(!deleteConfirmation) return;

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
        <div className="flex items-center gap-4">
          <Link
            href={"/role-management"}
            className="bg-green-500 text-xl p-4 rounded-md text-white hover:bg-green-600 transition-all duration-200 cursor-pointer"
          >
            <FaGear />
          </Link>
          <Link
            href={"/user-registration"}
            className="bg-blue-500 text-xl p-4 rounded-md text-white hover:bg-blue-600 transition-all duration-200 cursor-pointer"
          >
            <IoPersonAddSharp />
          </Link>
        </div>
      </div>

      <div className="mt-8 flex items-center w-full justify-between gap-6">
        <div className="card flex-1 px-6 py-4 rounded-xl flex items-center justify-between gap-6">
          <input
            type="search"
            placeholder="Filter by name or username"
            className="border flex-1 border-neutral-600/50 px-4 py-2 rounded-md outline-0"
          />
          <div className="flex items-center justify-between gap-4">
            <select
              name="role"
              id="role"
              className="border border-neutral-500 px-4 py-2 rounded-md outline-0"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="receptionist">Receptionist</option>
            </select>

            <select
              name="date"
              id="date"
              className="border border-neutral-500 px-4 py-2 rounded-md outline-0"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>

            <button className="border border-neutral-500 px-4 py-2 rounded-md bg-neutral-300/80 hover:bg-neutral-300 transition-all duration-200 cursor-pointer">
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

          {users.length > 0 ? (
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="bg-neutral-100 ring">
                  <td className="px-4 py-3">{user.fullName}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.role}</td>
                  <td className="px-4 py-3">{user.phone}</td>
                  <td className="px-4 py-3">{getTime(user.lastLogin)}</td>
                  <td className="px-4 py-3">{getTime(user.createdAt)}</td>
                  <td
                    onClick={() => handleDelete(user.id, user.fullName)}
                    className="flex h-12 items-center justify-center"
                  >
                    <RiDeleteBinLine
                      size={20}
                      className="text-red-400 hover:text-red-600 transition-all duration-200 cursor-pointer"
                    />
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
