"use client";

import { useEffect, useState } from "react";
import { ChatService } from "@/services/chat.service";
import { getChatConnection } from "@/lib/chatSignalR";
import { playMessageReceivedSound } from "@/lib/chatSound";

// Single source of truth for the sidebar's Messages badge - mirrors
// useUnreadAppointmentRequests's shape (fetch the real total on mount, since live SignalR
// events only cover what arrives while this tab is open; increment live after that).
// Approximates "read" as "visited the Messages page" via clearUnread(), same simplification
// the appointment-request bell already makes rather than tracking per-conversation state here.
export function useUnreadChatCount(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;

    ChatService.getConversations()
      .then((res) => {
        if (!isMounted) return;
        const total = (res.data || []).reduce((sum: number, c: { unreadCount: number }) => sum + c.unreadCount, 0);
        setUnreadCount(total);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;

    // No parameter declared on purpose - SignalR still passes the message payload through,
    // this hook just doesn't need it. Any incoming message means "the total went up by one";
    // only the count and the sound matter here.
    const handleMessage = () => {
      if (!isMounted) return;
      setUnreadCount((prev) => prev + 1);
      playMessageReceivedSound();
    };

    const connect = async () => {
      const connection = await getChatConnection();
      if (!isMounted) return;
      connection.off("messageReceived", handleMessage);
      connection.on("messageReceived", handleMessage);
    };
    // No token (e.g. mid-logout) or a genuine connection failure both just mean "no live
    // updates this mount" - the mount-time fetch above already has the real count.
    connect().catch(() => {});

    return () => {
      isMounted = false;
      getChatConnection()
        .then((connection) => connection.off("messageReceived", handleMessage))
        .catch(() => {});
    };
  }, [enabled]);

  const clearUnread = () => setUnreadCount(0);

  return { unreadCount, clearUnread };
}
