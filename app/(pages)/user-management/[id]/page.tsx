"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Mail, Phone, UserRound, Briefcase, Stethoscope, ShieldCheck, History as HistoryIcon,
  StickyNote, Plus, Trash2, Loader2, LogIn, LogOut, Clock,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { UserService } from "@/services/user.service";
import { StaffNoteType, UserDetailsType } from "@/types/user.type";
import { getUserDetail } from "@/lib/userDetail";
import { backendAssetUrl } from "@/lib/backendAsset";
import { parseDateInputValue } from "@/lib/date";
import { formatCurrency } from "@/lib/currency";
import { terminationReasonLabel } from "@/helpers/terminationReasons";

// Staff detail page - opened from a row/card on User Management. Gated by the same
// /user-management module as the list (lib/routeAccess.ts matches sub-paths), and the
// API's GET /api/user/{id}/details carries the same [RequireModule].

// Timestamps come back without a timezone suffix (same as the list's getTime) - they're UTC.
const formatDateTime = (value: string | null) => {
  if (!value) return null;
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

// "09:12 AM" - attendance times come back with a "Z" suffix, so plain Date parsing is right.
const formatClock = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// DateOnly "yyyy-MM-dd" values - parsed as local calendar days so they never shift a day.
const formatDay = (value: string | null) =>
  parseDateInputValue(value ?? "")?.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) ?? null;

// "2 yrs 3 mos" from a "yyyy-MM-dd" start date up to today (or an end date).
function serviceLength(start: string | null, end?: string | null): string | null {
  const from = parseDateInputValue(start ?? "");
  if (!from) return null;
  const to = parseDateInputValue(end ?? "") ?? new Date();
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0 && rest === 0) return "Less than a month";
  return [years && `${years} yr${years > 1 ? "s" : ""}`, rest && `${rest} mo${rest > 1 ? "s" : ""}`]
    .filter(Boolean)
    .join(" ");
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = backendAssetUrl(image);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="h-24 w-24 shrink-0 rounded-full object-cover shadow-md"
      />
    );
  }
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary/15 text-3xl font-bold text-primary shadow-md">
      {initials || <UserRound size={36} />}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Field({ label, value, capitalize }: { label: string; value: React.ReactNode; capitalize?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate text-sm font-medium ${empty ? "text-muted-foreground" : "text-foreground"} ${capitalize ? "capitalize" : ""}`}>
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetailsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    UserService.getDetails(id)
      .then((res) => setUser(res.data ?? null))
      .catch(() => {
        setUser(null);
        toast.error("Failed to load staff details");
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-6 py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="card">
          <EmptyState illustration="users" title="Staff member not found" description="This account may have been deleted." />
        </div>
      </div>
    );
  }

  const isDoctor =
    user.role?.toLowerCase() === "doctor" || !!user.specializationName || user.experienceYears != null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="card flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={user.name} image={user.userImage} />
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:items-start">
          <h1 className="text-3xl font-bold text-foreground">{user.name}</h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {user.role && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
                {user.role}
              </span>
            )}
            {user.designation && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-foreground">
                {user.designation}
              </span>
            )}
            {user.isTerminated ? (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                Terminated
              </span>
            ) : user.isActive ? (
              <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                Active
              </span>
            ) : (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Inactive
              </span>
            )}
            {/* Today's attendance only */}
            {user.todayCheckOutAt ? (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                <LogOut size={12} /> Checked out · {formatClock(user.todayCheckOutAt)}
              </span>
            ) : user.todayCheckInAt ? (
              <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <LogIn size={12} /> Checked in · {formatClock(user.todayCheckInAt)}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Clock size={12} /> Not checked in today
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 text-sm sm:items-end">
          {user.email && (
            <a href={`mailto:${user.email}`} className="flex items-center gap-2 text-foreground hover:text-primary">
              <Mail size={14} className="text-muted-foreground" /> {user.email}
            </a>
          )}
          {user.phone && (
            <a href={`tel:${user.phone}`} className="flex items-center gap-2 text-foreground hover:text-primary">
              <Phone size={14} className="text-muted-foreground" /> {user.phone}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Personal" icon={<UserRound size={16} />}>
          <Field label="Full name" value={user.name} />
          <Field label="Username" value={user.username} />
          <Field label="Gender" value={user.gender} />
          <Field label="Nationality" value={user.nationality} />
          <Field label="Email" value={user.email} />
          <Field label="Phone number" value={user.phone} />
        </Section>

        <Section title="Employment" icon={<Briefcase size={16} />}>
          <Field label="Role" value={user.role} capitalize />
          <Field label="Designation" value={user.designation} />
          <Field label="Department" value={user.departmentName} />
          <Field label="Branch" value={user.branchName} />
          <Field label="Joining date" value={formatDay(user.joiningDate)} />
          <Field
            label="Time with us"
            value={user.isActive ? serviceLength(user.currentStintStartDate) : null}
          />
          {user.currentStintStartDate && user.currentStintStartDate !== user.joiningDate && (
            <Field label="Current stint started" value={formatDay(user.currentStintStartDate)} />
          )}
          <Field label="Full-time equivalent (FTE)" value={user.fteValue?.toFixed(2)} />
          <Field
            label="Max discount allowed"
            value={user.maxDiscountPercent != null ? `${user.maxDiscountPercent}%` : null}
          />
        </Section>

        {isDoctor && (
          <Section title="Doctor profile" icon={<Stethoscope size={16} />}>
            <Field label="Specialization" value={user.specializationName} />
            <Field
              label="Experience"
              value={user.experienceYears != null ? `${user.experienceYears} year${user.experienceYears === 1 ? "" : "s"}` : null}
            />
            <Field label="License number" value={user.licenseNumber} />
            <Field
              label="Consultation fee"
              value={user.consultationFee != null ? formatCurrency(user.consultationFee) : null}
            />
            <Field label="Clinician code" value={user.clinicianCode} />
          </Section>
        )}

        <Section title="Account" icon={<ShieldCheck size={16} />}>
          <Field label="Account created" value={formatDateTime(user.createdAt)} />
          <Field label="Last login" value={formatDateTime(user.lastLogin) ?? "Never"} />
          {!user.isActive && <Field label="Deactivated on" value={formatDateTime(user.deactivatedAt)} />}
          <Field label="Status" value={user.isTerminated ? "Terminated" : user.isActive ? "Active" : "Inactive"} />
        </Section>

        {/* Sits beside Account on large screens. For doctors the extra Doctor profile card
            already fills that slot, so it spans the full row instead of leaving half empty. */}
        <section className={`card p-5 ${isDoctor ? "lg:col-span-2" : ""}`}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <HistoryIcon size={16} /> Employment history
          </h2>
          {user.employmentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employment history recorded.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {user.employmentHistory.map((e) => (
                <div
                  key={e.staffEmploymentEventId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {formatDay(e.hireDate)} — {e.terminationDate ? formatDay(e.terminationDate) : "Present"}
                    </span>
                    {e.departmentName && <span className="text-xs text-muted-foreground">{e.departmentName}</span>}
                    {e.terminationReason && (
                      <span className="text-xs text-muted-foreground">
                        Reason: {terminationReasonLabel(e.terminationReason)}
                        {e.terminationReasonOtherText ? ` — ${e.terminationReasonOtherText}` : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{serviceLength(e.hireDate, e.terminationDate)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <StaffNotes userId={user.id} />
    </div>
  );
}

const NOTE_MAX_LENGTH = 4000;

// Running log of free-text notes about this staff member - newest first, each with its
// author and time. Only the author or an admin can delete one (enforced by the API too).
function StaffNotes({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<StaffNoteType[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const me = getUserDetail();
  const canDelete = (note: StaffNoteType) => me?.role === "admin" || note.createdByUserId === me?.userId;

  useEffect(() => {
    setLoading(true);
    UserService.getNotes(userId)
      .then((res) => setNotes(res.data ?? []))
      .catch(() => toast.error("Failed to load notes"))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleAdd = async () => {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    try {
      const res = await UserService.addNote(userId, content);
      setNotes((prev) => [res.data, ...prev]);
      setDraft("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note: StaffNoteType) => {
    if (!window.confirm("Delete this note?")) return;
    setDeletingId(note.staffNoteId);
    try {
      await UserService.deleteNote(note.staffNoteId);
      setNotes((prev) => prev.filter((n) => n.staffNoteId !== note.staffNoteId));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <StickyNote size={16} /> Notes
      </h2>

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
          maxLength={NOTE_MAX_LENGTH}
          rows={4}
          placeholder="Add a note about this staff member..."
          className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {draft.length}/{NOTE_MAX_LENGTH} · Ctrl+Enter to save
          </span>
          <button
            onClick={handleAdd}
            disabled={!draft.trim() || saving}
            className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add Note
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-4 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          notes.map((note) => (
            <div key={note.staffNoteId} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{note.createdByName ?? "Unknown"}</span>
                  {" · "}
                  {formatDateTime(note.createdAt)}
                </span>
                {canDelete(note) && (
                  <button
                    onClick={() => handleDelete(note)}
                    disabled={deletingId === note.staffNoteId}
                    title="Delete note"
                    className="rounded-full p-1.5 text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
