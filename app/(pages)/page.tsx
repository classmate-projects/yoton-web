'use client';

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
import { useEffect, useState } from "react"

export default function Home() {

  const [totalCounts, setTotalCounts] = useState<TotalCounts | null>(null)

  useEffect(() => {
    const fetchTotalCounts = async () => {
      const res = await fetch("/api/total-counts")
      const data = await res.json()
      console.log(data)
      setTotalCounts(data)
    }

    fetchTotalCounts()
  }, [])

  return (
    <div className="flex h-dvh justify-center items-center" style={{color: 'var(--color-text)'}}>
        <div className="flex flex-col gap-2">
          <h1>Total Counts</h1>
          <p>Total Patients : {totalCounts?.totalPatients}</p>
          <p>Total Doctors : {totalCounts?.totalDoctors}</p>
        </div>
    </div>
  )}