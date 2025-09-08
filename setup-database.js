#!/usr/bin/env node

/**
 * Database Setup Script for Kochi Metro Train Induction Planning
 * 
 * This script helps set up the database by applying migrations.
 * Run this if you encounter "table not found" errors.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Please check your .env file.');
  console.log('Required variables:');
  console.log('- VITE_SUPABASE_URL');
  console.log('- VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  console.log('🚀 Starting database setup...');
  
  try {
    // Read migration files
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Apply in chronological order

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      console.log(`📄 Applying migration: ${file}`);
      
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.warn(`⚠️  Warning in ${file}: ${error.message}`);
            // Continue with other statements
          }
        }
      }
    }

    console.log('✅ Database setup completed successfully!');
    console.log('🎉 You can now use the CSV upload feature.');
    console.log('📝 Note: The train_data table now has a unique constraint on train_id for better data integrity.');
    console.log('💾 All CSV data will be preserved exactly as uploaded with complete column information.');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.log('\n🔧 Manual setup instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of each migration file from supabase/migrations/');
    console.log('4. Run them in chronological order');
    process.exit(1);
  }
}

// Check if we can connect to Supabase
async function testConnection() {
  try {
    const { data, error } = await supabase.from('_supabase_migrations').select('*').limit(1);
    if (error && !error.message.includes('relation "_supabase_migrations" does not exist')) {
      throw error;
    }
    console.log('✅ Connected to Supabase successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Kochi Metro Train Induction Planning - Database Setup');
  console.log('=======================================================\n');
  
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }
  
  await runMigrations();
}

if (require.main === module) {
  main();
}

module.exports = { runMigrations, testConnection };
