#!/bin/bash

echo "🚀 Starting DigiLocker Demo..."
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "🔧 Starting services..."

# Start backend in background
echo "🌐 Starting backend server (port 3007)..."
npm run start:sandbox &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "⚛️  Starting React frontend (port 3000)..."
cd frontend && npm start &
FRONTEND_PID=$!

echo ""
echo "✅ DigiLocker Demo is starting..."
echo ""
echo "📍 Backend:  http://localhost:3007"
echo "📍 Frontend: http://localhost:3000"
echo "📍 API Docs: http://localhost:3007/docs"
echo ""
echo "⏹️  To stop: Press Ctrl+C"
echo ""

# Wait for user to stop
wait 