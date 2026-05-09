import logo from "@/public/yoton_logo.png";
import Image from "next/image";
import { sidebarMenuItems } from "./helpers/sidebaritems";
import Link from "next/link";


export default function Sidebar() {

    const currentUserRole = "admin"; // This should be dynamically set based on the logged-in user's role
    console.log("Sidebar rendered with role:", currentUserRole);


  return (
    <div
      className="sidebar h-dvh min-w-72 p-4 border-r"
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
            <ul>
                {sidebarMenuItems.map((item) => {
                    if (item.roles.includes(currentUserRole)) {
                        return (
                            <li key={item.id}>
                                <Link href={item.navLink} className="block py-2 px-4 hover:bg-blue-200/20 rounded-xl transition-colors duration-200 border-l-4 border-transparent hover:border-l-4 hover:border-blue-500">
                                    {item.name}
                                </Link>
                            </li>
                        );
                    }
                    return null;
                })}
            </ul>
        </div>
    </div>
  );
}
