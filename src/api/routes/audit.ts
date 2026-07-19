import { Hono } from "hono";
import { executeQuery } from "../db.js";

export const auditRouter = new Hono();

interface PriceDivergence {
	date: string;
	btc_price: number | null;
	master_close: number | null;
	difference: number;
}

// ─── GET /api/v1/audit/price-comparison ─────────────────────────────
auditRouter.get("/price-comparison", (c) => {
	try {
		const thresholdParam = c.req.query("threshold");
		const threshold = parseFloat(thresholdParam || "1.0");
		const today = new Date().toISOString().split("T")[0];

		if (isNaN(threshold) || threshold < 0) {
			return c.json(
				{ error: "Invalid threshold. Must be a non-negative number." },
				400,
			);
		}

		// Query divergent records (CausalFilter: date <= today)
		const sql = `
			SELECT
				u.date,
				u.btc_price,
				m.close as master_close,
				ABS(COALESCE(u.btc_price, 0) - COALESCE(m.close, 0)) as difference
			FROM unified_daily_analytics u
			LEFT JOIN master_ohlcv m ON u.date = m.date
			WHERE u.date <= ?
			  AND m.close IS NOT NULL
			  AND u.btc_price IS NOT NULL
			  AND ABS(u.btc_price - m.close) > ?
			ORDER BY u.date ASC
		`;

		const divergences = executeQuery<PriceDivergence>(sql, [today, threshold]);

		if (divergences.length === 0) {
			return c.json({
				status: "clean",
				count: 0,
				threshold,
				data: [],
			});
		}

		return c.json({
			status: "divergent",
			count: divergences.length,
			threshold,
			data: divergences,
		});
	} catch (err: any) {
		console.error("Error in GET /api/v1/audit/price-comparison:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});
