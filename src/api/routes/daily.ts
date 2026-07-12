import { Hono } from "hono";
import { executeQuery } from "../db.js";

export const dailyRouter = new Hono();

dailyRouter.get("/", (c) => {
	const query = c.req.query();
	const today = new Date().toISOString().split("T")[0];

	// Enforce strict t-1 CausalFilter: no query can return dates in the future beyond today
	let effectiveEndDate = today;
	if (query.end_date) {
		effectiveEndDate = query.end_date > today ? today : query.end_date;
	}

	const effectiveStartDate = query.start_date || "2010-01-01";
	let limit = parseInt(query.limit || "500", 10);
	if (isNaN(limit) || limit <= 0) limit = 500;
	if (limit > 5000) limit = 5000;

	const sql = `
    SELECT 
      u.date,
      m.open, m.high, m.low, m.close, m.volume,
      u.btc_price,
      u.valuation_composite,
      u.lttd_regime, u.lttd_score, u.lttd_prob_bull, u.lttd_prob_bear, u.lttd_prob_sideways,
      u.mttd_imo, u.mttd_er, u.mttd_entropy, u.mttd_position, u.mttd_immunity_active,
      u.ichimoku_imo, u.ichimoku_regime, u.ichimoku_position,
      u.ichi_s_tk, u.ichi_s_cloud, u.ichi_s_future, u.ichi_s_chikou,
      u.ichi_tenkan, u.ichi_kijun, u.ichi_senkou_a, u.ichi_senkou_b, u.ichi_chikou,
      u.ichi_entropy, u.ichi_er, u.ichi_imo_std
    FROM unified_daily_analytics u
    LEFT JOIN master_ohlcv m ON u.date = m.date
    WHERE u.date >= ? AND u.date <= ?
    ORDER BY u.date DESC
    LIMIT ?
  `;

	const rows = executeQuery(sql, [effectiveStartDate, effectiveEndDate, limit]);

	const data = rows.map((row: any) => ({
		date: row.date,
		master_ohlcv: {
			open: row.open ?? row.btc_price,
			high: row.high ?? row.btc_price,
			low: row.low ?? row.btc_price,
			close: row.close ?? row.btc_price,
			volume: row.volume ?? 0,
		},
		valuation_composite: {
			score: row.valuation_composite,
			bubble_warning: (row.valuation_composite ?? 0) >= 1.5,
			deep_discount_override: (row.valuation_composite ?? 0) <= -1.0,
		},
		lttd_regime: {
			regime: row.lttd_regime,
			score: row.lttd_score,
			prob_bull: row.lttd_prob_bull,
			prob_bear: row.lttd_prob_bear,
			prob_sideways: row.lttd_prob_sideways,
			sideways_zero_exposure_lock:
				row.lttd_regime === "SIDEWAYS" && (row.lttd_prob_sideways ?? 0) > 0.6,
		},
		mttd_imo: {
			oscillator: row.mttd_imo,
			efficiency_ratio: row.mttd_er,
			shannon_entropy: row.mttd_entropy,
			position: row.mttd_position,
			immunity_active: Boolean(row.mttd_immunity_active),
		},
		ichimoku_imo: {
			oscillator: row.ichimoku_imo,
			regime: row.ichimoku_regime,
			position: row.ichimoku_position,
			s_tk: row.ichi_s_tk ?? null,
			s_cloud: row.ichi_s_cloud ?? null,
			s_future: row.ichi_s_future ?? null,
			s_chikou: row.ichi_s_chikou ?? null,
			tenkan: row.ichi_tenkan ?? null,
			kijun: row.ichi_kijun ?? null,
			senkou_a: row.ichi_senkou_a ?? null,
			senkou_b: row.ichi_senkou_b ?? null,
			chikou: row.ichi_chikou ?? null,
			entropy: row.ichi_entropy ?? null,
			er: row.ichi_er ?? null,
			imo_std: row.ichi_imo_std ?? null,
		},
	}));

	return c.json({
		status: "success",
		causal_filter: {
			applied: true,
			max_allowed_date: today,
			requested_end_date: query.end_date || null,
			effective_end_date: effectiveEndDate,
		},
		count: data.length,
		data,
	});
});
