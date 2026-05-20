"use client";

import SelectRole from "@/components/selectRole";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";


export default function UserRegistrationPage() {
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  

  const router = useRouter();

  const handleUserReg = async () => {
    try {
      if (!fullname || !username || !password || !email || !role || !phone) {
        alert("Please fill the form first")
        return;
      }

      const res = await fetch("api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullname,
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

      const data = await res.json()

      setEmail("");
      setFullname("");
      setUsername("");
      setPhone("");
      setPassword("");
      setRole("");

      toast.success(data.body.message)

      router.push("/user-management");
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className=" h-dvh flex flex-col py-8 px-10 gap-4">
      <div>
        <h1 className="text-4xl font-semibold">Staff Registration</h1>
        <p className="text-sm text-gray-500">
          Enter new personnel details to provision system access.
        </p>
      </div>

      <div>
        <form
          onSubmit={handleUserReg}
          className="card rounded-xl shadow-2xl border-t p-8 mt-8 flex flex-col gap-6"
        >
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
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
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
        </form>

        <div className="mt-6 flex justify-end gap-4">
          <button
            type="reset"
            className="px-6 py-3 rounded-md border border-neutral-400 hover:bg-neutral-200/50 transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleUserReg}
            className="px-6 py-3 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 cursor-pointer"
          >
            Register User
          </button>
        </div>
      </div>
    </div>
  );
}
