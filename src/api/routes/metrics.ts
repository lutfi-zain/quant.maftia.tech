import { Hono } from "hono";
import fs from "node:fs";
import { createRequire } from "node:module";
import BetterSqlite3 from "better-sqlite3";
import { executeQuery } from "../db.js";
import { mapToOscillator } from "../../lib/oscillator.js";

const require = createRequire(import.meta.url);
export const metricsRouter = new Hono();

const METRICS_DB_PATH =
	"/home/ubuntu/projects/quant-btc-valuation-system/database/metrics.db";

let metricsDbInstance: any = null;

function getMetricsDb() {
	if (metricsDbInstance) return metricsDbInstance;

	if (!fs.existsSync(METRICS_DB_PATH)) {
		throw new Error(`Metrics database not found at ${METRICS_DB_PATH}`);
	}

	if (typeof (globalThis as any).Bun !== "undefined") {
		const { Database } = require("bun:sqlite");
		const db = new Database(METRICS_DB_PATH);
		db.exec("PRAGMA journal_mode=WAL;");
		metricsDbInstance = {
			prepare: (sql: string) => {
				const stmt = db.prepare(sql);
				return {
					all: (...params: any[]) => stmt.all(...params),
					get: (...params: any[]) => stmt.get(...params),
					run: (...params: any[]) => stmt.run(...params),
				};
			},
			exec: (sql: string) => db.exec(sql),
		};
	} else {
		const db = new BetterSqlite3(METRICS_DB_PATH);
		db.exec("PRAGMA journal_mode=WAL;");
		metricsDbInstance = {
			prepare: (sql: string) => {
				const stmt = db.prepare(sql);
				return {
					all: (...params: any[]) => stmt.all(...params),
					get: (...params: any[]) => stmt.get(...params),
					run: (...params: any[]) => stmt.run(...params),
				};
			},
			exec: (sql: string) => db.exec(sql),
		};
	}

	return metricsDbInstance;
}

const DEFAULT_THRESHOLDS: Record<
	string,
	{
		t_minus_2: number | null;
		t_minus_1: number | null;
		t_zero: number | null;
		t_plus_1: number | null;
		t_plus_2: number | null;
	}
> = {
	aviv_ratio: {
		t_minus_2: 2.0,
		t_minus_1: 1.0,
		t_zero: null,
		t_plus_1: -1.0,
		t_plus_2: -2.0,
	},
	aviv_nupl: {
		t_minus_2: 0.5,
		t_minus_1: 0.3,
		t_zero: null,
		t_plus_1: -0.3,
		t_plus_2: -0.6,
	},
	cvdd_ratio: {
		t_minus_2: null,
		t_minus_1: null,
		t_zero: null,
		t_plus_1: 1.6,
		t_plus_2: 1.3,
	},
	mvrv_z: {
		t_minus_2: 6.65,
		t_minus_1: 4.6,
		t_zero: null,
		t_plus_1: 0.17,
		t_plus_2: 0.15,
	},
	lth_sth_sopr_ratio: {
		t_minus_2: 6.9,
		t_minus_1: 3.2,
		t_zero: null,
		t_plus_1: 0.99,
		t_plus_2: 0.73,
	},
	terminal_price_ratio: {
		t_minus_2: 0.17,
		t_minus_1: 0.25,
		t_zero: null,
		t_plus_1: 0.75,
		t_plus_2: 1.0,
	},
	unrealized_sell_risk: {
		t_minus_2: 2.2,
		t_minus_1: 1.8,
		t_zero: null,
		t_plus_1: null,
		t_plus_2: null,
	},
	sharpe_ratio_52w: {
		t_minus_2: 53.0,
		t_minus_1: 42.0,
		t_zero: null,
		t_plus_1: -10.0,
		t_plus_2: -20.0,
	},
	pi_cycle_top: {
		t_minus_2: 0.95,
		t_minus_1: 0.7,
		t_zero: null,
		t_plus_1: 0.45,
		t_plus_2: 0.35,
	},
	vpli: {
		t_minus_2: 80.0,
		t_minus_1: 70.0,
		t_zero: null,
		t_plus_1: 50.0,
		t_plus_2: 45.0,
	},
	risk_metrics: {
		t_minus_2: 0.85,
		t_minus_1: 0.75,
		t_zero: null,
		t_plus_1: 0.33,
		t_plus_2: 0.13,
	},
	dvrsi: {
		t_minus_2: 73.0,
		t_minus_1: 65.0,
		t_zero: null,
		t_plus_1: 50.0,
		t_plus_2: 42.0,
	},
	williams_r: {
		t_minus_2: null,
		t_minus_1: null,
		t_zero: null,
		t_plus_1: -70.0,
		t_plus_2: -80.0,
	},
	two_year_ma: {
		t_minus_2: 4.2,
		t_minus_1: 3.0,
		t_zero: null,
		t_plus_1: 1.0,
		t_plus_2: 0.7,
	},
	ahr999: {
		t_minus_2: 5.47,
		t_minus_1: 2.9,
		t_zero: null,
		t_plus_1: 0.7,
		t_plus_2: 0.45,
	},
	fear_greed_og: {
		t_minus_2: 70.0,
		t_minus_1: 60.0,
		t_zero: null,
		t_plus_1: 50.0,
		t_plus_2: 30.0,
	},
	fear_greed_cmc: {
		t_minus_2: 80.0,
		t_minus_1: 60.0,
		t_zero: null,
		t_plus_1: 40.0,
		t_plus_2: 20.0,
	},
};

// GET /api/v1/quant/metric/defaults
metricsRouter.get("/defaults", (c) => {
	try {
		return c.json({
			status: "success",
			defaults: DEFAULT_THRESHOLDS,
		});
	} catch (err: any) {
		console.error("Error fetching defaults config:", err);
		return c.json(
			{ status: "error", message: err.message || "Internal server error" },
			500,
		);
	}
});

// GET /api/v1/analytics/metric/:metric_name
metricsRouter.get("/:metric_name", (c) => {
	try {
		const metricName = c.req.param("metric_name").toLowerCase();
		const query = c.req.query();
		const today = new Date().toISOString().split("T")[0];

		let effectiveEndDate = today;
		if (query.end_date) {
			effectiveEndDate = query.end_date > today ? today : query.end_date;
		}

		const effectiveStartDate = query.start_date || "2010-01-01";

		const startParam = `${effectiveStartDate}`;
		const endParamRaw = `${effectiveEndDate}T23:59:59`;
		const endParamOhlc = `${effectiveEndDate}`;

		// 1. Fetch raw metric values from subsystem metrics.db
		const subsystemDb = getMetricsDb();
		const rawRows = subsystemDb
			.prepare(
				"SELECT date, raw_value FROM timeseries_metrics WHERE metric_name = ? AND date >= ? AND date <= ? ORDER BY date ASC",
			)
			.all(metricName, startParam, endParamRaw) as any[];

		// 2. Fetch BTC OHLC from master_ohlcv in master database
		const ohlcRows = executeQuery(
			"SELECT date, open, high, low, close FROM master_ohlcv WHERE date >= ? AND date <= ? ORDER BY date ASC",
			[effectiveStartDate, endParamOhlc],
		);

		// 3. Fetch normalized values from unified_component_signals in master database
		const normalizedRows = executeQuery(
			"SELECT date, normalized_score FROM unified_component_signals WHERE component_name = ? AND system_source = 'VALUATION' AND date >= ? AND date <= ? ORDER BY date ASC",
			[metricName, startParam, endParamRaw],
		);

		const raw_values_raw = rawRows.map((r) => ({
			date: r.date.split("T")[0],
			value: r.raw_value,
		}));

		const btc_ohlc_raw = ohlcRows.map((r) => ({
			date: r.date.split("T")[0],
			open: r.open,
			high: r.high,
			low: r.low,
			close: r.close,
		}));

		const normalized_values_raw = normalizedRows.map((r) => ({
			date: r.date.split("T")[0],
			value: r.normalized_score,
		}));

		// Inner join / alignment by date to prevent index-based chart timescale sync drift
		const rawMap = new Map(raw_values_raw.map((r) => [r.date, r.value]));
		const btcMap = new Map(btc_ohlc_raw.map((b) => [b.date, b]));
		const normMap = new Map(
			normalized_values_raw.map((n) => [n.date, n.value]),
		);

		const commonDates = Array.from(rawMap.keys())
			.filter((date) => btcMap.has(date))
			.sort();

		const raw_values = commonDates.map((date) => ({
			date,
			value: rawMap.get(date),
		}));

		const btc_ohlc = commonDates.map((date) => {
			const b = btcMap.get(date)!;
			return {
				date,
				open: b.open,
				high: b.high,
				low: b.low,
				close: b.close,
			};
		});

		const normalized_values = commonDates.map((date) => ({
			date,
			value: normMap.get(date) ?? 0.0,
		}));

		return c.json({
			status: "success",
			metric_name: metricName,
			causal_filter: {
				applied: true,
				max_allowed_date: today,
				effective_end_date: effectiveEndDate,
			},
			count: commonDates.length,
			data: {
				raw_values,
				normalized_values,
				btc_ohlc,
			},
		});
	} catch (err: any) {
		console.error("Error fetching metric timeseries:", err);
		return c.json(
			{ status: "error", message: err.message || "Internal server error" },
			500,
		);
	}
});

// GET /api/v1/analytics/metric/:metric_name/config
metricsRouter.get("/:metric_name/config", (c) => {
	try {
		const metricName = c.req.param("metric_name").toLowerCase();
		const subsystemDb = getMetricsDb();
		const row = subsystemDb
			.prepare(
				"SELECT t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2 FROM metric_config WHERE metric_name = ?",
			)
			.get(metricName) as any;

		if (row) {
			return c.json({
				status: "success",
				metric_name: metricName,
				thresholds: {
					t_minus_2: row.t_minus_2,
					t_minus_1: row.t_minus_1,
					t_zero: row.t_zero,
					t_plus_1: row.t_plus_1,
					t_plus_2: row.t_plus_2,
				},
			});
		}

		const defaults = DEFAULT_THRESHOLDS[metricName] || {
			t_minus_2: null,
			t_minus_1: null,
			t_zero: null,
			t_plus_1: null,
			t_plus_2: null,
		};

		// Convert thresholds properties from default object
		return c.json({
			status: "success",
			metric_name: metricName,
			thresholds: {
				t_minus_2: defaults.t_minus_2,
				t_minus_1: defaults.t_minus_1,
				t_zero: defaults.t_zero,
				t_plus_1: defaults.t_plus_1,
				t_plus_2: defaults.t_plus_2,
			},
		});
	} catch (err: any) {
		console.error("Error fetching metric config:", err);
		return c.json(
			{ status: "error", message: err.message || "Internal server error" },
			500,
		);
	}
});

// POST /api/v1/analytics/metric/:metric_name/config
metricsRouter.post("/:metric_name/config", async (c) => {
	try {
		const metricName = c.req.param("metric_name").toLowerCase();
		const body = await c.req.json();
		const { t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2 } = body;

		const subsystemDb = getMetricsDb();
		subsystemDb
			.prepare(
				"INSERT OR REPLACE INTO metric_config (metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run(
				metricName,
				t_minus_2 !== undefined ? t_minus_2 : null,
				t_minus_1 !== undefined ? t_minus_1 : null,
				t_zero !== undefined ? t_zero : null,
				t_plus_1 !== undefined ? t_plus_1 : null,
				t_plus_2 !== undefined ? t_plus_2 : null,
			);

		return c.json({
			status: "saved",
			metric_name: metricName,
			thresholds: {
				t_minus_2: t_minus_2 ?? null,
				t_minus_1: t_minus_1 ?? null,
				t_zero: t_zero ?? null,
				t_plus_1: t_plus_1 ?? null,
				t_plus_2: t_plus_2 ?? null,
			},
		});
	} catch (err: any) {
		console.error("Error saving metric config:", err);
		return c.json(
			{ status: "error", message: err.message || "Internal server error" },
			500,
		);
	}
});

// POST /api/v1/analytics/metric/:metric_name/renormalize — recalculate normalized values using python subprocess
metricsRouter.post("/:metric_name/renormalize", async (c) => {
	try {
		const metricName = c.req.param("metric_name").toLowerCase();
		const pythonScript = "/home/ubuntu/projects/quant-btc-valuation-system/scripts/renormalize_metric.py";

		if (!fs.existsSync(pythonScript)) {
			return c.json({ status: "error", message: `Renormalize script not found at ${pythonScript}` }, 500);
		}

		// Spawn the python process using Bun.spawn
		const proc = (globalThis as any).Bun.spawn(["python3", pythonScript, metricName]);

		// Setup timeout mechanism
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("Timeout")), 30000)
		);

		const exitCode = await Promise.race([
			proc.exited,
			timeoutPromise
		]).catch(async (err) => {
			proc.kill();
			throw err;
		});

		if (exitCode !== 0) {
			const errText = await new Response(proc.stderr).text();
			return c.json({ status: "error", message: `Subprocess exited with code ${exitCode}: ${errText}` }, 500);
		}

		const stdoutText = await new Response(proc.stdout).text();
		
		// Parse rows updated from output or just match it
		let rowsUpdated = 0;
		const match = stdoutText.match(/(\d+) rows updated/i);
		if (match) {
			rowsUpdated = parseInt(match[1], 10);
		}

		return c.json({
			status: "success",
			metric_name: metricName,
			rows_updated: rowsUpdated,
			message: "Renormalization completed successfully via python subprocess"
		});

	} catch (err: any) {
		console.error("Error renormalizing metric:", err);
		if (err.message === "Timeout") {
			return c.json({ status: "error", message: "Renormalize timed out after 30 seconds" }, 504);
		}
		return c.json(
			{ status: "error", message: err.message || "Internal server error" },
			500,
		);
	}
});
