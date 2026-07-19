export interface DailyAnalyticsPoint {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	valuation_composite: number;
	lttd_regime: "BULL" | "BEAR" | "SIDEWAYS";
	mttd_imo: number;
	ichimoku_imo: number;
	// Additional internal details if returned
	lttd_prob_bull?: number;
	lttd_prob_bear?: number;
	lttd_prob_sideways?: number;
	lttd_target_exposure?: number;
	mttd_er_ratio?: number;
	mttd_shannon_entropy?: number;
	ichimoku_s_tk?: number;
	ichimoku_s_cloud?: number;
	ichimoku_s_future?: number;
	ichimoku_s_chikou?: number;
	ichimoku_tenkan?: number;
	ichimoku_kijun?: number;
	ichimoku_senkou_a?: number;
	ichimoku_senkou_b?: number;
	ichimoku_chikou?: number;
	ichimoku_entropy?: number | null;
	ichimoku_er?: number | null;
	ichimoku_imo_std?: number | null;
	ichimoku_position?: number | null;
	ichimoku_ref_pos?: number;
	ichimoku_cum_strat?: number;
	ichimoku_cum_market?: number;
	ichimoku_active_pos?: number;
	ichimoku_strat_net_ret?: number;
	sdca_multiplier?: number;
	sdca_phase?: string;
	sdca_action?: string;
	sdca_confidence?: string;
}

export interface CircuitBreakersResponse {
	date: string;
	valuation_circuit_breaker: {
		is_bubble_risk: boolean;
		is_deep_discount: boolean;
		composite_score: number;
		thresholds: { bubble: number; discount: number };
	};
	lttd_macro_override: {
		is_sideways_override: boolean;
		regime: "BULL" | "BEAR" | "SIDEWAYS";
		exposure_multiplier: number;
		probability_sideways: number;
	};
	mttd_consensus_gates: {
		er_gate_open: boolean;
		shannon_entropy_gate_open: boolean;
		chikou_momentum_exit: boolean;
		efficiency_ratio: number;
		shannon_entropy: number;
	};
	system_status: "NORMAL" | "WARNING" | "OVERRIDE_ACTIVE";
	causal_filter_verified: boolean;
}

export interface ComponentSignal {
	date: string;
	system_source: string;
	component_name: string;
	normalized_score: number;
	signal_direction: -1 | 0 | 1;
	raw_value?: number;
}

export interface MetricTimeseriesResponse {
	status: string;
	metric_name: string;
	causal_filter: {
		applied: boolean;
		max_allowed_date: string;
		effective_end_date: string;
	};
	count: number;
	data: {
		raw_values: { date: string; value: number }[];
		normalized_values: { date: string; value: number }[];
		btc_ohlc: {
			date: string;
			open: number;
			high: number;
			low: number;
			close: number;
		}[];
	};
}

export interface MetricThresholdConfig {
	status: string;
	metric_name: string;
	thresholds: {
		t_minus_2: number;
		t_minus_1: number;
		t_zero: number;
		t_plus_1: number;
		t_plus_2: number;
	};
}

export interface MetricThresholdSaveResponse {
	status: string;
	metric_name: string;
	thresholds: {
		t_minus_2: number;
		t_minus_1: number;
		t_zero: number;
		t_plus_1: number;
		t_plus_2: number;
	};
}

// ── LTTD-Specific Types ──────────────────────────────────────────────

export interface LttdLatestRecord {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	lttd_regime: "BULL" | "BEAR" | "SIDEWAYS";
	lttd_score: number;
	lttd_prob_bull: number | null;
	lttd_prob_bear: number | null;
	lttd_prob_sideways: number | null;
	target_exposure: number | null;
}

export interface LttdRegimeRecord {
	date: string;
	regime: "BULL" | "BEAR" | "SIDEWAYS";
	p_bull: number;
	p_bear: number;
	p_sideways: number;
}

export interface LttdChartRecord {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	lttd_score: number;
	target_exposure: number;
}

export interface LttdDiagnosticsRecord {
	date: string;
	indicator_scores: Record<string, number>;
	raw_values: Record<string, number>;
	signal_directions: Record<string, number>;
	pca_components: Record<string, number>;
	vif: Record<string, number>;
	pca_variance_explained: number;
}

export interface LttdOnchainRecord {
	date: string;
	sth_mvrv: number | null;
	sth_nupl: number | null;
	sth_sopr_24h: number | null;
}

export interface LttdBacktestMetrics {
	winRate: number;
	profitFactor: number;
	totalTrades: number;
	sharpeRatio: number;
	sharpeRatioMarket: number;
	annReturnStrat: number;
	annReturnMarket: number;
	annVolatilityStrat: number;
	annVolatilityMarket: number;
	maxDrawdown: number;
	maxDrawdownMarket: number;
	totalReturnStrat: number;
	totalReturnMarket: number;
	sortinoRatio: number;
	cagrStrat: number;
	cagrMarket: number;
}

export interface LttdTradeLogEntry {
	id: number;
	entryDate: string;
	entryPrice: number;
	exitDate: string;
	exitPrice: number;
	holdDays: number;
	exitReason: string;
	returnPct: number;
}

export interface LttdBacktestResponse {
	date_range: { start: string; end: string };
	config: { fee_bps: number };
	metrics: LttdBacktestMetrics;
	trade_log: LttdTradeLogEntry[];
	equity_curve: { date: string; strat: number; market: number }[];
}

export interface LttdActionResponse {
	success: boolean;
	action: string;
	output: string;
	error_output: string;
}

export interface HealthResponse {
	status: "healthy" | "degraded" | "error";
	service: string;
	port: number;
	database_wal: boolean;
	causal_filter: string;
	timestamp: string;
	database?: {
		latest_data_timestamp: string;
		total_records: number;
	};
}
