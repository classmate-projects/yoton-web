'use client'

import Image from "next/image";
import logo from "@/public/yoton_logo.png";
import { useState } from "react";

// icons
import { LuEye, LuEyeClosed  } from "react-icons/lu";

export default function LoginPage() {

    const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="h-dvh w-full bg-gray-100 flex justify-center items-center">
      <div className="h-dvh sm:h-fit w-full px-4 sm:px-12 py-8 rounded-2xl shadow-lg border-t border-gray-200 bg-white sm:w-1/3 flex flex-col gap-4 justify-start items-center">
        <div className=" flex flex-col items-center gap-1 pb-10">
          <Image src={logo} alt="logo" width={150} height={150} />
          <h1 className="text-3xl font-bold text-blue-500 text-center">
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
                className="outline-none w-full px-4 py-2 rounded-xl shadow-md border-t border-gray-200/70"
                required
              />
            </div>
            <div className="relative w-full px-4 py-2 rounded-xl shadow-md border-t border-gray-200/70"> 
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="********"
                className="outline-none w-full pr-8"
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
            className="bg-blue-500 py-2 text-white rounded-xl text-xl hover:bg-blue-600 transition-all duration-200 cursor-pointer mt-4"
            type="submit"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
