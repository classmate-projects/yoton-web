import { useEffect } from "react";
import { getSignalRConnection } from "@/lib/signalR";

export interface AppointmentRequestedEvent {
  appointmentId: string;
  doctorId: string | null;
  doctorName: string | null;
  patientId: string | null;
  patientName: string | null;
  appointmentDate: string;
  status: string | null;
  notes: string | null;
}

export function useAppointmentRequestSignalR(
  onRequested: (event: AppointmentRequestedEvent) => void
) {
  useEffect(() => {
    let isMounted = true;

    const handleAppointmentRequested = (event: AppointmentRequestedEvent) => {
      if (!isMounted) return;
      onRequested(event);
    };

    const connect = async () => {
      const connection = await getSignalRConnection();
      if (!isMounted) return;

      // Prevent duplicate subscriptions
      connection.off("appointmentRequested", handleAppointmentRequested);
      connection.on("appointmentRequested", handleAppointmentRequested);
    };

    connect();

    return () => {
      isMounted = false;
      getSignalRConnection().then((connection) => {
        connection.off("appointmentRequested", handleAppointmentRequested);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
