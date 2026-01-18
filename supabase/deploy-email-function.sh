#!/bin/bash

# Deploy Email Function to Supabase
# Run this script from the project root directory

echo "🚀 Deploying Synathrozo Email Function..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "📝 Please log in to Supabase..."
    supabase login
fi

# Get project ref from config.js
PROJECT_URL=$(grep "SUPABASE_URL" js/config.js | grep -o "https://[^'\"]*" | head -1)
PROJECT_REF=$(echo "$PROJECT_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Could not find project URL in js/config.js"
    exit 1
fi

echo "📌 Project: $PROJECT_REF"

# Link project if not already linked
supabase link --project-ref "$PROJECT_REF" 2>/dev/null || true

# Set secrets from .env.local
if [ -f "supabase/.env.local" ]; then
    echo "🔐 Setting secrets..."
    source supabase/.env.local
    supabase secrets set RESEND_API_KEY="$RESEND_API_KEY"
    supabase secrets set FROM_EMAIL="$FROM_EMAIL"
else
    echo "⚠️  No supabase/.env.local found. Creating with defaults..."
    echo "RESEND_API_KEY=your_resend_api_key_here" > supabase/.env.local
    echo "FROM_EMAIL=Synathrozo <onboarding@resend.dev>" >> supabase/.env.local
    echo "Please edit supabase/.env.local with your Resend API key and run again."
    exit 1
fi

# Deploy the function
echo "📦 Deploying function..."
supabase functions deploy send-invitation-email --no-verify-jwt

echo ""
echo "✅ Done! Email function deployed."
echo ""
echo "Test it by:"
echo "1. Go to Manage Invitations for any event"
echo "2. Add a guest with an email address"
echo "3. Click the ✉️ button to send an email"
