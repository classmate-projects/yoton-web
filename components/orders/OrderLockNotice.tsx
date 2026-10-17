"use client";

import { Lock, MessageCircle } from "lucide-react";
import type { OrderLockFields } from "@/types/orderLock.type";
import { getUserDetail } from "@/lib/userDetail";
import { parseServerUtcDate } from "@/lib/date";

interface OrderLockNoticeProps {
  lock: OrderLockFields;
  // "Visit" locks depend on where the doctor is (their own finalized encounter vs an
  // earlier visit), so the caller supplies that guidance instead of the server's generic one.
  visitLockHint?: string;
  compact?: boolean;
}

const formatTime = (value: string) =>
  parseServerUtcDate(value).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Opens in a new tab so the doctor doesn't lose their place in the workbench.
function chatHref(userId: string) {
  return `/messages?userId=${encodeURIComponent(userId)}`;
}

function canChatWith(userId: string | null) {
  if (!userId) return false;
  const me = getUserDetail();
  if (!me || me.userId === userId) return false;
  return me.role === "admin" || (me.allowedModules ?? []).includes("/messages");
}

// Who has an order and what to do about it - shared by the doctor's order lists and the
// order config popups, so every locked order explains itself the same way.
export default function OrderLockNotice({ lock, visitLockHint, compact = false }: OrderLockNoticeProps) {
  if (!lock.locked) return null;

  const isVisitLock = lock.lockedBy === "Visit";
  const who = lock.lockedByName || lock.lockedBy || "another team";
  const headline = isVisitLock ? "Read-only — encounter finalized" : `${lock.lockAction || "Started"} by ${who}`;
  const guidance = isVisitLock ? visitLockHint || lock.lockMessage : lock.lockMessage;
  const showChat = !isVisitLock && canChatWith(lock.lockedByUserId);

  // Plain inline flow (not flex) so it wraps word by word inside narrow table cells.
  if (compact) {
    return (
      <span className="block text-[11px] font-medium not-italic leading-snug text-amber-700 dark:text-amber-400" title={guidance ?? undefined}>
        <Lock size={11} className="mr-1 inline-block align-[-1px]" />
        {headline}
        {!isVisitLock && lock.lockedAt && (
          <span className="text-amber-700/70 dark:text-amber-400/70"> · {formatTime(lock.lockedAt)}</span>
        )}
        {showChat && (
          <a
            href={chatHref(lock.lockedByUserId!)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Message ${who}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-1 inline-block rounded align-[-2px] hover:bg-amber-100 dark:hover:bg-amber-950/50"
          >
            <MessageCircle size={12} />
          </a>
        )}
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 font-semibold">
          <Lock size={14} className="shrink-0" /> {headline}
        </p>
        {!isVisitLock && lock.lockedBy && (
          <span className="shrink-0 rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-semibold dark:bg-amber-900/50">
            {lock.lockedBy}
          </span>
        )}
      </div>
      {!isVisitLock && lock.lockedAt && <p className="mt-0.5 text-xs opacity-80">{formatTime(lock.lockedAt)}</p>}
      {guidance && <p className="mt-1.5 text-xs">{guidance}</p>}
      {showChat && (
        <a
          href={chatHref(lock.lockedByUserId!)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-400/70 bg-white/60 px-2.5 py-1 text-xs font-semibold hover:bg-white dark:bg-transparent dark:hover:bg-amber-950/50"
        >
          <MessageCircle size={13} /> Message {who}
        </a>
      )}
    </div>
  );
}
