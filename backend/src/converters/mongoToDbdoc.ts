// backend/src/converters/mongoToDbdoc.ts
export function mongoToDbdocSource(
  id: string,
  conn: string,
  db: string,
  coll: string,
  schema: any
) {
  return {
    id,
    kind: "mongodb",
    conn,
    db,
    collection: coll,
    fields: schema.fields,
  };
}
