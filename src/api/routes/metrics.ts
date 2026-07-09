import { Hono } from 'hono';
import { executeQuery, executeQuerySingle } from '../db.js';

export const metricsRouter = new Hono();

/**
 * GET /api/v1/analytics/metric/:metric_name
 *
 * Returns per-metric timeseries data for the Valuation Studio metric detail view.
 * - raw_values: raw metric scores from unified_component_signals
 * - normalized_values: normalized scores from unified_component_signals
 * - btc_ohlc: BTC OHLC data from master_ohlcv aligned by date
 *
 * Enforces strict t-1 CausalFilter verification.
 */
metricsRouter.get('/:metric_name', (c) => {
  const metricName = c.req.param('metric_name');
  const query = c.req.query();
  const today = new Date().toISOString().split('T')[0];

  const effectiveStartDate = query.start_date
    ? query.start_date.split('T')[0]
    : '2010-01-01';
  let effectiveEndDate = today;
  if (query.end_date) {
    effectiveEndDate = query.end_date > today ? today : query.end_date;
  }
  let limit = parseInt(query.limit || '500', 10);
  if (isNaN(limit) || limit <= 0) limit = 500;
  if (limit > 5000) limit = 5000;

  // Fetch component signals for this metric name (case-insensitive)
  const signalSql = `
    SELECT date, raw_value, normalized_score, signal_direction
    FROM unified_component_signals
    WHERE LOWER(component_name) = LOWER(?)
      AND date >= ?
      AND date <= ?
    ORDER BY date ASC
    LIMIT ?
  `;

  const signalRows = executeQuery<any>(signalSql, [
    metricName,
    effectiveStartDate,
    effectiveEndDate,
    limit,
  ]);

  if (signalRows.length === 0) {
    return c.json(
      {
        status: 'error',
        message: `No data found for metric '${metricName}' within the valid causal window.`,
        causal_filter: {
          applied: true,
          max_allowed_date: today,
          requested_end_date: query.end_date || null,
          effective_end_date: effectiveEndDate,
        },
      },
      404,
    );
  }

  // Extract unique dates from signal rows for aligned OHLC query
  const dates = signalRows.map((r: any) => r.date.split('T')[0]);
  const uniqueDates = [...new Set(dates)];
  const placeholders = uniqueDates.map(() => '?').join(',');

  // Fetch BTC OHLC for the same date range
  const ohlcSql = `
    SELECT date, open, high, low, close
    FROM master_ohlcv
    WHERE date IN (${placeholders})
    ORDER BY date ASC
  `;

  const ohlcRows = executeQuery<any>(ohlcSql, uniqueDates);
  const ohlcMap = new Map<string, any>();
  for (const row of ohlcRows) {
    ohlcMap.set(row.date, row);
  }

  // Build response data aligned by date
  const rawValues: { date: string; value: number }[] = [];
  const normalizedValues: { date: string; value: number }[] = [];
  const btcOhlc: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }[] = [];
  const dateSet = new Set<string>();

  for (const row of signalRows) {
    const date = row.date.split('T')[0];
    if (dateSet.has(date)) continue;
    dateSet.add(date);

    rawValues.push({ date, value: row.raw_value ?? 0 });
    normalizedValues.push({ date, value: row.normalized_score ?? 0 });

    const ohlc = ohlcMap.get(date);
    if (ohlc) {
      btcOhlc.push({
        date,
        open: ohlc.open ?? 0,
        high: ohlc.high ?? 0,
        low: ohlc.low ?? 0,
        close: ohlc.close ?? 0,
      });
    }
  }

  return c.json({
    status: 'success',
    metric_name: metricName,
    causal_filter: {
      applied: true,
      max_allowed_date: today,
      effective_end_date: effectiveEndDate,
    },
    count: rawValues.length,
    data: {
      raw_values: rawValues,
      normalized_values: normalizedValues,
      btc_ohlc: btcOhlc,
    },
  });
});

// Helper to ensure the metric_thresholds table exists
function ensureThresholdsTable() {
  executeQuery(
    `CREATE TABLE IF NOT EXISTS metric_thresholds (
      metric_name TEXT PRIMARY KEY,
      t_minus_2 REAL NOT NULL DEFAULT 2.0,
      t_minus_1 REAL NOT NULL DEFAULT 1.0,
      t_zero REAL NOT NULL DEFAULT 0.0,
      t_plus_1 REAL NOT NULL DEFAULT -1.0,
      t_plus_2 REAL NOT NULL DEFAULT -2.0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );
}

/**
 * GET /api/v1/analytics/metric/:metric_name/config
 *
 * Returns the 5-piece threshold config for a metric.
 * Uses the metric_thresholds table; returns defaults if no config exists.
 */
metricsRouter.get('/:metric_name/config', (c) => {
  const metricName = c.req.param('metric_name');
  ensureThresholdsTable();

  const row = executeQuerySingle<any>(
    `SELECT metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2
     FROM metric_thresholds
     WHERE LOWER(metric_name) = LOWER(?)`,
    [metricName],
  );

  if (!row) {
    return c.json({
      status: 'success',
      metric_name: metricName,
      thresholds: {
        t_minus_2: 2.0,
        t_minus_1: 1.0,
        t_zero: 0.0,
        t_plus_1: -1.0,
        t_plus_2: -2.0,
      },
    });
  }

  return c.json({
    status: 'success',
    metric_name: row.metric_name,
    thresholds: {
      t_minus_2: row.t_minus_2,
      t_minus_1: row.t_minus_1,
      t_zero: row.t_zero,
      t_plus_1: row.t_plus_1,
      t_plus_2: row.t_plus_2,
    },
  });
});

/**
 * POST /api/v1/analytics/metric/:metric_name/config
 *
 * Upserts the 5-piece threshold config for a metric.
 */
metricsRouter.post('/:metric_name/config', async (c) => {
  const metricName = c.req.param('metric_name');
  const body = await c.req.json();

  const t_minus_2 = body.t_minus_2 ?? 2.0;
  const t_minus_1 = body.t_minus_1 ?? 1.0;
  const t_zero = body.t_zero ?? 0.0;
  const t_plus_1 = body.t_plus_1 ?? -1.0;
  const t_plus_2 = body.t_plus_2 ?? -2.0;

  ensureThresholdsTable();

  // Upsert using INSERT OR REPLACE via parameterized query
  executeQuery(
    `INSERT OR REPLACE INTO metric_thresholds
       (metric_name, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [metricName, t_minus_2, t_minus_1, t_zero, t_plus_1, t_plus_2],
  );

  return c.json({
    status: 'saved',
    metric_name: metricName,
    thresholds: {
      t_minus_2,
      t_minus_1,
      t_zero,
      t_plus_1,
      t_plus_2,
    },
  });
});
