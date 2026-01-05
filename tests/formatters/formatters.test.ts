import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatMessageForAttio,
  formatLocationString,
  formatMessagesForSingleNote,
  type ForwardedMessageData,
} from "@/src/services/attio/formatters";

describe("formatMessageForAttio", () => {
  const baseMessage: ForwardedMessageData = {
    text: "Hello, this is a test message",
    chatName: "Test Chat",
    date: 1733400000, // Dec 5, 2024 12:00:00 UTC
    messageId: 123,
  };

  it("formats a basic message with text", () => {
    const result = formatMessageForAttio(baseMessage);

    expect(result.title).toContain("Message from Test Chat");
    expect(result.content).toContain("**Forwarded from:** Test Chat");
    expect(result.content).toContain("**Sender:** Unknown");
    expect(result.content).toContain("Hello, this is a test message");
  });

  it("uses username when available", () => {
    const message: ForwardedMessageData = {
      ...baseMessage,
      senderUsername: "testuser",
    };
    const result = formatMessageForAttio(message);

    expect(result.content).toContain("**Sender:** @testuser");
  });

  it("uses first and last name when no username", () => {
    const message: ForwardedMessageData = {
      ...baseMessage,
      senderFirstName: "John",
      senderLastName: "Doe",
    };
    const result = formatMessageForAttio(message);

    expect(result.content).toContain("**Sender:** John Doe");
  });

  it("uses only first name when last name missing", () => {
    const message: ForwardedMessageData = {
      ...baseMessage,
      senderFirstName: "John",
    };
    const result = formatMessageForAttio(message);

    expect(result.content).toContain("**Sender:** John");
  });

  it("prefers username over name", () => {
    const message: ForwardedMessageData = {
      ...baseMessage,
      senderUsername: "testuser",
      senderFirstName: "John",
      senderLastName: "Doe",
    };
    const result = formatMessageForAttio(message);

    expect(result.content).toContain("**Sender:** @testuser");
    expect(result.content).not.toContain("John");
  });

  it("includes media type when present", () => {
    const message: ForwardedMessageData = {
      ...baseMessage,
      hasMedia: true,
      mediaType: "photo",
    };
    const result = formatMessageForAttio(message);

    expect(result.content).toContain("**Media:** photo");
  });

  it("shows media placeholder when no text but has media", () => {
    const message: ForwardedMessageData = {
      ...baseMessage,
      text: "",
      hasMedia: true,
      mediaType: "video",
    };
    const result = formatMessageForAttio(message);

    expect(result.content).toContain("[video message]");
  });

  it("shows no content placeholder when empty", () => {
    const message: ForwardedMessageData = {
      ...baseMessage,
      text: "",
    };
    const result = formatMessageForAttio(message);

    expect(result.content).toContain("[No text content]");
  });

  it("includes separator between metadata and content", () => {
    const result = formatMessageForAttio(baseMessage);

    expect(result.content).toContain("---");
  });
});

describe("formatLocationString", () => {
  it("returns location when present", () => {
    const company = { location: "San Francisco, CA" };
    expect(formatLocationString(company)).toBe("San Francisco, CA");
  });

  it("returns undefined when location missing", () => {
    const company = {};
    expect(formatLocationString(company)).toBeUndefined();
  });

  it("returns undefined when location is undefined", () => {
    const company = { location: undefined };
    expect(formatLocationString(company)).toBeUndefined();
  });
});

describe("formatMessagesForSingleNote", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-12-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseMessages: ForwardedMessageData[] = [
    {
      text: "First message",
      chatName: "Sales Chat",
      date: 1733392800, // Dec 5, 2024 10:00:00 UTC
      messageId: 1,
      senderUsername: "alice",
    },
    {
      text: "Second message",
      chatName: "Sales Chat",
      date: 1733396400, // Dec 5, 2024 11:00:00 UTC
      messageId: 2,
      senderFirstName: "Bob",
      senderLastName: "Smith",
    },
  ];

  it("creates title with chat name and current date", () => {
    const result = formatMessagesForSingleNote(baseMessages);

    expect(result.title).toContain("Telegram conversation with Sales Chat");
    expect(result.title).toContain("Dec");
  });

  it("formats multiple messages as conversation", () => {
    const result = formatMessagesForSingleNote(baseMessages);

    expect(result.content).toContain("@alice");
    expect(result.content).toContain("First message");
    expect(result.content).toContain("Bob Smith");
    expect(result.content).toContain("Second message");
  });

  it("includes time for each message", () => {
    const result = formatMessagesForSingleNote(baseMessages);

    // Time format depends on locale, just check for time marker
    expect(result.content).toMatch(/\*\*\[\d{1,2}:\d{2}/);
  });

  it("handles empty messages array", () => {
    const result = formatMessagesForSingleNote([]);

    expect(result.title).toContain("Unknown");
    expect(result.content).toBe("");
  });

  it("handles single message", () => {
    const result = formatMessagesForSingleNote([baseMessages[0]]);

    expect(result.content).toContain("First message");
    expect(result.content).not.toContain("\n\n**["); // No extra spacing
  });

  it("shows media placeholder for media messages", () => {
    const messages: ForwardedMessageData[] = [
      {
        text: "",
        chatName: "Media Chat",
        date: 1733392800,
        messageId: 1,
        hasMedia: true,
        mediaType: "photo",
      },
    ];
    const result = formatMessagesForSingleNote(messages);

    expect(result.content).toContain("*[sent a photo]*");
  });

  it("shows empty message placeholder", () => {
    const messages: ForwardedMessageData[] = [
      {
        text: "",
        chatName: "Empty Chat",
        date: 1733392800,
        messageId: 1,
      },
    ];
    const result = formatMessagesForSingleNote(messages);

    expect(result.content).toContain("*[empty message]*");
  });

  it("adds spacing between messages", () => {
    const result = formatMessagesForSingleNote(baseMessages);

    // Should have blank line between messages
    expect(result.content).toMatch(/First message\n\n\*\*/);
  });
});
