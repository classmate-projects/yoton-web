export type ChatParticipantType = "User" | "Patient" | "Reception";

export interface ChatContactType {
  id: string;
  type: ChatParticipantType;
  name: string;
  role: string | null;
  avatarUrl: string | null;
}

export interface ChatConversationType {
  chatConversationId: string;
  otherId: string;
  otherType: ChatParticipantType;
  otherName: string;
  otherAvatarUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatAttachmentType {
  chatMessageAttachmentId: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string | null;
}

export interface ChatReactionSummaryType {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ChatMessageType {
  chatMessageId: string;
  chatConversationId: string;
  senderId: string;
  senderType: ChatParticipantType;
  content: string;
  createdAt: string;
  readAt: string | null;
  replyToMessageId: string | null;
  replyToPreview: string | null;
  attachments: ChatAttachmentType[];
  reactions: ChatReactionSummaryType[];
}

export interface StartConversationPayload {
  otherId: string;
  otherType: ChatParticipantType;
}

export interface SendChatMessagePayload {
  conversationId: string;
  content: string;
  replyToMessageId?: string;
  files?: File[];
}

export interface ChatPresenceType {
  userId: string;
  isOnline: boolean;
}

export const CHAT_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
