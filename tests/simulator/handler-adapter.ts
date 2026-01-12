/**
 * Handler adapter for wiring TelegramSimulator to actual bot handlers.
 * Configures vitest mocks to inject MockKV into handlers.
 */

import { vi } from "vitest";
import { MockKV, getGlobalMockKV, resetGlobalMockKV } from "./mock-kv";
import { TelegramSimulator, type SimulatorConfig } from "./telegram-simulator";
import { MockContext } from "./mock-context";
import type { Context, CommandContext } from "grammy";

// Store reference to mock KV for module mock
let currentMockKV: MockKV | null = null;

/**
 * Get the current mock KV instance.
 * Used by the @vercel/kv mock.
 */
export function getCurrentMockKV(): MockKV {
  if (!currentMockKV) {
    currentMockKV = getGlobalMockKV();
  }
  return currentMockKV;
}

/**
 * Setup vitest mock for @vercel/kv.
 * Call this in your test file's beforeAll or at module level.
 */
export function setupKVMock(): void {
  vi.mock("@vercel/kv", () => ({
    kv: {
      get: async <T>(key: string): Promise<T | null> => getCurrentMockKV().get<T>(key),
      set: async (key: string, value: unknown, options?: { ex?: number }): Promise<void> =>
        getCurrentMockKV().set(key, value, options),
      del: async (key: string): Promise<void> => getCurrentMockKV().del(key),
      expire: async (key: string, seconds: number): Promise<void> =>
        getCurrentMockKV().expire(key, seconds),
      exists: async (key: string): Promise<boolean> => getCurrentMockKV().exists(key),
      mget: async <T>(...keys: string[]): Promise<(T | null)[]> =>
        getCurrentMockKV().mget<T>(...keys),
      mset: async (data: Record<string, unknown>): Promise<void> => getCurrentMockKV().mset(data),
    },
  }));
}

/**
 * Reset KV mock state between tests.
 */
export function resetKVMock(): void {
  resetGlobalMockKV();
  currentMockKV = null;
}

/**
 * Adapt MockContext to grammY Context type.
 * This makes MockContext compatible with bot handlers.
 */
export function adaptContext(mockCtx: MockContext): Context {
  // The handlers use ctx.message, ctx.from, ctx.chat, ctx.reply, etc.
  // Create a proxy that maps these to MockContext methods
  const adapted = {
    // Core properties
    from: mockCtx.from,
    chat: mockCtx.chat,
    message: mockCtx.message,
    callbackQuery: mockCtx.callbackQuery,
    msg: mockCtx.msg,

    // Methods
    reply: (text: string, options?: unknown) =>
      mockCtx.reply(text, options as Parameters<MockContext["reply"]>[1]),
    editMessageText: (text: string, options?: unknown) =>
      mockCtx.editMessageText(text, options as Parameters<MockContext["editMessageText"]>[1]),
    answerCallbackQuery: (options?: unknown) =>
      mockCtx.answerCallbackQuery(options as Parameters<MockContext["answerCallbackQuery"]>[0]),
    react: (reaction: string | Array<{ type: string; emoji: string }>) => mockCtx.react(reaction),
    deleteMessage: () => mockCtx.deleteMessage(),

    // API object for setMessageReaction
    api: {
      setMessageReaction: async (_chatId: number, _messageId: number, reaction: unknown) => {
        const reactions = Array.isArray(reaction) ? reaction : [{ type: "emoji", emoji: reaction }];
        await mockCtx.react(reactions as Array<{ type: string; emoji: string }>);
      },
    },

    // Match for callbacks
    match: mockCtx.callbackData(),
  } as unknown as Context;

  return adapted;
}

/**
 * Adapt MockContext to CommandContext type.
 * Adds command-specific properties.
 */
export function adaptCommandContext(mockCtx: MockContext): CommandContext<Context> {
  const adapted = adaptContext(mockCtx) as CommandContext<Context>;

  // Add match property with command arguments
  const args = mockCtx.getCommandArgs();
  Object.defineProperty(adapted, "match", {
    get: () => args || "",
  });

  return adapted;
}

/**
 * Simulated bot handlers type.
 */
export interface SimulatedHandlers {
  handleForward: (ctx: Context) => Promise<void>;
  handleText: (ctx: Context) => Promise<void>;
  handleDone: (ctx: CommandContext<Context>) => Promise<void>;
  handleNew: (ctx: CommandContext<Context>) => Promise<void>;
  handleClear: (ctx: CommandContext<Context>) => Promise<void>;
  handleCancel: (ctx: CommandContext<Context>) => Promise<void>;
  handleStart: (ctx: CommandContext<Context>) => Promise<void>;
  handleHelp: (ctx: CommandContext<Context>) => Promise<void>;
  handleConfirm: (ctx: Context) => Promise<void>;
  handleCancelCallback: (ctx: Context) => Promise<void>;
  handleSkip: (ctx: Context) => Promise<void>;
  handleEdit: (ctx: Context) => Promise<void>;
  handleClarify: (ctx: Context) => Promise<void>;
}

/**
 * Create a simulator wired to actual bot handlers.
 * This returns both the simulator and the imported handlers.
 *
 * Usage:
 * ```ts
 * const { sim, handlers } = await createWiredSimulator();
 * await sim.forward({ text: 'Hello from John' });
 * await sim.command('/done create person');
 * ```
 */
export async function createWiredSimulator(
  config?: SimulatorConfig
): Promise<{ sim: TelegramSimulator; handlers: SimulatedHandlers; mockKV: MockKV }> {
  // Ensure KV mock is set up
  currentMockKV = getGlobalMockKV();

  // Import handlers (they'll use the mocked KV)
  const [
    { handleForward },
    { handleText },
    { handleDone },
    { handleNew },
    { handleClear },
    { handleCancel },
    { handleStart },
    { handleHelp },
    { handleConfirm, handleCancel: handleCancelCallback, handleSkip },
    { handleEdit },
    { handleClarify },
  ] = await Promise.all([
    import("@/src/handlers/messages/forward.handler"),
    import("@/src/handlers/messages/text.handler"),
    import("@/src/handlers/commands/done.handler"),
    import("@/src/handlers/commands/new.handler"),
    import("@/src/handlers/commands/clear.handler"),
    import("@/src/handlers/commands/cancel.handler"),
    import("@/src/handlers/commands/start.handler"),
    import("@/src/handlers/commands/help.handler"),
    import("@/src/handlers/callbacks/confirm.handler"),
    import("@/src/handlers/callbacks/edit.handler"),
    import("@/src/handlers/callbacks/clarify.handler"),
  ]);

  const handlers: SimulatedHandlers = {
    handleForward,
    handleText,
    handleDone,
    handleNew,
    handleClear,
    handleCancel,
    handleStart,
    handleHelp,
    handleConfirm,
    handleCancelCallback,
    handleSkip,
    handleEdit,
    handleClarify,
  };

  // Create simulator
  const sim = new TelegramSimulator(config);

  // Wire handlers to simulator
  sim.onForward(async (mockCtx) => {
    const ctx = adaptContext(mockCtx);
    await handleForward(ctx);
  });

  sim.onText(async (mockCtx) => {
    const ctx = adaptContext(mockCtx);
    await handleText(ctx);
  });

  sim.onCommand("done", async (mockCtx) => {
    const ctx = adaptCommandContext(mockCtx);
    await handleDone(ctx);
  });

  sim.onCommand("new", async (mockCtx) => {
    const ctx = adaptCommandContext(mockCtx);
    await handleNew(ctx);
  });

  sim.onCommand("clear", async (mockCtx) => {
    const ctx = adaptCommandContext(mockCtx);
    await handleClear(ctx);
  });

  sim.onCommand("cancel", async (mockCtx) => {
    const ctx = adaptCommandContext(mockCtx);
    await handleCancel(ctx);
  });

  sim.onCommand("start", async (mockCtx) => {
    const ctx = adaptCommandContext(mockCtx);
    await handleStart(ctx);
  });

  sim.onCommand("help", async (mockCtx) => {
    const ctx = adaptCommandContext(mockCtx);
    await handleHelp(ctx);
  });

  sim.onCallback(async (mockCtx) => {
    const ctx = adaptContext(mockCtx);
    const data = mockCtx.callbackData();

    // Route to appropriate handler based on callback data
    if (data === "ai_confirm" || data?.startsWith("confirm")) {
      await handleConfirm(ctx);
    } else if (data === "ai_cancel" || data?.startsWith("cancel")) {
      await handleCancelCallback(ctx);
    } else if (data === "ai_edit" || data?.startsWith("edit")) {
      await handleEdit(ctx);
    } else if (data === "ai_clarify" || data?.startsWith("clarify")) {
      await handleClarify(ctx);
    } else if (data?.startsWith("skip") || data === "clarify_skip") {
      await handleSkip(ctx);
    } else {
      console.log("[SimulatorHandler] Unknown callback:", data);
    }
  });

  return { sim, handlers, mockKV: currentMockKV };
}

/**
 * Set custom mock KV instance.
 * Use when you need isolated KV state for a specific test.
 */
export function setMockKV(kv: MockKV): void {
  currentMockKV = kv;
}
