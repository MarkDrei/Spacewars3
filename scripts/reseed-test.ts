#!/usr/bin/env tsx
/**
 * Reseed test database with updated seed data
 */
import { getDatabase } from '../src/lib/server/database.js';
import { seedDatabase } from '../src/lib/server/seedData.js';

async function reseed() {
  console.log('📦 Getting database connection...');
  const db = await getDatabase();
  
  console.log('🗑️  Truncating tables...');
  await db.query('TRUNCATE TABLE users CASCADE');
  await db.query('TRUNCATE TABLE space_objects CASCADE');
  
  console.log('🌱 Reseeding database with new positions...');
  await seedDatabase(db, true);
  
  console.log('✅ Database reseeded successfully');
  process.exit(0);
}

reseed().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
