#!/bin/bash
# Kill existing processes on ports 8910 and 8911
echo "🔧 Killing existing processes on ports 8910 and 8911..."
kill $(lsof -t -i:8910) 2>/dev/null
kill $(lsof -t -i:8911) 2>/dev/null
sleep 1

# Run Python pipeline
echo "📊 Running Python pipeline..."
cd /home/ubuntu/projects/quant.maftia.tech
python3 run_report_pipeline.py 2>&1 | tail -3

# Start API backend on port 8910
echo "🚀 Starting API backend on port 8910..."
nohup /home/ubuntu/.bun/bin/bun run src/api/index.ts >/home/ubuntu/projects/quant.maftia.tech/api.log 2>&1 &
sleep 2

# Start Frontend dev server on port 8911
echo "🌐 Starting Frontend dev server on port 8911..."
cd /home/ubuntu/projects/quant.maftia.tech/web
nohup bun run dev >/home/ubuntu/projects/quant.maftia.tech/web.log 2>&1 &

sleep 3
echo ""
echo "✅ Done!"
echo "   API:      http://localhost:8910"
echo "   Frontend: http://localhost:8911"
