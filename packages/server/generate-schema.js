// Script to generate schema.sql from schema.ts
const { CREATE_TABLES, SCHEMA_VERSION } = require('./dist/src/schema.js');
const { writeFileSync } = require('fs');
const { join } = require('path');

const sqlContent = `-- Auto-generated schema file
-- Do not edit manually - edit src/schema.ts instead
-- Schema version: ${SCHEMA_VERSION}

${CREATE_TABLES.join('\n\n')}
`;

const sqlPath = join(__dirname, 'db', 'schema.sql');
writeFileSync(sqlPath, sqlContent);
console.log('Generated schema.sql from schema.ts');
