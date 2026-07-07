export const dummyDoctors = [
  {
    id: "doc_001",
    name: "Dr. Sarah Johnson",
    specialization: "Cardiologist",
    experience: 12,
    qualification: "MBBS, MD",
    image: "https://placehold.co/200x200",
    consultationFee: 800,
  },
  {
    id: "doc_002",
    name: "Dr. Michael Brown",
    specialization: "Dermatologist",
    experience: 8,
    qualification: "MBBS, DDVL",
    image: "https://placehold.co/200x200",
    consultationFee: 600,
  },
  {
    id: "doc_003",
    name: "Dr. Emily Wilson",
    specialization: "Orthopedic Surgeon",
    experience: 15,
    qualification: "MBBS, MS Ortho",
    image: "https://placehold.co/200x200",
    consultationFee: 1000,
  },
  {
    id: "doc_004",
    name: "Dr. David Lee",
    specialization: "Pediatrician",
    experience: 10,
    qualification: "MBBS, MD Pediatrics",
    image: "https://placehold.co/200x200",
    consultationFee: 700,
  },
  {
    id: "doc_005",
    name: "Dr. Sophia Martinez",
    specialization: "Gynecologist",
    experience: 14,
    qualification: "MBBS, MS OBG",
    image: "https://placehold.co/200x200",
    consultationFee: 900,
  },
  {
    id: "doc_006",
    name: "Dr. James Anderson",
    specialization: "Neurologist",
    experience: 18,
    qualification: "MBBS, DM Neurology",
    image: "https://placehold.co/200x200",
    consultationFee: 1200,
  },
];

export const appointmentSlots = {
  doctor: {
    id: "doc_001",
    name: "Dr. Sarah Johnson",
    specialization: "Cardiologist",
    experience: 12,
    consultationFee: 800,
  },
  slots: [
    {
      slotId: "slot_001",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "09:00 AM",
      endTime: "09:30 AM",
      status: "booked",
      patient: {
        id: "pat_001",
        name: "Rahul Sharma",
      },
    },
    {
      slotId: "slot_002",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "09:30 AM",
      endTime: "10:00 AM",
      status: "available",
      patient: null,
    },
    {
      slotId: "slot_003",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "10:00 AM",
      endTime: "10:30 AM",
      status: "booked",
      patient: {
        id: "pat_002",
        name: "Priya Nair",
      },
    },
    {
      slotId: "slot_004",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "10:30 AM",
      endTime: "11:00 AM",
      status: "blocked",
      patient: null,
    },
    {
      slotId: "slot_005",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "11:00 AM",
      endTime: "11:30 AM",
      status: "available",
      patient: null,
    },
    {
      slotId: "slot_006",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "11:30 AM",
      endTime: "12:00 PM",
      status: "available",
      patient: null,
    },
    {
      slotId: "slot_007",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "02:00 PM",
      endTime: "02:30 PM",
      status: "booked",
      patient: {
        id: "pat_003",
        name: "Anjali Menon",
      },
    },
    {
      slotId: "slot_008",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "02:30 PM",
      endTime: "03:00 PM",
      status: "available",
      patient: null,
    },
    {
      slotId: "slot_009",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "03:00 PM",
      endTime: "03:30 PM",
      status: "available",
      patient: null,
    },
    {
      slotId: "slot_010",
      date: "2026-07-08",
      day: "Wednesday",
      startTime: "03:30 PM",
      endTime: "04:00 PM",
      status: "available",
      patient: null,
    },
  ],
};

const patientNames = [
  "Rahul Sharma",
  "Priya Nair",
  "Anjali Menon",
  "Arjun Kumar",
  "Meera Iyer",
  "Karan Patel",
  "Nisha Rao",
  "Vikram Singh",
  "Farah Khan",
  "Dev Mehta",
];

const doctorSlotSchedules = [
  {
    doctorId: "doc_001",
    dates: [
      {
        date: "2026-07-08",
        day: "Wednesday",
        slots: [
          ["10:00 AM", "10:30 AM", "booked"],
          ["10:30 AM", "11:00 AM", "available"],
          ["11:00 AM", "11:30 AM", "available"],
          ["11:30 AM", "12:00 PM", "blocked"],
          ["02:00 PM", "02:30 PM", "booked"],
          ["02:30 PM", "03:00 PM", "available"],
          ["03:00 PM", "03:30 PM", "available"],
          ["03:30 PM", "04:00 PM", "available"],
        ],
      },
      {
        date: "2026-07-09",
        day: "Thursday",
        slots: [
          ["09:00 AM", "09:20 AM", "available"],
          ["09:20 AM", "09:40 AM", "available"],
          ["09:40 AM", "10:00 AM", "booked"],
          ["10:00 AM", "10:20 AM", "available"],
          ["10:20 AM", "10:40 AM", "blocked"],
          ["10:40 AM", "11:00 AM", "available"],
          ["11:00 AM", "11:20 AM", "booked"],
        ],
      },
      {
        date: "2026-07-11",
        day: "Saturday",
        slots: [
          ["12:00 PM", "12:30 PM", "available"],
          ["12:30 PM", "01:00 PM", "booked"],
          ["01:00 PM", "01:30 PM", "available"],
          ["01:30 PM", "02:00 PM", "available"],
        ],
      },
    ],
  },
  {
    doctorId: "doc_002",
    dates: [
      {
        date: "2026-07-08",
        day: "Wednesday",
        slots: [
          ["11:00 AM", "11:15 AM", "available"],
          ["11:15 AM", "11:30 AM", "booked"],
          ["11:30 AM", "11:45 AM", "available"],
          ["11:45 AM", "12:00 PM", "available"],
          ["04:00 PM", "04:15 PM", "booked"],
          ["04:15 PM", "04:30 PM", "available"],
          ["04:30 PM", "04:45 PM", "available"],
          ["04:45 PM", "05:00 PM", "available"],
        ],
      },
      {
        date: "2026-07-10",
        day: "Friday",
        slots: [
          ["10:00 AM", "10:30 AM", "available"],
          ["10:30 AM", "11:00 AM", "blocked"],
          ["11:00 AM", "11:30 AM", "available"],
          ["11:30 AM", "12:00 PM", "booked"],
          ["12:00 PM", "12:30 PM", "available"],
        ],
      },
      {
        date: "2026-07-13",
        day: "Monday",
        slots: [
          ["03:00 PM", "03:20 PM", "available"],
          ["03:20 PM", "03:40 PM", "available"],
          ["03:40 PM", "04:00 PM", "booked"],
          ["04:00 PM", "04:20 PM", "available"],
          ["04:20 PM", "04:40 PM", "available"],
        ],
      },
    ],
  },
  {
    doctorId: "doc_003",
    dates: [
      {
        date: "2026-07-09",
        day: "Thursday",
        slots: [
          ["08:30 AM", "09:00 AM", "available"],
          ["09:00 AM", "09:30 AM", "booked"],
          ["09:30 AM", "10:00 AM", "available"],
          ["10:00 AM", "10:30 AM", "available"],
          ["10:30 AM", "11:00 AM", "blocked"],
          ["11:00 AM", "11:30 AM", "available"],
        ],
      },
      {
        date: "2026-07-10",
        day: "Friday",
        slots: [
          ["01:00 PM", "01:45 PM", "booked"],
          ["01:45 PM", "02:30 PM", "available"],
          ["02:30 PM", "03:15 PM", "available"],
          ["03:15 PM", "04:00 PM", "available"],
        ],
      },
      {
        date: "2026-07-14",
        day: "Tuesday",
        slots: [
          ["10:00 AM", "10:30 AM", "available"],
          ["10:30 AM", "11:00 AM", "available"],
          ["11:00 AM", "11:30 AM", "booked"],
          ["11:30 AM", "12:00 PM", "available"],
        ],
      },
    ],
  },
  {
    doctorId: "doc_004",
    dates: [
      {
        date: "2026-07-08",
        day: "Wednesday",
        slots: [
          ["09:30 AM", "09:45 AM", "available"],
          ["09:45 AM", "10:00 AM", "available"],
          ["10:00 AM", "10:15 AM", "booked"],
          ["10:15 AM", "10:30 AM", "available"],
          ["10:30 AM", "10:45 AM", "blocked"],
          ["10:45 AM", "11:00 AM", "available"],
          ["11:00 AM", "11:15 AM", "booked"],
          ["11:15 AM", "11:30 AM", "available"],
        ],
      },
      {
        date: "2026-07-12",
        day: "Sunday",
        slots: [
          ["05:00 PM", "05:20 PM", "available"],
          ["05:20 PM", "05:40 PM", "available"],
          ["05:40 PM", "06:00 PM", "booked"],
          ["06:00 PM", "06:20 PM", "available"],
        ],
      },
      {
        date: "2026-07-14",
        day: "Tuesday",
        slots: [
          ["02:00 PM", "02:15 PM", "available"],
          ["02:15 PM", "02:30 PM", "available"],
          ["02:30 PM", "02:45 PM", "available"],
          ["02:45 PM", "03:00 PM", "available"],
          ["03:00 PM", "03:15 PM", "booked"],
          ["03:15 PM", "03:30 PM", "available"],
        ],
      },
    ],
  },
  {
    doctorId: "doc_005",
    dates: [
      {
        date: "2026-07-09",
        day: "Thursday",
        slots: [
          ["10:00 AM", "10:30 AM", "available"],
          ["10:30 AM", "11:00 AM", "booked"],
          ["11:00 AM", "11:30 AM", "available"],
          ["11:30 AM", "12:00 PM", "available"],
          ["12:00 PM", "12:30 PM", "blocked"],
        ],
      },
      {
        date: "2026-07-11",
        day: "Saturday",
        slots: [
          ["04:00 PM", "04:30 PM", "available"],
          ["04:30 PM", "05:00 PM", "available"],
          ["05:00 PM", "05:30 PM", "booked"],
          ["05:30 PM", "06:00 PM", "available"],
          ["06:00 PM", "06:30 PM", "available"],
        ],
      },
      {
        date: "2026-07-13",
        day: "Monday",
        slots: [
          ["09:00 AM", "09:30 AM", "booked"],
          ["09:30 AM", "10:00 AM", "available"],
          ["10:00 AM", "10:30 AM", "available"],
          ["10:30 AM", "11:00 AM", "available"],
        ],
      },
    ],
  },
  {
    doctorId: "doc_006",
    dates: [
      {
        date: "2026-07-08",
        day: "Wednesday",
        slots: [
          ["01:00 PM", "01:30 PM", "available"],
          ["01:30 PM", "02:00 PM", "booked"],
          ["02:00 PM", "02:30 PM", "available"],
          ["02:30 PM", "03:00 PM", "available"],
          ["03:00 PM", "03:30 PM", "blocked"],
          ["03:30 PM", "04:00 PM", "available"],
        ],
      },
      {
        date: "2026-07-10",
        day: "Friday",
        slots: [
          ["10:00 AM", "10:45 AM", "available"],
          ["10:45 AM", "11:30 AM", "booked"],
          ["11:30 AM", "12:15 PM", "available"],
          ["12:15 PM", "01:00 PM", "available"],
        ],
      },
      {
        date: "2026-07-14",
        day: "Tuesday",
        slots: [
          ["03:00 PM", "03:30 PM", "available"],
          ["03:30 PM", "04:00 PM", "available"],
          ["04:00 PM", "04:30 PM", "booked"],
          ["04:30 PM", "05:00 PM", "available"],
          ["05:00 PM", "05:30 PM", "available"],
        ],
      },
    ],
  },
] as const;

export const dummyAppointmentSlots = dummyDoctors.map((doctor) => {
  const schedule = doctorSlotSchedules.find(
    (doctorSchedule) => doctorSchedule.doctorId === doctor.id
  );

  return {
    doctor: {
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      experience: doctor.experience,
      consultationFee: doctor.consultationFee,
    },
    slots:
      schedule?.dates.flatMap((dateSchedule, dateIndex) =>
        dateSchedule.slots.map(([startTime, endTime, status], slotIndex) => {
          const hasPatient = status === "booked";
          const patientIndex = (dateIndex + slotIndex) % patientNames.length;

          return {
            slotId: `${doctor.id}_${dateSchedule.date}_slot_${String(
              slotIndex + 1
            ).padStart(3, "0")}`,
            date: dateSchedule.date,
            day: dateSchedule.day,
            startTime,
            endTime,
            status,
            patient: hasPatient
              ? {
                  id: `pat_${doctor.id}_${dateIndex}_${String(
                    slotIndex + 1
                  ).padStart(3, "0")}`,
                  name: patientNames[patientIndex],
                }
              : null,
          };
        })
      ) ?? [],
  };
});
