"use client";

import SelectRole from "@/components/selectRole";
import ToggleButton from "@/components/ToggleButton";
import { baseUrl } from "@/lib/constants";
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

  const router = useRouter();
  const searchParams = useSearchParams();
  const editMode = searchParams.get("edit") === "true";

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
        }
      } catch (error) {
        console.error("Error loading user edit data from sessionStorage:", error);
      }
    }
  }, [editMode]);

  const handleUserReg = async () => {
    try {
      if (!name || !username || !password || !email || !role || !phone) {
        toast.warning("Please fill all the required fields");
        return;
      }

      const res = await fetch(`${baseUrl}/api/user/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          email,
          password,
          role,
          phone,
        }),
      });
      if (!res.ok) {
        throw new Error("User registration failed");
      }

      const data = await res.json();

      setEmail("");
      setName("");
      setUsername("");
      setPhone("");
      setPassword("");
      setRole("");

      sessionStorage.removeItem("editUser");
      toast.success(data.message);

      router.push("/user-management");
    } catch (error) {
      console.log(error);
    }
  };

  const handleUserUpdate = async () => {
    try {
      if (!name || !username || !email || !role || !phone) {
        toast.warning("Please fill all the required fields");
        return;
      }

      const res = await fetch(`${baseUrl}/api/user/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          email,
          role,
          phone,
          isActive,
        }),
      });

      if (!res.ok) {
        throw new Error("User update failed");
      }

      sessionStorage.removeItem("editUser");
      toast.success("User changes saved successfully!");
      router.push("/user-management");
    } catch (error) {
      console.log("Error updating user:", error);
    }
  };

  return (
    <div className=" h-dvh flex flex-col py-8 px-10 gap-4">
      <div>
        <h1 className="text-4xl font-semibold">
          {editMode ? "Edit Staff Details" : "Staff Registration"}
        </h1>
        <p className="text-sm text-gray-500">
          {editMode
            ? "Update personnel details and system access permissions."
            : "Enter new personnel details to provision system access."}
        </p>
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
          className="card rounded-xl shadow-2xl border-t p-8 mt-8 flex flex-col gap-6"
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
                  <label htmlFor="username" className="font-bold required">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    required
                    placeholder="johnathandoe123"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
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
                  <label htmlFor="password" className="font-bold required">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    className="outline-0 p-4 rounded-xl w-full mt-2"
                    style={{
                      backgroundColor: "var(--color-highlight)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>
              </div>
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
              {editMode ? "Save Changes" : "Register User"}
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
