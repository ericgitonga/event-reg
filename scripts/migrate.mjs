import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const schemaPath = fileURLToPath(new URL("../db/schema.sql", import.meta.url));
const schema = readFileSync(schemaPath, "utf-8");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await client.executeMultiple(schema);
console.log("Schema applied.");
client.close();
