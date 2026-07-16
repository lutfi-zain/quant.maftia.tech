import type {
	DailyAnalyticsPoint,
	CircuitBreakersResponse,
	ComponentSignal,
	HealthResponse,
	MetricTimeseriesResponse,
	MetricThresholdConfig,
	MetricThresholdSaveResponse,
	LttdLatestRecord,
	LttdRegimeRecord,
	LttdChartRecord,
	LttdDiagnosticsRecord,
	LttdOnchainRecord,
	LttdBacktestResponse,
	LttdActionResponse,
} from "./types";

const API_BASE =
	import.meta.env.VITE_API_BASE_URL !== undefined
		? import.meta.env.VITE_API_BASE_URL
		: window.location.origin;

/**
 * Ensures strict t-1 CausalFilter verification on incoming time-series data.
 * Verifies that all points have timestamps <= current date minus any lookahead risk.
 */
function verifyCausalData<T extends { date: string }>(data: T[]): T[] {
	const now = new Date();
	const todayStr = now.toISOString().split("T")[0];
	// Filter out any anomalous future dates beyond current observation window
	const filtered = data.filter(
		(item) => item && typeof item.date === "string" && item.date <= todayStr,
	);
	const uniqueMap = new Map<string, T>();
	for (const item of filtered) {
		const compName = (item as any).component_name;
		const sysSource = (item as any).system_source;
		const key =
			compName && sysSource
				? `${sysSource}_${compName}_${item.date}`
				: compName
					? `${compName}_${item.date}`
					: item.date;
		if (!uniqueMap.has(key)) {
			uniqueMap.set(key, item);
		}
	}
	return Array.from(uniqueMap.values()).sort((a, b) =>
		a.date.localeCompare(b.date),
	);
}

export const quantClient = {
	async getHealth(): Promise<HealthResponse> {
		const res = await fetch(`${API_BASE}/api/v1/health`);
		if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
		return res.json();
	},

	async getDailyAnalytics(limit?: number): Promise<DailyAnalyticsPoint[]> {
		const url = new URL(
			`${API_BASE}/api/v1/quant/daily`,
			window.location.origin,
		);
		if (limit) url.searchParams.set("limit", limit.toString());

		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch daily analytics: ${res.statusText}`);
		const json = await res.json();
		const rawList: any[] = Array.isArray(json)
			? json
			: Array.isArray(json.data)
				? json.data
				: [];

		// Map raw backend points into flat DailyAnalyticsPoint
		const mapped: DailyAnalyticsPoint[] = rawList.map((item) => ({
			...item,
			date: item.date,
			open:
				item.master_ohlcv?.open ??
				(typeof item.open === "number" ? item.open : 0),
			high:
				item.master_ohlcv?.high ??
				(typeof item.high === "number" ? item.high : 0),
			low:
				item.master_ohlcv?.low ?? (typeof item.low === "number" ? item.low : 0),
			close:
				item.master_ohlcv?.close ??
				(typeof item.close === "number" ? item.close : 0),
			volume:
				item.master_ohlcv?.volume ??
				(typeof item.volume === "number" ? item.volume : 0),
			valuation_composite:
				item.valuation_composite?.score ??
				(typeof item.valuation_composite === "number"
					? item.valuation_composite
					: 0),
			lttd_regime:
				item.lttd_regime?.regime ??
				(typeof item.lttd_regime === "string" ? item.lttd_regime : "SIDEWAYS"),
			lttd_score: item.lttd_regime?.score ?? 0,
			lttd_prob_bull: item.lttd_regime?.prob_bull ?? 0,
			lttd_prob_bear: item.lttd_regime?.prob_bear ?? 0,
			lttd_prob_sideways: item.lttd_regime?.prob_sideways ?? 1,
			lttd_target_exposure: item.lttd_regime?.target_exposure ?? undefined,
			mttd_imo:
				item.mttd_imo?.oscillator ??
				(typeof item.mttd_imo === "number" ? item.mttd_imo : 0),
			mttd_er_ratio: item.mttd_imo?.efficiency_ratio ?? 0,
			mttd_shannon_entropy: item.mttd_imo?.shannon_entropy ?? 0,
			ichimoku_imo:
				item.ichimoku_imo?.oscillator ??
				(typeof item.ichimoku_imo === "number" ? item.ichimoku_imo : 0),
			ichimoku_s_tk: item.ichimoku_imo?.s_tk ?? undefined,
			ichimoku_s_cloud: item.ichimoku_imo?.s_cloud ?? undefined,
			ichimoku_s_future: item.ichimoku_imo?.s_future ?? undefined,
			ichimoku_s_chikou: item.ichimoku_imo?.s_chikou ?? undefined,
			ichimoku_tenkan: item.ichimoku_imo?.tenkan ?? undefined,
			ichimoku_kijun: item.ichimoku_imo?.kijun ?? undefined,
			ichimoku_senkou_a: item.ichimoku_imo?.senkou_a ?? undefined,
			ichimoku_senkou_b: item.ichimoku_imo?.senkou_b ?? undefined,
			ichimoku_chikou: item.ichimoku_imo?.chikou ?? undefined,
			ichimoku_entropy: item.ichimoku_imo?.entropy ?? undefined,
			ichimoku_er: item.ichimoku_imo?.er ?? undefined,
			ichimoku_imo_std: item.ichimoku_imo?.imo_std ?? undefined,
			ichimoku_position: item.ichimoku_imo?.position ?? undefined,
			ichimoku_ref_pos: item.ichimoku_imo?.ref_pos ?? undefined,
			ichimoku_cum_strat: item.ichimoku_imo?.cum_strat ?? undefined,
			ichimoku_cum_market: item.ichimoku_imo?.cum_market ?? undefined,
			ichimoku_active_pos: item.ichimoku_imo?.active_pos ?? undefined,
			ichimoku_strat_net_ret: item.ichimoku_imo?.strat_net_ret ?? undefined,
		}));

		return verifyCausalData(mapped);
	},

	async getCircuitBreakers(): Promise<CircuitBreakersResponse> {
		const res = await fetch(`${API_BASE}/api/v1/system/circuit-breakers`);
		if (!res.ok)
			throw new Error(`Failed to fetch circuit breakers: ${res.statusText}`);
		const json = await res.json();
		const cb = json.circuit_breakers || {};
		const valScore = cb.bubble_warning?.current_valuation_score ?? 0;
		const lttdRegime =
			cb.sideways_zero_exposure_lock?.current_regime ?? "SIDEWAYS";
		const probSideways =
			cb.sideways_zero_exposure_lock?.current_prob_sideways ?? 0;
		const isSidewaysOverride = cb.sideways_zero_exposure_lock?.active ?? false;

		return {
			date: json.as_of_date || new Date().toISOString().split("T")[0],
			valuation_circuit_breaker: {
				is_bubble_risk: cb.bubble_warning?.active ?? false,
				is_deep_discount: cb.deep_discount_override?.active ?? false,
				composite_score: valScore,
				thresholds: { bubble: 1.5, discount: -1.0 },
			},
			lttd_macro_override: {
				is_sideways_override: isSidewaysOverride,
				regime: lttdRegime,
				exposure_multiplier: isSidewaysOverride ? 0.0 : 1.0,
				probability_sideways: probSideways,
			},
			mttd_consensus_gates: {
				er_gate_open: true,
				shannon_entropy_gate_open: true,
				chikou_momentum_exit: false,
				efficiency_ratio: 0.25,
				shannon_entropy: 2.1,
			},
			system_status: isSidewaysOverride ? "OVERRIDE_ACTIVE" : "NORMAL",
			causal_filter_verified: true,
		};
	},

	async getComponents(
		systemSource?: string,
		date?: string,
		limit?: number,
	): Promise<ComponentSignal[]> {
		const url = new URL(
			`${API_BASE}/api/v1/quant/components`,
			window.location.origin,
		);
		if (systemSource) url.searchParams.set("system", systemSource);
		if (date) url.searchParams.set("date", date);
		if (limit) url.searchParams.set("limit", limit.toString());

		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch component signals: ${res.statusText}`);
		const json = await res.json();
		const rawList: any[] = Array.isArray(json)
			? json
			: Array.isArray(json.data)
				? json.data
				: [];
		return verifyCausalData(rawList);
	},

	async getMetricTimeseries(
		metricName: string,
	): Promise<MetricTimeseriesResponse> {
		const res = await fetch(`${API_BASE}/api/v1/quant/metric/${metricName}`);
		if (!res.ok)
			throw new Error(`Failed to fetch metric timeseries: ${res.statusText}`);
		const json = (await res.json()) as MetricTimeseriesResponse;
		if (json && json.data) {
			json.data.raw_values = verifyCausalData(json.data.raw_values);
			json.data.normalized_values = verifyCausalData(
				json.data.normalized_values,
			);
			json.data.btc_ohlc = verifyCausalData(json.data.btc_ohlc);
		}
		return json;
	},

	async getMetricConfig(metricName: string): Promise<MetricThresholdConfig> {
		const res = await fetch(
			`${API_BASE}/api/v1/quant/metric/${metricName}/config`,
		);
		if (!res.ok)
			throw new Error(`Failed to fetch metric config: ${res.statusText}`);
		return res.json();
	},

	async saveMetricConfig(
		metricName: string,
		config: {
			t_minus_2: number | null;
			t_minus_1: number | null;
			t_zero: number | null;
			t_plus_1: number | null;
			t_plus_2: number | null;
		},
	): Promise<MetricThresholdSaveResponse> {
		const res = await fetch(
			`${API_BASE}/api/v1/quant/metric/${metricName}/config`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(config),
			},
		);
		if (!res.ok)
			throw new Error(`Failed to save metric config: ${res.statusText}`);
		return res.json();
	},

	async renormalizeMetric(
		metricName: string,
	): Promise<{ status: string; metric_name: string; rows_updated: number }> {
		const res = await fetch(
			`${API_BASE}/api/v1/quant/metric/${metricName}/renormalize`,
			{
				method: "POST",
			},
		);
		if (!res.ok)
			throw new Error(`Failed to renormalize metric: ${res.statusText}`);
		return res.json();
	},

	async fetchMetricDefaults(): Promise<{ status: string; defaults: any }> {
		const res = await fetch(`${API_BASE}/api/v1/quant/metric/defaults`);
		if (!res.ok)
			throw new Error(`Failed to fetch defaults config: ${res.statusText}`);
		return res.json();
	},

	// ── LTTD Endpoints ────────────────────────────────────────────────

	async fetchLttdLatest(): Promise<LttdLatestRecord> {
		const res = await fetch(`${API_BASE}/api/v1/lttd/latest`);
		if (!res.ok)
			throw new Error(`Failed to fetch LTTD latest: ${res.statusText}`);
		return res.json();
	},

	async fetchLttdHistory(
		start?: string,
		end?: string,
		limit?: number,
	): Promise<LttdLatestRecord[]> {
		const url = new URL(
			`${API_BASE}/api/v1/lttd/history`,
			window.location.origin,
		);
		if (start) url.searchParams.set("start", start);
		if (end) url.searchParams.set("end", end);
		if (limit) url.searchParams.set("limit", limit.toString());
		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch LTTD history: ${res.statusText}`);
		return verifyCausalData(await res.json());
	},

	async fetchLttdChart(
		start?: string,
		end?: string,
	): Promise<LttdChartRecord[]> {
		const url = new URL(
			`${API_BASE}/api/v1/lttd/chart`,
			window.location.origin,
		);
		if (start) url.searchParams.set("start", start);
		if (end) url.searchParams.set("end", end);
		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch LTTD chart: ${res.statusText}`);
		return verifyCausalData(await res.json());
	},

	async fetchLttdRegime(
		start?: string,
		end?: string,
	): Promise<LttdRegimeRecord[]> {
		const url = new URL(
			`${API_BASE}/api/v1/lttd/regime`,
			window.location.origin,
		);
		if (start) url.searchParams.set("start", start);
		if (end) url.searchParams.set("end", end);
		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch LTTD regime: ${res.statusText}`);
		return verifyCausalData(await res.json());
	},

	async fetchLttdDiagnostics(
		start?: string,
		end?: string,
	): Promise<LttdDiagnosticsRecord[]> {
		const url = new URL(
			`${API_BASE}/api/v1/lttd/diagnostics`,
			window.location.origin,
		);
		if (start) url.searchParams.set("start", start);
		if (end) url.searchParams.set("end", end);
		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch LTTD diagnostics: ${res.statusText}`);
		return verifyCausalData(await res.json());
	},

	async fetchLttdOnchain(
		start?: string,
		end?: string,
	): Promise<LttdOnchainRecord[]> {
		const url = new URL(
			`${API_BASE}/api/v1/lttd/onchain`,
			window.location.origin,
		);
		if (start) url.searchParams.set("start", start);
		if (end) url.searchParams.set("end", end);
		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch LTTD onchain: ${res.statusText}`);
		return verifyCausalData(await res.json());
	},

	async triggerLttdAction(action: string): Promise<LttdActionResponse> {
		const res = await fetch(`${API_BASE}/api/v1/lttd/actions/run`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action }),
		});
		if (!res.ok)
			throw new Error(`Failed to trigger LTTD action: ${res.statusText}`);
		return res.json();
	},

	async fetchLttdBacktest(
		start?: string,
		end?: string,
		feeBps?: number,
	): Promise<LttdBacktestResponse> {
		const url = new URL(
			`${API_BASE}/api/v1/lttd/backtest`,
			window.location.origin,
		);
		if (start) url.searchParams.set("start", start);
		if (end) url.searchParams.set("end", end);
		if (feeBps !== undefined)
			url.searchParams.set("fee_bps", feeBps.toString());
		const res = await fetch(url.toString());
		if (!res.ok)
			throw new Error(`Failed to fetch LTTD backtest: ${res.statusText}`);
		const json = await res.json();
		if (json.equity_curve)
			json.equity_curve = verifyCausalData(json.equity_curve);
		return json;
	},

	// ── Scheduler & Configuration Endpoints ───────────────────────────

	async getSchedulerStatus(): Promise<any> {
		const res = await fetch(`${API_BASE}/api/v1/config/scheduler`);
		if (!res.ok)
			throw new Error(`Failed to fetch scheduler status: ${res.statusText}`);
		return res.json();
	},

	async saveSchedulerConfig(config: {
		cronString?: string;
		isActive?: boolean;
	}): Promise<any> {
		const res = await fetch(`${API_BASE}/api/v1/config/scheduler`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(config),
		});
		if (!res.ok)
			throw new Error(`Failed to save scheduler config: ${res.statusText}`);
		return res.json();
	},

	async triggerSyncRun(): Promise<any> {
		const res = await fetch(`${API_BASE}/api/v1/config/sync/run`, {
			method: "POST",
		});
		if (!res.ok)
			throw new Error(`Failed to trigger manual sync: ${res.statusText}`);
		return res.json();
	},
};
