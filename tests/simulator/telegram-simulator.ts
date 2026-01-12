/**
 * Telegram Simulator for E2E testing without real Telegram.
 * Simulates the full message flow through the bot.
 */

import { MockApi, type BotResponse } from "./mock-api";
import { MockKV } from "./mock-kv";
import { MockContext, type ForwardInput } from "./mock-context";

// ============ Types ============

export interface SimulatorConfig {
  /** User ID for the simulated user */
  userId?: number;
  /** Chat ID for the simulated chat */
  chatId?: number;
  /** Username for the simulated user */
  username?: string;
  /** First name for the simulated user */
  firstName?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface HandlerRegistry {
  onForward?: (ctx: MockContext) => Promise<void>;
  onText?: (ctx: MockContext) => Promise<void>;
  onCommand?: Record<string, (ctx: MockContext) => Promise<void>>;
  onCallback?: (ctx: MockContext) => Promise<void>;
}

// ============ Telegram Simulator ============

export class TelegramSimulator {
  private mockApi: MockApi;
  private mockKv: MockKV;
  private config: Required<SimulatorConfig>;
  private handlers: HandlerRegistry = {};
  private lastContext: MockContext | null = null;

  constructor(config: SimulatorConfig = {}) {
    this.config = {
      userId: config.userId ?? 67890,
      chatId: config.chatId ?? 12345,
      username: config.username ?? "testuser",
      firstName: config.firstName ?? "Test",
      debug: config.debug ?? false,
    };

    this.mockApi = new MockApi({ debug: this.config.debug });
    this.mockKv = new MockKV();
  }

  // ============ Handler Registration ============

  /**
   * Register handlers for the simulator.
   */
  registerHandlers(handlers: HandlerRegistry): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Register a command handler.
   */
  onCommand(command: string, handler: (ctx: MockContext) => Promise<void>): void {
    if (!this.handlers.onCommand) {
      this.handlers.onCommand = {};
    }
    this.handlers.onCommand[command] = handler;
  }

  /**
   * Register the forward handler.
   */
  onForward(handler: (ctx: MockContext) => Promise<void>): void {
    this.handlers.onForward = handler;
  }

  /**
   * Register the text handler.
   */
  onText(handler: (ctx: MockContext) => Promise<void>): void {
    this.handlers.onText = handler;
  }

  /**
   * Register the callback handler.
   */
  onCallback(handler: (ctx: MockContext) => Promise<void>): void {
    this.handlers.onCallback = handler;
  }

  // ============ Simulation Methods ============

  /**
   * Simulate a forwarded message.
   */
  async forward(input: ForwardInput): Promise<void> {
    const ctx = this.createContext();
    ctx.simulateForward(input);
    this.lastContext = ctx;

    if (this.handlers.onForward) {
      await this.handlers.onForward(ctx);
    } else {
      this.log("No forward handler registered");
    }
  }

  /**
   * Simulate a command.
   */
  async command(cmd: string): Promise<void> {
    // Parse command and args
    const parts = cmd.startsWith("/") ? cmd.substring(1).split(" ") : cmd.split(" ");
    const command = parts[0];
    const args = parts.slice(1).join(" ");

    const ctx = this.createContext();
    ctx.simulateCommand(`/${command}`, args);
    this.lastContext = ctx;

    // Try command-specific handler first
    if (this.handlers.onCommand?.[command]) {
      await this.handlers.onCommand[command](ctx);
    } else if (this.handlers.onText) {
      // Fall back to text handler
      await this.handlers.onText(ctx);
    } else {
      this.log(`No handler for command: ${command}`);
    }
  }

  /**
   * Simulate a text message.
   */
  async text(message: string): Promise<void> {
    const ctx = this.createContext();
    ctx.simulateTextMessage(message);
    this.lastContext = ctx;

    if (this.handlers.onText) {
      await this.handlers.onText(ctx);
    } else {
      this.log("No text handler registered");
    }
  }

  /**
   * Simulate a callback (button click).
   */
  async callback(data: string): Promise<void> {
    const ctx = this.createContext();
    ctx.simulateCallback(data);
    this.lastContext = ctx;

    if (this.handlers.onCallback) {
      await this.handlers.onCallback(ctx);
    } else {
      this.log(`No callback handler for: ${data}`);
    }
  }

  // ============ Response Access ============

  /**
   * Get the last response sent by the bot.
   */
  lastResponse(): BotResponse | undefined {
    return this.mockApi.lastResponse();
  }

  /**
   * Get the last reply (not edit or callback answer).
   */
  lastReply(): BotResponse | undefined {
    return this.mockApi.lastReply();
  }

  /**
   * Get all responses from the bot.
   */
  allResponses(): BotResponse[] {
    return this.mockApi.allResponses();
  }

  /**
   * Check if any response contains the given text.
   */
  responseContains(text: string): boolean {
    return this.mockApi.hasResponseContaining(text);
  }

  /**
   * Get reply texts.
   */
  getReplyTexts(): string[] {
    return this.mockApi.getReplyTexts();
  }

  // ============ State Access ============

  /**
   * Get the current session state.
   */
  getSession(): unknown | null {
    return this.mockKv.getSession(this.config.chatId, this.config.userId);
  }

  /**
   * Get the pending instruction.
   */
  getPending(): unknown | null {
    return this.mockKv.getPending(this.config.chatId);
  }

  /**
   * Get the mock KV store directly.
   */
  getKV(): MockKV {
    return this.mockKv;
  }

  /**
   * Get the mock API directly.
   */
  getApi(): MockApi {
    return this.mockApi;
  }

  /**
   * Get the last context created.
   */
  getLastContext(): MockContext | null {
    return this.lastContext;
  }

  // ============ Utility Methods ============

  /**
   * Clear all state (responses and KV).
   */
  reset(): void {
    this.mockApi.clear();
    this.mockKv.clear();
    this.lastContext = null;
  }

  /**
   * Set up session state directly (for test setup).
   */
  async setSession(session: unknown): Promise<void> {
    const key = `attio:session:${this.config.chatId}:${this.config.userId}`;
    await this.mockKv.set(key, session);
  }

  /**
   * Set up pending instruction directly (for test setup).
   */
  async setPending(instruction: string): Promise<void> {
    const key = `attio:pending:${this.config.chatId}`;
    await this.mockKv.set(key, { instruction, timestamp: Date.now() }, { ex: 2 });
  }

  // ============ Private Methods ============

  private createContext(): MockContext {
    return new MockContext({
      mockApi: this.mockApi,
      mockKv: this.mockKv,
      from: {
        id: this.config.userId,
        first_name: this.config.firstName,
        username: this.config.username,
        is_bot: false,
      },
      chat: {
        id: this.config.chatId,
        type: "private",
      },
    });
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[TelegramSimulator] ${message}`);
    }
  }
}

// ============ Factory Functions ============

/**
 * Create a new simulator instance.
 */
export function createSimulator(config?: SimulatorConfig): TelegramSimulator {
  return new TelegramSimulator(config);
}

/**
 * Create a simulator with common handlers pre-registered.
 * This is a convenience function for tests that don't need custom handlers.
 */
export function createSimulatorWithHandlers(
  handlers: HandlerRegistry,
  config?: SimulatorConfig
): TelegramSimulator {
  const sim = new TelegramSimulator(config);
  sim.registerHandlers(handlers);
  return sim;
}
