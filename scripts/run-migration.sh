#!/bin/bash

# Email Templates Migration Runner
# Runs the SQL migration through Supabase CLI or psql

echo "🚀 Running Email Templates Migration..."
echo ""

# Check if Supabase CLI is installed
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI found"
    echo "📝 Running migration..."
    supabase db push
    echo ""
    echo "✅ Migration completed!"
    echo ""
    echo "Now run: node scripts/run-email-migration.mjs"
    echo "to insert the 10 email templates"
else
    echo "⚠️  Supabase CLI not found"
    echo ""
    echo "Please run the migration manually:"
    echo "1. Go to Supabase Dashboard → SQL Editor"
    echo "2. Copy contents of: supabase/migrations/033_email_templates_tracking.sql"
    echo "3. Execute the SQL"
    echo ""
    echo "Then run: node scripts/run-email-migration.mjs"
    echo "to insert the 10 email templates"
fi
