import type { ComponentType } from "react";
import BillingIllustration from "./BillingIllustration";
import BuildingIllustration from "./BuildingIllustration";
import ChartIllustration from "./ChartIllustration";
import ClipboardIllustration from "./ClipboardIllustration";
import DocumentsIllustration from "./DocumentsIllustration";
import DoneIllustration from "./DoneIllustration";
import FeedbackIllustration from "./FeedbackIllustration";
import HygieneIllustration from "./HygieneIllustration";
import IncidentIllustration from "./IncidentIllustration";
import LabIllustration from "./LabIllustration";
import MedicationHistoryIllustration from "./MedicationHistoryIllustration";
import MessagesIllustration from "./MessagesIllustration";
import NotesIllustration from "./NotesIllustration";
import PatientsIllustration from "./PatientsIllustration";
import PharmacyIllustration from "./PharmacyIllustration";
import RadiologyIllustration from "./RadiologyIllustration";
import ReferralsIllustration from "./ReferralsIllustration";
import RolesIllustration from "./RolesIllustration";
import SearchIllustration from "./SearchIllustration";
import UsersIllustration from "./UsersIllustration";
import VisitsIllustration from "./VisitsIllustration";
import VitalsIllustration from "./VitalsIllustration";

// Name -> artwork lookup used by <EmptyState illustration="...">. To add one: create
// XyzIllustration.tsx in this folder (draw inside <Frame>, see shared.tsx) and register it here.
export const illustrations = {
  patients: PatientsIllustration,
  visits: VisitsIllustration,
  referrals: ReferralsIllustration,
  search: SearchIllustration,
  lab: LabIllustration,
  radiology: RadiologyIllustration,
  pharmacy: PharmacyIllustration,
  medicationHistory: MedicationHistoryIllustration,
  billing: BillingIllustration,
  building: BuildingIllustration,
  users: UsersIllustration,
  roles: RolesIllustration,
  clipboard: ClipboardIllustration,
  chart: ChartIllustration,
  messages: MessagesIllustration,
  notes: NotesIllustration,
  documents: DocumentsIllustration,
  incident: IncidentIllustration,
  hygiene: HygieneIllustration,
  feedback: FeedbackIllustration,
  vitals: VitalsIllustration,
  done: DoneIllustration,
} satisfies Record<string, ComponentType>;

export type IllustrationName = keyof typeof illustrations;
