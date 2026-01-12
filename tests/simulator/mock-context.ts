/**
 * Mock grammY Context for testing bot handlers.
 * Simulates Telegram updates without real Telegram API.
 */

import type { InlineKeyboard } from "grammy";
import { MockApi } from "./mock-api";
import { MockKV } from "./mock-kv";

// ============ Types ============

export interface MockUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  is_bot: boolean;
}

export interface MockChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
}

export interface MockMessage {
  message_id: number;
  date: number;
  chat: MockChat;
  from?: MockUser;
  text?: string;
  forward_origin?: {
    type: "user" | "chat" | "hidden_user" | "channel";
    date: number;
    sender_user?: MockUser;
    sender_chat?: MockChat;
    sender_user_name?: string;
  };
}

export interface MockCallbackQuery {
  id: string;
  from: MockUser;
  message?: MockMessage;
  data?: string;
}

export interface ForwardInput {
  text: string;
  senderUsername?: string;
  senderFirstName?: string;
  senderLastName?: string;
  chatName?: string;
  date?: number;
}

// ============ Mock Context ============

export class MockContext {
  private mockApi: MockApi;
  // MockKV stored for potential future use (session access)
  public readonly kv: MockKV;
  private _message: MockMessage | undefined;
  private _callbackQuery: MockCallbackQuery | undefined;
  private _from: MockUser;
  private _chat: MockChat;

  constructor(options: {
    mockApi: MockApi;
    mockKv: MockKV;
    from?: Partial<MockUser>;
    chat?: Partial<MockChat>;
  }) {
    this.mockApi = options.mockApi;
    this.kv = options.mockKv;

    this._from = {
      id: 67890,
      first_name: "Test",
      last_name: "User",
      username: "testuser",
      is_bot: false,
      ...options.from,
    };

    this._chat = {
      id: 12345,
      type: "private",
      ...options.chat,
    };
  }

  // ============ Getters ============

  get from(): MockUser {
    return this._from;
  }

  get chat(): MockChat {
    return this._chat;
  }

  get message(): MockMessage | undefined {
    return this._message;
  }

  get callbackQuery(): MockCallbackQuery | undefined {
    return this._callbackQuery;
  }

  get msg(): MockMessage | undefined {
    return this._message || this._callbackQuery?.message;
  }

  // ============ Update Simulation ============

  /**
   * Simulate a text message.
   */
  simulateTextMessage(text: string): void {
    this._message = {
      message_id: Math.floor(Math.random() * 100000),
      date: Math.floor(Date.now() / 1000),
      chat: this._chat,
      from: this._from,
      text,
    };
    this._callbackQuery = undefined;
  }

  /**
   * Simulate a command message.
   */
  simulateCommand(command: string, args?: string): void {
    const text = args ? `${command} ${args}` : command;
    this.simulateTextMessage(text);
  }

  /**
   * Simulate a forwarded message.
   */
  simulateForward(input: ForwardInput): void {
    const senderUser: MockUser | undefined =
      input.senderFirstName || input.senderUsername
        ? {
            id: Math.floor(Math.random() * 100000),
            first_name: input.senderFirstName || "Unknown",
            last_name: input.senderLastName,
            username: input.senderUsername,
            is_bot: false,
          }
        : undefined;

    this._message = {
      message_id: Math.floor(Math.random() * 100000),
      date: Math.floor(Date.now() / 1000),
      chat: this._chat,
      from: this._from,
      text: input.text,
      forward_origin: {
        type: senderUser ? "user" : "hidden_user",
        date: input.date || Math.floor(Date.now() / 1000),
        sender_user: senderUser,
        sender_user_name: input.senderFirstName,
      },
    };
    this._callbackQuery = undefined;
  }

  /**
   * Simulate a callback query (button click).
   */
  simulateCallback(data: string, messageId?: number): void {
    this._callbackQuery = {
      id: `callback_${Math.random().toString(36).substring(7)}`,
      from: this._from,
      data,
      message: this._message || {
        message_id: messageId || Math.floor(Math.random() * 100000),
        date: Math.floor(Date.now() / 1000),
        chat: this._chat,
        from: this._from,
      },
    };
    this._message = undefined;
  }

  // ============ Response Methods ============

  /**
   * Reply to the current message.
   */
  async reply(
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: InlineKeyboard;
    }
  ): Promise<{ message_id: number }> {
    return this.mockApi.sendMessage(this._chat.id, text, options);
  }

  /**
   * Edit a message.
   */
  async editMessageText(
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: InlineKeyboard;
    }
  ): Promise<void> {
    const messageId = this.msg?.message_id;
    if (messageId) {
      await this.mockApi.editMessageText(this._chat.id, messageId, text, options);
    }
  }

  /**
   * Answer a callback query.
   */
  async answerCallbackQuery(options?: { text?: string; show_alert?: boolean }): Promise<void> {
    if (this._callbackQuery) {
      await this.mockApi.answerCallbackQuery(this._callbackQuery.id, options);
    }
  }

  /**
   * Set message reaction.
   */
  async react(reaction: string | Array<{ type: string; emoji: string }>): Promise<void> {
    const reactions =
      typeof reaction === "string" ? [{ type: "emoji", emoji: reaction }] : reaction;
    const messageId = this.msg?.message_id;
    if (messageId) {
      await this.mockApi.setMessageReaction(this._chat.id, messageId, reactions);
    }
  }

  /**
   * Delete a message.
   */
  async deleteMessage(): Promise<void> {
    const messageId = this.msg?.message_id;
    if (messageId) {
      await this.mockApi.deleteMessage(this._chat.id, messageId);
    }
  }

  // ============ Utility Properties ============

  /**
   * Check if this is a callback query.
   */
  hasCallbackQuery(): boolean {
    return !!this._callbackQuery;
  }

  /**
   * Check if message has text.
   */
  hasText(): boolean {
    return !!this._message?.text;
  }

  /**
   * Get message text.
   */
  getText(): string | undefined {
    return this._message?.text;
  }

  /**
   * Check if message is a forward.
   */
  isForward(): boolean {
    return !!this._message?.forward_origin;
  }

  /**
   * Get command from message.
   */
  getCommand(): string | undefined {
    const text = this._message?.text;
    if (!text?.startsWith("/")) return undefined;
    const [command] = text.split(" ");
    return command.substring(1); // Remove leading /
  }

  /**
   * Get command arguments.
   */
  getCommandArgs(): string | undefined {
    const text = this._message?.text;
    if (!text?.startsWith("/")) return undefined;
    const spaceIndex = text.indexOf(" ");
    if (spaceIndex === -1) return undefined;
    return text.substring(spaceIndex + 1);
  }

  // ============ Match Helpers ============

  /**
   * Match callback data pattern.
   */
  match(pattern: string): boolean {
    return this._callbackQuery?.data === pattern;
  }

  /**
   * Get callback data.
   */
  callbackData(): string | undefined {
    return this._callbackQuery?.data;
  }
}

// ============ Factory Functions ============

export interface CreateContextOptions {
  mockApi: MockApi;
  mockKv: MockKV;
  userId?: number;
  chatId?: number;
  username?: string;
  firstName?: string;
}

export function createMockContext(options: CreateContextOptions): MockContext {
  return new MockContext({
    mockApi: options.mockApi,
    mockKv: options.mockKv,
    from: {
      id: options.userId || 67890,
      first_name: options.firstName || "Test",
      username: options.username || "testuser",
    },
    chat: {
      id: options.chatId || 12345,
      type: "private",
    },
  });
}
