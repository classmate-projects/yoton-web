"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { TopDoctor } from "@/types/dashboard.type";
import EmptyState from "@/components/EmptyState";
import { backendAssetUrl } from "@/lib/backendAsset";
import { getAvatarColor } from "@/lib/avatarColor";
import { getInitials } from "@/lib/getInitials";

interface TopDoctorsListProps {
  doctors: TopDoctor[];
}

// Profile photo, falling back to coloured initials (same treatment as the sidebar's own
// avatar) when the doctor has no photo or it fails to load.
function DoctorAvatar({ doctor }: { doctor: TopDoctor }) {
  const [failed, setFailed] = useState(false);
  const src = backendAssetUrl(doctor.userImage);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path; not eligible for next/image's static optimization
      <img
        src={src}
        alt={doctor.doctorName ?? "Doctor"}
        onError={() => setFailed(true)}
        className="shrink-0 h-9 w-9 rounded-full object-cover shadow-sm"
      />
    );
  }

  return (
    <div
      className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
      style={{ backgroundColor: getAvatarColor(doctor.doctorId || doctor.doctorName || undefined) }}
    >
      {doctor.doctorName ? getInitials(doctor.doctorName) : <UserRound size={16} />}
    </div>
  );
}

export default function TopDoctorsList({ doctors }: TopDoctorsListProps) {
  if (doctors.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState size="compact" illustration="users" title="No appointment activity yet" />
      </div>
    );
  }

  const max = Math.max(...doctors.map((d) => d.count));

  return (
    <div className="flex flex-col gap-5">
      {doctors.map((doctor, i) => (
        <div key={doctor.doctorId} className="flex items-center gap-3">
          <span className="shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
            {i + 1}
          </span>
          <DoctorAvatar doctor={doctor} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <p className="text-sm font-semibold text-foreground truncate">
                {doctor.doctorName ?? "Unknown doctor"}
              </p>
              <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0">
                {doctor.count.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${max > 0 ? (doctor.count / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
