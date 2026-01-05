import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "@/src/ai/prompts";
import type { AttioSchema } from "@/src/services/attio/schema-types";

describe("buildSystemPrompt", () => {
  const minimalSchema: AttioSchema = {
    objects: [
      {
        workspaceId: "ws-1",
        objectId: "obj-1",
        apiSlug: "people",
        singularNoun: "Person",
        pluralNoun: "People",
        createdAt: "2024-01-01",
        attributes: [
          {
            id: "attr-1",
            apiSlug: "name",
            title: "Name",
            type: "personal-name",
            isRequired: true,
            isWritable: true,
            isUnique: false,
            isArchived: false,
          },
          {
            id: "attr-2",
            apiSlug: "email_addresses",
            title: "Email",
            type: "email-addresses",
            isRequired: false,
            isWritable: true,
            isUnique: false,
            isArchived: false,
            description: "Contact email addresses",
          },
          {
            id: "attr-3",
            apiSlug: "archived_field",
            title: "Archived",
            type: "text",
            isRequired: false,
            isWritable: true,
            isUnique: false,
            isArchived: true, // Should be excluded
          },
          {
            id: "attr-4",
            apiSlug: "readonly_field",
            title: "Read Only",
            type: "text",
            isRequired: false,
            isWritable: false, // Should be excluded
            isUnique: false,
            isArchived: false,
          },
        ],
      },
      {
        workspaceId: "ws-1",
        objectId: "obj-2",
        apiSlug: "companies",
        singularNoun: "Company",
        pluralNoun: "Companies",
        createdAt: "2024-01-01",
        attributes: [
          {
            id: "attr-5",
            apiSlug: "name",
            title: "Name",
            type: "text",
            isRequired: true,
            isWritable: true,
            isUnique: false,
            isArchived: false,
          },
        ],
      },
    ],
    lists: [
      {
        id: "list-1",
        apiSlug: "sales-pipeline",
        name: "Sales Pipeline",
        parentObject: "companies",
        parentObjectId: "obj-companies",
        createdAt: "2024-01-01",
        attributes: [],
        workspaceMemberAccess: "full-access",
      },
      {
        id: "list-2",
        apiSlug: "leads",
        name: "Leads",
        parentObject: "people",
        parentObjectId: "obj-people",
        createdAt: "2024-01-01",
        attributes: [],
        workspaceMemberAccess: "full-access",
      },
    ],
    workspaceMembers: [
      {
        id: "member-1",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@company.com",
        accessLevel: "admin",
        createdAt: "2024-01-01",
      },
      {
        id: "member-2",
        firstName: "Bob",
        lastName: "Jones",
        email: "bob@company.com",
        accessLevel: "member",
        createdAt: "2024-01-01",
      },
    ],
    lastFetched: Date.now(),
  };

  it("includes object schemas with writable attributes", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("Person (people)");
    expect(prompt).toContain("name (personal-name) [REQUIRED]");
    expect(prompt).toContain("email_addresses (email-addresses)");
    expect(prompt).toContain("Contact email addresses");
  });

  it("excludes archived and read-only attributes", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).not.toContain("archived_field");
    expect(prompt).not.toContain("readonly_field");
  });

  it("includes all objects", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("Person (people)");
    expect(prompt).toContain("Company (companies)");
  });

  it("includes list definitions", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("Sales Pipeline (sales-pipeline)");
    expect(prompt).toContain("for companies records");
    expect(prompt).toContain("Leads (leads)");
    expect(prompt).toContain("for people records");
  });

  it("includes workspace members", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("Alice Smith (alice@company.com)");
    expect(prompt).toContain("Bob Jones (bob@company.com)");
  });

  it("includes action guidelines", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("create_person");
    expect(prompt).toContain("create_company");
    expect(prompt).toContain("create_deal");
    expect(prompt).toContain("create_task");
    expect(prompt).toContain("add_to_list");
    expect(prompt).toContain("add_note");
  });

  it("includes prerequisite actions guidance", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("prerequisiteActions");
    expect(prompt).toContain("create_company as prerequisite");
  });

  it("emphasizes company linking requirement", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("ALL records (people, deals, tasks) MUST be linked to a company");
    expect(prompt).toContain("associated_company");
  });

  it("includes note creation guidance", () => {
    const prompt = buildSystemPrompt(minimalSchema);

    expect(prompt).toContain("noteTitle");
    expect(prompt).toContain("forwarded messages are provided, they will be saved as a note");
  });

  it("handles empty lists array", () => {
    const schemaNoLists: AttioSchema = {
      ...minimalSchema,
      lists: [],
    };
    const prompt = buildSystemPrompt(schemaNoLists);

    expect(prompt).toContain("Available Lists");
    // Should not throw
  });

  it("handles empty members array", () => {
    const schemaNoMembers: AttioSchema = {
      ...minimalSchema,
      workspaceMembers: [],
    };
    const prompt = buildSystemPrompt(schemaNoMembers);

    expect(prompt).toContain("Team Members");
    // Should not throw
  });
});

describe("buildUserPrompt", () => {
  it("formats single message correctly", () => {
    const messages = [
      {
        text: "Hello, this is a test message",
        senderUsername: "testuser",
        chatName: "Test Chat",
        date: 1733400000, // Dec 5, 2024 12:00:00 UTC
      },
    ];

    const prompt = buildUserPrompt(messages, "create a contact");

    expect(prompt).toContain("[Message 1]");
    expect(prompt).toContain("From: @testuser");
    expect(prompt).toContain("Test Chat");
    expect(prompt).toContain("Hello, this is a test message");
    expect(prompt).toContain("## User Instruction");
    expect(prompt).toContain("create a contact");
  });

  it("formats multiple messages", () => {
    const messages = [
      {
        text: "First message",
        senderUsername: "alice",
        chatName: "Sales",
        date: 1733400000,
      },
      {
        text: "Second message",
        senderFirstName: "Bob",
        senderLastName: "Smith",
        chatName: "Sales",
        date: 1733403600,
      },
    ];

    const prompt = buildUserPrompt(messages, "create deal");

    expect(prompt).toContain("[Message 1]");
    expect(prompt).toContain("@alice");
    expect(prompt).toContain("First message");
    expect(prompt).toContain("[Message 2]");
    expect(prompt).toContain("Bob Smith");
    expect(prompt).toContain("Second message");
  });

  it("uses first/last name when no username", () => {
    const messages = [
      {
        text: "Test",
        senderFirstName: "John",
        senderLastName: "Doe",
        chatName: "Chat",
        date: 1733400000,
      },
    ];

    const prompt = buildUserPrompt(messages, "test");

    expect(prompt).toContain("From: John Doe");
    expect(prompt).not.toContain("@");
  });

  it("shows Unknown when no sender info", () => {
    const messages = [
      {
        text: "Anonymous message",
        chatName: "Chat",
        date: 1733400000,
      },
    ];

    const prompt = buildUserPrompt(messages, "test");

    expect(prompt).toContain("From: Unknown");
  });

  it("handles empty messages array", () => {
    const prompt = buildUserPrompt([], "create a task");

    expect(prompt).toContain("No forwarded messages provided");
    expect(prompt).toContain("create a task");
  });

  it("includes date in formatted output", () => {
    const messages = [
      {
        text: "Test",
        chatName: "Chat",
        date: 1733400000,
      },
    ];

    const prompt = buildUserPrompt(messages, "test");

    // Date format depends on locale, just check it's present
    expect(prompt).toMatch(/\d{1,2}.*\d{4}/); // Some date format
  });

  it("preserves message text exactly", () => {
    const complexText = `Line 1
Line 2
- Bullet point
Email: test@example.com
Phone: +1-234-567-8900`;

    const messages = [
      {
        text: complexText,
        chatName: "Chat",
        date: 1733400000,
      },
    ];

    const prompt = buildUserPrompt(messages, "extract data");

    expect(prompt).toContain(complexText);
    expect(prompt).toContain("test@example.com");
    expect(prompt).toContain("+1-234-567-8900");
  });

  it("handles messages with only first name", () => {
    const messages = [
      {
        text: "Test",
        senderFirstName: "Alice",
        chatName: "Chat",
        date: 1733400000,
      },
    ];

    const prompt = buildUserPrompt(messages, "test");

    expect(prompt).toContain("From: Alice");
  });
});
