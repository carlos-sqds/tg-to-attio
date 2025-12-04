import { defineHook } from "workflow";
import type { ForwardedMessageData } from "../types/index.js";

export interface TelegramMessageEvent {
  type: "command" | "forwarded_message" | "text_message";
  text?: string;
  command?: string;
  forwardedMessage?: ForwardedMessageData;
}

export interface TelegramCallbackEvent {
  type: "callback_query";
  callbackData: string;
  callbackQueryId: string;
}

export type TelegramEvent = TelegramMessageEvent | TelegramCallbackEvent;

export const telegramHook = defineHook<TelegramEvent>();
