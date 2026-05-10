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
      className="sidebar fixed left-0 top-0 h-dvh overflow-hidden min-w-72 p-1.5 border-r border-neutral-400/50 z-10"
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
            <ul className="flex flex-col">
                {sidebarMenuItems.map((item) => {
                    if (item.roles.includes(currentUserRole)) {
                        const isActive = pathname === item.navLink;
                        return (
                            <li key={item.id}>
                                <Link 
                                    href={item.navLink} 
                                    className={`flex items-center gap-3 text-lg py-2 px-4 rounded-lg transition-colors duration-200 ${
                                        isActive 
                                            ? 'bg-neutral-300 font-semibold' 
                                            : 'hover:bg-neutral-200'
                                    }`}
                                >
                                    <span className="text-3xl"><item.icon /></span>
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
