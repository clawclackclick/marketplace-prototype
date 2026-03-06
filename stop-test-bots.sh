#!/bin/bash

# Stop all test bots

echo "🛑 Stopping test bots..."

# Find and kill seller/buyer bot processes
pkill -f "seller-bots.js" 2>/dev/null && echo "   Seller bots stopped" || echo "   No seller bots running"
pkill -f "buyer-bots.js" 2>/dev/null && echo "   Buyer bots stopped" || echo "   No buyer bots running"

echo "✅ Done"