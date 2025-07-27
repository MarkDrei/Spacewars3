// Script to generate schema.sql from schema.ts
import { CREATE_TABLES, SCHEMA_VERSION } from './src/schema';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const sqlContent = `-- Auto-generated schema file
-- Do not edit manually - edit src/schema.ts instead
-- Schema version: ${SCHEMA_VERSION}

${CREATE_TABLES.join('\n\n')}
`;

const sqlPath = join(__dirname, 'db', 'schema.sql');
const dbDir = dirname(sqlPath);

// Ensure the db directory exists
mkdirSync(dbDir, { recursive: true });

writeFileSync(sqlPath, sqlContent);
console.log('Generated schema.sql from schema.ts');
