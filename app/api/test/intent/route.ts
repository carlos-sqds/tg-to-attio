import { NextRequest, NextResponse } from "next/server";
import { analyzeIntent } from "@/src/workflows/ai.intent";
import { fetchFullSchemaCached } from "@/src/workflows/attio.schema";
import type { ForwardedMessageData } from "@/src/types";

interface IntentTestCase {
  messages: Array<{
    text: string;
    senderUsername?: string;
    senderFirstName?: string;
    senderLastName?: string;
    chatName?: string;
    date?: number;
  }>;
  instruction: string;
  expectedIntent?: string;
  expectedFields?: Record<string, unknown>;
}

/**
 * Test endpoint for AI intent analysis.
 *
 * POST /api/test/intent
 * {
 *   messages: [{ text: "..." }],
 *   instruction: "create a person"
 * }
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { messages, instruction, testCases } = body;

    // Handle test cases
    if (testCases && Array.isArray(testCases)) {
      const results = await runIntentTestCases(testCases);
      return NextResponse.json(results);
    }

    // Handle single request
    if (!messages || !instruction) {
      return NextResponse.json(
        { error: "Missing required fields: messages, instruction" },
        { status: 400 }
      );
    }

    const result = await testIntent(messages, instruction);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Intent Test] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function testIntent(
  messages: Array<{
    text: string;
    senderUsername?: string;
    senderFirstName?: string;
    senderLastName?: string;
    chatName?: string;
    date?: number;
  }>,
  instruction: string
) {
  const schema = await fetchFullSchemaCached();

  const formattedMessages: ForwardedMessageData[] = messages.map((m, i) => ({
    text: m.text,
    senderUsername: m.senderUsername,
    senderFirstName: m.senderFirstName,
    senderLastName: m.senderLastName,
    chatName: m.chatName || "Test Chat",
    date: m.date || Math.floor(Date.now() / 1000) - i * 60,
    messageId: 1000 + i,
    hasMedia: false,
  }));

  const startTime = Date.now();
  const result = await analyzeIntent({
    messages: formattedMessages,
    instruction,
    schema,
  });
  const duration = Date.now() - startTime;

  return {
    input: { messages, instruction },
    result: {
      intent: result.intent,
      confidence: result.confidence,
      targetObject: result.targetObject,
      extractedData: result.extractedData,
      clarificationsNeeded: result.clarificationsNeeded,
      prerequisiteActions: result.prerequisiteActions,
      reasoning: result.reasoning,
    },
    duration: `${duration}ms`,
  };
}

async function runIntentTestCases(testCases: IntentTestCase[]) {
  const results = await Promise.all(
    testCases.map(async (tc) => {
      try {
        const result = await testIntent(tc.messages, tc.instruction);
        let passed = true;
        const failures: string[] = [];

        // Check expected intent
        if (tc.expectedIntent && result.result.intent !== tc.expectedIntent) {
          passed = false;
          failures.push(`Expected intent "${tc.expectedIntent}", got "${result.result.intent}"`);
        }

        // Check expected fields
        if (tc.expectedFields) {
          for (const [key, expectedValue] of Object.entries(tc.expectedFields)) {
            const actualValue = result.result.extractedData[key];
            const actualStr = JSON.stringify(actualValue)?.toLowerCase();
            const expectedStr = String(expectedValue).toLowerCase();

            if (!actualStr || !actualStr.includes(expectedStr)) {
              passed = false;
              failures.push(
                `Expected field "${key}" to contain "${expectedValue}", got "${actualValue}"`
              );
            }
          }
        }

        return {
          instruction: tc.instruction,
          messagesPreview: tc.messages.map((m) => m.text.slice(0, 50)).join(" | "),
          expected: { intent: tc.expectedIntent, fields: tc.expectedFields },
          actual: result.result,
          passed,
          failures: failures.length > 0 ? failures : undefined,
          duration: result.duration,
        };
      } catch (error) {
        return {
          instruction: tc.instruction,
          messagesPreview: tc.messages.map((m) => m.text.slice(0, 50)).join(" | "),
          expected: { intent: tc.expectedIntent, fields: tc.expectedFields },
          actual: null,
          passed: false,
          failures: [error instanceof Error ? error.message : String(error)],
          duration: "0ms",
        };
      }
    })
  );

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
