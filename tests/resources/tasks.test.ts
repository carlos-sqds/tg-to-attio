/**
 * Tasks resource tests.
 * Tests Attio task creation with all field combinations.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { AttioTestClient, uniqueTestName } from "../helpers/attio-test-client";

describe("Tasks resource", () => {
  let client: AttioTestClient;

  beforeAll(async () => {
    if (!process.env.ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY environment variable is not set");
    }
    client = new AttioTestClient();
    // Validate API key works
    await client.searchRecords("companies", "test");
  });

  afterAll(async () => {
    if (client) {
      await client.cleanup();
    }
  });

  it("creates task with content only", async () => {
    const content = uniqueTestName("Simple task");
    const result = await client.createTask({ content });
    expect(result.taskId).toBeDefined();

    const task = await client.getTask(result.taskId);
    // Attio returns content as content_plaintext
    expect(task.content_plaintext).toBe(`[TEST] ${content}`);
    expect(task.is_completed).toBe(false);
  });

  it("creates task with deadline", async () => {
    const content = uniqueTestName("Deadline task");
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    // Format as ISO string with microseconds for Attio
    const deadlineStr = deadline.toISOString().slice(0, -5) + "Z";

    const result = await client.createTask({
      content,
      deadline: deadlineStr,
    });

    const task = await client.getTask(result.taskId);
    expect(task.deadline_at).toBeDefined();

    // Verify deadline is approximately correct (within a day)
    const storedDeadline = new Date(task.deadline_at as string);
    const diffMs = Math.abs(storedDeadline.getTime() - deadline.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThan(1);
  });

  it("creates task linked to company", async () => {
    // Create company first
    const companyName = uniqueTestName("Task Company");
    const company = await client.createCompany({ name: companyName });

    // Create task linked to company
    const content = uniqueTestName("Linked task");
    const result = await client.createTask({
      content,
      linkedRecordId: company.recordId,
      linkedRecordObject: "companies",
    });

    const task = await client.getTask(result.taskId);
    const linkedRecords = task.linked_records as Array<{
      target_record_id: string;
    }>;

    expect(linkedRecords).toBeDefined();
    expect(linkedRecords.length).toBeGreaterThan(0);
    expect(linkedRecords[0].target_record_id).toBe(company.recordId);
  });

  it("creates task linked to person", async () => {
    // Create person first
    const personName = uniqueTestName("Task Person");
    const person = await client.createPerson({ name: personName });

    // Create task linked to person
    const content = uniqueTestName("Person task");
    const result = await client.createTask({
      content,
      linkedRecordId: person.recordId,
      linkedRecordObject: "people",
    });

    const task = await client.getTask(result.taskId);
    const linkedRecords = task.linked_records as Array<{
      target_record_id: string;
    }>;

    expect(linkedRecords).toBeDefined();
    expect(linkedRecords.length).toBeGreaterThan(0);
    expect(linkedRecords[0].target_record_id).toBe(person.recordId);
  });

  // Skip: Deal creation fails due to workspace-specific required field
  it.skip("creates task linked to deal", async () => {
    // Create deal first
    const dealName = uniqueTestName("Task Deal");
    const deal = await client.createDeal({ name: dealName });

    // Create task linked to deal
    const content = uniqueTestName("Deal task");
    const result = await client.createTask({
      content,
      linkedRecordId: deal.recordId,
      linkedRecordObject: "deals",
    });

    const task = await client.getTask(result.taskId);
    const linkedRecords = task.linked_records as Array<{
      target_record_id: string;
      target_object: string;
    }>;

    expect(linkedRecords).toBeDefined();
    expect(linkedRecords.length).toBeGreaterThan(0);
    expect(linkedRecords[0].target_record_id).toBe(deal.recordId);
    expect(linkedRecords[0].target_object).toBe("deals");
  });

  it("creates task with all fields", async () => {
    // Create company first
    const companyName = uniqueTestName("Full Task Company");
    const company = await client.createCompany({ name: companyName });

    // Create task with all fields
    const content = uniqueTestName("Full task");
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);
    const deadlineStr = deadline.toISOString().slice(0, -5) + "Z";

    const result = await client.createTask({
      content,
      deadline: deadlineStr,
      linkedRecordId: company.recordId,
      linkedRecordObject: "companies",
    });

    const task = await client.getTask(result.taskId);

    // Verify content (Attio returns as content_plaintext)
    expect(task.content_plaintext).toBe(`[TEST] ${content}`);

    // Verify deadline
    expect(task.deadline_at).toBeDefined();

    // Verify linked record
    const linkedRecords = task.linked_records as Array<{
      target_record_id: string;
    }>;
    expect(linkedRecords[0].target_record_id).toBe(company.recordId);

    // Verify not completed
    expect(task.is_completed).toBe(false);
  });

  it("task is created successfully", async () => {
    const content = uniqueTestName("Format task");
    const result = await client.createTask({ content });
    expect(result.taskId).toBeDefined();

    const task = await client.getTask(result.taskId);
    expect(task).toBeDefined();
    // Task was created successfully if we can retrieve it
    expect(task.id).toBeDefined();
  });
});
