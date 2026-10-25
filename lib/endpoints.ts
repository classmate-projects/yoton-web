export const ENDPOINTS = {
    AUTH: {
        ME: `/api/auth/me`,
        UPLOAD_AVATAR: `/api/auth/upload-avatar`,
        DELETE_AVATAR: `/api/auth/avatar`,
        CHANGE_PASSWORD: `/api/auth/change-password`,
    },
    // Super administrator only - the installation's country/region (SystemController).
    SYSTEM: {
        STATUS: `/api/system/status`,
        REGIONS: `/api/system/regions`,
        APPLY_REGION: `/api/system/region`,
    },
    COMPANY: {
        UPLOAD_LOGO: `/api/company/upload-logo`,
        UPDATE_SETTINGS: `/api/company/settings`,
        PREVIEW_PATIENT_EMAIL: `/api/company/preview-patient-email`,
    },
    BRANCH: {
        GET_ALL: `/api/branch/get-all`,
        CREATE: `/api/branch/create`,
        UPDATE: (id: string) => `/api/branch/update/${id}`,
        UPLOAD_LOGO: (id: string) => `/api/branch/${id}/upload-logo`,
        DELETE: (id: string) => `/api/branch/${id}`,
        MIGRATE_AND_DELETE: (id: string) => `/api/branch/${id}/migrate-and-delete`,
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
        // POSTs, so mobile numbers and ID numbers never end up in URLs or server logs.
        SEARCH_PATIENTS: `/api/reception/patient-search`,
        MATCH_PATIENTS: `/api/reception/patient-match`,
        CREATE_EXTERNAL_PATIENT: `/api/reception/external-patient`,
        GET_PATIENT_BY_ID: (id: string) => `/api/reception/patient/${id}`,
        UPDATE_PATIENT: (id: string) => `/api/reception/patient/${id}`,
        UPDATE_SCEDULE: `/api/reception/update-schedule`,
        GET_DOCTOR_AVAILABILITY: `/api/reception/doctor-availability`,
        GET_SCHEDULED_APPOINTMENTS: (date?: string) => `/api/reception/appointments/scheduled${date ? `?date=${date}` : ""}`,
        CREATE_APPOINTMENT: `/api/reception/create-appointment`,
        OVERLAP_APPOINTMENT: `/api/reception/overlap-appointment`,
        GET_SPECIALIZATIONS_DOCTORS: `/api/reception/specializations-doctors`,
        GET_DOCTOR_SLOTS: (doctorId: string, date: string) => `/api/reception/doctor-slots/${doctorId}?date=${date}`,
        SOFT_DELETE: (id: string) => `/api/reception/soft-delete/${id}`,
        UPDATE_STATUS: `/api/reception/update-status`,
        CANCEL: (id: string) => `/api/reception/cancel/${id}`,
        CHECK_IN: `/api/reception/check-in`,
        WALK_IN: `/api/reception/walk-in`,
        REASSIGN_VISIT: (id: string) => `/api/reception/visit/${id}`,
        CANCEL_VISIT: (id: string) => `/api/reception/visit/${id}/cancel`,
        GET_DAILY_VISIT_STATS: `/api/reception/visit/daily-stats`,
        UPLOAD_DOCUMENT: (patientId: string) => `/api/reception/patient/${patientId}/document`,
        GET_APPOINTMENT_REQUESTS: `/api/reception/appointment-requests`,
        GET_PENDING_FOLLOW_UPS: `/api/reception/follow-ups/pending`,
        CONFIRM_FOLLOW_UP: (id: string) => `/api/reception/follow-ups/${id}/confirm`,
        DISMISS_FOLLOW_UP: (id: string) => `/api/reception/follow-ups/${id}`,
        RESEND_WELCOME_EMAIL: (patientId: string) => `/api/reception/${patientId}/resend-welcome-email`,
        GET_PENDING_REFERRALS: `/api/reception/referrals/pending`,
        REGISTER_FROM_REFERRAL: (referralId: string) => `/api/reception/referral/${referralId}/register`,
        GET_PATIENT_EMR_CONSULTATIONS: (patientId: string, from?: string, to?: string) => {
            const params = new URLSearchParams();
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            const qs = params.toString();
            return `/api/reception/patient/${patientId}/emr/consultations${qs ? `?${qs}` : ""}`;
        },
        GET_PATIENT_EMR_ENCOUNTER: (patientId: string, encounterId: string) =>
            `/api/reception/patient/${patientId}/emr/encounter/${encounterId}`,
        REVERT_CHECKIN: (id: string) => `/api/reception/visit/${id}/revert-checkin`,
        UPDATE_APPOINTMENT: (id: string) => `/api/reception/appointment/${id}`,
        GET_PATIENT_DOCUMENTS: (patientId: string) => `/api/reception/patient/${patientId}/documents`,
        DELETE_PATIENT_DOCUMENT: (patientId: string, docId: string) => `/api/reception/patient/${patientId}/document/${docId}`,
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
        UPDATE_STATUS: (id: string) => `/api/user/${id}/status`,
        GET_ASSIGNED_DOCTORS: `/api/user/assigned-doctors`,
        CREATE_ASSIGN_DOCTOR: `/api/user/assign-doctor`,
        TERMINATE: (id: string) => `/api/user/${id}/terminate`,
        GET_EMPLOYMENT_HISTORY: (id: string) => `/api/user/${id}/employment-history`,
        GET_DETAILS: (id: string) => `/api/user/${id}/details`,
        NOTES: (id: string) => `/api/user/${id}/notes`,
        DELETE_NOTE: (noteId: string) => `/api/user/notes/${noteId}`,
        UPLOAD_SIGNATURE: (id: string) => `/api/user/${id}/upload-signature`,
    },
    EMR: {
        GET_DEPARTMENTS: `/api/emr/departments`,
        GET_PATIENTS: (doctorId?: string, date?: string, department?: string) => {
            const p = new URLSearchParams();
            if (doctorId) p.set("doctorId", doctorId);
            if (date) p.set("date", date);
            if (department) p.set("department", department);
            const qs = p.toString();
            return `/api/emr/patients${qs ? `?${qs}` : ""}`;
        },
        GET_PATIENT_ENCOUNTERS: (patientId: string, doctorId?: string) =>
            `/api/emr/patient/${patientId}/encounters${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_PATIENT_SUMMARY: (patientId: string, doctorId?: string, visitId?: string) => {
            const qs = new URLSearchParams();
            if (doctorId) qs.set("doctorId", doctorId);
            if (visitId) qs.set("visitId", visitId);
            const s = qs.toString();
            return `/api/emr/patient/${patientId}/summary${s ? `?${s}` : ""}`;
        },
        UPDATE_PATIENT_ALERT: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/alert${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_MEDICAL_HISTORY: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/medical-history${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_INSURANCE_COVERAGE: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/insurance-coverage${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_DASHBOARD_SUMMARY: (doctorId?: string) => `/api/emr/dashboard-summary${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_TODAY_SCHEDULE: (doctorId?: string, date?: string) => { const p = new URLSearchParams(); if (doctorId) p.set("doctorId", doctorId); if (date) p.set("date", date); const q = p.toString(); return `/api/emr/schedule/today${q ? `?${q}` : ""}`; },
        GET_ACTIVE_CASES: (doctorId?: string) => `/api/emr/active-cases${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_TODAY_QUEUE: (doctorId?: string) => `/api/emr/patients/today-queue${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPSERT_ENCOUNTER: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/encounter${doctorId ? `?doctorId=${doctorId}` : ""}`,
        FINISH_ENCOUNTER: (encounterId: string, doctorId?: string) => `/api/emr/encounter/${encounterId}/finish${doctorId ? `?doctorId=${doctorId}` : ""}`,
        RE_ENCOUNTER: (encounterId: string, tzOffset: number) => `/api/emr/encounter/${encounterId}/re-encounter?tzOffset=${tzOffset}`,
        RELEASE_VISIT: (visitId: string, doctorId?: string, password?: string) => {
          const params = new URLSearchParams();
          if (doctorId) params.set("doctorId", doctorId);
          if (password) params.set("password", password);
          const qs = params.toString();
          return `/api/emr/visit/${visitId}/release${qs ? `?${qs}` : ""}`;
        },
        ADD_CHRONIC_CONDITION: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/chronic-condition${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_CHRONIC_CONDITION: (chronicConditionId: string, doctorId?: string) => `/api/emr/chronic-condition/${chronicConditionId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_CHRONIC_CONDITION: (chronicConditionId: string, doctorId?: string) => `/api/emr/chronic-condition/${chronicConditionId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_ALLERGY: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/allergy${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_ALLERGY: (patientAllergyId: string, doctorId?: string) => `/api/emr/allergy/${patientAllergyId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_ALLERGY: (patientAllergyId: string, doctorId?: string) => `/api/emr/allergy/${patientAllergyId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_FAMILY_HISTORY: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/family-history${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_FAMILY_HISTORY: (familyHistoryId: string, doctorId?: string) => `/api/emr/family-history/${familyHistoryId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_FAMILY_HISTORY: (familyHistoryId: string, doctorId?: string) => `/api/emr/family-history/${familyHistoryId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_MEDICATION: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/medication${doctorId ? `?doctorId=${doctorId}` : ""}`,
        DISCONTINUE_MEDICATION: (medicationId: string, doctorId?: string) => `/api/emr/medication/${medicationId}/discontinue${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_MEDICATION: (medicationId: string, doctorId?: string) => `/api/emr/medication/${medicationId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_MEDICATION: (medicationId: string, doctorId?: string) => `/api/emr/medication/${medicationId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_REFERRAL: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/referral${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_REFERRAL: (referralId: string, doctorId?: string) => `/api/emr/referral/${referralId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_REFERRAL: (referralId: string, doctorId?: string) => `/api/emr/referral/${referralId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        SAVE_DENTAL_EXTRAS: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/dental-extras${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_QUICK_NOTES: (doctorId?: string, patientId?: string) => {
            const params = new URLSearchParams();
            if (doctorId) params.set("doctorId", doctorId);
            if (patientId) params.set("patientId", patientId);
            const query = params.toString();
            return `/api/emr/quick-notes${query ? `?${query}` : ""}`;
        },
        ADD_QUICK_NOTE: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/quick-note${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_QUICK_NOTE: (consultationNoteId: string, doctorId?: string) => `/api/emr/quick-note/${consultationNoteId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_QUICK_NOTE: (consultationNoteId: string, doctorId?: string) => `/api/emr/quick-note/${consultationNoteId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_DOCUMENTS: (patientId: string) => `/api/emr/patient/${patientId}/documents`,
        MARK_DOCUMENT_VIEWED: (patientId: string, id: string) => `/api/emr/patient/${patientId}/documents/${id}/mark-viewed`,
        // ADD_TREATMENT moved to ENDPOINTS.TREATMENTS.CREATE.
        ADD_CONFIDENTIAL_NOTE: (patientId: string) => `/api/emr/patient/${patientId}/confidential-note`,
        UPDATE_CONFIDENTIAL_NOTE: (doctorConfidentialNoteId: string) => `/api/emr/confidential-note/${doctorConfidentialNoteId}`,
        REMOVE_CONFIDENTIAL_NOTE: (doctorConfidentialNoteId: string) => `/api/emr/confidential-note/${doctorConfidentialNoteId}`,
        GET_CONFIDENTIAL_NOTES: (patientId?: string) => `/api/emr/confidential-notes${patientId ? `?patientId=${patientId}` : ""}`,
        ADD_DIAGNOSIS: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/diagnosis${doctorId ? `?doctorId=${doctorId}` : ""}`,
        SET_PRIMARY_DIAGNOSIS: (encounterDiagnosisId: string, doctorId?: string) => `/api/emr/diagnosis/${encounterDiagnosisId}/set-primary${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_DIAGNOSIS: (encounterDiagnosisId: string, doctorId?: string) => `/api/emr/diagnosis/${encounterDiagnosisId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADD_FOLLOW_UP: (patientId: string, doctorId?: string) => `/api/emr/patient/${patientId}/follow-up${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_FOLLOW_UP: (followUpId: string, doctorId?: string) => `/api/emr/follow-up/${followUpId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        REMOVE_FOLLOW_UP: (followUpId: string, doctorId?: string) => `/api/emr/follow-up/${followUpId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        GET_FOLLOW_UPS: (doctorId?: string) => `/api/emr/follow-ups${doctorId ? `?doctorId=${doctorId}` : ""}`,
        PROPOSE_ENCOUNTER_CORRECTION: (patientId: string, encounterId: string) => `/api/emr/patient/${patientId}/encounter/${encounterId}/propose-correction`,
        GET_ENCOUNTER_CORRECTIONS: (patientId: string, encounterId: string) => `/api/emr/patient/${patientId}/encounter/${encounterId}/corrections`,
        GET_MY_PENDING_CORRECTIONS: () => `/api/emr/my-pending-corrections`,
        ACKNOWLEDGE_CORRECTION: (correctionId: string) => `/api/emr/encounter/correction/${correctionId}/acknowledge`,
        REJECT_CORRECTION: (correctionId: string) => `/api/emr/encounter/correction/${correctionId}/reject`,
        REQUEST_ENCOUNTER_UNLOCK: (patientId: string, encounterId: string) => `/api/emr/patient/${patientId}/encounter/${encounterId}/request-unlock`,
        GET_MY_UNLOCK_REQUEST_STATUS: (patientId: string, encounterId: string) => `/api/emr/patient/${patientId}/encounter/${encounterId}/unlock-request-status`,
        GET_ENCOUNTER_UNLOCK_REQUESTS: () => `/api/emr/encounter-unlock-requests`,
        APPROVE_ENCOUNTER_UNLOCK: (requestId: string) => `/api/emr/encounter/unlock-request/${requestId}/approve`,
        DENY_ENCOUNTER_UNLOCK: (requestId: string) => `/api/emr/encounter/unlock-request/${requestId}/deny`,
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
        REOPEN: (id: string) => `/api/clinical-incidents/${id}/reopen`,
        REMOVE: (id: string) => `/api/clinical-incidents/${id}`,
    },
    STAFF_EXPOSURE: {
        GET_ALL: (status?: string) => `/api/staff-exposure${status ? `?status=${status}` : ""}`,
        CREATE: () => `/api/staff-exposure`,
        UPDATE: (id: string) => `/api/staff-exposure/${id}`,
        REOPEN: (id: string) => `/api/staff-exposure/${id}/reopen`,
        REMOVE: (id: string) => `/api/staff-exposure/${id}`,
    },
    HAND_HYGIENE: {
        GET_SESSIONS: () => `/api/hand-hygiene/sessions`,
        CREATE_SESSION: () => `/api/hand-hygiene/sessions`,
        UPDATE_SESSION: (id: string) => `/api/hand-hygiene/sessions/${id}`,
        REMOVE_SESSION: (id: string) => `/api/hand-hygiene/sessions/${id}`,
    },
    PATIENT_SATISFACTION: {
        GET_ALL: () => `/api/patient-satisfaction`,
        CREATE: () => `/api/patient-satisfaction`,
        UPDATE: (id: string) => `/api/patient-satisfaction/${id}`,
        REMOVE: (id: string) => `/api/patient-satisfaction/${id}`,
    },
    KPI_REPORT: {
        GET_CATALOG: () => `/api/reports/kpi`,
        DOWNLOAD: (reportKey: string, start: string, end: string) =>
            `/api/reports/kpi/${encodeURIComponent(reportKey)}/download?start=${start}&end=${end}`,
    },
    COMPLIANCE_DATA: {
        GET_STAFF_FTE: () => `/api/compliance-data/staff-fte`,
        UPDATE_STAFF_FTE: (userId: string) => `/api/compliance-data/staff-fte/${userId}`,
        GET_PATIENT_FLAGS: () => `/api/compliance-data/patient-flags`,
        UPDATE_PATIENT_FLAGS: (chronicConditionId: string) => `/api/compliance-data/patient-flags/${chronicConditionId}`,
    },
    AUDIT_LOG: {
        GET_ALL: (params: {
            userId?: string;
            module?: string;
            method?: string;
            from?: string;
            to?: string;
            page?: number;
            pageSize?: number;
        }) => {
            const query = new URLSearchParams();
            if (params.userId) query.set("userId", params.userId);
            if (params.module) query.set("module", params.module);
            if (params.method) query.set("method", params.method);
            if (params.from) query.set("from", params.from);
            if (params.to) query.set("to", params.to);
            if (params.page) query.set("page", String(params.page));
            if (params.pageSize) query.set("pageSize", String(params.pageSize));
            const qs = query.toString();
            return `/api/audit-log${qs ? `?${qs}` : ""}`;
        },
        GET_MODULES: () => `/api/audit-log/modules`,
        GET_VERSIONS: (auditLogId: string) => `/api/audit-log/${auditLogId}/versions`,
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
    LIST_TEMPLATE: {
        GET: (listType: string) => `/api/list-templates/${listType}`,
        SAVE: (listType: string) => `/api/list-templates/${listType}`,
        HISTORY: (listType: string) => `/api/list-templates/${listType}/history`,
    },
    LAB: {
        GET_ALL: (date?: string) => date ? `/api/Lab?date=${date}` : `/api/Lab`,
        GET_PENDING: (date?: string) => date ? `/api/Lab/pending?date=${date}` : `/api/Lab/pending`,
        GET_SUMMARY: `/api/Lab/summary`,
        CREATE: `/api/Lab`,
        UPDATE: (id: string) => `/api/Lab/${id}`,
        REMOVE: (id: string) => `/api/Lab/${id}`,
        UPDATE_STATUS: `/api/Lab/status`,
        UPLOAD_RESULT: `/api/Lab/upload-result`,
        COLLECT_SAMPLE: `/api/Lab/collect-sample`,
        SAVE_RESULT_VALUES: `/api/Lab/result-values`,
        RECORD_PRINT: (id: string) => `/api/Lab/${id}/record-print`,
        REVERT: (id: string) => `/api/Lab/${id}/revert`,
    },
    RADIOLOGY: {
        GET_ALL: (date?: string) => date ? `/api/Radiology?date=${date}` : `/api/Radiology`,
        GET_PENDING: (date?: string) => date ? `/api/Radiology/pending?date=${date}` : `/api/Radiology/pending`,
        GET_SUMMARY: `/api/Radiology/summary`,
        CREATE: `/api/Radiology`,
        UPDATE: (id: string) => `/api/Radiology/${id}`,
        REMOVE: (id: string) => `/api/Radiology/${id}`,
        UPDATE_STATUS: `/api/Radiology/status`,
        UPLOAD_RESULT: `/api/Radiology/upload-result`,
        UPLOAD_IMAGES: `/api/Radiology/upload-images`,
        REVERT: (id: string) => `/api/Radiology/${id}/revert`,
    },
    TREATMENTS: {
        CREATE: (doctorId?: string) => `/api/treatments${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE: (id: string) => `/api/treatments/${id}`,
        START: (id: string) => `/api/treatments/${id}/start`,
        REVERT: (id: string) => `/api/treatments/${id}/revert`,
        MARK_DONE: (id: string) => `/api/treatments/${id}/mark-done`,
    },
    TEST_PARAMETERS: {
        GET: (listItemId: string) => `/api/test-parameters?listItemId=${encodeURIComponent(listItemId)}`,
        CREATE: `/api/test-parameters`,
        DELETE: (id: string) => `/api/test-parameters/${id}`,
    },
    PHARMACY: {
        GET_MEDICINES: `/api/Pharmacy/medicine`,
        GET_LOW_STOCK: `/api/Pharmacy/medicine/low-stock`,
        ADD_MEDICINE: `/api/Pharmacy/medicine`,
        BULK_UPLOAD_MEDICINES: `/api/Pharmacy/medicine/bulk`,
        UPDATE_MEDICINE: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}`,
        REMOVE_MEDICINE: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}`,
        GET_PRESCRIPTIONS: (date?: string) => date ? `/api/Pharmacy/prescription?date=${date}` : `/api/Pharmacy/prescription`,
        GET_PENDING_PRESCRIPTIONS: (date?: string) => date ? `/api/Pharmacy/prescription/pending?date=${date}` : `/api/Pharmacy/prescription/pending`,
        CREATE_PRESCRIPTION: `/api/Pharmacy/prescription`,
        UPDATE_PRESCRIPTION: (prescriptionId: string) => `/api/Pharmacy/prescription/${prescriptionId}`,
        REMOVE_PRESCRIPTION: (prescriptionId: string) => `/api/Pharmacy/prescription/${prescriptionId}`,
        ISSUE: `/api/Pharmacy/issue`,
        GET_SUMMARY: `/api/Pharmacy/summary`,
        GET_MEDICATION_QUEUE: (status: "pending" | "all", date?: string) => `/api/Pharmacy/medication-queue?status=${status}${date ? `&date=${date}` : ""}`,
        PREPARE_MEDICATION: (medicationId: string) => `/api/Pharmacy/medication/${medicationId}/prepare`,
        REVERT_PREPARE_MEDICATION: (medicationId: string) => `/api/Pharmacy/medication/${medicationId}/revert-prepare`,
        DISPENSE_MEDICATION: (medicationId: string) => `/api/Pharmacy/medication/${medicationId}/dispense`,
        GET_ALTERNATIVES: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}/alternatives`,
        ADD_ALTERNATIVE: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}/alternatives`,
        REMOVE_ALTERNATIVE: (medicineId: string, alternativeId: string) =>
            `/api/Pharmacy/medicine/${medicineId}/alternatives/${alternativeId}`,
        SET_HIGH_RISK: (medicineId: string) => `/api/Pharmacy/medicine/${medicineId}/high-risk`,
    },
    BILLING: {
        // tz = browser getTimezoneOffset(), so "a day" means the user's local day, not UTC.
        GET_ALL: (date?: string) => `/api/Billing?tzOffset=${new Date().getTimezoneOffset()}${date ? `&date=${date}` : ""}`,
        GET_PENDING: (date?: string) => `/api/Billing/pending?tzOffset=${new Date().getTimezoneOffset()}${date ? `&date=${date}` : ""}`,
        GET_AWAITING: `/api/Billing/awaiting`,
        OPEN_VISIT_BILL: (visitId: string) => `/api/Billing/visit/${visitId}/open`,
        GET_SUMMARY: () => `/api/Billing/summary?tzOffset=${new Date().getTimezoneOffset()}`,
        CREATE: `/api/Billing/create`,
        ADD_ITEM: `/api/Billing/item`,
        PAY: `/api/Billing/pay`,
        CANCEL: (id: string) => `/api/Billing/cancel/${id}`,
        GET_CHARGEABLE_ITEMS: (visitId: string) => `/api/Billing/visit/${visitId}/chargeable-items`,
        GET_WALK_IN_AWAITING: `/api/Billing/walk-in/awaiting`,
        GET_WALK_IN_ITEMS: (patientId: string) => `/api/Billing/patient/${patientId}/walk-in-items`,
        OPEN_WALK_IN_BILL: (patientId: string) => `/api/Billing/patient/${patientId}/walk-in/open`,
        ADD_ITEM_FROM_SOURCE: `/api/Billing/item/from-source`,
        UPDATE_ITEM: (itemId: string) => `/api/Billing/item/${itemId}`,
        REMOVE_ITEM: (itemId: string) => `/api/Billing/item/${itemId}/remove`,
        // Refunds owed on paid bills (items returned after payment).
        GET_REFUNDS: (billId: string) => `/api/Billing/${billId}/refunds`,
        GET_REFUNDS_DUE: `/api/Billing/refunds/due`,
        PAY_REFUND: (refundId: string) => `/api/Billing/refunds/${refundId}/pay`,
        REPORTS: (from: string, to: string) =>
            `/api/BillingReports?from=${from}&to=${to}&tzOffset=${new Date().getTimezoneOffset()}`,
    },
    NURSING: {
        GET_DASHBOARD_SUMMARY: `/api/nursing/dashboard-summary`,
        GET_TASKS: (status?: string) => `/api/nursing/tasks${status ? `?status=${status}` : ""}`,
        UPDATE_TASK_STATUS: `/api/nursing/status`,
        GET_PATIENT_CHART: (patientId: string) => `/api/nursing/patient/${patientId}/chart`,
        GET_VITALS_HISTORY: (patientId: string) => `/api/nursing/patient/${patientId}/vitals-history`,
        ENSURE_ENCOUNTER: (patientId: string) => `/api/nursing/patient/${patientId}/encounter/ensure`,
        END_ENCOUNTER: (encounterId: string) => `/api/nursing/encounter/${encounterId}/end`,
        SAVE_VITALS: `/api/nursing/vitals`,
        UPDATE_VITALS: (vitalsRecordId: string) => `/api/nursing/vitals/${vitalsRecordId}`,
        REMOVE_VITALS: (vitalsRecordId: string, nurseId?: string, password?: string) => {
            const params = new URLSearchParams();
            if (nurseId) params.set("nurseId", nurseId);
            if (password) params.set("password", password);
            const query = params.toString();
            return `/api/nursing/vitals/${vitalsRecordId}${query ? `?${query}` : ""}`;
        },
        SAVE_INJECTION: `/api/nursing/injection`,
        UPDATE_INJECTION: (injectionRecordId: string) => `/api/nursing/injection/${injectionRecordId}`,
        REMOVE_INJECTION: (injectionRecordId: string, nurseId?: string, password?: string) => {
            const params = new URLSearchParams();
            if (nurseId) params.set("nurseId", nurseId);
            if (password) params.set("password", password);
            const query = params.toString();
            return `/api/nursing/injection/${injectionRecordId}${query ? `?${query}` : ""}`;
        },
        SAVE_DRESSING: `/api/nursing/dressing`,
        UPDATE_DRESSING: (dressingTaskId: string) => `/api/nursing/dressing/${dressingTaskId}`,
        REMOVE_DRESSING: (dressingTaskId: string) => `/api/nursing/dressing/${dressingTaskId}`,
        SAVE_BLOOD_SUGAR: `/api/nursing/blood-sugar`,
        UPDATE_BLOOD_SUGAR: (bloodSugarTaskId: string) => `/api/nursing/blood-sugar/${bloodSugarTaskId}`,
        REMOVE_BLOOD_SUGAR: (bloodSugarTaskId: string) => `/api/nursing/blood-sugar/${bloodSugarTaskId}`,
        SAVE_IV_FLUIDS: `/api/nursing/iv-fluids`,
        UPDATE_IV_FLUIDS: (ivFluidsTaskId: string) => `/api/nursing/iv-fluids/${ivFluidsTaskId}`,
        REMOVE_IV_FLUIDS: (ivFluidsTaskId: string) => `/api/nursing/iv-fluids/${ivFluidsTaskId}`,
        ADD_SPECIAL_REMARK: (patientId: string) => `/api/nursing/patient/${patientId}/special-remark`,
        UPDATE_SPECIAL_REMARK: (specialRemarkId: string) => `/api/nursing/special-remark/${specialRemarkId}`,
        REMOVE_SPECIAL_REMARK: (specialRemarkId: string) => `/api/nursing/special-remark/${specialRemarkId}`,
        ADD_NOTE: (patientId: string) => `/api/nursing/patient/${patientId}/note`,
        UPDATE_NOTE: (nurseNoteId: string) => `/api/nursing/note/${nurseNoteId}`,
        REMOVE_NOTE: (nurseNoteId: string) => `/api/nursing/note/${nurseNoteId}`,
        GET_NOTES: (patientId: string) => `/api/nursing/patient/${patientId}/notes`,
        ADD_CONFIDENTIAL_NOTE: (patientId: string) => `/api/nursing/patient/${patientId}/confidential-note`,
        UPDATE_CONFIDENTIAL_NOTE: (confidentialNoteId: string) => `/api/nursing/confidential-note/${confidentialNoteId}`,
        REMOVE_CONFIDENTIAL_NOTE: (confidentialNoteId: string) => `/api/nursing/confidential-note/${confidentialNoteId}`,
        GET_CONFIDENTIAL_NOTES: (patientId?: string) => `/api/nursing/confidential-notes${patientId ? `?patientId=${patientId}` : ""}`,
        ADD_EXAMINATION_NOTE: (patientId: string) => `/api/nursing/patient/${patientId}/examination-note`,
        // MARK_TREATMENT_DONE moved to ENDPOINTS.TREATMENTS.MARK_DONE.
        ADMINISTER_MEDICATION: (medicationId: string) => `/api/nursing/medication/${medicationId}/administer`,
        CANCEL_MEDICATION_ADMINISTRATION: (administrationId: string) => `/api/nursing/medication-administration/${administrationId}/cancel`,
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
    USER_PREFERENCES: {
        GET: (key: string) => `/api/user-preferences/${encodeURIComponent(key)}`,
        SET: (key: string) => `/api/user-preferences/${encodeURIComponent(key)}`,
    },
    ATTENDANCE: {
        GET_TODAY: `/api/attendance/today`,
        // tzOffset lets a forgotten check-out be closed at 23:59:59 of this user's own local day.
        CHECK_IN: () => `/api/attendance/check-in?tzOffset=${new Date().getTimezoneOffset()}`,
        CHECK_OUT: `/api/attendance/check-out`,
        GET_HISTORY: (days?: number) => `/api/attendance/history${days ? `?days=${days}` : ""}`,
        GET_STAFF: (date: string) => `/api/attendance/staff?date=${date}`,
        GET_RECENT_AUTO_CHECK_OUTS: (days: number) => `/api/attendance/staff/auto-check-outs?days=${days}`,
    },
    FORM_TEMPLATE: {
        GET_ALL: `/api/form-templates`,
        CREATE: `/api/form-templates`,
        UPDATE: (id: string) => `/api/form-templates/${id}`,
        SET_ACTIVE: (id: string, isActive: boolean) => `/api/form-templates/${id}/active?isActive=${isActive}`,
        SET_DEPARTMENTS: (id: string) => `/api/form-templates/${id}/departments`,
        SET_SPECIALTIES: (id: string) => `/api/form-templates/${id}/specialties`,
        GET_AVAILABLE: (doctorId?: string) => `/api/form-templates/available${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPLOAD_IMAGE: `/api/form-templates/upload-image`,
        GET_PLACEHOLDERS: `/api/form-templates/placeholders`,
    },
    SAVED_MEDICAL_FORM: {
        CREATE: `/api/saved-medical-forms`,
        UPDATE: (id: string) => `/api/saved-medical-forms/${id}`,
        DELETE: (id: string, password?: string) => `/api/saved-medical-forms/${id}${password ? `?password=${encodeURIComponent(password)}` : ""}`,
        GET_BY_PATIENT: (patientId: string) => `/api/saved-medical-forms/patient/${patientId}`,
        GET_PLACEHOLDER_VALUES: (formTemplateId: string, patientId: string, visitId?: string | null) =>
            `/api/saved-medical-forms/placeholder-values?formTemplateId=${encodeURIComponent(formTemplateId)}&patientId=${encodeURIComponent(patientId)}${visitId ? `&visitId=${encodeURIComponent(visitId)}` : ""}`,
        HANDOVER: (id: string) => `/api/saved-medical-forms/${id}/handover`,
        GET_MY_PENDING_HANDOVERS: `/api/saved-medical-forms/my-pending-handovers`,
        ACKNOWLEDGE_HANDOVER: (id: string) => `/api/saved-medical-forms/${id}/handover/acknowledge`,
    },
    // Reads pass the browser's timezone offset so "due today"/"overdue" follow the user's own day.
    IMMUNIZATION: {
        GET_VACCINES: (includeInactive?: boolean) => `/api/immunization/vaccines${includeInactive ? "?includeInactive=true" : ""}`,
        CREATE_VACCINE: `/api/immunization/vaccine`,
        UPDATE_VACCINE: (vaccineId: string) => `/api/immunization/vaccine/${vaccineId}`,
        DELETE_VACCINE: (vaccineId: string) => `/api/immunization/vaccine/${vaccineId}`,
        GET_SCHEDULE: (patientId: string) => `/api/immunization/patient/${patientId}?tz=${new Date().getTimezoneOffset()}`,
        SCHEDULE_VACCINATION: (patientId: string, doctorId?: string) =>
            `/api/immunization/patient/${patientId}/schedule-vaccination${doctorId ? `?doctorId=${doctorId}` : ""}`,
        UPDATE_ORDER: (orderId: string, doctorId?: string) =>
            `/api/immunization/vaccination-order/${orderId}${doctorId ? `?doctorId=${doctorId}` : ""}`,
        CANCEL_ORDER: (orderId: string, doctorId?: string) =>
            `/api/immunization/vaccination-order/${orderId}/cancel${doctorId ? `?doctorId=${doctorId}` : ""}`,
        RECORD_MISSED_DOSE: (patientId: string, doctorId?: string) =>
            `/api/immunization/patient/${patientId}/missed-dose${doctorId ? `?doctorId=${doctorId}` : ""}`,
        ADMINISTER: (orderId: string) => `/api/immunization/vaccination-order/${orderId}/administer-vaccine`,
        UNDO_ADMINISTRATION: (orderId: string) => `/api/immunization/vaccination-order/${orderId}/undo-administration`,
        MARK_MISSED: (orderId: string) => `/api/immunization/vaccination-order/${orderId}/mark-missed`,
        RECORD_PAST_DOSE: (patientId: string) => `/api/immunization/patient/${patientId}/past-dose`,
        RECORD_PRINT: (patientId: string) => `/api/immunization/patient/${patientId}/print-history`,
        GET_REMINDERS: (doctorId?: string) =>
            `/api/immunization/reminders?tz=${new Date().getTimezoneOffset()}${doctorId ? `&doctorId=${doctorId}` : ""}`,
    },
}