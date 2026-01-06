import { config } from "dotenv";
config({ override: true });

import { fetchFullSchema } from "../src/workflows/attio.schema";
import type { AttributeDefinition } from "../src/services/attio/schema-types";

async function main() {
  console.log("Fetching Attio schema...\n");

  try {
    const schema = await fetchFullSchema();

    console.log("=== OBJECTS ===\n");
    for (const obj of schema.objects) {
      console.log(`${obj.singularNoun} (${obj.apiSlug})`);
      console.log(`  Attributes: ${obj.attributes.length}`);

      const writableAttrs = obj.attributes.filter(
        (a: AttributeDefinition) => a.isWritable && !a.isArchived
      );
      console.log(`  Writable: ${writableAttrs.length}`);

      const requiredAttrs = obj.attributes.filter((a: AttributeDefinition) => a.isRequired);
      if (requiredAttrs.length > 0) {
        console.log(
          `  Required: ${requiredAttrs.map((a: AttributeDefinition) => a.apiSlug).join(", ")}`
        );
      }

      console.log(
        `  Sample fields: ${writableAttrs
          .slice(0, 5)
          .map((a: AttributeDefinition) => `${a.apiSlug}(${a.type})`)
          .join(", ")}`
      );
      console.log();
    }

    console.log("=== LISTS ===\n");
    for (const list of schema.lists) {
      console.log(`${list.name} (${list.apiSlug})`);
      console.log(`  Parent: ${list.parentObject}`);
      console.log(`  List Attributes: ${list.attributes.length}`);
      if (list.attributes.length > 0) {
        console.log(
          `  Fields: ${list.attributes.map((a: AttributeDefinition) => a.apiSlug).join(", ")}`
        );
      }
      console.log();
    }

    console.log("=== WORKSPACE MEMBERS ===\n");
    for (const member of schema.workspaceMembers) {
      console.log(
        `${member.firstName} ${member.lastName} (${member.email}) - ${member.accessLevel}`
      );
    }
    console.log();

    console.log("=== SUMMARY ===");
    console.log(`Objects: ${schema.objects.length}`);
    console.log(`Lists: ${schema.lists.length}`);
    console.log(`Members: ${schema.workspaceMembers.length}`);
    console.log(`Fetched at: ${new Date(schema.lastFetched).toISOString()}`);

    // Save to file for reference
    const fs = await import("fs");
    fs.writeFileSync("schema-dump.json", JSON.stringify(schema, null, 2));
    console.log("\nFull schema saved to schema-dump.json");
  } catch (error) {
    console.error("Failed to fetch schema:", error);
    process.exit(1);
  }
}

main();
