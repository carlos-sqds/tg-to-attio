import { defineHook } from "workflow";
import type { ForwardedMessageData } from "@/src/types";

export interface CallerInfo {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface TelegramTerminateEvent {
  type: "terminate";
}

export interface TelegramMessageEvent {
  type: "command" | "forwarded_message" | "text_message";
  text?: string;
  command?: string;
  forwardedMessage?: ForwardedMessageData;
  messageId?: number;
  callerInfo?: CallerInfo;
}

export interface TelegramForwardWithInstructionEvent {
  type: "forward_with_instruction";
  forwardedMessage: ForwardedMessageData;
  instruction: string;
  messageId?: number;
  callerInfo?: CallerInfo;
}

export interface TelegramCallbackEvent {
  type: "callback_query";
  callbackData: string;
  callbackQueryId: string;
}

export type TelegramEvent =
  | TelegramTerminateEvent
  | TelegramMessageEvent
  | TelegramForwardWithInstructionEvent
  | TelegramCallbackEvent;

export const telegramHook = defineHook<TelegramEvent>();
