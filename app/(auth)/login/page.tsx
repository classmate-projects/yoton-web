'use client'

import { useState } from "react";

// icons
import { LuEye, LuEyeClosed  } from "react-icons/lu";
import Link from "next/link";

export default function LoginPage() {

    const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="h-dvh w-full bg-gray-100 flex justify-center items-center">
      <div className="h-dvh sm:h-fit w-full px-4 sm:px-16 py-8 rounded-xl shadow-xl border-t border-gray-200 bg-white max-w-150 flex flex-col gap-4 justify-center items-center">
        <div className=" flex flex-col items-center gap-1 pb-10">
          <h1 className="text-4xl font-bold text-black text-center">
            Login Page
          </h1>
          <p className="text-sm text-black/60">Welcome back to Yoton</p>
        </div>

        <form className=" w-full flex flex-col justify-center gap-6 ">
          <div className="flex flex-col gap-4 w-full">
            <div>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="username@yoton.to"
                className="bg-gray-100 outline-0 p-4 rounded-xl ring ring-gray-400/40 w-full"
                required
              />
            </div>
            <div className="relative bg-gray-100 outline-0 p-4 rounded-xl ring ring-gray-400/40 w-full"> 
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="********"
                className="outline-none w-[93%] mr-8 flex-1"
                required
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 transform -translate-y-1/2 cursor-pointer h-10 w-10 flex items-center justify-center"
              >
                {showPassword ? (
                    <LuEye className="text-xl"/>
                ) : (
                    <LuEyeClosed className="text-xl"/>
                )}
              </span>
            </div>
          </div>
          <button
            className="theme-blue text-white font-bold flex items-center justify-center gap-2 w-full p-4 rounded-xl mt-4 cursor-pointer hover:bg-[#00288E]/80 transition-all duration-200"
            type="submit"
          >
            Login
          </button>
        </form>
        <Link href="/forgot-password" className="text-center flex justify-center items-center gap-2 text-blue-600 hover:text-blue-500 transition-all duration-200 cursor-pointer">Forgot password?</Link>
      </div>
    </div>
  );
}
