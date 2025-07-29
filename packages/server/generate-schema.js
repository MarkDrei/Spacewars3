// Script to generate schema.sql from schema.ts
import { CREATE_TABLES, SCHEMA_VERSION } from './dist/src/schema.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sqlContent = `-- Auto-generated schema file
-- Do not edit manually - edit src/schema.ts instead
-- Schema version: ${SCHEMA_VERSION}

${CREATE_TABLES.join('\n\n')}
`;

const sqlPath = join(__dirname, 'db', 'schema.sql');
writeFileSync(sqlPath, sqlContent);
console.log('Generated schema.sql from schema.ts');
