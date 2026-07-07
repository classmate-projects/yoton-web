export interface DummyBreakTime {
  id: string;
  startTime: string;
  reason: string;
}

export interface DummyDayAvailability {
  day: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  breakTimes: DummyBreakTime[];
}

export interface DummyAvailabilityDoctor {
  doctorId: string;
  doctorName: string;
  specialization: string;
  schedules: DummyDayAvailability[];
}

export interface DummyAvailabilityDepartment {
  departmentId: string;
  departmentName: string;
  doctors: DummyAvailabilityDoctor[];
}

export const dummyDoctorAvailability: DummyAvailabilityDepartment[] = [
  {
    departmentId: "dept_cardiology",
    departmentName: "Cardiology",
    doctors: [
      {
        doctorId: "doc_001",
        doctorName: "Dr. Sarah Johnson",
        specialization: "Cardiologist",
        schedules: [
          {
            day: "Monday",
            startTime: "10:00",
            endTime: "16:00",
            intervalMinutes: 30,
            breakTimes: [
              {
                id: "br_doc_001_mon_001",
                startTime: "13:00",
                reason: "Lunch",
              },
            ],
          },
          {
            day: "Wednesday",
            startTime: "09:00",
            endTime: "13:00",
            intervalMinutes: 20,
            breakTimes: [
              {
                id: "br_doc_001_wed_001",
                startTime: "11:00",
                reason: "Rounds",
              },
            ],
          },
          {
            day: "Saturday",
            startTime: "12:00",
            endTime: "15:00",
            intervalMinutes: 30,
            breakTimes: [],
          },
        ],
      },
      {
        doctorId: "doc_007",
        doctorName: "Dr. Robert Kim",
        specialization: "Cardiologist",
        schedules: [
          {
            day: "Tuesday",
            startTime: "08:00",
            endTime: "12:00",
            intervalMinutes: 20,
            breakTimes: [],
          },
          {
            day: "Friday",
            startTime: "14:00",
            endTime: "18:00",
            intervalMinutes: 30,
            breakTimes: [
              {
                id: "br_doc_007_fri_001",
                startTime: "16:00",
                reason: "Review break",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    departmentId: "dept_dermatology",
    departmentName: "Dermatology",
    doctors: [
      {
        doctorId: "doc_002",
        doctorName: "Dr. Michael Brown",
        specialization: "Dermatologist",
        schedules: [
          {
            day: "Tuesday",
            startTime: "11:00",
            endTime: "17:00",
            intervalMinutes: 15,
            breakTimes: [
              {
                id: "br_doc_002_tue_001",
                startTime: "13:30",
                reason: "Lunch",
              },
              {
                id: "br_doc_002_tue_002",
                startTime: "15:30",
                reason: "Procedure buffer",
              },
            ],
          },
          {
            day: "Friday",
            startTime: "10:00",
            endTime: "12:30",
            intervalMinutes: 30,
            breakTimes: [],
          },
        ],
      },
      {
        doctorId: "doc_008",
        doctorName: "Dr. Anita Kapoor",
        specialization: "Dermatologist",
        schedules: [
          {
            day: "Monday",
            startTime: "10:00",
            endTime: "14:00",
            intervalMinutes: 20,
            breakTimes: [
              {
                id: "br_doc_008_mon_001",
                startTime: "12:00",
                reason: "Procedure buffer",
              },
            ],
          },
          {
            day: "Thursday",
            startTime: "15:00",
            endTime: "18:00",
            intervalMinutes: 15,
            breakTimes: [],
          },
        ],
      },
    ],
  },
  {
    departmentId: "dept_orthopedics",
    departmentName: "Orthopedics",
    doctors: [
      {
        doctorId: "doc_003",
        doctorName: "Dr. Emily Wilson",
        specialization: "Orthopedic Surgeon",
        schedules: [
          {
            day: "Thursday",
            startTime: "08:30",
            endTime: "12:00",
            intervalMinutes: 30,
            breakTimes: [],
          },
          {
            day: "Friday",
            startTime: "13:00",
            endTime: "16:00",
            intervalMinutes: 45,
            breakTimes: [
              {
                id: "br_doc_003_fri_001",
                startTime: "14:30",
                reason: "Post-op review",
              },
            ],
          },
        ],
      },
      {
        doctorId: "doc_009",
        doctorName: "Dr. Naveen Rao",
        specialization: "Orthopedic Surgeon",
        schedules: [
          {
            day: "Monday",
            startTime: "13:00",
            endTime: "17:00",
            intervalMinutes: 30,
            breakTimes: [],
          },
          {
            day: "Wednesday",
            startTime: "09:00",
            endTime: "12:00",
            intervalMinutes: 30,
            breakTimes: [
              {
                id: "br_doc_009_wed_001",
                startTime: "10:30",
                reason: "X-ray review",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    departmentId: "dept_pediatrics",
    departmentName: "Pediatrics",
    doctors: [
      {
        doctorId: "doc_004",
        doctorName: "Dr. David Lee",
        specialization: "Pediatrician",
        schedules: [
          {
            day: "Monday",
            startTime: "09:30",
            endTime: "11:30",
            intervalMinutes: 15,
            breakTimes: [],
          },
          {
            day: "Sunday",
            startTime: "17:00",
            endTime: "18:30",
            intervalMinutes: 20,
            breakTimes: [],
          },
        ],
      },
      {
        doctorId: "doc_010",
        doctorName: "Dr. Kavya Menon",
        specialization: "Pediatrician",
        schedules: [
          {
            day: "Tuesday",
            startTime: "09:00",
            endTime: "12:00",
            intervalMinutes: 15,
            breakTimes: [],
          },
          {
            day: "Friday",
            startTime: "16:00",
            endTime: "19:00",
            intervalMinutes: 20,
            breakTimes: [
              {
                id: "br_doc_010_fri_001",
                startTime: "17:30",
                reason: "Vaccination buffer",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    departmentId: "dept_womens_health",
    departmentName: "Women's Health",
    doctors: [
      {
        doctorId: "doc_005",
        doctorName: "Dr. Sophia Martinez",
        specialization: "Gynecologist",
        schedules: [
          {
            day: "Thursday",
            startTime: "10:00",
            endTime: "12:30",
            intervalMinutes: 30,
            breakTimes: [],
          },
          {
            day: "Saturday",
            startTime: "16:00",
            endTime: "18:30",
            intervalMinutes: 30,
            breakTimes: [
              {
                id: "br_doc_005_sat_001",
                startTime: "17:00",
                reason: "Break",
              },
            ],
          },
        ],
      },
      {
        doctorId: "doc_011",
        doctorName: "Dr. Aisha Fernandez",
        specialization: "Gynecologist",
        schedules: [
          {
            day: "Monday",
            startTime: "11:00",
            endTime: "15:00",
            intervalMinutes: 30,
            breakTimes: [
              {
                id: "br_doc_011_mon_001",
                startTime: "13:00",
                reason: "Lunch",
              },
            ],
          },
          {
            day: "Wednesday",
            startTime: "09:00",
            endTime: "12:00",
            intervalMinutes: 20,
            breakTimes: [],
          },
        ],
      },
    ],
  },
  {
    departmentId: "dept_neurology",
    departmentName: "Neurology",
    doctors: [
      {
        doctorId: "doc_006",
        doctorName: "Dr. James Anderson",
        specialization: "Neurologist",
        schedules: [
          {
            day: "Wednesday",
            startTime: "13:00",
            endTime: "16:00",
            intervalMinutes: 30,
            breakTimes: [],
          },
          {
            day: "Friday",
            startTime: "10:00",
            endTime: "13:00",
            intervalMinutes: 45,
            breakTimes: [
              {
                id: "br_doc_006_fri_001",
                startTime: "11:30",
                reason: "Consult review",
              },
            ],
          },
        ],
      },
      {
        doctorId: "doc_012",
        doctorName: "Dr. Priya Shah",
        specialization: "Neurologist",
        schedules: [
          {
            day: "Tuesday",
            startTime: "12:00",
            endTime: "16:00",
            intervalMinutes: 45,
            breakTimes: [],
          },
          {
            day: "Thursday",
            startTime: "10:00",
            endTime: "13:00",
            intervalMinutes: 30,
            breakTimes: [
              {
                id: "br_doc_012_thu_001",
                startTime: "11:30",
                reason: "Report review",
              },
            ],
          },
        ],
      },
    ],
  },
];
