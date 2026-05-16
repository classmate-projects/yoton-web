"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function UserManagement() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();

        console.log("Fetched users:", data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchAllUsers();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">User Management</h1>
          <p>
            Efficiently manage hospital staff access, roles, and administrative
            permissions.
          </p>
        </div>
        <Link href={"/user-registration"} className="bg-blue-500 px-4 py-2 rounded-md text-white hover:bg-blue-600 transition-all duration-200 cursor-pointer">
          Add User
        </Link>
      </div>

      <div className="mt-8 flex items-center w-full justify-between gap-6">
        <div className="card flex-1 px-6 py-4 rounded-xl flex items-center justify-between gap-6">
          <input
            type="search"
            placeholder="Filter by name or username"
            className="border flex-1 border-neutral-600/50 px-4 py-2 rounded-md outline-0"
          />
          <div className="flex items-center justify-between gap-4">
            <select name="role" id="role" className="border border-neutral-500 px-4 py-2 rounded-md outline-0">
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="receptionist">Receptionist</option>
            </select>

            <select name="date" id="date" className="border border-neutral-500 px-4 py-2 rounded-md outline-0">
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
    </div>
  );
}
