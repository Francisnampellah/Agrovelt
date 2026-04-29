#!/bin/bash

# Agrovelt Production-Ready Setup Script
# This script installs Docker and Docker Compose (if missing) and runs the project.

set -e

echo "🚀 Starting Agrovelt setup..."

# 1. Check if Docker is installed
if ! [ -x "$(command -v docker)" ]; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed."
else
    echo "✅ Docker is already installed."
fi

# 2. Check if Docker Compose is installed (v2)
if ! docker compose version >/dev/null 2>&1; then
    echo "📦 Installing Docker Compose..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installed."
else
    echo "✅ Docker Compose is already installed."
fi

# 3. Handle Environment Files
if [ ! -f .env ]; then
    echo "📝 .env file not found, creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        cat <<EOF > .env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@db:5432/mydb?schema=public"
JWT_SECRET="your_very_secret_key_change_me"
FIREBASE_PROJECT_ID="your-project-id"
EOF
    fi
    echo "⚠️ Please edit .env with your actual credentials later."
fi

# 4. Clean up any stale state (optional)
echo "🧹 Pre-flight cleanup..."
docker compose down --remove-orphans || true

# 5. Build and Run
echo "🏗️ Building and starting Agrovelt services..."
docker compose up --build -d

echo ""
echo "===================================================="
echo "✨ Agrovelt is running!"
echo "📍 API: http://localhost:3000"
echo "📖 Swagger: http://localhost:3000/api-docs"
echo "🛠️ Prisma Studio: http://localhost:5555"
echo "===================================================="
echo "Note: If this is your first time running, check logs with: docker compose logs -f app"
