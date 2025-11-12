#!/bin/bash
# Deploy all Supabase Edge Functions

set -e  # Exit on error

echo "🚀 Deploying Olive Edge Functions..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Install with: brew install supabase/tap/supabase"
    echo "Or: npm install -g supabase"
    exit 1
fi

# Determine the correct directory
# Check if we're in supabase/ directory (has functions/ and .supabase/)
if [ -d "functions" ] && [ -f ".supabase/config.toml" ]; then
    # We're in supabase/ directory, move to parent
    cd ..
    echo "📁 Changed to project root: $(pwd)"
fi

# Verify we're in the right place now
if [ ! -d "supabase/functions" ]; then
    echo "❌ Cannot find supabase/functions/"
    echo "Current directory: $(pwd)"
    echo "Please run this script from the project root (olive-expo/) or supabase/ directory"
    exit 1
fi

# Note: Supabase CLI will check if project is linked
echo "ℹ️  Make sure project is linked: supabase link --project-ref <ref>"
echo ""

echo "📦 Deploying chat-stream..."
supabase functions deploy chat-stream

echo ""
echo "📦 Deploying summarize..."
supabase functions deploy summarize

echo ""
echo "📦 Deploying gate..."
supabase functions deploy gate

echo ""
echo "✅ All functions deployed successfully!"
echo ""
echo "⚙️  Don't forget to set your secrets:"
echo "   supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx"
echo "   supabase secrets set OPENAI_CHAT_MODEL=gpt-5-nano"
echo ""
echo "🔍 View logs:"
echo "   supabase functions logs chat-stream --tail"
echo ""
echo "📋 List functions:"
echo "   supabase functions list"

