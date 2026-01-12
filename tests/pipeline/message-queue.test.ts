/**
 * Message Queue Pipeline Tests
 *
 * Tests the full message forwarding and queue flow without AI.
 * These tests verify the basic bot mechanics work correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setupKVMock, resetKVMock, createWiredSimulator } from "../simulator";

// Set up KV mock before any imports that use @vercel/kv
setupKVMock();

describe("Message Queue Pipeline", () => {
  beforeEach(() => {
    resetKVMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("forwarding messages", () => {
    it("adds forwarded message to queue", async () => {
      const { sim, mockKV } = await createWiredSimulator();

      await sim.forward({
        text: "Meeting notes from John",
        senderFirstName: "John",
        senderLastName: "Doe",
        senderUsername: "johndoe",
      });

      // Verify response
      const lastReply = sim.lastReply();
      expect(lastReply?.text).toContain("Added to queue");
      expect(lastReply?.text).toContain("1 message");

      // Verify session state
      const session = mockKV.getSession(12345, 67890) as {
        messageQueue: Array<{ text: string; senderFirstName?: string }>;
        state: { type: string };
      };
      expect(session.messageQueue.length).toBe(1);
      expect(session.messageQueue[0].text).toBe("Meeting notes from John");
      expect(session.messageQueue[0].senderFirstName).toBe("John");
      expect(session.state.type).toBe("gathering_messages");
    });

    it("adds multiple forwarded messages to queue", async () => {
      const { sim, mockKV } = await createWiredSimulator();

      await sim.forward({ text: "Message 1", senderFirstName: "Alice" });
      await sim.forward({ text: "Message 2", senderFirstName: "Bob" });
      await sim.forward({ text: "Message 3", senderFirstName: "Charlie" });

      // Verify queue has all messages
      const session = mockKV.getSession(12345, 67890) as {
        messageQueue: unknown[];
      };
      expect(session.messageQueue.length).toBe(3);

      // Last response should show updated count
      const lastReply = sim.lastReply();
      expect(lastReply?.text).toContain("3 message");
    });

    it("preserves sender info in queue", async () => {
      const { sim, mockKV } = await createWiredSimulator();

      await sim.forward({
        text: "Important info",
        senderFirstName: "Jane",
        senderLastName: "Smith",
        senderUsername: "janesmith",
      });

      const session = mockKV.getSession(12345, 67890) as {
        messageQueue: Array<{
          text: string;
          senderFirstName?: string;
          senderLastName?: string;
          senderUsername?: string;
        }>;
      };
      const msg = session.messageQueue[0];

      expect(msg.senderFirstName).toBe("Jane");
      expect(msg.senderLastName).toBe("Smith");
      expect(msg.senderUsername).toBe("janesmith");
    });
  });

  describe("/done without AI", () => {
    it("requires messages in queue", async () => {
      const { sim } = await createWiredSimulator();

      await sim.command("/done create person");

      const lastReply = sim.lastReply();
      expect(lastReply?.text).toContain("No messages in queue");
    });

    it("requires instruction text", async () => {
      const { sim } = await createWiredSimulator();

      // Add a message first
      await sim.forward({ text: "Test message" });
      sim.getApi().clear();

      // Try /done without instruction
      await sim.command("/done");

      const lastReply = sim.lastReply();
      expect(lastReply?.text).toContain("What should I do");
    });
  });

  describe("/clear command", () => {
    it("clears message queue", async () => {
      const { sim, mockKV } = await createWiredSimulator();

      // Add messages
      await sim.forward({ text: "Message 1" });
      await sim.forward({ text: "Message 2" });

      // Verify queue has messages
      let session = mockKV.getSession(12345, 67890) as {
        messageQueue: unknown[];
      };
      expect(session.messageQueue.length).toBe(2);

      // Clear
      await sim.command("/clear");

      // Verify queue is empty
      session = mockKV.getSession(12345, 67890) as {
        messageQueue: unknown[];
      };
      expect(session.messageQueue?.length || 0).toBe(0);
    });

    it("shows count of cleared messages", async () => {
      const { sim } = await createWiredSimulator();

      // Add messages
      await sim.forward({ text: "Message 1" });
      await sim.forward({ text: "Message 2" });
      await sim.forward({ text: "Message 3" });
      sim.getApi().clear();

      // Clear and check response
      await sim.command("/clear");

      const lastReply = sim.lastReply();
      expect(lastReply?.text?.toLowerCase()).toContain("cleared");
      expect(lastReply?.text).toContain("3");
    });
  });

  describe("/cancel command", () => {
    it("cancels and returns to idle", async () => {
      const { sim } = await createWiredSimulator();

      // Add a message to have something to cancel
      await sim.forward({ text: "Test message" });

      // Cancel
      await sim.command("/cancel");

      // Should acknowledge cancellation
      const lastReply = sim.lastReply();
      expect(lastReply?.text).toBeDefined();
    });
  });

  describe("session isolation", () => {
    it("isolates sessions by user ID", async () => {
      // User 1
      const { sim: sim1, mockKV } = await createWiredSimulator({
        userId: 111,
        chatId: 100,
      });

      // User 2 (same chat, different user)
      const { sim: sim2 } = await createWiredSimulator({
        userId: 222,
        chatId: 100,
      });

      // User 1 forwards a message
      await sim1.forward({ text: "User 1 message" });

      // User 2 forwards a different message
      await sim2.forward({ text: "User 2 message" });

      // Each user should have their own queue
      const session1 = mockKV.getSession(100, 111) as {
        messageQueue: Array<{ text: string }>;
      };
      const session2 = mockKV.getSession(100, 222) as {
        messageQueue: Array<{ text: string }>;
      };

      expect(session1.messageQueue[0].text).toBe("User 1 message");
      expect(session2.messageQueue[0].text).toBe("User 2 message");
    });

    it("isolates sessions by chat ID", async () => {
      // Same user, different chats
      const { sim: sim1, mockKV } = await createWiredSimulator({
        userId: 111,
        chatId: 100,
      });

      const { sim: sim2 } = await createWiredSimulator({
        userId: 111,
        chatId: 200,
      });

      await sim1.forward({ text: "Chat 1 message" });
      await sim2.forward({ text: "Chat 2 message" });

      const session1 = mockKV.getSession(100, 111) as {
        messageQueue: Array<{ text: string }>;
      };
      const session2 = mockKV.getSession(200, 111) as {
        messageQueue: Array<{ text: string }>;
      };

      expect(session1.messageQueue[0].text).toBe("Chat 1 message");
      expect(session2.messageQueue[0].text).toBe("Chat 2 message");
    });
  });
});
