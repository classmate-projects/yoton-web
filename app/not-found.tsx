"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdOutlineMedicalServices, MdArrowBack, MdHome } from "react-icons/md";

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh flex flex-col justify-center items-center px-6 py-12 bg-neutral-50 relative overflow-hidden select-none">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-200/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/30 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center flex flex-col items-center z-10">

        {/* Big 404 text with gradient */}
        <h1 className="text-9xl font-black tracking-tight text-neutral-850 relative select-none">
          <span className="bg-gradient-to-r from-teal-600 via-teal-500 to-blue-600 bg-clip-text text-transparent">
            404
          </span>
        </h1>

        <h2 className="text-2xl font-bold text-neutral-800 mt-4">
          Oops! Page Not Found
        </h2>
        
        <p className="text-neutral-500 mt-3 text-base leading-relaxed">
          The medical record or dashboard page you are trying to access might have been moved, deleted, or does not exist. Let's get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full mt-8">
          <button
            onClick={() => router.back()}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border border-neutral-300 rounded-xl bg-white text-neutral-700 font-semibold shadow-sm hover:bg-neutral-50 cursor-pointer active:scale-[0.98] transition duration-200"
          >
            <MdArrowBack size={20} className="text-neutral-500" />
            Go Back
          </button>
          
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-500 text-white font-semibold shadow-md shadow-teal-500/20 hover:bg-teal-600 cursor-pointer active:scale-[0.98] transition duration-200 animate-pulse"
            style={{ animationDuration: '3s' }}
          >
            <MdHome size={20} />
            Go to Home
          </Link>
        </div>
        
        {/* Footer info */}
        <p className="text-xs text-neutral-400 mt-12">
          If you believe this is an error, please contact your system administrator.
        </p>
      </div>
    </div>
  );
}