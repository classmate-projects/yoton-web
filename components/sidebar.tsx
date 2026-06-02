"use client";

interface CurrentUserType {
  role: string;
  name: string;
}

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems } from "@/helpers/sidebaritems";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import pkg from "@/package.json";
import { useEffect, useState } from "react";
import LogoutIcon from "@/public/icons/LogoutIcon";

import { IoIosArrowDroprightCircle } from "react-icons/io";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserType | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const user = localStorage.getItem("yoton_user_detail");

      if (user) {
        setCurrentUser(JSON.parse(user));
      }
    });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    localStorage.removeItem("yoton_user_detail");
    router.push("/login");
  };

  return (
    <div
      className={`bg-white sticky top-0 h-screen p-1.5 border-r border-neutral-400/50 z-50 transition-all duration-300 ease-in-out shrink-0 ${
        isExpanded ? "w-80" : "w-20"
      }`}
    >
      <style>{`
        .sidebar::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar::-webkit-scrollbar-thumb {
          background: #d4d4d8;
          border-radius: 3px;
        }
      `}</style>

      {/* sidebar toggle */}
      <IoIosArrowDroprightCircle
        title={isExpanded ? "Collapse" : "Expand"}
        onClick={() => setIsExpanded((prev) => !prev)}
        className={`absolute -right-4 top-12 transition-all duration-200 cursor-pointer ${isExpanded ? "rotate-180" : ""}`}
        size={30}
      />

      {/* header section */}
      <div className="flex items-center justify-center gap-3 pb-4">
        <Image src={logo} alt="logo" height={50} width={50} loading="eager" />
        {isExpanded && (
          <div className="transition-opacity duration-300">
            <h1 className="text-lg font-bold text-[#1AAFBE] whitespace-nowrap">
              Yoton Health
            </h1>
            <div className="text-xs flex items-center capitalize gap-1">
              <p className="text-black"> {currentUser?.role} user:</p>
              <p className="truncate">{currentUser?.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* menu section */}
      <div className="mt-8">
        <ul className="flex flex-col gap-2">
          {sidebarMenuItems.map((item) => {
            if (item.roles.includes(currentUser?.role ?? "")) {
              const isActive = pathname === item.navLink;
              return (
                <li key={item.id} title={isExpanded ? "" : item.name}>
                  <Link
                    href={item.navLink}
                    title={isExpanded ? "" : item.name}
                    className={`flex items-center  gap-3 py-2 px-2.5 rounded-xl transition-all duration-200 ${
                      isExpanded ? "px-3 justify-start" : "justify-center"
                    } ${
                      isActive
                        ? "bg-neutral-300 font-semibold"
                        : "hover:bg-neutral-200"
                    }`}
                  >
                    <span className="shrink-0">
                      <item.icon />
                    </span>
                    {isExpanded && (
                      <span className="whitespace-nowrap text-base">
                        {item.name}
                      </span>
                    )}
                  </Link>
                </li>
              );
            }
            return null;
          })}
        </ul>
      </div>

      <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center px-2 py-2 gap-3">
        {isExpanded && (
          <p className="text-center text-xs text-neutral-600">v{pkg.version}</p>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          className={`border-2 border-neutral-400 rounded-md cursor-pointer hover:bg-neutral-300 transition-all duration-200 flex items-center justify-center gap-3 ${
            isExpanded ? "px-3 py-2 w-full" : "p-2"
          }`}
        >
          {isExpanded && <span className="text-sm">Logout</span>}
          <LogoutIcon />
        </button>
      </div>
    </div>
  );
}
