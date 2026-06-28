'use client'

import { ReceptionService } from "@/services/reception.service"
import axios from "axios";
import { useEffect } from "react"

export default function Appointments() {
    useEffect(() => {
        const fetchDoctorAvailability = async () => {
            try {
                const data = await ReceptionService.getDoctorAvailability();
                console.log("DoctorAvailability: ", data)
            } catch (error) {
                if(axios.isAxiosError(error)){
                    console.log("error: ", error.response?.data)
                } else {
                    console.log("Something went wrong")
                }
            }
        }

        fetchDoctorAvailability()
    }, [])
    useEffect(() => {
        const fetchAllAppointments = async () => {
            try {
                const data = await ReceptionService.getAllAppointments();
                console.log("All appointments: ", data)
            } catch (error) {
                if(axios.isAxiosError(error)){
                    console.log("error: ", error.response?.data)
                } else {
                    console.log("Something went wrong")
                }
            }
        }

        fetchAllAppointments()
    }, [])
    useEffect(() => {
        const id = "DOC-b3155d2a"
        const fetchDoctorById = async () => {
            try {
                const data = await ReceptionService.getDoctorById(id);
                console.log("doctor by id: ", data)
            } catch (error) {
                if(axios.isAxiosError(error)){
                    console.log("error: ", error.response?.data)
                } else {
                    console.log("Something went wrong")
                }
            }
        }

        fetchDoctorById()
    }, [])
    return (
        <div className="flex h-dvh justify-center items-center">
            <h1>Appointments Page</h1>
        </div>
    )
}