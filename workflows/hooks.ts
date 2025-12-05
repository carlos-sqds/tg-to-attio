import { defineHook } from "workflow";
import type { ForwardedMessageData } from "@/src/types";

export interface TelegramMessageEvent {
  type: "command" | "forwarded_message" | "text_message";
  text?: string;
  command?: string;
  forwardedMessage?: ForwardedMessageData;
  messageId?: number;
}

export interface TelegramCallbackEvent {
  type: "callback_query";
  callbackData: string;
  callbackQueryId: string;
}

export type TelegramEvent = TelegramMessageEvent | TelegramCallbackEvent;

export const telegramHook = defineHook<TelegramEvent>();
