/**
 * Handler adapter tests.
 * Verifies that the simulator is correctly wired to bot handlers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupKVMock, resetKVMock, createWiredSimulator } from "./handler-adapter";

// Set up KV mock before any imports that use @vercel/kv
setupKVMock();

describe("Handler Adapter", () => {
  beforeEach(() => {
    resetKVMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createWiredSimulator", () => {
    it("creates simulator with all handlers registered", async () => {
      const { sim, handlers } = await createWiredSimulator();

      // Verify handlers are functions
      expect(typeof handlers.handleForward).toBe("function");
      expect(typeof handlers.handleText).toBe("function");
      expect(typeof handlers.handleDone).toBe("function");
      expect(typeof handlers.handleNew).toBe("function");
      expect(typeof handlers.handleClear).toBe("function");
      expect(typeof handlers.handleCancel).toBe("function");
      expect(typeof handlers.handleStart).toBe("function");
      expect(typeof handlers.handleHelp).toBe("function");
      expect(typeof handlers.handleConfirm).toBe("function");

      // Verify simulator is configured
      expect(sim).toBeDefined();
      expect(sim.getKV()).toBeDefined();
      expect(sim.getApi()).toBeDefined();
    });

    it("forwards message adds to queue in mock KV", async () => {
      const { sim, mockKV } = await createWiredSimulator();

      // Forward a message
      await sim.forward({
        text: "Hello from John Doe",
        senderFirstName: "John",
        senderLastName: "Doe",
        senderUsername: "johndoe",
      });

      // Verify response
      const lastReply = sim.lastReply();
      expect(lastReply).toBeDefined();
      expect(lastReply?.text).toContain("Added to queue");

      // Verify session was updated in mock KV
      const session = mockKV.getSession(12345, 67890);
      expect(session).toBeDefined();
    });

    it("/start command responds with welcome message", async () => {
      const { sim } = await createWiredSimulator();

      await sim.command("/start");

      const lastReply = sim.lastReply();
      expect(lastReply).toBeDefined();
      // Start handler should reply with welcome
      expect(lastReply?.text).toBeDefined();
    });

    it("/help command responds with help text", async () => {
      const { sim } = await createWiredSimulator();

      await sim.command("/help");

      const lastReply = sim.lastReply();
      expect(lastReply).toBeDefined();
      expect(lastReply?.text).toBeDefined();
    });

    it("/done without queue shows empty queue message", async () => {
      const { sim } = await createWiredSimulator();

      await sim.command("/done create person");

      const lastReply = sim.lastReply();
      expect(lastReply).toBeDefined();
      expect(lastReply?.text).toContain("No messages in queue");
    });

    it("/done without instruction shows hint", async () => {
      const { sim } = await createWiredSimulator();

      // First add a message to queue
      await sim.forward({ text: "Test message" });

      // Reset responses
      sim.getApi().clear();

      // Then run /done without instruction
      await sim.command("/done");

      const lastReply = sim.lastReply();
      expect(lastReply).toBeDefined();
      expect(lastReply?.text).toContain("What should I do");
    });

    it("/clear resets session", async () => {
      const { sim, mockKV } = await createWiredSimulator();

      // First add a message
      await sim.forward({ text: "Test message" });

      // Verify queue has message
      let session = mockKV.getSession(12345, 67890) as { messageQueue?: unknown[] };
      expect(session?.messageQueue?.length).toBeGreaterThan(0);

      // Clear session
      await sim.command("/clear");

      const lastReply = sim.lastReply();
      expect(lastReply?.text?.toLowerCase()).toContain("cleared");

      // Verify queue is empty
      session = mockKV.getSession(12345, 67890) as { messageQueue?: unknown[] };
      // After clear, queue should be empty or session reset
      expect(session?.messageQueue?.length || 0).toBe(0);
    });

    it("/cancel when idle shows appropriate message", async () => {
      const { sim } = await createWiredSimulator();

      await sim.command("/cancel");

      const lastReply = sim.lastReply();
      expect(lastReply).toBeDefined();
      // Cancel should acknowledge or say nothing to cancel
      expect(lastReply?.text).toBeDefined();
    });
  });

  describe("mock KV integration", () => {
    it("multiple simulators share global mock KV by default", async () => {
      const { mockKV: kv1 } = await createWiredSimulator();
      const { mockKV: kv2 } = await createWiredSimulator();

      // They should reference the same instance
      expect(kv1).toBe(kv2);
    });

    it("session persists across simulator calls", async () => {
      const { sim, mockKV } = await createWiredSimulator();

      // Forward multiple messages
      await sim.forward({ text: "Message 1" });
      await sim.forward({ text: "Message 2" });
      await sim.forward({ text: "Message 3" });

      // Check session has all messages
      const session = mockKV.getSession(12345, 67890) as { messageQueue?: unknown[] };
      expect(session?.messageQueue?.length).toBe(3);
    });
  });
});
