import type { CompanySearchResult } from "../services/attio/types.js";

export interface ForwardedMessageData {
  text: string;
  senderUsername?: string;
  senderFirstName?: string;
  senderLastName?: string;
  chatName: string;
  date: number;
  messageId: number;
  hasMedia?: boolean;
  mediaType?: string;
}

export interface RecentCompany {
  id: string;
  name: string;
  usedAt: number;
}

export type TelegramEventType = 
  | "command"
  | "forwarded_message"
  | "text_message"
  | "callback_query";

export interface TelegramEvent {
  type: TelegramEventType;
  userId: number;
  chatId: number;
  messageId?: number;
  command?: string;
  text?: string;
  callbackData?: string;
  forwardedMessage?: ForwardedMessageData;
}

export type { CompanySearchResult };
