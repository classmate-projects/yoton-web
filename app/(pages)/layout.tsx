import Sidebar from "@/components/sidebar";

export default function PageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full flex flex-row">
      <Sidebar />
      <div className="flex-1 ml-72">{children}</div>
    </div>
  );
}
