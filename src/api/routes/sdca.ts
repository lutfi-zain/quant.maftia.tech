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
		const body = await c.req.json().catch(() => ({}));
		const today = new Date().toISOString().split("T")[0];

		let startDate = body.start_date || "2010-01-01";
		let endDate = body.end_date || today;

		if (!dateRegex.test(startDate)) startDate = "2010-01-01";
		if (!dateRegex.test(endDate)) endDate = today;

		if (endDate > today) endDate = today;
		if (startDate > endDate) startDate = endDate;

		const sql = `
			SELECT date, 
				btc_price as close,
				valuation_composite,
				COALESCE(lttd_regime, 'SIDEWAYS') as lttd_regime,
				COALESCE(lttd_prob_bull, 0.0) as lttd_prob_bull,
				COALESCE(lttd_prob_sideways, 0.0) as lttd_prob_sideways,
				COALESCE(lttd_exposure, 0.0) as lttd_target_exposure,
				COALESCE(mttd_imo, 0.0) as mttd_imo,
				COALESCE(mttd_position, 0.0) as mttd_position,
				COALESCE(mttd_er, 0.0) as mttd_er,
				COALESCE(mttd_entropy, 2.0) as mttd_entropy,
				COALESCE(ichimoku_imo, 0.0) as ichimoku_imo,
				COALESCE(ichimoku_position, 0.0) as ichimoku_position,
				COALESCE(price_ma200_ratio, 1.0) as price_ma200_ratio,
				COALESCE(ath_drawdown, 0.0) as ath_drawdown
			FROM unified_daily_analytics 
			WHERE date >= ? AND date <= ? AND btc_price IS NOT NULL AND valuation_composite IS NOT NULL
			ORDER BY date ASC
		`;
		const records = executeQuery(sql, [startDate, endDate]);

		// Import computeSdcaBacktest dynamically
		const { computeSdcaBacktest } = await import("../../lib/sdcaBacktest.js");
		const result = computeSdcaBacktest(records, {
			start_date: startDate,
			end_date: endDate,
			fee_bps: body.fee_bps,
			base_dca_amount: body.base_dca_amount,
			dca_cash_pct: body.dca_cash_pct,
			initial_cash: body.initial_cash,
			thresholds: body.thresholds,
		});

		return c.json(result);
	} catch (err: any) {
		console.error("Error in POST /api/v1/sdca/backtest:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});
