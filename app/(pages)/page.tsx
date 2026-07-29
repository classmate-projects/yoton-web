"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Users,
  Stethoscope,
  Calendar,
  FlaskConical,
  Activity,
  Trophy,
  ArrowUpRight,
  LucideIcon
} from "lucide-react";
import { DashboardService } from "@/services/dashboard.service";
import BarChart, { BarChartPoint } from "@/components/BarChart";
import TopDoctorsList from "@/components/TopDoctorsList";
import { RevenuePoint, TopDoctor, WeeklyAppointmentPoint } from "@/types/dashboard.type";

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

// The API only returns days that had appointments — backfill the missing days
// of the last week with 0 so the chart reads as a full 7-day trend.
const buildWeeklySeries = (points: WeeklyAppointmentPoint[]): BarChartPoint[] => {
  const countByDate = new Map(points.map((p) => [format(new Date(p.date), "yyyy-MM-dd"), p.count]));

  return Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const key = format(date, "yyyy-MM-dd");
    return {
      label: format(date, "EEE"),
      fullLabel: format(date, "EEEE, MMM d"),
      value: countByDate.get(key) ?? 0,
    };
  });
};

// Revenue has no date filter server-side — keep the chart readable by
// showing only the most recent 14 days that have billing activity.
const buildRevenueSeries = (points: RevenuePoint[]): BarChartPoint[] =>
  points.slice(-14).map((p) => ({
    label: format(new Date(p.date), "MMM d"),
    fullLabel: format(new Date(p.date), "EEEE, MMM d"),
    value: p.total,
  }));

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: { title: string, value: number | string, subtext?: string, icon: LucideIcon, colorClass: string }) => {
  // colorClass is "bg-X text-X" — only the text-X token is used here. Applying
  // the bg-X token too would fight bg-current/10 for the same background-color
  // property; whichever utility Tailwind happens to generate later wins,
  // which previously made a couple of icons render in the same solid color
  // as their own background (invisible) while others worked by luck.
  const textClass = colorClass.split(" ")[1];

  return (
    <div className="card group hover:ring-2 hover:ring-primary transition-all duration-300">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
          </div>
          <div className={`p-3 rounded-2xl ${textClass} bg-current/10 transition-transform group-hover:scale-110 duration-300`}>
            <Icon size={24} className={textClass} />
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
};

export default function Home() {
  const [totalCounts, setTotalCounts] = useState<TotalCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [weeklyAppointments, setWeeklyAppointments] = useState<WeeklyAppointmentPoint[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topDoctors, setTopDoctors] = useState<TopDoctor[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);

  useEffect(() => {
    const fetchTotalCounts = async () => {
      try {
        setIsLoading(true);
        const data = await DashboardService.getCounts();
        setTotalCounts(data);
      } catch (error) {
        console.error("Failed to fetch total counts", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchActivity = async () => {
      try {
        setIsActivityLoading(true);
        const [weeklyData, revenueData, topDoctorsData] = await Promise.all([
          DashboardService.getWeeklyAppointments(),
          DashboardService.getRevenue(),
          DashboardService.getTopDoctors(),
        ]);
        setWeeklyAppointments(weeklyData);
        setRevenue(revenueData);
        setTopDoctors(topDoctorsData?.data ?? []);
      } catch (error) {
        console.error("Failed to fetch dashboard activity", error);
      } finally {
        setIsActivityLoading(false);
      }
    };

    fetchTotalCounts();
    fetchActivity();
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
        <div className="lg:col-span-2 card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Activity size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Weekly Appointments</h3>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
          </div>

          {isActivityLoading ? (
            <div className="h-56 animate-pulse bg-muted/50 rounded-xl" />
          ) : (
            <BarChart
              data={buildWeeklySeries(weeklyAppointments)}
              color="var(--primary)"
              emptyMessage="No appointments in the last 7 days"
            />
          )}
        </div>

        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Trophy size={20} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Top Doctors</h3>
              <p className="text-xs text-muted-foreground">By appointment volume</p>
            </div>
          </div>

          {isActivityLoading ? (
            <div className="h-56 animate-pulse bg-muted/50 rounded-xl" />
          ) : (
            <TopDoctorsList doctors={topDoctors} />
          )}
        </div>
      </div>

      <div className="mt-8 card p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <ArrowUpRight size={20} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Revenue</h3>
            <p className="text-xs text-muted-foreground">Most recent billing activity</p>
          </div>
        </div>

        {isActivityLoading ? (
          <div className="h-56 animate-pulse bg-muted/50 rounded-xl" />
        ) : (
          <BarChart
            data={buildRevenueSeries(revenue)}
            color="#059669"
            formatValue={(v) => `$${v.toLocaleString()}`}
            emptyMessage="No billing activity recorded yet"
          />
        )}
      </div>
    </div>
  );
}