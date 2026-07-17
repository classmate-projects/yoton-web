"use client";
import React, { useState } from "react";
import {
  MdOutlinePersonOutline,
  MdOutlineLocalPhone,
  MdOutlineFilePresent,
  MdExpandMore,
} from "react-icons/md";
import { countryDetails } from "@/helpers/countyDetails";
import { ReceptionService } from "@/services/reception.service";
import { toast } from "sonner";
import { ReceptionCreatePatientType } from "@/types/reception.type";

export default function PatientEntryPage() {
  const [formData, setFormData] = useState({
    name: "",
    sex: "",
    dateOfBirth: "",
    phone: "",
    phoneCode: "+971",
    email: "",
    address: "",
    nationality: "",
    passportNumber: "",
    nationalID: "",
    fatherName: "",
    motherName: "",
    patientType: "Normal",
    visaType: "",
    maritalStatus: "",
    designation: "",
    referralStatus: false,
    chronicStatus: false,
    emergencyContact: "",
    emergencyContactPhone: "",
    password: "",
  });
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const inputElement = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? inputElement.checked : value,
    }));
    setError("");
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    // Validate that at least one of National ID or Passport Number is filled
    if (!formData.nationalID && !formData.passportNumber) {
      setError("Please provide either National ID or Passport Number");
      setLoading(false);
      return;
    }

    const registeredBy =
      JSON.parse(localStorage.getItem("yoton_user_detail") || "{}").userId ??
      null;

    const payload: ReceptionCreatePatientType = {
      ...formData,
      registeredBy,
    };

    try {
      const data = await ReceptionService.createPatinet(payload)
      toast.success(data.message)
      resetForm();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false)
    }
    setError("");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sex: "",
      dateOfBirth: "",
      phone: "",
      phoneCode: "+971",
      email: "",
      address: "",
      nationality: "",
      passportNumber: "",
      nationalID: "",
      fatherName: "",
      motherName: "",
      patientType: "Normal",
      visaType: "",
      maritalStatus: "",
      designation: "",
      referralStatus: false,
      chronicStatus: false,
      emergencyContact: "",
      emergencyContactPhone: "",
      password: "",
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mainPage flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-foreground">
            New Patient Entry
          </h1>
          <p className="text-base text-foreground/80">
            Complete patient registration form. All fields marked with * are
            required.
          </p>
        </div>

        {/* Personal Information Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-8">
          <div className="flex items-center gap-3 mb-6">
            <MdOutlinePersonOutline className="text-primary" size={28} />
            <h2 className="text-2xl font-bold text-foreground">
              Personal Information
            </h2>
          </div>
          <hr className="mb-6 border-border" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="font-semibold text-foreground/90">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="John Doe"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Sex */}
            <div className="flex flex-col gap-2">
              <label htmlFor="sex" className="font-semibold text-foreground/90">
                Sex <span className="text-red-500">*</span>
              </label>
              <select
                id="sex"
                name="sex"
                value={formData.sex}
                onChange={handleInputChange}
                required
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-card"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="dateOfBirth"
                className="font-semibold text-foreground/90"
              >
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                required
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Nationality */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="nationality"
                className="font-semibold text-foreground/90"
              >
                Nationality <span className="text-red-500">*</span>
              </label>
              <select
                id="nationality"
                name="nationality"
                value={formData.nationality}
                onChange={handleInputChange}
                required
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-card"
              >
                <option value="" disabled>
                  Select Country
                </option>
                {countryDetails.map((country) => (
                  <option key={country.country} value={country.country}>
                    {country.country}
                  </option>
                ))}
              </select>
            </div>

            {/* Father Name */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="fatherName"
                className="font-semibold text-foreground/90"
              >
                Father Name
              </label>
              <input
                type="text"
                id="fatherName"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleInputChange}
                placeholder="Father's Name"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Mother Name */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="motherName"
                className="font-semibold text-foreground/90"
              >
                Mother Name
              </label>
              <input
                type="text"
                id="motherName"
                name="motherName"
                value={formData.motherName}
                onChange={handleInputChange}
                placeholder="Mother's Name"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Marital Status */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="maritalStatus"
                className="font-semibold text-foreground/90"
              >
                Marital Status <span className="text-red-500">*</span>
              </label>
              <select
                id="maritalStatus"
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleInputChange}
                required
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-card"
              >
                <option value="">Select Status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>

            {/* Designation */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="designation"
                className="font-semibold text-foreground/90"
              >
                Designation
              </label>
              <input
                type="text"
                id="designation"
                name="designation"
                value={formData.designation}
                onChange={handleInputChange}
                placeholder="Engineer"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-8">
          <div className="flex items-center gap-3 mb-6">
            <MdOutlineLocalPhone className="text-primary" size={28} />
            <h2 className="text-2xl font-bold text-foreground">
              Contact Information
            </h2>
          </div>
          <hr className="mb-6 border-border" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phone Code and Phone Number - Combined */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-foreground/90">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="flex border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent overflow-hidden">
                {/* Phone Code Display and Dropdown */}
                <div className="relative w-20 shrink-0">
                  <div className="absolute left-4 top-2.5 text-foreground font-medium pointer-events-none z-10">
                    {formData.phoneCode}
                  </div>
                  <div className="absolute right-1 top-2.5 pointer-events-none z-10 text-muted-foreground">
                    <MdExpandMore size={20} />
                  </div>
                  <select
                    id="phoneCode"
                    name="phoneCode"
                    value={formData.phoneCode}
                    onChange={handleInputChange}
                    required
                    className="px-4 py-2.5 border-r border-border ring-transparent! focus:outline-none! rounded-none! text-foreground bg-card w-full shrink-0 appearance-none cursor-pointer"
                    style={{ color: "transparent" }}
                  >
                    {countryDetails.map((country, index) => (
                      <option
                        key={index}
                        value={country.phoneCode}
                        className="text-foreground bg-card"
                      >
                        {country.phoneCode} - {country.country}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Input */}
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="0501234567"
                  className="flex-1 px-4 py-2.5 focus:outline-none text-foreground bg-transparent rounded-none!"
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="Email" className="font-semibold text-foreground/90">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="john@example.com"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Address */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label htmlFor="Address" className="font-semibold text-foreground/90">
                Address
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Abu Dhabi"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Emergency Contact */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="emergencyContact"
                className="font-semibold text-foreground/90"
              >
                Emergency Contact Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleInputChange}
                required
                placeholder="Contact Name"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Emergency Contact Phone */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="emergencyContactPhone"
                className="font-semibold text-foreground/90"
              >
                Emergency Contact Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                value={formData.emergencyContactPhone}
                onChange={handleInputChange}
                required
                placeholder="0509876543"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* Identification Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-8">
          <div className="flex items-center gap-3 mb-6">
            <MdOutlineFilePresent className="text-primary" size={28} />
            <h2 className="text-2xl font-bold text-foreground">Identification</h2>
          </div>
          <hr className="mb-6 border-border" />
          <p className="mb-6 text-sm text-foreground/80">
            <span className="text-red-500">*</span> Please provide either
            National ID or Passport Number
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* National ID */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="nationalID"
                className="font-semibold text-foreground/90"
              >
                National ID
              </label>
              <input
                type="text"
                id="nationalID"
                name="nationalID"
                value={formData.nationalID}
                onChange={handleInputChange}
                placeholder="784-1234-5678901-2"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
            </div>

            {/* Passport Number */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="passportNumber"
                className="font-semibold text-foreground/90"
              >
                Passport Number
              </label>
              <input
                type="text"
                id="passportNumber"
                name="passportNumber"
                value={formData.passportNumber}
                onChange={handleInputChange}
                placeholder="A1234567"
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-transparent"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {/* Visa Type */}
            <div className="flex flex-col gap-2">
              <label htmlFor="visaType" className="font-semibold text-foreground/90">
                Visa Type <span className="text-red-500">*</span>
              </label>
              <select
                id="visaType"
                name="visaType"
                value={formData.visaType}
                onChange={handleInputChange}
                required
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-card"
              >
                <option value="">Select Visa Type</option>
                <option value="Residency">Residency</option>
                <option value="Tourist">Tourist</option>
                <option value="Business">Business</option>
                <option value="Student">Student</option>
              </select>
            </div>
          </div>
        </div>

        {/* Medical Information Section */}
        <div className="bg-card rounded-lg shadow-md border border-border p-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Medical Information
          </h2>
          <hr className="mb-6 border-border" />

          <div className="flex flex-wrap gap-6 items-end">
            {/* Patient Type */}
            <div className="flex flex-col gap-2 w-1/2">
              <label
                htmlFor="patientType"
                className="font-semibold text-foreground/90"
              >
                Patient Type <span className="text-red-500">*</span>
              </label>
              <select
                id="patientType"
                name="patientType"
                value={formData.patientType}
                onChange={handleInputChange}
                required
                className="px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground bg-card"
              >
                <option value="Normal">Normal</option>
                <option value="VIP">VIP</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="referralStatus"
                  name="referralStatus"
                  checked={formData.referralStatus}
                  onChange={handleInputChange}
                  className="cursor-pointer bg-transparent"
                />
                <label
                  htmlFor="referralStatus"
                  className="font-semibold text-foreground/90 cursor-pointer"
                >
                  Referral Status
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chronicStatus"
                  name="chronicStatus"
                  checked={formData.chronicStatus}
                  onChange={handleInputChange}
                  className="cursor-pointer bg-transparent"
                />
                <label
                  htmlFor="chronicStatus"
                  className="font-semibold text-foreground/90 cursor-pointer"
                >
                  Chronic Status
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 my-8">
          <button
            type="submit"
            className="flex-1 bg-primary hover:opacity-90 text-white font-bold py-3 px-6 rounded-lg transition duration-200 shadow-md cursor-pointer"
          >
            {loading ? "Registering..." : "Register Patient"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="flex-1 bg-muted hover:bg-muted/80 text-foreground font-bold py-3 px-6 rounded-lg transition duration-200 shadow-md"
          >
            Clear Form
          </button>
        </div>
      </form>
    </>
  );
}
