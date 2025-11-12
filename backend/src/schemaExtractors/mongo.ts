// backend/src/schemaExtractors/mongo.ts
import { MongoClient } from "mongodb";

/**
 * Extracts MongoDB schema by sampling a collection
 * and flattening document keys.
 */
export async function extractMongoSchema(
  connString: string,
  dbName: string,
  collection: string,
  sampleSize = 100
) {
  const client = new MongoClient(connString);
  await client.connect();
  const db = client.db(dbName);

  const docs = await db
    .collection(collection)
    .find({})
    .limit(sampleSize)
    .toArray();

  await client.close();

  const paths = new Set<string>();

  // Recursively flatten nested object fields
  function traverse(obj: any, prefix = "") {
    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.add(path);
      if (val && typeof val === "object" && !Array.isArray(val)) {
        traverse(val, path);
      }
    }
  }

  docs.forEach((doc) => traverse(doc));

  return {
    collection,
    fields: Array.from(paths).map((p) => ({ name: p })),
  };
}
