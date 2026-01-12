/**
 * Notes resource tests.
 * Tests Attio note creation with all field combinations.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { AttioTestClient, uniqueTestName } from "../helpers/attio-test-client";

describe("Notes resource", () => {
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

  it("creates note on company", async () => {
    // Create company first
    const companyName = uniqueTestName("Note Company");
    const company = await client.createCompany({ name: companyName });

    // Create note on company
    const title = uniqueTestName("Company Note");
    const content = "Test note content for company";
    const result = await client.createNote({
      parentObject: "companies",
      parentRecordId: company.recordId,
      title,
      content,
    });

    expect(result.noteId).toBeDefined();

    const note = await client.getNote(result.noteId);
    expect(note.title).toBe(`[TEST] ${title}`);
    expect(note.parent_object).toBe("companies");
    expect(note.parent_record_id).toBe(company.recordId);
  });

  it("creates note on person", async () => {
    // Create person first
    const personName = uniqueTestName("Note Person");
    const person = await client.createPerson({ name: personName });

    // Create note on person
    const title = uniqueTestName("Person Note");
    const content = "Note on person";
    const result = await client.createNote({
      parentObject: "people",
      parentRecordId: person.recordId,
      title,
      content,
    });

    const note = await client.getNote(result.noteId);
    expect(note.title).toBe(`[TEST] ${title}`);
    expect(note.parent_object).toBe("people");
    expect(note.parent_record_id).toBe(person.recordId);
  });

  // Skip: Deal creation fails due to workspace-specific required field
  it.skip("creates note on deal", async () => {
    // Create deal first
    const dealName = uniqueTestName("Note Deal");
    const deal = await client.createDeal({ name: dealName });

    // Create note on deal
    const title = uniqueTestName("Deal Note");
    const content = "Note on deal";
    const result = await client.createNote({
      parentObject: "deals",
      parentRecordId: deal.recordId,
      title,
      content,
    });

    const note = await client.getNote(result.noteId);
    expect(note.title).toBe(`[TEST] ${title}`);
    expect(note.parent_object).toBe("deals");
  });

  it("creates note with markdown content", async () => {
    // Create company first
    const companyName = uniqueTestName("Markdown Company");
    const company = await client.createCompany({ name: companyName });

    // Create note with markdown
    const title = uniqueTestName("Markdown Note");
    const content = `# Meeting Notes

## Attendees
- Alice
- Bob`;

    const result = await client.createNote({
      parentObject: "companies",
      parentRecordId: company.recordId,
      title,
      content,
    });

    expect(result.noteId).toBeDefined();

    const note = await client.getNote(result.noteId);
    expect(note).toBeDefined();
  });

  it("creates note with long content", async () => {
    // Create company first
    const companyName = uniqueTestName("Long Note Company");
    const company = await client.createCompany({ name: companyName });

    // Create note with long content
    const title = uniqueTestName("Long Note");
    const content = Array(100).fill("This is a line of test content for the note. ").join("\n");

    const result = await client.createNote({
      parentObject: "companies",
      parentRecordId: company.recordId,
      title,
      content,
    });

    const note = await client.getNote(result.noteId);
    expect(note.title).toBe(`[TEST] ${title}`);
    // Content should be stored (may be truncated in response)
    expect(note.content_plaintext).toContain("test content");
  });

  it("creates multiple notes on same record", async () => {
    // Create company first
    const companyName = uniqueTestName("Multi Note Company");
    const company = await client.createCompany({ name: companyName });

    // Create first note
    const title1 = uniqueTestName("First Note");
    const result1 = await client.createNote({
      parentObject: "companies",
      parentRecordId: company.recordId,
      title: title1,
      content: "First note content",
    });

    // Create second note
    const title2 = uniqueTestName("Second Note");
    const result2 = await client.createNote({
      parentObject: "companies",
      parentRecordId: company.recordId,
      title: title2,
      content: "Second note content",
    });

    // Both notes should exist and be different
    expect(result1.noteId).not.toBe(result2.noteId);

    const note1 = await client.getNote(result1.noteId);
    const note2 = await client.getNote(result2.noteId);

    expect(note1.title).toBe(`[TEST] ${title1}`);
    expect(note2.title).toBe(`[TEST] ${title2}`);
    expect(note1.parent_record_id).toBe(company.recordId);
    expect(note2.parent_record_id).toBe(company.recordId);
  });
});
