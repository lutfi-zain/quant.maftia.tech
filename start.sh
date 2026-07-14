#!/bin/bash
# Kill existing processes on ports 8910, 8911, and legacy 5173 (proxy compatibility)
echo "🔧 Killing existing processes on ports 8910, 8911, 5173..."
kill $(lsof -t -i:8910) 2>/dev/null
kill $(lsof -t -i:8911) 2>/dev/null
kill $(lsof -t -i:5173) 2>/dev/null
sleep 1


# Start API backend on port 8910
echo "🚀 Starting API backend on port 8910..."
cd /home/ubuntu/projects/quant.maftia.tech
nohup /home/ubuntu/.bun/bin/bun run src/api/index.ts >/home/ubuntu/projects/quant.maftia.tech/api.log 2>&1 &
sleep 2

# Start Frontend dev server on port 8911
echo "🌐 Starting Frontend dev server on port 8911..."
cd /home/ubuntu/projects/quant.maftia.tech/web
nohup bun run dev >/home/ubuntu/projects/quant.maftia.tech/web.log 2>&1 &

# TCP forwarder: port 5173 -> 8911 (for Cloudflare proxy compatibility)
echo "🔁 Starting TCP forwarder 5173 -> 8911..."
nohup socat TCP-LISTEN:5173,fork,reuseaddr TCP:localhost:8911 >/dev/null 2>&1 &

sleep 3
echo ""
echo "✅ Done!"
echo "   API:      http://localhost:8910"
echo "   Frontend: http://localhost:8911"
echo "   Proxy:    5173 -> 8911 (for quant.membran.app)"
