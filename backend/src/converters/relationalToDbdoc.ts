// backend/src/converters/relationalToDbdoc.ts

export interface ColumnDef {
  name: string;
  type: string;
  not_null?: boolean;
}

export interface TableDef {
  name: string;
  schema: string;
  columns: ColumnDef[];
}

export interface RelationalSchemaDump {
  [key: string]: TableDef;
}

export interface DbDocTarget {
  db: string;
  engine: string;
  schema: string;
  tables: Array<{
    name: string;
    columns: ColumnDef[];
  }>;
}

export function relationalToDbdoc(
  db: string,
  engine: string,
  schemaDump: RelationalSchemaDump
): DbDocTarget {
  const tables = Object.values(schemaDump).map((tbl) => ({
    name: tbl.name,
    columns: tbl.columns.map((c) => ({
      name: c.name,
      type: c.type?.toUpperCase() || "UNKNOWN",
      not_null: !!c.not_null,
    })),
  }));

  // ✅ Use `as` cast safely after null check
  const first = Object.values(schemaDump)[0] as TableDef | undefined;
  const schemaName = first?.schema || "public";

  return {
    db,
    engine,
    schema: schemaName,
    tables,
  };
}
