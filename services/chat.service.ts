import api from "@/lib/axios";
import { ENDPOINTS } from "@/lib/endpoints";
import { SendChatMessagePayload, StartConversationPayload } from "@/types/chat.type";

export const ChatService = {
  getContacts: async (tab: "staff" | "patient" | "" = "") => {
    const { data } = await api.get(ENDPOINTS.CHAT.GET_CONTACTS(tab));
    return data;
  },
  getConversations: async () => {
    const { data } = await api.get(ENDPOINTS.CHAT.GET_CONVERSATIONS);
    return data;
  },
  startConversation: async (payload: StartConversationPayload) => {
    const { data } = await api.post(ENDPOINTS.CHAT.START_CONVERSATION, payload);
    return data;
  },
  getMessages: async (conversationId: string) => {
    const { data } = await api.get(ENDPOINTS.CHAT.GET_MESSAGES(conversationId));
    return data;
  },
  sendMessage: async (payload: SendChatMessagePayload) => {
    const form = new FormData();
    form.append("conversationId", payload.conversationId);
    form.append("content", payload.content);
    if (payload.replyToMessageId) form.append("replyToMessageId", payload.replyToMessageId);
    (payload.files || []).forEach((file) => form.append("files", file));

    const { data } = await api.post(ENDPOINTS.CHAT.SEND_MESSAGE, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  markRead: async (conversationId: string) => {
    const { data } = await api.post(ENDPOINTS.CHAT.MARK_READ(conversationId));
    return data;
  },
  setReaction: async (messageId: string, emoji: string | null) => {
    const { data } = await api.post(ENDPOINTS.CHAT.SET_REACTION(messageId), { emoji });
    return data;
  },
  getPresence: async (ids: string[]) => {
    if (ids.length === 0) return { data: [] };
    const { data } = await api.get(ENDPOINTS.CHAT.GET_PRESENCE(ids.join(",")));
    return data;
  },
};
