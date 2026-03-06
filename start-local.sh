#!/bin/bash

# Start the marketplace bot locally (Mac Mini)
# Usage: ./start-local.sh

set -e

echo "🚀 Starting Marketplace Bot (Local Mode)..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and fill in your credentials."
    exit 1
fi

# Start PostgreSQL if not running
if ! docker ps | grep -q marketplace-db; then
    echo "🐳 Starting PostgreSQL..."
    docker-compose up -d postgres
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    until docker exec marketplace-db pg_isready -U marketplace > /dev/null 2>&1; do
        sleep 1
    done
    echo "✅ PostgreSQL is ready!"
else
    echo "✅ PostgreSQL is already running"
fi

echo ""
echo "🤖 Starting Marketplace Bot..."
echo "   Health check: http://localhost:3001/health"
echo ""

# Run the bot directly (not in Docker) for local development
node marketplace-bot/index.js