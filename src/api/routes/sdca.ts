import { Hono } from "hono";
import { executeQuery } from "../db.js";

export const sdcaRouter = new Hono();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ─── POST /api/v1/sdca/signal ──────────────────────────────────────
sdcaRouter.post("/signal", async (c) => {
	try {
		const body = await c.req.json();
		const today = new Date().toISOString().split("T")[0];

		// Single date lookup
		if (body.date) {
			if (!dateRegex.test(body.date)) {
				return c.json(
					{ error: "Invalid date format. Expected YYYY-MM-DD." },
					400,
				);
			}
			if (body.date > today) {
				return c.json(
					{ error: "Cannot query future dates (CausalFilter)." },
					400,
				);
			}

			// Fetch pre-calculated data from SQLite
			const sql = `
				SELECT date, 
					sdca_multiplier as multiplier, 
					sdca_phase as phase, 
					sdca_action as action, 
					sdca_confidence as confidence,
					COALESCE(price_ma200_ratio, 1.0) as price_ma200_ratio,
					COALESCE(ath_drawdown, 0.0) as ath_drawdown
				FROM unified_daily_analytics 
				WHERE date = ?
			`;
			const rows = executeQuery(sql, [body.date]);
			if (rows.length === 0) {
				return c.json({ error: "No data found for the specified date." }, 404);
			}

			const lastSignal = {
				...rows[0],
				pricePercentile: (rows[0].price_ma200_ratio ?? 1.0) * 100.0,
				trendPositive: (rows[0].price_ma200_ratio ?? 1.0) >= 1.0,
			};
			return c.json(lastSignal);
		}

		// Date range query
		const startDate = body.start_date || "2010-01-01";
		const endDate = body.end_date || today;

		if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
			return c.json(
				{ error: "Invalid date format. Expected YYYY-MM-DD." },
				400,
			);
		}
		if (startDate > endDate) {
			return c.json({ error: "start_date must be <= end_date" }, 400);
		}
		if (endDate > today) {
			return c.json(
				{ error: "Cannot query future dates (CausalFilter)." },
				400,
			);
		}

		const sql = `
			SELECT date, 
				sdca_multiplier as multiplier, 
				sdca_phase as phase, 
				sdca_action as action, 
				sdca_confidence as confidence,
				COALESCE(price_ma200_ratio, 1.0) as price_ma200_ratio,
				COALESCE(ath_drawdown, 0.0) as ath_drawdown
			FROM unified_daily_analytics 
			WHERE date >= ? AND date <= ?
			ORDER BY date ASC
		`;
		const records = executeQuery(sql, [startDate, endDate]);
		if (records.length === 0) {
			return c.json([]);
		}

		const signals = records.map((r: any) => ({
			...r,
			pricePercentile: (r.price_ma200_ratio ?? 1.0) * 100.0,
			trendPositive: (r.price_ma200_ratio ?? 1.0) >= 1.0,
		}));
		return c.json(signals);
	} catch (err: any) {
		console.error("Error in POST /api/v1/sdca/signal:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});

// ─── POST /api/v1/sdca/backtest ─────────────────────────────────────
sdcaRouter.post("/backtest", async (c) => {
	try {
		const body = await c.req.json();
		const today = new Date().toISOString().split("T")[0];

		const startDate = body.start_date || "2010-01-01";
		const endDate = body.end_date || today;

		if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
			return c.json(
				{ error: "Invalid date format. Expected YYYY-MM-DD." },
				400,
			);
		}
		if (startDate > endDate) {
			return c.json({ error: "start_date must be <= end_date" }, 400);
		}
		if (endDate > today) {
			return c.json(
				{ error: "Cannot query future dates (CausalFilter)." },
				400,
			);
		}

		// Since FE must act purely as a dumb view for the ledger, and Python calculates the ledger
		// We fetch the basic signal trace and mock the rest (the UI is meant to slice this)
		// Or we can return just the ledger array from `unified_daily_analytics` directly here
		const sql = `
			SELECT date, 
				sdca_multiplier as multiplier, 
				sdca_phase as phase, 
				sdca_action as action, 
				sdca_confidence as confidence,
				btc_price as close,
				valuation_composite,
				COALESCE(price_ma200_ratio, 1.0) as price_ma200_ratio,
				COALESCE(ath_drawdown, 0.0) as ath_drawdown
			FROM unified_daily_analytics 
			WHERE date >= ? AND date <= ?
			ORDER BY date ASC
		`;
		const records = executeQuery(sql, [startDate, endDate]);

		// Map it so the frontend gets the array of records to slice
		return c.json({
			signals: records.map((r: any) => ({
				date: r.date,
				multiplier: r.multiplier,
				phase: r.phase,
				action: r.action,
				confidence: r.confidence,
				pricePercentile: (r.price_ma200_ratio ?? 1.0) * 100.0,
				trendPositive: (r.price_ma200_ratio ?? 1.0) >= 1.0,
				price_ma200_ratio: r.price_ma200_ratio,
				ath_drawdown: r.ath_drawdown,
			})),
			records: records.map((r: any) => ({
				date: r.date,
				close: r.close,
				valuation_composite: r.valuation_composite,
			})),
		});
	} catch (err: any) {
		console.error("Error in POST /api/v1/sdca/backtest:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});
