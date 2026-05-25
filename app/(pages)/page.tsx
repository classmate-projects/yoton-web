"use client";

import { useEffect, useState } from "react";
import { 
  MdPeople, 
  MdOutlineMedicalServices, 
  MdCalendarToday, 
  MdOutlineScience,
  MdOutlineLocalHospital
} from "react-icons/md";

interface TotalCounts {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  totalLabRequests: number;
  pendingLabRequests: number;
  totalRadiologyRequests: number;
  pendingRadiologyRequests: number;
}

export default function Home() {
  const [totalCounts, setTotalCounts] = useState<TotalCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTotalCounts = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/total-counts");
        const data = await res.json();
        setTotalCounts(data);
      } catch (error) {
        console.error("Failed to fetch total counts", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTotalCounts();
  }, []);

  const StatCard = ({ title, value, subtext, icon: Icon, color }: { title: string, value: number | string, subtext?: string, icon: any, color: string }) => (
    <div className="card p-6 rounded-2xl shadow-sm border border-[var(--color-border)] hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-gray-500 font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
      {subtext && <p className="text-sm text-gray-500">{subtext}</p>}
    </div>
  );

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold">Dashboard Overview</h1>
        <p className="text-sm text-gray-500">
          Welcome back! Here is what's happening at the clinic today.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-xl text-gray-500 animate-pulse">Loading dashboard data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard 
            title="Total Patients" 
            value={totalCounts?.totalPatients || 0} 
            icon={MdPeople} 
            color="bg-blue-500" 
          />
          <StatCard 
            title="Total Doctors" 
            value={totalCounts?.totalDoctors || 0} 
            icon={MdOutlineMedicalServices} 
            color="bg-teal-500" 
          />
          <StatCard 
            title="Total Appointments" 
            value={totalCounts?.totalAppointments || 0} 
            subtext={`${totalCounts?.pendingAppointments || 0} pending | ${totalCounts?.completedAppointments || 0} completed`}
            icon={MdCalendarToday} 
            color="bg-indigo-500" 
          />
          <StatCard 
            title="Lab & Radiology" 
            value={(totalCounts?.totalLabRequests || 0) + (totalCounts?.totalRadiologyRequests || 0)} 
            subtext={`${(totalCounts?.pendingLabRequests || 0) + (totalCounts?.pendingRadiologyRequests || 0)} pending tests`}
            icon={MdOutlineScience} 
            color="bg-rose-500" 
          />
        </div>
      )}
      
      {/* Additional dashboard widgets could go here */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="card p-6 rounded-2xl shadow-sm border border-[var(--color-border)] min-h-64 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
            <MdOutlineLocalHospital size={64} className="text-blue-200 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">Recent Activities</h3>
            <p className="text-gray-500 text-center mt-2 max-w-sm">
              Activity feed will appear here as soon as the real-time logging service is connected.
            </p>
         </div>

         <div className="card p-6 rounded-2xl shadow-sm border border-[var(--color-border)] min-h-64 flex flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-green-50">
            <MdCalendarToday size={64} className="text-teal-200 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">Upcoming Appointments</h3>
            <p className="text-gray-500 text-center mt-2 max-w-sm">
              Quick view of today's schedule will be displayed here for easy access.
            </p>
         </div>
      </div>
    </div>
  );
}