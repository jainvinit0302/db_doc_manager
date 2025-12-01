import { introspectPostgreSQL } from '../introspection/postgres';
import { introspectMongoDB } from '../introspection/mongodb';
import { Client } from 'pg';
import { MongoClient } from 'mongodb';

// Mock pg
jest.mock('pg', () => {
    const mClient = {
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn(),
    };
    return { Client: jest.fn(() => mClient) };
});

// Mock mongodb
jest.mock('mongodb', () => {
    const mCollection = {
        find: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: jest.fn()
    };
    const mDb = {
        databaseName: 'testdb',
        listCollections: jest.fn().mockReturnThis(),
        toArray: jest.fn(),
        collection: jest.fn(() => mCollection)
    };
    const mClient = {
        connect: jest.fn(),
        db: jest.fn(() => mDb),
        close: jest.fn()
    };
    return { MongoClient: jest.fn(() => mClient) };
});

describe('Database Introspection', () => {

    describe('PostgreSQL', () => {
        let client: any;

        beforeEach(() => {
            // Reset mocks
            jest.clearAllMocks();
            client = new Client();
        });

        it('should introspect postgres database and generate DSL', async () => {
            // Mock query results
            (client.query as jest.Mock)
                .mockResolvedValueOnce({ rows: [{ table_name: 'users' }] }) // getTables
                .mockResolvedValueOnce({
                    rows: [ // getColumns
                        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
                        { column_name: 'email', data_type: 'text', is_nullable: 'NO' }
                    ]
                })
                .mockResolvedValueOnce({ rows: [{ column_name: 'id' }] }) // getPrimaryKeys
                .mockResolvedValueOnce({ rows: [] }) // getForeignKeys
                .mockResolvedValueOnce({ rows: [] }); // getUniqueConstraints

            const dsl = await introspectPostgreSQL({ connectionString: 'postgres://localhost/mydb' });

            expect(dsl).toContain('project: mydb');
            expect(dsl).toContain('engine: postgres');
            expect(dsl).toContain('name: users');
            expect(dsl).toContain('name: id');
            expect(dsl).toContain('type: INTEGER');
            expect(dsl).toContain('pk: true');
            expect(dsl).toContain('name: email');
            expect(dsl).toContain('type: TEXT');
        });
    });

    describe('MongoDB', () => {
        let client: any;
        let db: any;
        let collection: any;

        beforeEach(() => {
            jest.clearAllMocks();
            // Get mock instances
            client = new MongoClient('mongodb://localhost');
            db = client.db();
            collection = db.collection('users');
        });

        it('should introspect mongodb database and generate DSL', async () => {
            // Mock listCollections
            (db.listCollections().toArray as jest.Mock).mockResolvedValue([
                { name: 'users' }
            ]);

            // Mock samples
            (collection.find().limit().toArray as jest.Mock).mockResolvedValue([
                { _id: '123', name: 'Alice', age: 30 },
                { _id: '456', name: 'Bob', age: 25 }
            ]);

            const dsl = await introspectMongoDB({ connectionString: 'mongodb://localhost/testdb' });

            expect(dsl).toContain('project: testdb');
            expect(dsl).toContain('engine: mongodb');
            expect(dsl).toContain('name: users');
            expect(dsl).toContain('name: _id');
            expect(dsl).toContain('type: VARCHAR(255)'); // _id is string in sample
            expect(dsl).toContain('pk: true');
            expect(dsl).toContain('name: name');
            expect(dsl).toContain('type: VARCHAR(255)');
            expect(dsl).toContain('name: age');
            expect(dsl).toContain('type: INTEGER');
        });
    });
});
