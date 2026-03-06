#!/bin/bash

# Start the marketplace bot with PostgreSQL
# Usage: ./start.sh [docker|local]

set -e

MODE=${1:-docker}

if [ "$MODE" = "docker" ]; then
    echo "🐳 Starting PostgreSQL in Docker..."
    docker-compose up -d
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 3
    
    # Wait for database to be ready
    until docker exec marketplace-db pg_isready -U marketplace > /dev/null 2>&1; do
        echo "   Waiting for database..."
        sleep 1
    done
    
    echo "✅ PostgreSQL is ready!"
fi

echo "🤖 Starting Marketplace Bot..."
node marketplace-bot/index.js