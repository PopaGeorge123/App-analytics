#!/usr/bin/env node

/**
 * Quick Setup - Email Templates Migration
 * 
 * This script provides instructions for running the migration
 * since Supabase doesn't expose exec_sql via REST API.
 */

import fs from 'fs';
import { URL } from 'url';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  📧 EMAIL TEMPLATES MIGRATION SETUP                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('⚠️  Supabase REST API doesn\'t support running raw SQL.\n');

console.log('📝 Please follow these steps:\n');

console.log('OPTION 1: Supabase Dashboard (Easiest)');
console.log('─────────────────────────────────────────────────────────────');
console.log('1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
console.log('2. Click "New Query"');
console.log('3. Copy the contents of:');
console.log('   → supabase/migrations/033_email_templates_tracking.sql');
console.log('4. Paste into SQL Editor and click "Run"\n');

console.log('OPTION 2: Supabase CLI (Recommended for automation)');
console.log('─────────────────────────────────────────────────────────────');
console.log('1. Install Supabase CLI:');
console.log('   → macOS: brew install supabase/tap/supabase');
console.log('   → Windows: scoop install supabase');
console.log('2. Link your project:');
console.log('   → supabase link --project-ref YOUR_PROJECT_REF');
console.log('3. Push migrations:');
console.log('   → supabase db push\n');

console.log('OPTION 3: Direct PostgreSQL connection');
console.log('─────────────────────────────────────────────────────────────');
console.log('1. Get your database URL from Supabase Dashboard');
console.log('2. Run:');
console.log('   → psql YOUR_DATABASE_URL -f supabase/migrations/033_email_templates_tracking.sql\n');

const migrationPath = new URL('../supabase/migrations/033_email_templates_tracking.sql', import.meta.url).pathname;

try {
  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  const lineCount = migrationContent.split('\n').length;
  const tableCount = (migrationContent.match(/CREATE TABLE/g) || []).length;
  const functionCount = (migrationContent.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
  const triggerCount = (migrationContent.match(/CREATE TRIGGER/g) || []).length;
  const viewCount = (migrationContent.match(/CREATE OR REPLACE VIEW/g) || []).length;
  
  console.log('📊 Migration Summary:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   Lines: ${lineCount}`);
  console.log(`   Tables: ${tableCount}`);
  console.log(`   Views: ${viewCount}`);
  console.log(`   Functions: ${functionCount}`);
  console.log(`   Triggers: ${triggerCount}`);
  console.log(`   File: supabase/migrations/033_email_templates_tracking.sql\n`);
} catch (err) {
  console.error('❌ Could not read migration file:', err.message);
}

console.log('✅ After running the migration, execute:');
console.log('   → node scripts/run-email-migration.mjs');
console.log('   to insert the 10 email templates\n');

console.log('💡 Need help? Check: EMAIL_CAMPAIGN_GUIDE.md\n');
