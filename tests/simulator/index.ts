/**
 * Telegram Simulator module exports.
 * Use these components to test bot handlers without real Telegram.
 */

export { MockKV, createMockKV, getGlobalMockKV, resetGlobalMockKV } from "./mock-kv";
export { MockApi, createMockApi, type BotResponse } from "./mock-api";
export {
  MockContext,
  createMockContext,
  type MockUser,
  type MockChat,
  type MockMessage,
  type MockCallbackQuery,
  type ForwardInput,
} from "./mock-context";
export {
  TelegramSimulator,
  createSimulator,
  createSimulatorWithHandlers,
  type SimulatorConfig,
  type HandlerRegistry,
} from "./telegram-simulator";
export {
  setupKVMock,
  resetKVMock,
  createWiredSimulator,
  adaptContext,
  adaptCommandContext,
  setMockKV,
  getCurrentMockKV,
  type SimulatedHandlers,
} from "./handler-adapter";
