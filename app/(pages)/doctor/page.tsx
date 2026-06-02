"use client";

import { useEffect, useState } from "react";
import { MdOutlineMedicalServices, MdPersonAdd } from "react-icons/md";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Doctor {
  id: number;
  userId: number;
  specialization: string;
  licenseNumber: string;
  experienceYears: number;
  consultationFee: number;
}

export default function DoctorPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Doctor Form
  const [userId, setUserId] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [consultationFee, setConsultationFee] = useState("");

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/doctor");
      const data = await res.json();
      setDoctors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch doctors", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const callApi = () => {
      fetchDoctors();
    };
    callApi();
  }, []);

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          specialization,
          licenseNumber,
          experienceYears: Number(experienceYears),
          consultationFee: Number(consultationFee)
        }),
      });

      if (res.ok) {
        alert("Doctor profile created successfully");
        setUserId("");
        setSpecialization("");
        setLicenseNumber("");
        setExperienceYears("");
        setConsultationFee("");
        fetchDoctors();
      } else {
        alert("Failed to create doctor profile");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="py-8 px-10 h-full overflow-y-auto">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <MdOutlineMedicalServices className="text-primary" /> Doctors Directory
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage doctor profiles, specializations, and availability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">All Doctors</h2>
          <hr className="border-border mb-4" />
          
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="text-foreground/90">ID</th>
                  <th className="text-foreground/90">Specialization</th>
                  <th className="text-foreground/90">License</th>
                  <th className="text-foreground/90">Exp (Years)</th>
                  <th className="text-foreground/90">Fee</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <LoadingSpinner />
                    </td>
                  </tr>
                ) : doctors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      No doctors registered.
                    </td>
                  </tr>
                ) : (
                  doctors.map((doc) => (
                    <tr key={doc.id}>
                      <td className="font-semibold text-foreground">#{doc.id}</td>
                      <td className="text-primary font-semibold">{doc.specialization}</td>
                      <td className="text-foreground/80">{doc.licenseNumber}</td>
                      <td className="text-foreground/80">{doc.experienceYears}</td>
                      <td className="text-foreground/80">${doc.consultationFee}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <MdPersonAdd className="text-green-500" /> Register Doctor
          </h2>
          <hr className="border-border mb-4" />
          
          <form onSubmit={handleCreateDoctor} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold text-foreground/90">User ID</label>
              <input
                type="number"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground/90">Specialization</label>
              <input
                type="text"
                required
                placeholder="e.g. Cardiology"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground/90">License Number</label>
              <input
                type="text"
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
              />
            </div>
            <div className="flex gap-4">
              <div className="w-full">
                <label className="text-sm font-bold text-foreground/90">Exp. Years</label>
                <input
                  type="number"
                  required
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
                />
              </div>
              <div className="w-full">
                <label className="text-sm font-bold text-foreground/90">Fee ($)</label>
                <input
                  type="number"
                  required
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-muted border border-border text-foreground"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full mt-4 bg-primary hover:opacity-90 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Add Doctor
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}