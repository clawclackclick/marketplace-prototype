#!/bin/bash

# Launch test bots for marketplace simulation
# 3 sellers + 3 buyers, 1 hour runtime

set -e

echo "🧪 Marketplace Test Bot Launcher"
echo "================================"
echo ""

# Check if main bot is running
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ Main marketplace bot is not running!"
    echo "Start it first: npm start"
    exit 1
fi

echo "✅ Main bot is running"
echo ""

# Check for test bot tokens
if [ -z "$SELLER_BOT_A_TOKEN" ] || [ -z "$SELLER_BOT_B_TOKEN" ] || [ -z "$SELLER_BOT_C_TOKEN" ]; then
    echo "⚠️  Warning: Seller bot tokens not set"
    echo "Set these environment variables:"
    echo "  SELLER_BOT_A_TOKEN"
    echo "  SELLER_BOT_B_TOKEN"
    echo "  SELLER_BOT_C_TOKEN"
    echo ""
fi

if [ -z "$BUYER_BOT_X_TOKEN" ] || [ -z "$BUYER_BOT_Y_TOKEN" ] || [ -z "$BUYER_BOT_Z_TOKEN" ]; then
    echo "⚠️  Warning: Buyer bot tokens not set"
    echo "Set these environment variables:"
    echo "  BUYER_BOT_X_TOKEN"
    echo "  BUYER_BOT_Y_TOKEN"
    echo "  BUYER_BOT_Z_TOKEN"
    echo ""
fi

echo "🚀 Starting test bots..."
echo "   Sellers will post deals every 5 minutes"
echo "   Buyers will purchase deals every 5 minutes (+1min offset)"
echo "   Gap between seller and buyer start: 1 minute"
echo "   Runtime: 1 hour"
echo ""

# Start seller bots
echo "📦 Starting Seller Bots..."
node test-bots/seller-bots.js &
SELLER_PID=$!
echo "   Seller bots PID: $SELLER_PID"

# Wait 1 minute gap then start buyer bots
echo ""
echo "⏱️  Waiting 1 minute gap before starting buyer bots..."
sleep 60
echo ""
echo "💰 Starting Buyer Bots..."
node test-bots/buyer-bots.js &
BUYER_PID=$!
echo "   Buyer bots PID: $BUYER_PID"

echo ""
echo "================================"
echo "✅ All test bots launched!"
echo ""
echo "To stop: kill $SELLER_PID $BUYER_PID"
echo "Or run: ./stop-test-bots.sh"
echo ""

# Wait for user input
echo "Press Enter to stop test bots..."
read

kill $SELLER_PID $BUYER_PID 2>/dev/null || true
echo "🛑 Test bots stopped"