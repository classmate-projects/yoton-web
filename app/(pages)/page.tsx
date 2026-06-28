"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  Stethoscope, 
  Calendar, 
  FlaskConical,
  Activity,
  ArrowUpRight,
  LucideIcon
} from "lucide-react";
import { DashboardService } from "@/services/dashboard.service";

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

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: { title: string, value: number | string, subtext?: string, icon: LucideIcon, colorClass: string }) => (
  <div className="card group hover:ring-2 hover:ring-primary transition-all duration-300">
    <div className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-2xl ${colorClass.replace('bg-', 'bg-').replace('text-', 'text-')} bg-current/10 transition-transform group-hover:scale-110 duration-300`}>
          <Icon size={24} className={colorClass.split(' ')[1]} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {subtext ? (
          <p className="text-xs text-muted-foreground font-medium">{subtext}</p>
        ) : (
          <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <ArrowUpRight size={12} />
            <span>Active</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default function Home() {
  const [totalCounts, setTotalCounts] = useState<TotalCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTotalCounts = async () => {
      try {
        setIsLoading(true);
        const data = await DashboardService.getCounts();
        console.log("Data: ", data)
        setTotalCounts(data);
      } catch (error) {
        console.error("Failed to fetch total counts", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTotalCounts();
  }, []);

  return (
    <div className="mainPage h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time overview of clinic operations and patient activity.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-32 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard 
            title="Total Patients" 
            value={totalCounts?.totalPatients || 0} 
            icon={Users} 
            colorClass="bg-blue-500 text-blue-500" 
          />
          <StatCard 
            title="Active Doctors" 
            value={totalCounts?.totalDoctors || 0} 
            icon={Stethoscope} 
            colorClass="bg-primary text-primary" 
          />
          <StatCard 
            title="Appointments" 
            value={totalCounts?.totalAppointments || 0} 
            subtext={`${totalCounts?.pendingAppointments || 0} pending • ${totalCounts?.completedAppointments || 0} done`}
            icon={Calendar} 
            colorClass="bg-amber-500 text-amber-500" 
          />
          <StatCard 
            title="Lab & Imaging" 
            value={(totalCounts?.totalLabRequests || 0) + (totalCounts?.totalRadiologyRequests || 0)} 
            subtext={`${(totalCounts?.pendingLabRequests || 0) + (totalCounts?.pendingRadiologyRequests || 0)} awaiting results`}
            icon={FlaskConical} 
            colorClass="bg-rose-500 text-rose-500" 
          />
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 card p-8 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 transition-opacity" />
            <Activity size={48} className="text-primary/20 mb-6 group-hover:scale-110 transition-transform duration-500" />
            <h3 className="text-xl font-bold">Activity Timeline</h3>
            <p className="text-muted-foreground text-center mt-3 max-w-sm text-sm">
              Real-time patient flow and staff updates will appear here once the websocket service is active.
            </p>
            <button className="mt-8 text-xs font-bold uppercase tracking-widest text-primary hover:underline underline-offset-4">
              View All logs
            </button>
         </div>

         <div className="card p-8 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent opacity-50" />
            <Calendar size={48} className="text-amber-500/20 mb-6 group-hover:scale-110 transition-transform duration-500" />
            <h3 className="text-xl font-bold">Today&apos;s Schedule</h3>
            <p className="text-muted-foreground text-center mt-3 max-w-sm text-sm">
              Your prioritized list of upcoming appointments for the next 24 hours.
            </p>
            <div className="mt-8 flex gap-2">
              <div className="w-8 h-1 rounded-full bg-amber-500/20" />
              <div className="w-2 h-1 rounded-full bg-amber-500/20" />
              <div className="w-2 h-1 rounded-full bg-amber-500/20" />
            </div>
         </div>
      </div>
    </div>
  );
}