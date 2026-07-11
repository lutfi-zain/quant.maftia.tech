#!/bin/bash
# Kill existing processes on ports 8765 and 5173
echo "🔧 Killing existing processes on ports 8765 and 5173..."
kill $(lsof -t -i:8765) 2>/dev/null
kill $(lsof -t -i:5173) 2>/dev/null
sleep 1

# Run Python pipeline
echo "📊 Running Python pipeline..."
cd /home/ubuntu/projects/quant.maftia.tech
python3 run_report_pipeline.py 2>&1 | tail -3

# Start API backend on port 8765
echo "🚀 Starting API backend on port 8765..."
nohup /home/ubuntu/.bun/bin/bun run src/api/index.ts >/home/ubuntu/projects/quant.maftia.tech/api.log 2>&1 &
sleep 2

# Start Frontend dev server on port 5173
echo "🌐 Starting Frontend dev server on port 5173..."
cd /home/ubuntu/projects/quant.maftia.tech/web
nohup bun run dev >/home/ubuntu/projects/quant.maftia.tech/web.log 2>&1 &

sleep 3
echo ""
echo "✅ Done!"
echo "   API:      http://localhost:8765"
echo "   Frontend: http://localhost:5173"
