export interface AttendanceRecordType {
    attendanceRecordId: string;
    date: string;
    checkInAt: string;
    checkOutAt: string | null;
    // True when nobody checked out and the system closed the session at 23:59:59.
    isAutoCheckOut: boolean;
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
    isAutoCheckOut: boolean;
}

// A session the system closed because nobody checked out - feeds the admin alert bell.
export interface AutoCheckOutType {
    attendanceRecordId: string;
    userId: string;
    name: string;
    date: string;
    checkInAt: string;
    checkOutAt: string;
}

// Payload of the "attendanceAutoCheckedOut" SignalR event (see EodAutoCheckOutService).
export interface AutoCheckOutEvent {
    records: { attendanceRecordId: string; userId: string; date: string }[];
}
