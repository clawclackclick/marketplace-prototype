#!/bin/bash
cd /Users/apple/.openclaw/workspace/bot-marketplace
node marketplace-bot/index.js &
PID=$!
echo "Bot started with PID: $PID"
echo "Waiting 10 seconds..."
sleep 10
echo "Checking if still running..."
ps -p $PID > /dev/null && echo "Bot is still running (PID: $PID)" || echo "Bot has stopped!"
echo ""
echo "Press Ctrl+C to stop the bot completely"
wait $PID