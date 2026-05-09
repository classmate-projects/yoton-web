'use client'

import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems } from "@/helpers/sidebaritems";
import Link from "next/link";
import { usePathname } from "next/navigation";
import pkg from "@/package.json";


export default function Sidebar() {
    const pathname = usePathname();
    const currentUserRole = "receptionist"; // This should be dynamically set based on the logged-in user's role
    console.log("Sidebar rendered with role:", currentUserRole);


  return (
    <div
      className="sidebar h-dvh min-w-72 p-4 border-r shadow-2xl relative"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* header section */}
      <div className="flex items-center gap-3">
        <Image src={logo} alt="logo" height={70} width={70} />
        <div>
          <h1 className="text-xl font-bold text-[#1AAFBE]">Yoton Health</h1>
          <p className="text-sm text-black/50">
            <b>Admin:</b> John Doe
          </p> {/* This should be dynamically set based on the logged-in user's name */}
        </div>
      </div>


        {/* menu section */}
        <div className="mt-14">
            <ul className="flex flex-col gap-4">
                {sidebarMenuItems.map((item) => {
                    if (item.roles.includes(currentUserRole)) {
                        const isActive = pathname === item.navLink;
                        return (
                            <li key={item.id}>
                                <Link 
                                    href={item.navLink} 
                                    className={`flex items-center gap-3 text-lg py-2 px-4 rounded-lg transition-colors duration-200 border-l-4 ${
                                        isActive 
                                            ? 'bg-blue-100 border-l-blue-500 font-semibold' 
                                            : 'border-transparent hover:bg-blue-300/15 hover:border-l-blue-400/50'
                                    }`}
                                >
                                    <span className="text-2xl"><item.icon /></span>
                                    {item.name}
                                </Link>
                            </li>
                        );
                    }
                    return null;
                })}
            </ul>
        </div>
        <p className="text-center text-sm absolute bottom-2 left-0 right-0">Version: {pkg.version}</p>
    </div>
  );
}
