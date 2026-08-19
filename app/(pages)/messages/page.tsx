"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Paperclip, Search, Send, Smile, X, Reply as ReplyIcon, FileText } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ChatService } from "@/services/chat.service";
import { getChatConnection } from "@/lib/chatSignalR";
import { playMessageReceivedSound } from "@/lib/chatSound";
import { backendAssetUrl } from "@/lib/backendAsset";
import { getUserDetail } from "@/lib/userDetail";
import { getInitials } from "@/lib/getInitials";
import {
  CHAT_REACTION_EMOJIS,
  ChatContactType,
  ChatConversationType,
  ChatMessageType,
  ChatPresenceType,
  MAX_ATTACHMENT_BYTES,
} from "@/types/chat.type";

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as { response?: { data?: { message?: string } } }).response;
    return resp?.data?.message || fallback;
  }
  return fallback;
};

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const formatDay = (value: string) => new Date(value).toLocaleDateString();
const formatBytes = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);
// IFormFile.ContentType isn't reliably set by every client (mobile camera
// capture and some drag-and-drop paths often send "application/octet-stream"
// or omit it entirely), so a missing/generic content type still counts as an
// image if the filename itself has an image extension - otherwise a real
// photo silently falls back to the plain file-chip instead of a thumbnail.
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/i;
const isImage = (a: { contentType: string | null; fileName: string }) =>
  (!!a.contentType && a.contentType.toLowerCase().startsWith("image/")) || IMAGE_EXTENSION_RE.test(a.fileName);

function Avatar({ name, url, size = 40, online }: { name: string; url?: string | null; size?: number; online?: boolean }) {
  const resolved = backendAssetUrl(url);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path
        <img src={resolved} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-primary/15 font-semibold text-primary w-full h-full"
          style={{ fontSize: size * 0.38 }}
        >
          {getInitials(name)}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
      )}
    </div>
  );
}

export default function MessagesPage() {
  const myId = getUserDetail()?.userId;

  const [tab, setTab] = useState<"staff" | "patient">("staff");
  const [conversations, setConversations] = useState<ChatConversationType[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [contacts, setContacts] = useState<ChatContactType[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [presence, setPresence] = useState<Record<string, boolean>>({});

  const [activeConversation, setActiveConversation] = useState<ChatConversationType | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessageType | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [openReactionPickerFor, setOpenReactionPickerFor] = useState<string | null>(null);
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  // Attachments whose image actually failed to load (bad/expired URL, etc.) -
  // falls back to the plain file-chip instead of leaving a broken-image icon.
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const res = await ChatService.getConversations();
      setConversations(res.data || []);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load conversations"));
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const tabConversations = useMemo(
    () =>
      conversations.filter((c) => (tab === "staff" ? c.otherType === "User" : c.otherType !== "User")),
    [conversations, tab]
  );

  // Presence only applies to real staff accounts ("User") - a Patient or the virtual
  // Reception inbox has no single online/offline state worth showing.
  //
  // Keyed on the sorted id *set* (a string), not tabConversations itself: that array is a
  // new reference on every incoming message anywhere (see handleMessage's setConversations
  // below), which would otherwise re-fire this REST call once per message across the whole
  // inbox even though the actual set of people to track rarely changes. Ongoing online/
  // offline changes come from the "presenceChanged" SignalR event instead - this effect only
  // needs to (re)seed presence when the set of contacts itself changes.
  const presenceUserIdsKey = useMemo(() => {
    const ids = tabConversations.filter((c) => c.otherType === "User").map((c) => c.otherId);
    return Array.from(new Set(ids)).sort().join(",");
  }, [tabConversations]);

  useEffect(() => {
    if (!presenceUserIdsKey) return;
    const ids = presenceUserIdsKey.split(",");
    ChatService.getPresence(ids)
      .then((res) => {
        const map: Record<string, boolean> = {};
        (res.data || []).forEach((p: ChatPresenceType) => (map[p.userId] = p.isOnline));
        setPresence((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
  }, [presenceUserIdsKey]);

  useEffect(() => {
    setShowContactPicker(false);
    setContactSearch("");
    ChatService.getContacts(tab)
      .then((res) => setContacts(res.data || []))
      .catch(() => setContacts([]));
  }, [tab]);

  const contactsWithoutConversation = useMemo(() => {
    const existingIds = new Set(conversations.map((c) => c.otherId));
    return contacts.filter(
      (c) => !existingIds.has(c.id) && c.name.toLowerCase().includes(contactSearch.toLowerCase())
    );
  }, [contacts, conversations, contactSearch]);

  const resetComposer = () => {
    setDraft("");
    setReplyingTo(null);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openConversation = async (conversation: ChatConversationType) => {
    setActiveConversation(conversation);
    resetComposer();
    setIsLoadingMessages(true);
    try {
      const res = await ChatService.getMessages(conversation.chatConversationId);
      setMessages(res.data || []);
      if (conversation.unreadCount > 0) {
        await ChatService.markRead(conversation.chatConversationId);
        setConversations((prev) =>
          prev.map((c) => (c.chatConversationId === conversation.chatConversationId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load messages"));
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const startConversation = async (contact: ChatContactType) => {
    try {
      const res = await ChatService.startConversation({ otherId: contact.id, otherType: contact.type });
      const conversation: ChatConversationType = res.data;
      setConversations((prev) => {
        const exists = prev.some((c) => c.chatConversationId === conversation.chatConversationId);
        return exists ? prev : [conversation, ...prev];
      });
      setShowContactPicker(false);
      await openConversation(conversation);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to start conversation"));
    }
  };

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Read inside the SignalR handlers below without re-subscribing on every state change.
  const activeConversationRef = useRef(activeConversation);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Live delivery: the active thread appends incoming messages directly; any other
  // conversation just gets bumped to the top with an incremented unread count rather than
  // re-fetching the whole list on every message. Sound plays for anything not already open,
  // matching how Slack/Teams stay quiet for the thread you're actively looking at.
  useEffect(() => {
    let isMounted = true;

    const handleMessage = (incoming: ChatMessageType) => {
      if (!isMounted) return;
      const isForActiveThread = incoming.chatConversationId === activeConversationRef.current?.chatConversationId;

      if (isForActiveThread) {
        setMessages((prev) => (prev.some((m) => m.chatMessageId === incoming.chatMessageId) ? prev : [...prev, incoming]));
        ChatService.markRead(incoming.chatConversationId).catch(() => {});
      } else {
        playMessageReceivedSound();
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.chatConversationId === incoming.chatConversationId);
        if (idx === -1) {
          fetchConversations();
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessage: incoming.content,
          lastMessageAt: incoming.createdAt,
          unreadCount: isForActiveThread ? 0 : updated[idx].unreadCount + 1,
        };
        const [moved] = updated.splice(idx, 1);
        return [moved, ...updated];
      });
    };

    const handleMessageUpdated = (updated: ChatMessageType) => {
      if (!isMounted) return;
      setMessages((prev) => prev.map((m) => (m.chatMessageId === updated.chatMessageId ? updated : m)));
    };

    const handleTyping = (payload: { conversationId: string; userId: string }) => {
      if (!isMounted || payload.conversationId !== activeConversationRef.current?.chatConversationId) return;
      setTypingLabel(`${activeConversationRef.current.otherName} is typing…`);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingLabel(null), 3000);
    };

    const handlePresenceChanged = (payload: { userId: string; isOnline: boolean }) => {
      if (!isMounted) return;
      setPresence((prev) => ({ ...prev, [payload.userId]: payload.isOnline }));
    };

    const connect = async () => {
      const connection = await getChatConnection();
      if (!isMounted) return;
      connection.off("messageReceived", handleMessage);
      connection.off("messageUpdated", handleMessageUpdated);
      connection.off("typing", handleTyping);
      connection.off("presenceChanged", handlePresenceChanged);
      connection.on("messageReceived", handleMessage);
      connection.on("messageUpdated", handleMessageUpdated);
      connection.on("typing", handleTyping);
      connection.on("presenceChanged", handlePresenceChanged);
    };
    connect();

    return () => {
      isMounted = false;
      getChatConnection().then((connection) => {
        connection.off("messageReceived", handleMessage);
        connection.off("messageUpdated", handleMessageUpdated);
        connection.off("typing", handleTyping);
        connection.off("presenceChanged", handlePresenceChanged);
      });
    };
  }, []);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!activeConversation || activeConversation.otherType !== "User") return;

    // Throttled to once every 2s while actively typing, not once per keystroke.
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    getChatConnection().then((connection) =>
      connection.invoke("Typing", activeConversation.chatConversationId, activeConversation.otherId).catch(() => {})
    );
  };

  const handleFilesPicked = (files: FileList | null) => {
    if (!files) return;
    const chosen = Array.from(files);
    const oversized = chosen.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      toast.error(`${oversized.name} is over the 5MB attachment limit`);
      return;
    }
    setPendingFiles((prev) => [...prev, ...chosen]);
  };

  const handleSend = async () => {
    if ((!draft.trim() && pendingFiles.length === 0) || !activeConversation) return;
    const content = draft.trim();
    const files = pendingFiles;
    const replyToMessageId = replyingTo?.chatMessageId;
    resetComposer();

    try {
      setIsSending(true);
      const res = await ChatService.sendMessage({
        conversationId: activeConversation.chatConversationId,
        content,
        replyToMessageId,
        files,
      });
      const sent: ChatMessageType = res.data;
      setMessages((prev) => [...prev, sent]);
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.chatConversationId === activeConversation.chatConversationId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessage: content || "📎 Attachment", lastMessageAt: sent.createdAt };
        const [moved] = updated.splice(idx, 1);
        return [moved, ...updated];
      });
    } catch (error) {
      toast.error(errorMessage(error, "Failed to send message"));
      setDraft(content);
      setPendingFiles(files);
    } finally {
      setIsSending(false);
    }
  };

  const toggleReaction = async (message: ChatMessageType, emoji: string) => {
    setOpenReactionPickerFor(null);
    const alreadyReacted = message.reactions.find((r) => r.emoji === emoji && r.reactedByMe);
    try {
      const res = await ChatService.setReaction(message.chatMessageId, alreadyReacted ? null : emoji);
      const updated: ChatMessageType = res.data;
      setMessages((prev) => prev.map((m) => (m.chatMessageId === updated.chatMessageId ? updated : m)));
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update reaction"));
    }
  };

  return (
    // h-screen, not h-full: the shared (pages) layout only sets min-h-full up
    // the ancestor chain (so ordinary pages can grow taller than the viewport
    // and let the page scroll), which means a plain h-full here has no
    // definite height to resolve against and just grows with content too -
    // the whole page would scroll instead of this panel's own message list.
    // 100vh doesn't need ancestor cooperation, so it actually pins this page
    // to the viewport and lets the flex-1 min-h-0 chain below clip properly.
    <div className="flex h-screen flex-col py-6 px-4 sm:py-8 sm:px-10">
      <div className="flex flex-col gap-1 mb-6 shrink-0">
        <h1 className="text-4xl font-semibold flex items-center gap-3 text-foreground">
          <MessageCircle className="text-primary" /> Messages
        </h1>
        <p className="text-sm text-muted-foreground">Secure messaging with staff and patients.</p>
      </div>

      <div className="flex gap-2 mb-4 shrink-0">
        {(
          [
            { key: "staff", label: "Staff" },
            { key: "patient", label: "Patient" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setActiveConversation(null);
            }}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card flex flex-1 min-h-0 overflow-hidden">
        {/* Conversation list */}
        <div className="w-full sm:w-72 shrink-0 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <button
              onClick={() => setShowContactPicker((v) => !v)}
              className="w-full flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              <Search size={14} /> New conversation
            </button>
            {showContactPicker && (
              <div className="mt-2 flex flex-col gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder={`Search ${tab === "staff" ? "staff" : "patients"}...`}
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="h-9 text-sm"
                />
                <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
                  {contactsWithoutConversation.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">No matching contacts.</p>
                  ) : (
                    contactsWithoutConversation.map((c) => (
                      <button
                        key={`${c.type}-${c.id}`}
                        onClick={() => startConversation(c)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60"
                      >
                        <Avatar name={c.name} url={c.avatarUrl} size={28} online={presence[c.id]} />
                        <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="py-10 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : tabConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 px-4">
                No conversations yet — start one above.
              </p>
            ) : (
              tabConversations.map((c) => (
                <button
                  key={c.chatConversationId}
                  onClick={() => openConversation(c)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-border/60 transition-colors ${
                    activeConversation?.chatConversationId === c.chatConversationId ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <Avatar name={c.otherName} url={c.otherAvatarUrl} online={presence[c.otherId]} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{c.otherName}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatDay(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">{c.lastMessage || "No messages yet"}</span>
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shrink-0">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="hidden sm:flex flex-1 flex-col min-w-0 min-h-0">
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation to start messaging.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border p-4 shrink-0">
                <Avatar
                  name={activeConversation.otherName}
                  url={activeConversation.otherAvatarUrl}
                  size={36}
                  online={presence[activeConversation.otherId]}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{activeConversation.otherName}</p>
                  {typingLabel && <p className="text-xs text-primary truncate">{typingLabel}</p>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {isLoadingMessages ? (
                  <div className="flex-1 flex justify-center items-center">
                    <LoadingSpinner />
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.senderId === myId;
                    return (
                      <div
                        key={m.chatMessageId}
                        className={`group flex items-center gap-1.5 ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        {isMine && <MessageActions message={m} onReply={setReplyingTo} onReact={setOpenReactionPickerFor} openPickerId={openReactionPickerFor} onPickEmoji={toggleReaction} />}
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                            isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {m.replyToPreview && (
                            <div
                              className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs opacity-80 ${
                                isMine ? "border-primary-foreground/50" : "border-primary/50"
                              }`}
                            >
                              {m.replyToPreview}
                            </div>
                          )}

                          {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}

                          {m.attachments.length > 0 && (
                            <div className="mt-1.5 flex flex-col gap-1.5">
                              {m.attachments.map((a) =>
                                isImage(a) && !brokenImageIds.has(a.chatMessageAttachmentId) ? (
                                  <a key={a.chatMessageAttachmentId} href={backendAssetUrl(a.filePath) ?? "#"} target="_blank" rel="noopener noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- backend-hosted, runtime-only path */}
                                    <img
                                      src={backendAssetUrl(a.filePath) ?? undefined}
                                      alt={a.fileName}
                                      className="max-h-48 rounded-lg"
                                      onError={() =>
                                        setBrokenImageIds((prev) => new Set(prev).add(a.chatMessageAttachmentId))
                                      }
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={a.chatMessageAttachmentId}
                                    href={backendAssetUrl(a.filePath) ?? "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                                      isMine ? "bg-primary-foreground/10" : "bg-background"
                                    }`}
                                  >
                                    <FileText size={14} className="shrink-0" />
                                    <span className="truncate">{a.fileName}</span>
                                    <span className="opacity-70 shrink-0">({formatBytes(a.fileSizeBytes)})</span>
                                  </a>
                                )
                              )}
                            </div>
                          )}

                          <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {formatTime(m.createdAt)}
                          </p>

                          {m.reactions.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {m.reactions.map((r) => (
                                <button
                                  key={r.emoji}
                                  onClick={() => toggleReaction(m, r.emoji)}
                                  className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                                    r.reactedByMe
                                      ? "bg-primary-foreground/20 ring-1 ring-primary-foreground/40"
                                      : isMine
                                      ? "bg-primary-foreground/10"
                                      : "bg-background"
                                  }`}
                                >
                                  {r.emoji} {r.count}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {!isMine && <MessageActions message={m} onReply={setReplyingTo} onReact={setOpenReactionPickerFor} openPickerId={openReactionPickerFor} onPickEmoji={toggleReaction} />}
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {replyingTo && (
                <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2 shrink-0">
                  <div className="min-w-0 flex items-center gap-2 text-xs text-muted-foreground">
                    <ReplyIcon size={13} className="shrink-0" />
                    <span className="truncate">Replying to: {replyingTo.content || "attachment"}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X size={14} />
                  </button>
                </div>
              )}

              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2 shrink-0">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs">
                      <FileText size={12} />
                      <span className="max-w-32 truncate">{f.name}</span>
                      <button onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-border p-3 flex items-center gap-2 shrink-0">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFilesPicked(e.target.files)} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach a file (max 5MB)"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted shrink-0"
                >
                  <Paperclip size={18} />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 h-11 text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || (!draft.trim() && pendingFiles.length === 0)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  <Send size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageActions({
  message,
  onReply,
  onReact,
  openPickerId,
  onPickEmoji,
}: {
  message: ChatMessageType;
  onReply: (message: ChatMessageType) => void;
  onReact: (id: string | null) => void;
  openPickerId: string | null;
  onPickEmoji: (message: ChatMessageType, emoji: string) => void;
}) {
  const isOpen = openPickerId === message.chatMessageId;
  return (
    <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={() => onReact(isOpen ? null : message.chatMessageId)}
        title="React"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <Smile size={14} />
      </button>
      <button
        onClick={() => onReply(message)}
        title="Reply"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <ReplyIcon size={14} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border border-border bg-card p-1.5 shadow-lg">
          {CHAT_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onPickEmoji(message, emoji)}
              className="text-lg hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
