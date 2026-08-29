export const ENDPOINTS = {
    AUTH: {
        ME: `/api/auth/me`,
        UPLOAD_AVATAR: `/api/auth/upload-avatar`,
        DELETE_AVATAR: `/api/auth/avatar`,
    },
    COMPANY: {
        UPLOAD_LOGO: `/api/company/upload-logo`,
        UPDATE_SETTINGS: `/api/company/settings`,
    },
    CHAT: {
        GET_CONTACTS: (tab: string) => `/api/chat/contacts${tab ? `?tab=${tab}` : ""}`,
        GET_CONVERSATIONS: `/api/chat/conversations`,
        START_CONVERSATION: `/api/chat/conversations`,
        GET_MESSAGES: (conversationId: string) => `/api/chat/conversations/${conversationId}/messages`,
        SEND_MESSAGE: `/api/chat/messages`,
        MARK_READ: (conversationId: string) => `/api/chat/conversations/${conversationId}/read`,
        SET_REACTION: (messageId: string) => `/api/chat/messages/${messageId}/reactions`,
        GET_PRESENCE: (ids: string) => `/api/chat/presence?ids=${encodeURIComponent(ids)}`,
    },
    DASHBOARD: {
        GET_COUNTS: `/api/dashboard/counts`,
        GET_WEEKLY_APPOINTMENTS: `/api/dashboard/appointments/weekly`,
        GET_REVENUE: `/api/dashboard/revenue`,
        GET_TOP_DOCTORS: `/api/dashboard/top-doctors`
    },
    DEPARTMENT: {
        GET: `/api/department/get-all`,
        CREATE: `/api/department/create`,
        UPDATE: (id: string) => `/api/department/update/${id}`,
        DELETE: (id: string) => `/api/department/delete/${id}`,
    },
    RECEPTION: {
        GET_ALL_PATIENTS: `/api/reception/get-all/patient`,
        GET_VISIT_LIST: (from?: string, to?: string) => {
            const params = new URLSearchParams();
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            const qs = params.toString();
            return `/api/reception/visits/list${qs ? `?${qs}` : ""}`;
        },
        CREATE_PATIENT: `/api/reception/create-patient`,
        UPDATE_SCEDULE: `/api/reception/update-schedule`,
        GET_DOCTOR_AVAILABILITY: `/api/reception/doctor-availability`,
        GET_ALL_APPOINTMENTS: `/api/reception/get-all/appointment`,
        CREATE_APPOINTMENT: `/api/reception/create-appointment`,
        GET_SPECIALIZATIONS_DOCTORS: `/api/reception/specializations-doctors`,
        GET_DOCTOR_SLOTS: (doctorId: string, date: string) => `/api/reception/doctor-slots/${doctorId}?date=${date}`,
        SOFT_DELETE: (id: string) => `/api/reception/soft-delete/${id}`,
        UPDATE_STATUS: `/api/reception/update-status`,
        GET_DOCTOR_BY_ID: (doctorId: string) => `/api/reception/get-all/doctor/${doctorId}`,
        CANCEL: (id: string) => `/api/reception/cancel/${id}`,
        CHECK_IN: `/api/reception/check-in`,
        WALK_IN: `/api/reception/walk-in`,
        GET_VISIT: (id: string) => `/api/reception/visit/${id}`,
        GET_VISIT_QUEUE: (status?: string) => `/api/reception/visit/queue${status ? `?status=${status}` : ""}`,
        UPLOAD_DOCUMENT: (patientId: string) => `/api/reception/patient/${patientId}/document`,
        GET_APPOINTMENT_REQUESTS: `/api/reception/appointment-requests`,
        RESEND_WELCOME_EMAIL: (patientId: string) => `/api/reception/${patientId}/resend-welcome-email`,
    },
    ROLE: {
        GET: `/api/role/get-all`,
        CREATE: `/api/role/create-role`,
        UPDATE: (id: string) => `/api/role/update/${id}`,
        DELETE: (id: string) => `/api/role/delete/${id}`,
        GET_ALLOWED_MODULES: (id: string) => `/api/role/${id}/allowed-modules`,
        SET_ALLOWED_MODULES: (id: string) => `/api/role/${id}/allowed-modules`,
        FORCE_MODULE: (id: string) => `/api/role/${id}/force-module`,
        REVOKE_MODULE: (id: string) => `/api/role/${id}/revoke-module`,
    },
    SPECIALIZATION: {
        GET: `/api/specialization/get-all`,
        CREATE: `/api/specialization/create`,
        UPDATE: (id: string) => `/api/specialization/update/${id}`,
        DELETE: (id: string) => `/api/specialization/delete/${id}`
    },
    USER: {
        GET: `/api/user/get-all`,
        GET_BY_ROLE: (role: string) => `/api/user/get-all?role=${role}`,
        CREATE: `/api/user/create`,
        UPDATE: (id: string) => `/api/user/update/${id}`,
        DELETE: (id: string) => `/api/user/delete/${id}`,
        RESTORE: (id: string) => `/api/user/${id}/restore`,
        REHIRE: (id: string) => `/api/user/${id}/rehire`,
        GET_ASSIGNED_DOCTORS: `/api/user/assigned-doctors`,
        CREATE_ASSIGN_DOCTOR: `/api/user/assign-doctor`,
        GET_SCHEDULED_DOCTOR: (doctorId: string) => `/api/user/${doctorId}/schedule`,
        TERMINATE: (id: string) => `/api/user/${id}/terminate`,
        GET_EMPLOYMENT_HISTORY: (id: string) => `/api/user/${id}/employment-history`,
    },
    EMR: {
        GET_PATIENTS: (doctorId?: string) => `/api/emr/patients${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_PATIENT_SUMMARY: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/summary${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_INSURANCE_COVERAGE: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/insurance-coverage${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_DASHBOARD_SUMMARY: (doctorId?: string) => `/api/emr/dashboard-summary${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_TODAY_SCHEDULE: (doctorId?: string) => `/api/emr/schedule/today${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_ACTIVE_CASES: (doctorId?: string) => `/api/emr/active-cases${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPSERT_ENCOUNTER: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/encounter${doctorId ? `?doctorId=${doctorId}` : ""}`,
        FINISH_ENCOUNTER: (encounterId: string, doctorId?: string) => `/api/emr/encounter/${encounterId}/finish${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_CHRONIC_CONDITION: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/chronic-condition${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_ALLERGY: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/allergy${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_MEDICATION: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/medication${doctorId ? `?doctorId=${doctorId}` : ""}`,
        DISCONTINUE_MEDICATION: (medicationId: string, doctorId?: string) => `/api/emr/medication/${medicationId}/discontinue${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_REFERRAL: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/referral${doctorId ? `?doctorId=${doctorId}` : ""}`,
        SET_REFERRAL_OUTCOME: (referralId: string, doctorId?: string) => `/api/emr/referral/${referralId}/outcome${doctorId ? `?doctorId=${doctorId}` : ""}`,
        SAVE_DENTAL_EXTRAS: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/dental-extras${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_QUICK_NOTES: (doctorId?: string, patientId?: string) => {
            const params = new URLSearchParams();
            if (doctorId) params.set("doctorId", doctorId);
            if (patientId) params.set("patientId", patientId);
            const query = params.toString();
            return `/api/emr/quick-notes${query ? `?${query}` : ""}`;
        },
        ADD_QUICK_NOTE: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/quick-note${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_DOCUMENTS: (patientId: string) => `/api/emr/patient/${patientId}/documents`,
        MARK_DOCUMENT_VIEWED: (patientId: string, id: string) => `/api/emr/patient/${patientId}/documents/${id}/mark-viewed`,
        ADD_TREATMENT: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/treatment${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_CONFIDENTIAL_NOTE: (patientId: string) => `/api/emr/patient/${patientId}/confidential-note`,
        GET_CONFIDENTIAL_NOTES: (patientId?: string) => `/api/emr/confidential-notes${patientId ? `?patientId=${patientId}` : ""}`,
        ADD_DIAGNOSIS: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/diagnosis${doctorId ? `?doctorId=${doctorId}` : ""}`,
        SET_PRIMARY_DIAGNOSIS: (encounterDiagnosisId: string, doctorId?: string) => `/api/emr/diagnosis/${encounterDiagnosisId}/set-primary${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_DIAGNOSIS: (encounterDiagnosisId: string, doctorId?: string) => `/api/emr/diagnosis/${encounterDiagnosisId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_FOLLOW_UP: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/follow-up${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_FOLLOW_UPS: (doctorId?: string) => `/api/emr/follow-ups${doctorId ? `?doctorId=${doctorId}` : ""}`,
        PROPOSE_ENCOUNTER_CORRECTION: (patientId: string, encounterId: string) => `/api/emr/patient/${patientId}/encounter/${encounterId}/propose-correction`,
        GET_ENCOUNTER_CORRECTIONS: (patientId: string, encounterId: string) => `/api/emr/patient/${patientId}/encounter/${encounterId}/corrections`,
        GET_MY_PENDING_CORRECTIONS: () => `/api/emr/my-pending-corrections`,
        ACKNOWLEDGE_CORRECTION: (correctionId: string) => `/api/emr/encounter/correction/${correctionId}/acknowledge`,
        REJECT_CORRECTION: (correctionId: string) => `/api/emr/encounter/correction/${correctionId}/reject`,
    },
    CLINICAL_INCIDENT: {
        GET_ALL: (category?: string, status?: string) => {
            const params = new URLSearchParams();
            if (category) params.set("category", category);
            if (status) params.set("status", status);
            const query = params.toString();
            return `/api/clinical-incidents${query ? `?${query}` : ""}`;
        },
        CREATE: () => `/api/clinical-incidents`,
        UPDATE: (id: string) => `/api/clinical-incidents/${id}`,
    },
    STAFF_EXPOSURE: {
        GET_ALL: (status?: string) => `/api/staff-exposure${status ? `?status=${status}` : ""}`,
        CREATE: () => `/api/staff-exposure`,
        UPDATE: (id: string) => `/api/staff-exposure/${id}`,
    },
    HAND_HYGIENE: {
        GET_SESSIONS: () => `/api/hand-hygiene/sessions`,
        CREATE_SESSION: () => `/api/hand-hygiene/sessions`,
    },
    PATIENT_SATISFACTION: {
        GET_ALL: () => `/api/patient-satisfaction`,
        CREATE: () => `/api/patient-satisfaction`,
    },
    KPI_REPORT: {
        GET_CATALOG: () => `/api/reports/kpi`,
        DOWNLOAD: (reportKey: string, start: string, end: string) =>
            `/api/reports/kpi/${encodeURIComponent(reportKey)}/download?start=${start}&end=${end}`,
    },
    CONFIG_LIST: {
        GET: (listType: string, search?: string, page?: number, pageSize?: number) => {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (page) params.set("page", String(page));
            if (pageSize) params.set("pageSize", String(pageSize));
            const qs = params.toString();
            return `/api/config-lists/${listType}${qs ? `?${qs}` : ""}`;
        },
        CREATE: (listType: string) => `/api/config-lists/${listType}`,
        BULK_UPLOAD: (listType: string) => `/api/config-lists/${listType}/bulk`,
        UPDATE: (id: string) => `/api/config-lists/${id}`,
        SET_ACTIVE: (id: string, isActive: boolean) => `/api/config-lists/${id}/active?isActive=${isActive}`,
        DELETE: (id: string) => `/api/config-lists/${id}`,
    },
    LAB: {
        GET_ALL: `/api/Lab`,
        GET_PENDING: `/api/Lab/pending`,
        GET_SUMMARY: `/api/Lab/summary`,
        CREATE: `/api/Lab`,
        UPDATE_STATUS: `/api/Lab/status`,
        UPLOAD_RESULT: `/api/Lab/upload-result`,
        COLLECT_SAMPLE: `/api/Lab/collect-sample`,
        SAVE_RESULT_VALUES: `/api/Lab/result-values`,
        RECORD_PRINT: (id: string) => `/api/Lab/${id}/record-print`,
    },
    RADIOLOGY: {
        GET_ALL: `/api/Radiology`,
        GET_PENDING: `/api/Radiology/pending`,
        GET_SUMMARY: `/api/Radiology/summary`,
        CREATE: `/api/Radiology`,
        UPDATE_STATUS: `/api/Radiology/status`,
        UPLOAD_RESULT: `/api/Radiology/upload-result`,
        UPLOAD_IMAGES: `/api/Radiology/upload-images`,
    },
    TEST_PARAMETERS: {
        GET: (listItemId: string) => `/api/test-parameters?listItemId=${encodeURIComponent(listItemId)}`,
        CREATE: `/api/test-parameters`,
        UPDATE: (id: string) => `/api/test-parameters/${id}`,
        DELETE: (id: string) => `/api/test-parameters/${id}`,
    },
    PHARMACY: {
        GET_MEDICINES: `/api/Pharmacy/medicine`,
        GET_LOW_STOCK: `/api/Pharmacy/medicine/low-stock`,
        ADD_MEDICINE: `/api/Pharmacy/medicine`,
        UPDATE_STOCK: `/api/Pharmacy/medicine/stock`,
        GET_PRESCRIPTIONS: `/api/Pharmacy/prescription`,
        GET_PENDING_PRESCRIPTIONS: `/api/Pharmacy/prescription/pending`,
        CREATE_PRESCRIPTION: `/api/Pharmacy/prescription`,
        ISSUE: `/api/Pharmacy/issue`,
        GET_SUMMARY: `/api/Pharmacy/summary`,
        GET_MEDICATION_QUEUE: (status: "pending" | "all") => `/api/Pharmacy/medication-queue?status=${status}`,
        PREPARE_MEDICATION: (medicationId: string) => `/api/Pharmacy/medication/${medicationId}/prepare`,
        DISPENSE_MEDICATION: (medicationId: string) => `/api/Pharmacy/medication/${medicationId}/dispense`,
        GET_ALTERNATIVES: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}/alternatives`,
        ADD_ALTERNATIVE: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}/alternatives`,
        REMOVE_ALTERNATIVE: (medicineId: string, alternativeId: string) =>
            `/api/Pharmacy/medicine/${medicineId}/alternatives/${alternativeId}`,
        SET_HIGH_RISK: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}/high-risk`,
    },
    BILLING: {
        GET_ALL: `/api/Billing`,
        GET_PENDING: `/api/Billing/pending`,
        GET_SUMMARY: `/api/Billing/summary`,
        GET_BY_ID: (id: string) => `/api/Billing/${id}`,
        GET_BY_PATIENT: (patientId: string) => `/api/Billing/patient/${patientId}`,
        CREATE: `/api/Billing/create`,
        ADD_ITEM: `/api/Billing/item`,
        PAY: `/api/Billing/pay`,
        CANCEL: (id: string) => `/api/Billing/cancel/${id}`,
        GET_CHARGEABLE_ITEMS: (visitId: string) => `/api/Billing/visit/${visitId}/chargeable-items`,
        ADD_ITEM_FROM_SOURCE: `/api/Billing/item/from-source`,
    },
    NURSING: {
        GET_DASHBOARD_SUMMARY: `/api/nursing/dashboard-summary`,
        GET_TASKS: (status?: string) => `/api/nursing/tasks${status ? `?status=${status}` : ""}`,
        UPDATE_TASK_STATUS: `/api/nursing/status`,
        GET_PATIENT_CHART: (patientId: string) => `/api/nursing/patient/${patientId}/chart`,
        ENSURE_ENCOUNTER: (patientId: string) => `/api/nursing/patient/${patientId}/encounter/ensure`,
        END_ENCOUNTER: (encounterId: string) => `/api/nursing/encounter/${encounterId}/end`,
        SAVE_VITALS: `/api/nursing/vitals`,
        SAVE_INJECTION: `/api/nursing/injection`,
        SAVE_DRESSING: `/api/nursing/dressing`,
        SAVE_BLOOD_SUGAR: `/api/nursing/blood-sugar`,
        SAVE_IV_FLUIDS: `/api/nursing/iv-fluids`,
        ADD_SPECIAL_REMARK: (patientId: string) => `/api/nursing/patient/${patientId}/special-remark`,
        ADD_NOTE: (patientId: string) => `/api/nursing/patient/${patientId}/note`,
        GET_NOTES: (patientId: string) => `/api/nursing/patient/${patientId}/notes`,
        ADD_CONFIDENTIAL_NOTE: (patientId: string) => `/api/nursing/patient/${patientId}/confidential-note`,
        GET_CONFIDENTIAL_NOTES: (patientId?: string) => `/api/nursing/confidential-notes${patientId ? `?patientId=${patientId}` : ""}`,
        ADD_EXAMINATION_NOTE: (patientId: string) => `/api/nursing/patient/${patientId}/examination-note`,
        MARK_TREATMENT_DONE: (treatmentId: string) => `/api/nursing/treatment/${treatmentId}/mark-done`,
        ADMINISTER_MEDICATION: (medicationId: string) => `/api/nursing/medication/${medicationId}/administer`,
        GET_WORK_QUEUE: `/api/nursing/work-queue`,
        GET_UNTOUCHED_PATIENTS: `/api/nursing/untouched-patients`,
        SAVE_TRIAGE: (patientId: string) => `/api/nursing/patient/${patientId}/triage`,
        GET_NURSE_SHIFTS: (nurseId: string) => `/api/nursing/nurse/${nurseId}/shifts`,
        SET_NURSE_SHIFTS: (nurseId: string) => `/api/nursing/nurse/${nurseId}/shifts`,
        GET_ON_DUTY_NOW: `/api/nursing/on-duty-now`,
    },
    RECENT_MODULES: {
        GET: `/api/recent-modules`,
        RECORD: `/api/recent-modules`,
    },
    ATTENDANCE: {
        GET_TODAY: `/api/attendance/today`,
        CHECK_IN: `/api/attendance/check-in`,
        CHECK_OUT: `/api/attendance/check-out`,
        GET_HISTORY: (days?: number) => `/api/attendance/history${days ? `?days=${days}` : ""}`,
    },
}