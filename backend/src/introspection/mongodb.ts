// backend/src/introspection/mongodb.ts
/**
 * MongoDB Database Introspection
 * Infers schema from MongoDB collections by sampling documents
 */

import { MongoClient, Db } from 'mongodb';
import { DSLBuilder, TableSchema, ColumnSchema, mapMongoDBType } from './dsl-builder';

export interface MongoDBIntrospectionOptions {
    connectionString: string;
    sampleSize?: number;
    excludeCollections?: string[];
}

export async function introspectMongoDB(options: MongoDBIntrospectionOptions): Promise<string> {
    const client = new MongoClient(options.connectionString);
    const sampleSize = options.sampleSize || 100;
    const excludeCollections = options.excludeCollections || [];

    try {
        await client.connect();
        const db = client.db();
        const dbName = db.databaseName;

        const builder = new DSLBuilder(dbName, dbName, 'mongodb', 'public'); // MongoDB doesn't have schemas, using 'public' as placeholder

        const collections = await db.listCollections().toArray();

        for (const collectionInfo of collections) {
            const collectionName = collectionInfo.name;

            if (excludeCollections.includes(collectionName) || collectionName.startsWith('system.')) {
                continue;
            }

            const collection = db.collection(collectionName);

            // Sample documents to infer schema
            const samples = await collection.find().limit(sampleSize).toArray();

            if (samples.length === 0) {
                // Empty collection, add with no columns or generic id
                builder.addTable({
                    name: collectionName,
                    columns: [{ name: '_id', type: 'VARCHAR(24)', pk: true }]
                });
                continue;
            }

            // Infer columns from samples
            const columns = inferColumns(samples);

            builder.addTable({
                name: collectionName,
                columns: columns
            });
        }

        return builder.toYAML();

    } finally {
        await client.close();
    }
}

function inferColumns(samples: any[]): ColumnSchema[] {
    const fieldTypes: Record<string, Set<string>> = {};
    const fieldPresence: Record<string, number> = {};

    // Analyze samples
    for (const doc of samples) {
        flattenAndAnalyze(doc, '', fieldTypes, fieldPresence);
    }

    const columns: ColumnSchema[] = [];
    const totalSamples = samples.length;

    for (const [path, types] of Object.entries(fieldTypes)) {
        // Determine dominant type
        const type = determineDominantType(types);

        // Determine if nullable (not present in all docs or explicitly null)
        // Note: flattenAndAnalyze handles explicit nulls by adding 'null' to types
        // Here we check presence
        const count = fieldPresence[path] || 0;
        const isPresentInAll = count === totalSamples;
        const hasNullType = types.has('null');

        const isNullable = !isPresentInAll || hasNullType;

        const column: ColumnSchema = {
            name: path,
            type: mapMongoDBType(type)
        };

        if (path === '_id') {
            column.pk = true;
        } else if (!isNullable) {
            column.not_null = true;
        }

        columns.push(column);
    }

    return columns;
}

function flattenAndAnalyze(obj: any, prefix: string, fieldTypes: Record<string, Set<string>>, fieldPresence: Record<string, number>) {
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

        const value = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;

        // Update presence count
        fieldPresence[path] = (fieldPresence[path] || 0) + 1;

        // Determine type
        let type = 'string';
        if (value === null) {
            type = 'null';
        } else if (Array.isArray(value)) {
            type = 'array';
        } else if (value instanceof Date) {
            type = 'date';
        } else if (typeof value === 'object') {
            // Check for ObjectId (basic check)
            if (value._bsontype === 'ObjectID' || (value.toString && value.toString().match(/^[0-9a-fA-F]{24}$/))) {
                type = 'objectId';
            } else {
                type = 'object';
                // Recurse for nested objects? 
                // For relational DSL, we usually flatten or keep as JSON. 
                // Let's treat nested objects as JSON for now to keep DSL simple, 
                // unless we want to flatten. Let's stick to simple types + JSON for complex structures.
            }
        } else if (typeof value === 'number') {
            type = Number.isInteger(value) ? 'int' : 'double';
        } else if (typeof value === 'boolean') {
            type = 'bool';
        }

        if (!fieldTypes[path]) {
            fieldTypes[path] = new Set();
        }
        fieldTypes[path].add(type);
    }
}

function determineDominantType(types: Set<string>): string {
    if (types.has('objectId')) return 'objectId';
    if (types.has('array')) return 'array';
    if (types.has('object')) return 'object';
    if (types.has('string')) return 'string';
    if (types.has('double')) return 'double';
    if (types.has('int')) return 'int';
    if (types.has('date')) return 'date';
    if (types.has('bool')) return 'bool';

    // Fallback
    return 'string';
}
