export interface AttendanceRecordType {
    attendanceRecordId: string;
    date: string;
    checkInAt: string;
    checkOutAt: string | null;
}

export interface StaffAttendanceType {
    userId: string;
    name: string;
    username: string | null;
    role: string | null;
    departmentName: string | null;
    isActive: boolean;
    checkInAt: string | null;
    checkOutAt: string | null;
}
