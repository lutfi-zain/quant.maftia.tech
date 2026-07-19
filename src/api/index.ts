import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRouter } from "./routes/health.js";
import { dailyRouter } from "./routes/daily.js";
import { componentsRouter } from "./routes/components.js";
import { circuitBreakersRouter } from "./routes/circuit-breakers.js";
import { metricsRouter } from "./routes/metrics.js";
import { lttdRouter } from "./routes/lttd.js";
import { sdcaRouter } from "./routes/sdca.js";
import { auditRouter } from "./routes/audit.js";
import { startScheduler } from "./lib/scheduler.js";
import { configRouter } from "./routes/config.js";

// Start background cron scheduler
startScheduler();

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/api/v1/health", healthRouter);
app.route("/api/v1/analytics/daily", dailyRouter);
app.route("/api/v1/quant/daily", dailyRouter);
app.route("/api/v1/analytics/components", componentsRouter);
app.route("/api/v1/quant/components", componentsRouter);
app.route("/api/v1/analytics/metric", metricsRouter);
app.route("/api/v1/quant/metric", metricsRouter);
app.route("/api/v1/system/circuit-breakers", circuitBreakersRouter);
app.route("/api/v1/lttd", lttdRouter);
app.route("/api/v1/sdca", sdcaRouter);
app.route("/api/v1/audit", auditRouter);
app.route("/api/v1/config", configRouter);

import fs from "fs";
import path from "path";

app.get("/api/v1/backtest/sdca", async (c) => {
	try {
		const filePath = path.resolve(
			process.cwd(),
			"data/sdca_backtest.json",
		);
		if (!fs.existsSync(filePath)) {
			return c.json({ error: "Backtest data not found" }, 404);
		}
		const data = fs.readFileSync(filePath, "utf-8");
		return c.json(JSON.parse(data));
	} catch (err: any) {
		console.error("Error serving sdca backtest:", err);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

app.get("/", (c) => {
	return c.json({
		service:
			"Unified Quantitative & Statistical Bitcoin Intelligence API Gateway",
		status: "active",
		port: 8910,
		docs: "/api/v1/health",
	});
});

import { bunWebSocketHandlers } from "./websocket.js";

export default {
	port: 8910,
	hostname: "0.0.0.0",
	fetch(req: Request, server: any) {
		if (new URL(req.url).pathname.startsWith("/ws/")) {
			const id = `bun-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
			if (
				server.upgrade(req, {
					data: { id, topics: new Set(), lastPong: Date.now() },
				})
			) {
				return undefined;
			}
			return new Response("WebSocket upgrade failed", { status: 400 });
		}
		return app.fetch(req, server);
	},
	websocket: bunWebSocketHandlers,
};
