import type { ActionIntent } from "@/src/services/attio/schema-types";

export interface AITestCase {
  name: string;
  description?: string;
  messages: Array<{
    text: string;
    chatName: string;
    date: number;
    senderUsername?: string;
    senderFirstName?: string;
    senderLastName?: string;
  }>;
  instruction: string;
  expectedIntent: ActionIntent;
  expectedExtraction?: Record<string, unknown>;
  expectedClarification?: {
    field: string;
    reason?: string;
  };
  expectedMissingRequired?: string[];
}

const NOW = Math.floor(Date.now() / 1000);

export const testCases: AITestCase[] = [
  // Person creation tests
  {
    name: "Create person from forwarded conversation with email",
    description: "Should extract name and email from a conversation",
    messages: [
      {
        text: "Hi, I'm John Smith from Acme Corp. Nice to meet you!",
        chatName: "John Smith",
        date: NOW - 3600,
        senderFirstName: "John",
        senderLastName: "Smith",
      },
      {
        text: "You can reach me at john.smith@acme.com anytime.",
        chatName: "John Smith",
        date: NOW - 3500,
        senderFirstName: "John",
        senderLastName: "Smith",
      },
    ],
    instruction: "create a contact from this",
    expectedIntent: "create_person",
    expectedExtraction: {
      name: "John Smith",
      email: "john.smith@acme.com",
      company: "Acme Corp",
    },
  },
  {
    name: "Create person with phone number",
    messages: [
      {
        text: "Hey, this is Maria Garcia. Call me at +1-555-123-4567 to discuss the partnership.",
        chatName: "Maria Garcia",
        date: NOW - 1800,
        senderFirstName: "Maria",
        senderLastName: "Garcia",
      },
    ],
    instruction: "add this person to CRM",
    expectedIntent: "create_person",
    expectedExtraction: {
      name: "Maria Garcia",
      phone: "+1-555-123-4567",
    },
  },

  // Company creation tests
  {
    name: "Create company from description",
    messages: [
      {
        text: "TechCorp is a leading AI startup based in San Francisco. Their website is techcorp.io",
        chatName: "Partner Chat",
        date: NOW - 7200,
      },
    ],
    instruction: "create a new company",
    expectedIntent: "create_company",
    expectedExtraction: {
      name: "TechCorp",
      domain: "techcorp.io",
      location: "San Francisco",
    },
  },

  // Deal creation tests
  {
    name: "Create deal with value",
    messages: [
      {
        text: "We discussed a potential $50,000 annual contract for the enterprise plan.",
        chatName: "Sales Meeting Notes",
        date: NOW - 86400,
      },
    ],
    instruction: "create a deal for TechCorp",
    expectedIntent: "create_deal",
    expectedExtraction: {
      value: 50000,
      company: "TechCorp",
    },
  },
  {
    name: "Create deal with shorthand value",
    messages: [
      {
        text: "Looking at a 25k deal with potential to expand to 100k next year",
        chatName: "Pipeline Discussion",
        date: NOW - 43200,
      },
    ],
    instruction: "create deal",
    expectedIntent: "create_deal",
    expectedExtraction: {
      value: 25000,
    },
  },

  // Task creation tests
  {
    name: "Create task with assignee",
    messages: [],
    instruction: "remind Sarah to follow up with the client next week",
    expectedIntent: "create_task",
    expectedExtraction: {
      assignee: "Sarah",
      content: "follow up with the client",
    },
  },
  {
    name: "Create task from conversation context",
    messages: [
      {
        text: "We need to send them the proposal by Friday",
        chatName: "Team Chat",
        date: NOW - 3600,
      },
    ],
    instruction: "create a task for John",
    expectedIntent: "create_task",
    expectedExtraction: {
      assignee: "John",
      content: "send them the proposal",
      deadline: "Friday",
    },
  },

  // Add to list tests
  {
    name: "Add person to leads list",
    messages: [
      {
        text: "Met a great prospect at the conference - Alex Chen from StartupXYZ",
        chatName: "Conference Notes",
        date: NOW - 172800,
      },
    ],
    instruction: "add to sales leads",
    expectedIntent: "add_to_list",
    expectedExtraction: {
      list: "sales-leads",
      name: "Alex Chen",
      company: "StartupXYZ",
    },
  },

  // Add note tests
  {
    name: "Add note to company",
    messages: [
      {
        text: "Great call with the Acme team today. They're interested in Q1 rollout.",
        chatName: "Call Notes",
        date: NOW - 1800,
      },
      {
        text: "Main concerns: pricing and implementation timeline",
        chatName: "Call Notes",
        date: NOW - 1700,
      },
    ],
    instruction: "save this to Acme",
    expectedIntent: "add_note",
    expectedExtraction: {
      company: "Acme",
    },
  },

  // Ambiguous cases - should request clarification
  {
    name: "Ambiguous company reference",
    messages: [
      {
        text: "Following up on the Acme discussion from last week",
        chatName: "Partner Meeting",
        date: NOW - 259200,
      },
    ],
    instruction: "add note",
    expectedIntent: "add_note",
    expectedClarification: {
      field: "company",
      reason: "ambiguous",
    },
  },

  // Missing required fields
  {
    name: "Create person without enough info",
    messages: [
      {
        text: "Someone called about the product demo",
        chatName: "Reception",
        date: NOW - 900,
      },
    ],
    instruction: "create a contact",
    expectedIntent: "create_person",
    expectedMissingRequired: ["name"],
  },

  // Complex multi-entity extraction
  {
    name: "Extract multiple entities from conversation",
    messages: [
      {
        text: "Hi, I'm David Lee, CTO at InnovateTech. My email is david@innovatetech.com",
        chatName: "David Lee",
        date: NOW - 7200,
        senderFirstName: "David",
        senderLastName: "Lee",
      },
      {
        text: "We're a Series B startup in Seattle, looking to close a $75k deal this quarter",
        chatName: "David Lee",
        date: NOW - 7100,
        senderFirstName: "David",
        senderLastName: "Lee",
      },
      {
        text: "Can Sarah from your team set up a demo next Tuesday?",
        chatName: "David Lee",
        date: NOW - 7000,
        senderFirstName: "David",
        senderLastName: "Lee",
      },
    ],
    instruction: "create a person and deal",
    expectedIntent: "create_person", // Primary intent should be person
    expectedExtraction: {
      name: "David Lee",
      email: "david@innovatetech.com",
      company: "InnovateTech",
    },
  },
];

// Subset for quick smoke tests
export const smokeTestCases = testCases.filter((tc) =>
  [
    "Create person from forwarded conversation with email",
    "Create company from description",
    "Create deal with value",
    "Create task with assignee",
  ].includes(tc.name)
);
