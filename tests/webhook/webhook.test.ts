import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock external modules before importing the route
vi.mock("workflow/api", () => ({
  start: vi.fn(),
  getHookByToken: vi.fn(),
  Run: vi.fn().mockImplementation(() => ({
    cancel: vi.fn(),
  })),
}));

vi.mock("@/workflows/hooks", () => ({
  telegramHook: {
    resume: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/workflows/conversation-ai", () => ({
  conversationWorkflowAI: vi.fn(),
}));

vi.mock("@/src/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks are set up
import { POST } from "@/app/api/webhook/route";
import { start, getHookByToken } from "workflow/api";
import { telegramHook } from "@/workflows/hooks";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BOT_TOKEN", "test-bot-token");
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("/start command", () => {
    it("starts a new workflow", async () => {
      vi.mocked(telegramHook.resume).mockRejectedValue(new Error("No hook"));
      vi.mocked(getHookByToken).mockResolvedValue(null as never);
      vi.mocked(start).mockResolvedValue({ runId: "run-123" } as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/start",
          date: 1733400000,
        },
      });

      const response = await POST(request);
      const json = await response.json();

      expect(json).toEqual({ ok: true });
      expect(start).toHaveBeenCalled();
    });

    it("terminates existing workflow before starting new one", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValueOnce(undefined as never);
      vi.mocked(start).mockResolvedValue({ runId: "run-123" } as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/start",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith("ai6-12345", { type: "terminate" });
    });

    it("sends error message when workflow fails to start", async () => {
      vi.mocked(telegramHook.resume).mockRejectedValue(new Error("No hook"));
      vi.mocked(getHookByToken).mockResolvedValue(null as never);
      vi.mocked(start).mockRejectedValue(new Error("Failed"));

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/start",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sendMessage"),
        expect.objectContaining({
          body: expect.stringContaining("Failed to start"),
        })
      );
    });
  });

  describe("/help command", () => {
    it("responds directly without workflow", async () => {
      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/help",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(start).not.toHaveBeenCalled();
      expect(telegramHook.resume).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sendMessage"),
        expect.objectContaining({
          body: expect.stringContaining("Commands"),
        })
      );
    });
  });

  describe("/done command", () => {
    it("resumes workflow with text_message event", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 42,
          from: { id: 12345, first_name: "John", username: "johnd" },
          chat: { id: 12345 },
          text: "/done create a contact",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "text_message",
          text: "/done create a contact",
          messageId: 42,
          callerInfo: {
            firstName: "John",
            lastName: undefined,
            username: "johnd",
          },
        })
      );
    });

    it("sends error when no workflow running", async () => {
      vi.mocked(telegramHook.resume).mockRejectedValue(new Error("No hook"));

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/done",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sendMessage"),
        expect.objectContaining({
          body: expect.stringContaining("Please send /start first"),
        })
      );
    });
  });

  describe("Other commands", () => {
    it("routes /clear as command event", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/clear",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "command",
          command: "/clear",
        })
      );
    });

    it("routes /cancel as command event", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/cancel",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "command",
          command: "/cancel",
        })
      );
    });
  });

  describe("Forwarded messages", () => {
    it("extracts user forwarded message", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "Hello from forwarded message",
          date: 1733400000,
          forward_origin: {
            type: "user",
            sender_user: {
              username: "alice",
              first_name: "Alice",
              last_name: "Smith",
            },
          },
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "forwarded_message",
          forwardedMessage: expect.objectContaining({
            text: "Hello from forwarded message",
            senderUsername: "alice",
            senderFirstName: "Alice",
            senderLastName: "Smith",
            chatName: "Alice Smith",
          }),
        })
      );
    });

    it("extracts chat forwarded message", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "Group message",
          date: 1733400000,
          forward_origin: {
            type: "chat",
            sender_chat: { title: "Sales Team" },
          },
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "forwarded_message",
          forwardedMessage: expect.objectContaining({
            chatName: "Sales Team",
          }),
        })
      );
    });

    it("extracts channel forwarded message", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "Channel post",
          date: 1733400000,
          forward_origin: {
            type: "channel",
            chat: { title: "News Channel" },
          },
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "forwarded_message",
          forwardedMessage: expect.objectContaining({
            chatName: "News Channel",
          }),
        })
      );
    });

    it("handles hidden user forward", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "Secret message",
          date: 1733400000,
          forward_origin: {
            type: "hidden_user",
            sender_user_name: "Anonymous",
          },
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "forwarded_message",
          forwardedMessage: expect.objectContaining({
            chatName: "Anonymous",
          }),
        })
      );
    });

    it("detects media type in forwarded message", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          caption: "Photo caption",
          date: 1733400000,
          photo: [{ file_id: "photo123" }],
          forward_origin: {
            type: "user",
            sender_user: { first_name: "Bob" },
          },
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "forwarded_message",
          forwardedMessage: expect.objectContaining({
            text: "Photo caption",
            hasMedia: true,
            mediaType: "photo",
          }),
        })
      );
    });
  });

  describe("Regular text messages", () => {
    it("resumes workflow with text_message event", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "Some company name",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "text_message",
          text: "Some company name",
        })
      );
    });
  });

  describe("Callback queries", () => {
    it("resumes workflow with callback_query event", async () => {
      vi.mocked(telegramHook.resume).mockResolvedValue(undefined as never);

      const request = createRequest({
        update_id: 1,
        callback_query: {
          id: "callback-123",
          from: { id: 12345 },
          message: { chat: { id: 12345 }, message_id: 99 },
          data: "ai_confirm",
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledWith(
        "ai6-12345",
        expect.objectContaining({
          type: "callback_query",
          callbackData: "ai_confirm",
          callbackQueryId: "callback-123",
        })
      );
    });

    it("ignores callback without message", async () => {
      const request = createRequest({
        update_id: 1,
        callback_query: {
          id: "callback-123",
          from: { id: 12345 },
          data: "ai_confirm",
        },
      });

      const response = await POST(request);
      const json = await response.json();

      expect(json).toEqual({ ok: true });
      expect(telegramHook.resume).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("handles message without from field", async () => {
      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345 },
          text: "/start",
          date: 1733400000,
        },
      });

      const response = await POST(request);
      const json = await response.json();

      expect(json).toEqual({ ok: true });
      expect(start).not.toHaveBeenCalled();
    });

    it("handles empty update", async () => {
      const request = createRequest({
        update_id: 1,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(json).toEqual({ ok: true });
    });

    it("returns ok on error", async () => {
      const request = new NextRequest("http://localhost/api/webhook", {
        method: "POST",
        body: "invalid json",
      });

      const response = await POST(request);
      const json = await response.json();

      expect(json).toEqual({ ok: true });
    });
  });

  describe("tryResumeWorkflow retry logic", () => {
    it("retries on failure before giving up", async () => {
      vi.mocked(telegramHook.resume)
        .mockRejectedValueOnce(new Error("Retry 1"))
        .mockRejectedValueOnce(new Error("Retry 2"))
        .mockRejectedValueOnce(new Error("Retry 3"));

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/clear",
          date: 1733400000,
        },
      });

      await POST(request);

      // Should have tried 3 times
      expect(telegramHook.resume).toHaveBeenCalledTimes(3);
    });

    it("succeeds on retry", async () => {
      vi.mocked(telegramHook.resume)
        .mockRejectedValueOnce(new Error("Retry 1"))
        .mockResolvedValueOnce(undefined as never);

      const request = createRequest({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 12345 },
          chat: { id: 12345 },
          text: "/clear",
          date: 1733400000,
        },
      });

      await POST(request);

      expect(telegramHook.resume).toHaveBeenCalledTimes(2);
      // Should not have sent "Please send /start" message
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining("Please send /start"),
        })
      );
    });
  });
});
