import { Hono } from "hono";
import { executeQuerySingle } from "../db.js";

export const healthRouter = new Hono();

healthRouter.get("/", (c) => {
	try {
		const maxRow = executeQuerySingle<{ max_date: string }>(
			"SELECT MAX(date) as max_date FROM unified_daily_analytics",
		);
		const countRow = executeQuerySingle<{ count: number }>(
			"SELECT COUNT(*) as count FROM unified_daily_analytics",
		);

		return c.json({
			status: "healthy",
			service: "api.quant.maftia.tech",
			port: 8910,
			database: {
				accessible: true,
				mode: "read-only WAL",
				latest_data_timestamp: maxRow?.max_date || null,
				total_records: countRow?.count || 0,
			},
			systems: [
				"quant-btc-valuation-system",
				"quant-btc-lttd-system",
				"quant-btc-mttd-system",
				"quant-lttd-ichimoku",
			],
			timestamp: new Date().toISOString(),
		});
	} catch (error: any) {
		return c.json(
			{
				status: "unhealthy",
				service: "api.quant.maftia.tech",
				port: 8910,
				database: {
					accessible: false,
					error: error.message,
				},
				timestamp: new Date().toISOString(),
			},
			503,
		);
	}
});
