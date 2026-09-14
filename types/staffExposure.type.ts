export interface StaffExposureType {
  staffExposureIncidentId: string;
  exposedStaffUserId: string | null;
  exposedStaffName: string | null;
  isTempAgencyStaff: boolean;
  position: string | null;
  homeDepartmentId: string | null;
  homeDepartmentName: string | null;
  hoursOnDutyAtExposure: number | null;
  eventDateTime: string;
  reportedAt: string;
  exposureTypeCode: string | null;
  fluidTissueTypeCode: string | null;
  fluidTissueOtherText: string | null;
  exposureLocationCode: string | null;
  exposureLocationOtherText: string | null;
  bodySiteCode: string | null;
  bodySiteOtherText: string | null;
  objectCausingInjuryCode: string | null;
  objectCausingInjuryDetailText: string | null;
  injuryDescriptionText: string | null;
  injuryBodyLocationCode: string | null;
  injuryTypeCode: string | null;
  bloodExposureAmountCode: string | null;
  activityCode: string | null;
  activityOtherText: string | null;
  barriersUsedCode: string | null;
  barriersOtherText: string | null;
  woundDescriptionCode: string | null;
  biteActivityCode: string | null;
  biteActivityOtherText: string | null;
  status: string;
  closedAt: string | null;
  notes: string | null;
}

export interface StaffExposureCreatePayload {
  exposedStaffUserId?: string;
  isTempAgencyStaff?: boolean;
  position?: string;
  homeDepartmentId?: string;
  hoursOnDutyAtExposure?: number;
  eventDateTime: string;
  exposureTypeCode?: string;
  fluidTissueTypeCode?: string;
  fluidTissueOtherText?: string;
  exposureLocationCode?: string;
  exposureLocationOtherText?: string;
  bodySiteCode?: string;
  bodySiteOtherText?: string;
  objectCausingInjuryCode?: string;
  objectCausingInjuryDetailText?: string;
  injuryDescriptionText?: string;
  injuryBodyLocationCode?: string;
  injuryTypeCode?: string;
  bloodExposureAmountCode?: string;
  activityCode?: string;
  activityOtherText?: string;
  barriersUsedCode?: string;
  barriersOtherText?: string;
  woundDescriptionCode?: string;
  biteActivityCode?: string;
  biteActivityOtherText?: string;
  notes?: string;
}

// Same shape as create so the create form can double as the edit form - only accepted while
// Status is not Closed. eventDateTime is optional here (unlike create) so a plain status-only
// update - e.g. the list's inline status dropdown - doesn't need to resend the rest of the report.
export interface StaffExposureUpdatePayload extends Omit<StaffExposureCreatePayload, "eventDateTime"> {
  eventDateTime?: string;
  status?: string;
}
