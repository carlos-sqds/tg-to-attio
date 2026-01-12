/**
 * Mock Telegram API for capturing bot responses.
 * Records all messages, edits, and callback answers for assertions.
 */

import type { InlineKeyboard } from "grammy";

export interface BotResponse {
  type: "reply" | "edit" | "callback_answer" | "reaction";
  text?: string;
  keyboard?: InlineKeyboard;
  parseMode?: string;
  chatId?: number;
  messageId?: number;
  reaction?: string[];
  showAlert?: boolean;
}

export interface MockApiOptions {
  /** Default chat ID for messages */
  defaultChatId?: number;
  /** Enable logging of responses */
  debug?: boolean;
}

export class MockApi {
  private responses: BotResponse[] = [];
  private options: MockApiOptions;
  private messageIdCounter = 1000;

  constructor(options: MockApiOptions = {}) {
    this.options = {
      defaultChatId: 12345,
      debug: false,
      ...options,
    };
  }

  /**
   * Mock sendMessage - called when bot replies.
   */
  async sendMessage(
    chatId: number,
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: InlineKeyboard;
    }
  ): Promise<{ message_id: number }> {
    const response: BotResponse = {
      type: "reply",
      text,
      chatId,
      parseMode: options?.parse_mode,
      keyboard: options?.reply_markup,
      messageId: this.messageIdCounter++,
    };

    this.responses.push(response);
    this.log("sendMessage", response);

    return { message_id: response.messageId! };
  }

  /**
   * Mock editMessageText - called when bot edits a message.
   */
  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: InlineKeyboard;
    }
  ): Promise<void> {
    const response: BotResponse = {
      type: "edit",
      text,
      chatId,
      messageId,
      parseMode: options?.parse_mode,
      keyboard: options?.reply_markup,
    };

    this.responses.push(response);
    this.log("editMessageText", response);
  }

  /**
   * Mock answerCallbackQuery - called when bot answers a button click.
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    options?: {
      text?: string;
      show_alert?: boolean;
    }
  ): Promise<void> {
    const response: BotResponse = {
      type: "callback_answer",
      text: options?.text,
      showAlert: options?.show_alert,
    };

    this.responses.push(response);
    this.log("answerCallbackQuery", { callbackQueryId, ...response });
  }

  /**
   * Mock setMessageReaction - called when bot sets reactions.
   */
  async setMessageReaction(
    chatId: number,
    messageId: number,
    reaction: Array<{ type: string; emoji: string }>
  ): Promise<void> {
    const response: BotResponse = {
      type: "reaction",
      chatId,
      messageId,
      reaction: reaction.map((r) => r.emoji),
    };

    this.responses.push(response);
    this.log("setMessageReaction", response);
  }

  /**
   * Mock deleteMessage.
   */
  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    this.log("deleteMessage", { chatId, messageId });
  }

  // ============ Test Helpers ============

  /**
   * Get the last response sent by the bot.
   */
  lastResponse(): BotResponse | undefined {
    return this.responses[this.responses.length - 1];
  }

  /**
   * Get the last reply (not edit or callback answer).
   */
  lastReply(): BotResponse | undefined {
    for (let i = this.responses.length - 1; i >= 0; i--) {
      if (this.responses[i].type === "reply") {
        return this.responses[i];
      }
    }
    return undefined;
  }

  /**
   * Get all responses.
   */
  allResponses(): BotResponse[] {
    return [...this.responses];
  }

  /**
   * Get responses of a specific type.
   */
  getResponsesByType(type: BotResponse["type"]): BotResponse[] {
    return this.responses.filter((r) => r.type === type);
  }

  /**
   * Get all reply texts.
   */
  getReplyTexts(): string[] {
    return this.responses.filter((r) => r.type === "reply" && r.text).map((r) => r.text!);
  }

  /**
   * Check if any response contains text.
   */
  hasResponseContaining(text: string): boolean {
    return this.responses.some((r) => r.text?.includes(text));
  }

  /**
   * Get keyboard from last response with a keyboard.
   */
  lastKeyboard(): InlineKeyboard | undefined {
    for (let i = this.responses.length - 1; i >= 0; i--) {
      if (this.responses[i].keyboard) {
        return this.responses[i].keyboard;
      }
    }
    return undefined;
  }

  /**
   * Clear all recorded responses.
   */
  clear(): void {
    this.responses = [];
  }

  /**
   * Get count of responses.
   */
  responseCount(): number {
    return this.responses.length;
  }

  private log(method: string, data: unknown): void {
    if (this.options.debug) {
      console.log(`[MockApi.${method}]`, JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Create a mock API instance for testing.
 */
export function createMockApi(options?: MockApiOptions): MockApi {
  return new MockApi(options);
}
