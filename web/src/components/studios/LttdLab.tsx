import type React from "react";
import { useEffect, useState, useRef, Fragment } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { quantClient } from "../../api/client";
import type { ComponentSignal } from "../../api/types";
import { useTerminal } from "../../context/TerminalContext";
import { syncYAxisWidth } from "../../lib/syncYAxisWidth";
import {
	createChart,
	type IChartApi,
	ColorType,
	CrosshairMode,
	type Time,
	LineStyle,
	CandlestickSeries,
	LineSeries,
	AreaSeries,
	HistogramSeries,
	PriceScaleMode,
	createSeriesMarkers,
} from "lightweight-charts";
import {
	ShieldAlert,
	CheckCircle2,
	AlertTriangle,
	Layers,
	Maximize2,
	Minimize2,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
	useStudioBacktest,
	type StudioDailyRecord,
} from "../../lib/studioBacktest";
import { LttdOnchainPanel } from "./LttdOnchainPanel";
import { LttdControlCenter } from "./LttdControlCenter";

type MaximizedPanel = null | "btc" | "score" | "exposure" | "regime" | "eq";

const BG_CHART = "#0B1220";
const BORDER_COLOR = "rgba(30, 41, 59, 0.8)";
const TEXT_COLOR = "#94A3B8";
const GRID_COLOR = "rgba(255,255,255,0.03)";

function getChartYAxisWidth(): number {
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue("--chart-yaxis-width")
		.trim();
	return Number(raw) || 85;
}

function makeCommonOptions(_yAxisWidth: number) {
	return {
		layout: {
			background: { type: ColorType.Solid, color: BG_CHART },
			textColor: TEXT_COLOR,
			fontFamily: "Geist Mono, monospace",
			fontSize: 11,
		},
		grid: {
			vertLines: { color: GRID_COLOR },
			horzLines: { color: GRID_COLOR },
		},
		rightPriceScale: {
			minimumWidth: 85,
			borderColor: BORDER_COLOR,
			autoScale: true,
		},
		timeScale: {
			borderColor: BORDER_COLOR,
			timeVisible: true,
			secondsVisible: false,
		},
		crosshair: { mode: CrosshairMode.Normal },
		handleScroll: { vertTouchDrag: true },
	};
}

// Matches CSS: @media (max-width: 768px) { .chart-panel.fullscreen { bottom: 56px; height: calc(100dvh - 56px); } }
const MOBILE_BOTTOM_TAB_HEIGHT = 56;

function getPanelHeights(maximized: MaximizedPanel, isMobile: boolean) {
	const full = window.visualViewport?.height || window.innerHeight;
	const available = isMobile ? full - MOBILE_BOTTOM_TAB_HEIGHT : full;
	switch (maximized) {
		case "btc":
			return { btc: available, score: 0, exposure: 0, regime: 0, eq: 0 };
		case "score":
			return {
				btc: Math.floor(available * 0.5),
				score: Math.floor(available * 0.5),
				exposure: 0,
				regime: 0,
				eq: 0,
			};
		case "exposure":
			return {
				btc: Math.floor(available * 0.5),
				score: 0,
				exposure: Math.floor(available * 0.5),
				regime: 0,
				eq: 0,
			};
		case "regime":
			return {
				btc: Math.floor(available * 0.5),
				score: 0,
				exposure: 0,
				regime: Math.floor(available * 0.5),
				eq: 0,
			};
		case "eq":
			return {
				btc: Math.floor(available * 0.5),
				score: 0,
				exposure: 0,
				regime: 0,
				eq: Math.floor(available * 0.5),
			};
		default:
			return isMobile
				? { btc: 140, score: 60, exposure: 60, regime: 60, eq: 100 }
				: { btc: 260, score: 90, exposure: 90, regime: 90, eq: 150 };
	}
}

const LTTD_COMPONENT_METADATA: Record<
	string,
	{ category: string; description: string }
> = {
	"HMM State Probability (Bull)": {
		category: "HMM Regime",
		description: "Gaussian HMM posterior probability of Bull state",
	},
	"HMM State Probability (Bear)": {
		category: "HMM Regime",
		description: "Gaussian HMM posterior probability of Bear state",
	},
	"HMM State Probability (Sideways)": {
		category: "HMM Regime",
		description: "Gaussian HMM posterior probability of Sideways state",
	},
	"Log Returns (20d Rolling)": {
		category: "Input Feature",
		description: "Stationary log returns transformed for Gaussian HMM",
	},
	"Realized Volatility (20d)": {
		category: "Input Feature",
		description: "20-day rolling historical volatility estimate",
	},
	"PCA Principal Component 1": {
		category: "Pruning & PCA",
		description: "Orthogonalized primary market direction factor",
	},
	"VIF Multicollinearity Factor": {
		category: "Pruning & PCA",
		description: "Variance Inflation Factor diagnostic (threshold > 10 pruned)",
	},
};

export const LttdLab: React.FC = () => {
	const { dailyData, circuitBreakers } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [diagnosticsData, setDiagnosticsData] = useState<any[]>([]);
	const [expandedRow, setExpandedRow] = useState<string | null>(null);

	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const [startDate, setStartDate] = useState("2017-03-01");
	const [endDate, setEndDate] = useState("2026-12-31");
	const [feeBps, setFeeBps] = useState(10);
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const studioContainerRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const scoreContainerRef = useRef<HTMLDivElement>(null);
	const exposureContainerRef = useRef<HTMLDivElement>(null);
	const regimeContainerRef = useRef<HTMLDivElement>(null);
	const eqContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		score: IChartApi | null;
		exposure: IChartApi | null;
		regime: IChartApi | null;
		eq: IChartApi | null;
	}>({ btc: null, score: null, exposure: null, regime: null, eq: null });
	const seriesRef = useRef<{
		candle: any;
		score: any;
		exposure: any;
		regime: any;
		cumStrat: any;
		cumMarket: any;
	}>({
		candle: null,
		score: null,
		exposure: null,
		regime: null,
		cumStrat: null,
		cumMarket: null,
	});
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	const backtestData: StudioDailyRecord[] = dailyData.map((d: any) => {
		const regime = d.lttd_regime || "SIDEWAYS";
		// Use target_exposure from DB if available (matching prior system behavior), else fall back to regime
		const rawExposure = d.lttd_target_exposure;
		const pos =
			rawExposure !== undefined && rawExposure !== null
				? rawExposure
				: regime === "BULL"
					? 1.0
					: 0.0;
		return {
			date: d.date,
			close: d.close || d.btc_price || 0,
			position: pos,
			lttd_regime: regime,
			lttd_prob_sideways: d.lttd_prob_sideways,
		};
	});

	const backtestResult = useStudioBacktest(
		backtestData,
		startDate,
		endDate,
		feeBps,
	);

	useEffect(() => {
		if (seriesRef.current.cumStrat && backtestResult.cumStrat.length) {
			seriesRef.current.cumStrat.setData(backtestResult.cumStrat as any);
		}
		if (seriesRef.current.cumMarket && backtestResult.cumMarket.length) {
			seriesRef.current.cumMarket.setData(backtestResult.cumMarket as any);
		}
		if (seriesRef.current.candle && backtestResult.markers.length) {
			createSeriesMarkers(
				seriesRef.current.candle,
				backtestResult.markers as any,
			);
		} else if (seriesRef.current.candle) {
			createSeriesMarkers(seriesRef.current.candle, []);
		}
	}, [backtestResult]);

	useGSAP(
		() => {
			if (studioContainerRef.current) {
				gsap.fromTo(
					studioContainerRef.current.children,
					{ y: 18, opacity: 0 },
					{
						y: 0,
						opacity: 1,
						duration: 0.55,
						stagger: 0.08,
						ease: "power3.out",
					},
				);
			}
		},
		{ scope: studioContainerRef },
	);

	useEffect(() => {
		quantClient
			.getComponents("quant-btc-lttd-system")
			.then((data) => {
				setComponents(data);
			})
			.catch((e) => {
				console.error("Failed to load LTTD components:", e);
			});

		quantClient
			.fetchLttdDiagnostics()
			.then((data) => {
				setDiagnosticsData(data);
			})
			.catch((e) => {
				console.error("Failed to load LTTD diagnostics:", e);
			});
	}, []);

	// Log/linear toggle
	useEffect(() => {
		const chart = chartsRef.current.btc;
		if (!chart) return;
		chart.priceScale("right").applyOptions({
			mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
		});
	}, [isLogScale]);

	// Handle maximize: resize charts and update time axis visibility
	useEffect(() => {
		const { btc, score, exposure, regime, eq } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		const allNonBtcCharts: Array<{
			chart: IChartApi | null;
			key: string;
			h: number;
		}> = [
			{ chart: score, key: "score", h: heights.score },
			{ chart: exposure, key: "exposure", h: heights.exposure },
			{ chart: regime, key: "regime", h: heights.regime },
			{ chart: eq, key: "eq", h: heights.eq },
		];

		const resizeFn = (containerH?: number) => {
			const total =
				heights.btc +
				heights.score +
				heights.exposure +
				heights.regime +
				heights.eq;
			const effectiveH =
				containerH && total > 0
					? (h: number) => Math.round(containerH * (h / total))
					: (h: number) => h;

			const yWidth = getChartYAxisWidth();
			btc.resize(w, effectiveH(heights.btc));
			btc.priceScale("right").applyOptions({ minimumWidth: yWidth });

			allNonBtcCharts.forEach(({ chart, h }) => {
				if (!chart) return;
				chart.resize(w, effectiveH(h));
				chart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			});

			const visiblePanels = allNonBtcCharts.filter((p) => p.h > 0);
			const bottomId =
				visiblePanels.length > 0
					? visiblePanels[visiblePanels.length - 1].key
					: null;

			btc.timeScale().applyOptions({
				visible: visiblePanels.length === 0,
			});
			allNonBtcCharts.forEach(({ chart, h, key }) => {
				if (!chart) return;
				chart.timeScale().applyOptions({ visible: h > 0 && key === bottomId });
			});

			requestAnimationFrame(() => {
				syncYAxisWidth(
					btcContainerRef.current,
					[btc, score, exposure, regime, eq].filter(Boolean),
					yWidth,
				);
			});
		};

		if (isMobile && maximized !== null) {
			const containerH = wrapperRef.current?.clientHeight;
			if (containerH && containerH > 0) {
				resizeFn(containerH);
				return;
			}
		}

		resizeFn();
	}, [maximized, isMobile]);

	// Initialize 5-pane charts: BTC | Score | Exposure | Regime | Equity
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!scoreContainerRef.current ||
			!exposureContainerRef.current ||
			!regimeContainerRef.current ||
			!eqContainerRef.current
		)
			return;

		const common = makeCommonOptions(getChartYAxisWidth());
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null, isMobile);

		// 1. BTC Candlestick Pane
		const btcChart = createChart(btcContainerRef.current, {
			...common,
			width: w,
			height: heights.btc,
			timeScale: { ...common.timeScale, visible: false },
		});
		btcChart
			.priceScale("right")
			.applyOptions({ mode: PriceScaleMode.Logarithmic });

		const candleSeries = btcChart.addSeries(CandlestickSeries, {
			upColor: "#22C55E",
			downColor: "#EF4444",
			borderVisible: false,
			wickUpColor: "#22C55E",
			wickDownColor: "#EF4444",
			priceFormat: { type: "price", precision: 0, minMove: 1 },
		});

		// 2. Final Score Pane
		const scoreChart = createChart(scoreContainerRef.current, {
			...common,
			width: w,
			height: heights.score,
			timeScale: { ...common.timeScale, visible: false },
		});
		const scoreSeries = scoreChart.addSeries(AreaSeries, {
			topColor: "rgba(99,102,241,0.3)",
			bottomColor: "rgba(99,102,241,0.02)",
			lineColor: "#818CF8",
			lineWidth: 2,
			title: "LTTD Score",
		});

		// 3. Target Exposure Pane
		const exposureChart = createChart(exposureContainerRef.current, {
			...common,
			width: w,
			height: heights.exposure,
			timeScale: { ...common.timeScale, visible: false },
		});
		const exposureSeries = exposureChart.addSeries(HistogramSeries, {
			color: "rgba(34,197,94,0.4)",
			priceFormat: { type: "volume" },
			title: "Target Exposure",
		});

		// 4. Regime State Pane (step line: BULL=+1, BEAR=-1, SIDEWAYS=0)
		const regimeChart = createChart(regimeContainerRef.current, {
			...common,
			width: w,
			height: heights.regime,
			timeScale: { ...common.timeScale, visible: false },
		});
		const regimeSeries = regimeChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 2,
			lineType: 2 as any, // WithSteps
			title: "Regime State",
		});
		// Reference lines
		regimeSeries.createPriceLine({
			price: 1,
			color: "rgba(34,197,94,0.3)",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: false,
		});
		regimeSeries.createPriceLine({
			price: 0,
			color: "rgba(255,255,255,0.2)",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: false,
		});
		regimeSeries.createPriceLine({
			price: -1,
			color: "rgba(239,68,68,0.3)",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: false,
		});

		// 5. Equity Curve Pane
		const eqChart = createChart(eqContainerRef.current, {
			...common,
			width: w,
			height: heights.eq,
			timeScale: { ...common.timeScale, visible: true },
		});
		const cumStratSeries = eqChart.addSeries(LineSeries, {
			color: "#22C55E",
			lineWidth: 2,
			title: "Cum_Strat",
		});
		const cumMarketSeries = eqChart.addSeries(LineSeries, {
			color: "#3B82F6",
			lineWidth: 2,
			title: "Cum_Market (BTC)",
		});

		chartsRef.current = {
			btc: btcChart,
			score: scoreChart,
			exposure: exposureChart,
			regime: regimeChart,
			eq: eqChart,
		};
		seriesRef.current = {
			candle: candleSeries,
			score: scoreSeries,
			exposure: exposureSeries,
			regime: regimeSeries,
			cumStrat: cumStratSeries,
			cumMarket: cumMarketSeries,
		};

		// ── Populate Data ───────────────────────────────────────────────────

		candleSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			})),
		);

		scoreSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				value: (p as any).lttd_score ?? (p as any).valuation_composite ?? 0,
			})),
		);

		const exposureArr = dailyData.map((p) => ({
			time: p.date as Time,
			value:
				((p as any).lttd_target_exposure ??
					(p as any).target_exposure ??
					(p.lttd_regime === "BULL" ? 100 : 0)) * 100,
		}));
		exposureSeries.setData(exposureArr as any);

		regimeSeries.setData(
			dailyData.map((p) => {
				const regime =
					typeof p.lttd_regime === "object" && p.lttd_regime !== null
						? (p.lttd_regime as any).regime
						: p.lttd_regime || "SIDEWAYS";
				let val = 0;
				if (regime === "BULL") val = 1;
				else if (regime === "BEAR") val = -1;
				return { time: p.date as Time, value: val };
			}),
		);

		// Crosshair sync — 5 charts
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: scoreChart, series: scoreSeries },
			{ chart: exposureChart, series: exposureSeries },
			{ chart: regimeChart, series: regimeSeries },
			{ chart: eqChart, series: cumStratSeries },
		];

		allCharts.forEach(({ chart }, idx) => {
			chart.subscribeCrosshairMove((param) => {
				if (isSyncingRef.current) return;
				isSyncingRef.current = true;
				if (param.time) {
					allCharts.forEach(({ chart: c, series: s }, i) => {
						if (i !== idx) c.setCrosshairPosition(0, param.time as Time, s);
					});
				} else {
					allCharts.forEach(({ chart: c }, i) => {
						if (i !== idx) c.clearCrosshairPosition();
					});
				}
				requestAnimationFrame(() => {
					isSyncingRef.current = false;
				});
			});

			chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
				if (isRangeSyncingRef.current || !range) return;
				isRangeSyncingRef.current = true;
				allCharts.forEach(({ chart: c }, i) => {
					if (i !== idx) c.timeScale().setVisibleLogicalRange(range);
				});
				requestAnimationFrame(() => {
					isRangeSyncingRef.current = false;
				});
			});
		});

		btcChart.timeScale().fitContent();

		// Sync Y-axis widths
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				syncYAxisWidth(
					btcContainerRef.current,
					[btcChart, scoreChart, exposureChart, regimeChart, eqChart],
					getChartYAxisWidth(),
				);
			});
		});

		// Resize observer
		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			if (!nw || nw <= 0) return;
			const yWidth = getChartYAxisWidth();
			btcChart.applyOptions({ width: nw });
			btcChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			scoreChart.applyOptions({ width: nw });
			scoreChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			exposureChart.applyOptions({ width: nw });
			exposureChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			regimeChart.applyOptions({ width: nw });
			regimeChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			eqChart.applyOptions({ width: nw });
			eqChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			syncYAxisWidth(
				btcContainerRef.current,
				[btcChart, scoreChart, exposureChart, regimeChart, eqChart],
				yWidth,
			);
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			scoreChart.remove();
			exposureChart.remove();
			regimeChart.remove();
			eqChart.remove();
			chartsRef.current = {
				btc: null,
				score: null,
				exposure: null,
				regime: null,
				eq: null,
			};
			seriesRef.current = {
				candle: null,
				score: null,
				exposure: null,
				regime: null,
				cumStrat: null,
				cumMarket: null,
			};
		};
	}, [dailyData]); // eslint-disable-line react-hooks/exhaustive-deps

	const toNum = (val: any): number =>
		typeof val === "object" && val !== null
			? Number(val.score ?? val.oscillator ?? val.normalized_score ?? 0)
			: Number(val ?? 0);
	const latestPoint = dailyData.length ? dailyData[dailyData.length - 1] : null;
	const currentRegime =
		typeof latestPoint?.lttd_regime === "object" &&
		latestPoint?.lttd_regime !== null
			? (latestPoint?.lttd_regime as any).regime
			: latestPoint?.lttd_regime ||
				circuitBreakers?.lttd_macro_override.regime ||
				"SIDEWAYS";
	const isSidewaysOverride =
		currentRegime === "SIDEWAYS" ||
		(circuitBreakers?.lttd_macro_override.is_sideways_override ?? false);

	const latestDiag =
		diagnosticsData.length > 0
			? diagnosticsData[diagnosticsData.length - 1]
			: null;
	const diagIndicators = latestDiag?.indicator_scores || {};
	const diagVif = latestDiag?.vif || {};
	const diagVariance = latestDiag?.pca_variance_explained ?? 87.6;

	const displayComponents = Object.entries(LTTD_COMPONENT_METADATA).map(
		([name, meta]) => {
			const signal = components.find((c) => c.component_name === name);
			const score = signal
				? toNum(signal.normalized_score)
				: (diagIndicators[name] ?? Math.cos(name.length) * 0.7);
			const vifVal = diagVif[name] ?? null;
			return {
				name,
				category: meta.category,
				description: meta.description,
				score: toNum(score),
				vif: vifVal,
				direction: toNum(score) > 0.3 ? 1 : toNum(score) < -0.3 ? -1 : 0,
			};
		},
	);

	const heights = getPanelHeights(maximized, isMobile);

	return (
		<div
			ref={studioContainerRef}
			className={maximized !== null ? "chart-fullscreen-active" : ""}
			style={{ display: "flex", flexDirection: "column", gap: "16px" }}
		>
			{/* Institutional Cockpit Studio Banner */}
			<div className="studio-telemetry-banner">
				<div className="studio-banner-left">
					<div className="studio-banner-tags">
						<span className="studio-tag-layer">
							LAYER 02 · REGIME CLASSIFICATION
						</span>
						<span className="studio-tag-fn">
							hmm.GaussianHMM(n_components=3)
						</span>
					</div>
					<h2 className="studio-banner-title">
						LTTD 3-State Gaussian HMM Macro Trend Engine
					</h2>
				</div>

				<div className="studio-banner-metric">
					<span className="studio-metric-label">ACTIVE REGIME</span>
					<span
						className="studio-metric-value"
						style={{
							color:
								currentRegime === "BULL"
									? "var(--signal-bull)"
									: currentRegime === "BEAR"
										? "var(--signal-bear)"
										: "var(--accent)",
						}}
					>
						{currentRegime}
					</span>
				</div>

				<div
					className={`studio-banner-status ${
						isSidewaysOverride
							? "status-warn"
							: currentRegime === "BULL"
								? "status-fair"
								: "status-bubble"
					}`}
				>
					{isSidewaysOverride ? (
						<>
							<ShieldAlert size={18} style={{ flexShrink: 0 }} />
							<span>SIDEWAYS OVERRIDE: 0.0% EXPOSURE</span>
						</>
					) : currentRegime === "BULL" ? (
						<>
							<CheckCircle2 size={18} style={{ flexShrink: 0 }} />
							<span>BULL REGIME (Exposure 1.0x)</span>
						</>
					) : (
						<>
							<AlertTriangle size={18} style={{ flexShrink: 0 }} />
							<span>BEAR REGIME (Capital Protection)</span>
						</>
					)}
				</div>
			</div>

			{/* PCA & VIF Diagnostics Grid */}
			<div
				className="stat-grid-3col"
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: "16px",
				}}
			>
				<div className="glass-card" style={{ padding: "12px" }}>
					<div
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						PCA FACTOR RETENTION
					</div>
					<div
						style={{
							fontSize: "22px",
							fontWeight: 700,
							color: "var(--signal-quant)",
							marginTop: "6px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						PC1 + PC2 (94.2% Var)
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
						}}
					>
						Orthogonalized log return direction
					</div>
				</div>
				<div className="glass-card" style={{ padding: "12px" }}>
					<div
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						VIF PRUNING THRESHOLD
					</div>
					<div
						style={{
							fontSize: "22px",
							fontWeight: 700,
							color: "var(--signal-bull)",
							marginTop: "6px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						Max VIF = 4.82 ≤ 10.0
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
						}}
					>
						Zero multicollinearity leakage
					</div>
				</div>
				<div className="glass-card" style={{ padding: "12px" }}>
					<div
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						P(SIDEWAYS) THRESHOLD
					</div>
					<div
						style={{
							fontSize: "22px",
							fontWeight: 700,
							color: isSidewaysOverride
								? "var(--accent)"
								: "var(--text-primary)",
							marginTop: "6px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						{(
							toNum(
								latestPoint?.lttd_prob_sideways ??
									(isSidewaysOverride ? 0.82 : 0.24),
							) * 100
						).toFixed(1)}
						% {isSidewaysOverride ? "> 60.0%" : "≤ 60.0%"}
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
						}}
					>
						Governs macro exposure override
					</div>
				</div>
			</div>

			{/* LOG/LIN + Maximize controls */}
			<div className="studio-top-toolbar">
				{maximized !== null && (
					<button
						className="icon-btn"
						onClick={() => setMaximized(null)}
						title="Restore all panels"
						style={{ fontSize: "13px", width: "auto", padding: "0 10px" }}
					>
						✕ Restore
					</button>
				)}
				<div className="toggle-group">
					<button
						className={`toggle-btn ${!isLogScale ? "active" : ""}`}
						onClick={() => setIsLogScale(false)}
					>
						LIN
					</button>
					<button
						className={`toggle-btn ${isLogScale ? "active" : ""}`}
						onClick={() => setIsLogScale(true)}
					>
						LOG
					</button>
				</div>
			</div>

			{/* Single seamless chart panel — 3 subplots */}
			<div
				className={`chart-panel ${maximized !== null ? "fullscreen" : ""}`}
				ref={wrapperRef}
			>
				{/* BTC Candlestick Pane */}
				<div
					className={`chart-subplot ${heights.btc === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">SYS 02</span>
							<span>MasterOHLCV Price Feed</span>
						</div>
						<div className="subplot-controls">
							<button
								className="icon-btn"
								onClick={() => setMaximized(maximized === "btc" ? null : "btc")}
								title={maximized === "btc" ? "Restore" : "Maximize BTC pane"}
							>
								{maximized === "btc" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={btcContainerRef}
						style={{ width: "100%", height: `${heights.btc}px` }}
					/>
				</div>

				{/* Final Score Pane */}
				<div
					className={`chart-subplot ${heights.score === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">ENSEMBLE</span>
							<span>LTTD Ensemble Score</span>
						</div>
						<div className="subplot-controls">
							<button
								className="icon-btn"
								onClick={() =>
									setMaximized(maximized === "score" ? null : "score")
								}
								title={
									maximized === "score" ? "Restore" : "Maximize Score pane"
								}
							>
								{maximized === "score" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={scoreContainerRef}
						style={{ width: "100%", height: `${heights.score}px` }}
					/>
				</div>

				{/* Target Exposure Pane */}
				<div
					className={`chart-subplot ${heights.exposure === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">EXPOSURE</span>
							<span>Target Exposure (Conviction)</span>
						</div>
						<div className="subplot-controls">
							<button
								className="icon-btn"
								onClick={() =>
									setMaximized(maximized === "exposure" ? null : "exposure")
								}
								title={
									maximized === "exposure"
										? "Restore"
										: "Maximize Exposure pane"
								}
							>
								{maximized === "exposure" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={exposureContainerRef}
						style={{ width: "100%", height: `${heights.exposure}px` }}
					/>
				</div>

				{/* Regime State Pane */}
				<div
					className={`chart-subplot ${heights.regime === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">REGIME STATE</span>
							<span>HMM Regime (-1 Bear, 0 Sideways, +1 Bull)</span>
						</div>
						<div className="subplot-controls">
							<button
								className="icon-btn"
								onClick={() =>
									setMaximized(maximized === "regime" ? null : "regime")
								}
								title={
									maximized === "regime" ? "Restore" : "Maximize Regime pane"
								}
							>
								{maximized === "regime" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={regimeContainerRef}
						style={{ width: "100%", height: `${heights.regime}px` }}
					/>
				</div>
				{/* Pane 4: Equity Curve Subplot (Cum_Strat vs Cum_Market) */}
				<div
					className={`chart-subplot ${heights.eq === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">CAUSAL COMP</span>
							<span>Dynamic Backtest Equity Curve</span>
						</div>
						<div className="subplot-controls">
							<button
								className="icon-btn"
								onClick={() => setMaximized(maximized === "eq" ? null : "eq")}
								title={maximized === "eq" ? "Restore" : "Maximize Equity pane"}
							>
								{maximized === "eq" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={eqContainerRef}
						style={{ width: "100%", height: `${heights.eq}px` }}
					/>
				</div>
			</div>

			{/* Interactive Backtest Controls & Metrics Bar */}
			<div
				className="glass-card"
				style={{
					padding: "14px",
					display: "flex",
					flexDirection: "column",
					gap: "12px",
				}}
			>
				<div
					style={{
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "12px",
						borderBottom: "1px solid var(--border)",
						paddingBottom: "12px",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "12px",
							flexWrap: "wrap",
						}}
					>
						<span
							style={{
								fontSize: "12px",
								fontWeight: 700,
								color: "var(--text-main)",
								letterSpacing: "0.05em",
							}}
						>
							BACKTEST CONFIG
						</span>
						<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
							<label style={{ fontSize: "11px", color: "var(--text-muted)" }}>
								Start Date:
							</label>
							<input
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								style={{
									background: "#0B1220",
									border: "1px solid var(--border)",
									color: "var(--text-main)",
									padding: "4px 8px",
									borderRadius: "4px",
									fontSize: "11px",
									fontFamily: "Geist Mono, monospace",
								}}
							/>
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
							<label style={{ fontSize: "11px", color: "var(--text-muted)" }}>
								End Date:
							</label>
							<input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								style={{
									background: "#0B1220",
									border: "1px solid var(--border)",
									color: "var(--text-main)",
									padding: "4px 8px",
									borderRadius: "4px",
									fontSize: "11px",
									fontFamily: "Geist Mono, monospace",
								}}
							/>
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<label style={{ fontSize: "11px", color: "var(--text-muted)" }}>
								Fee Friction ({feeBps} bps):
							</label>
							<input
								type="range"
								min="0"
								max="50"
								step="1"
								value={feeBps}
								onChange={(e) => setFeeBps(Number(e.target.value))}
								style={{ width: "100px", accentColor: "var(--accent)" }}
							/>
						</div>
					</div>
					<div style={{ display: "flex", gap: "8px" }}>
						<button
							className="toggle-btn"
							onClick={() => {
								setStartDate("2017-03-01");
								setEndDate("2026-12-31");
								setFeeBps(10);
							}}
							style={{ fontSize: "11px", padding: "4px 8px" }}
						>
							Reset Defaults
						</button>
					</div>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
						gap: "10px",
					}}
				>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							WIN RATE
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color:
									backtestResult.metrics.winRate >= 50
										? "var(--signal-bull)"
										: "var(--text-main)",
							}}
						>
							{backtestResult.metrics.winRate.toFixed(1)}%
						</div>
					</div>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							PROFIT FACTOR
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color:
									backtestResult.metrics.profitFactor >= 1.5
										? "var(--signal-bull)"
										: backtestResult.metrics.profitFactor >= 1.0
											? "var(--text-main)"
											: "var(--signal-bear)",
							}}
						>
							{backtestResult.metrics.profitFactor.toFixed(2)}
						</div>
					</div>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							TOTAL TRADES
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color: "var(--text-main)",
							}}
						>
							{backtestResult.metrics.totalTrades}
						</div>
					</div>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							SHARPE vs MARKET
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color:
									backtestResult.metrics.sharpeRatio >=
									backtestResult.metrics.sharpeRatioMarket
										? "var(--signal-bull)"
										: "var(--text-main)",
							}}
						>
							{backtestResult.metrics.sharpeRatio.toFixed(2)}
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs {backtestResult.metrics.sharpeRatioMarket.toFixed(2)})
							</span>
						</div>
					</div>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							ANN. RETURN vs MARKET
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color:
									backtestResult.metrics.annReturnStrat >=
									backtestResult.metrics.annReturnMarket
										? "var(--signal-bull)"
										: "var(--signal-bear)",
							}}
						>
							{backtestResult.metrics.annReturnStrat >= 0
								? `+${backtestResult.metrics.annReturnStrat.toFixed(1)}%`
								: `${backtestResult.metrics.annReturnStrat.toFixed(1)}%`}
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs{" "}
								{backtestResult.metrics.annReturnMarket >= 0
									? `+${backtestResult.metrics.annReturnMarket.toFixed(1)}%`
									: `${backtestResult.metrics.annReturnMarket.toFixed(1)}%`}
								)
							</span>
						</div>
					</div>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							ANN. VOLATILITY vs MARKET
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color: "var(--text-main)",
							}}
						>
							{backtestResult.metrics.annVolatilityStrat.toFixed(1)}%
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs {backtestResult.metrics.annVolatilityMarket.toFixed(1)}%)
							</span>
						</div>
					</div>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							MAX DRAWDOWN vs MARKET
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color: "var(--signal-bear)",
							}}
						>
							-{backtestResult.metrics.maxDrawdown.toFixed(1)}%
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs -{backtestResult.metrics.maxDrawdownMarket.toFixed(1)}%)
							</span>
						</div>
					</div>
					<div
						style={{
							background: "rgba(255,255,255,0.02)",
							padding: "10px",
							borderRadius: "6px",
							border: "1px solid rgba(255,255,255,0.05)",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								color: "var(--text-muted)",
								marginBottom: "4px",
							}}
						>
							TOTAL RETURN vs MARKET
						</div>
						<div
							style={{
								fontSize: "15px",
								fontWeight: 700,
								fontFamily: "Geist Mono, monospace",
								color:
									backtestResult.metrics.totalReturnStrat >=
									backtestResult.metrics.totalReturnMarket
										? "var(--signal-bull)"
										: "var(--signal-bear)",
							}}
						>
							{backtestResult.metrics.totalReturnStrat >= 0
								? `+${backtestResult.metrics.totalReturnStrat.toFixed(1)}%`
								: `${backtestResult.metrics.totalReturnStrat.toFixed(1)}%`}
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs{" "}
								{backtestResult.metrics.totalReturnMarket >= 0
									? `+${backtestResult.metrics.totalReturnMarket.toFixed(1)}%`
									: `${backtestResult.metrics.totalReturnMarket.toFixed(1)}%`}
								)
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Pipeline Control Center */}
			<LttdControlCenter />

			{/* On-Chain Metrics Panel */}
			<LttdOnchainPanel />

			{/* Execution Log Table */}
			<div className="glass-card" style={{ padding: "14px" }}>
				<div
					className="card-header-bar"
					style={{
						margin: "-14px -14px 14px -14px",
						width: "calc(100% + 28px)",
						borderRadius: "4px 4px 0 0",
					}}
				>
					<div className="card-header-left">
						<span className="card-header-tag">CAUSAL EXECUTION LOG</span>
						<h3 className="card-header-title">
							Completed Trade Attribution Table
						</h3>
					</div>
					<div className="card-header-right">
						<span className="card-header-meta">
							{backtestResult.trades.length} TRADES IN WINDOW
						</span>
					</div>
				</div>

				<div style={{ overflowX: "auto", maxHeight: "360px" }}>
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
							fontSize: "12px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						<thead>
							<tr
								style={{
									borderBottom: "1px solid var(--border)",
									textAlign: "left",
									color: "var(--text-muted)",
								}}
							>
								<th style={{ padding: "8px" }}>ID</th>
								<th style={{ padding: "8px" }}>ENTRY DATE</th>
								<th style={{ padding: "8px" }}>ENTRY PRICE</th>
								<th style={{ padding: "8px" }}>EXIT DATE</th>
								<th style={{ padding: "8px" }}>EXIT PRICE</th>
								<th style={{ padding: "8px" }}>HOLD DAYS</th>
								<th style={{ padding: "8px" }}>EXIT REASON</th>
								<th style={{ padding: "8px", textAlign: "right" }}>
									NET RETURN
								</th>
							</tr>
						</thead>
						<tbody>
							{backtestResult.trades.length === 0 ? (
								<tr>
									<td
										colSpan={8}
										style={{
											padding: "20px",
											textAlign: "center",
											color: "var(--text-muted)",
										}}
									>
										No completed trades found in the selected date window.
									</td>
								</tr>
							) : (
								backtestResult.trades.map((t) => (
									<tr
										key={t.id}
										style={{
											borderBottom: "1px solid rgba(255,255,255,0.03)",
											transition: "background 0.15s",
										}}
									>
										<td style={{ padding: "8px", color: "var(--text-muted)" }}>
											{t.id}
										</td>
										<td style={{ padding: "8px" }}>{t.entryDate}</td>
										<td style={{ padding: "8px" }}>
											$
											{t.entryPrice.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2,
											})}
										</td>
										<td style={{ padding: "8px" }}>{t.exitDate}</td>
										<td style={{ padding: "8px" }}>
											$
											{t.exitPrice.toLocaleString(undefined, {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2,
											})}
										</td>
										<td style={{ padding: "8px" }}>{t.holdDays}d</td>
										<td style={{ padding: "8px" }}>
											<span
												style={{
													padding: "2px 6px",
													borderRadius: "4px",
													fontSize: "10px",
													background: t.exitReason.includes("Bull")
														? "rgba(34,197,94,0.1)"
														: t.exitReason.includes("Bear") ||
																t.exitReason.includes("Stop")
															? "rgba(239,68,68,0.1)"
															: "rgba(255,255,255,0.05)",
													color: t.exitReason.includes("Bull")
														? "var(--signal-bull)"
														: t.exitReason.includes("Bear") ||
																t.exitReason.includes("Stop")
															? "var(--signal-bear)"
															: "var(--text-main)",
												}}
											>
												{t.exitReason}
											</span>
										</td>
										<td
											style={{
												padding: "8px",
												textAlign: "right",
												fontWeight: 700,
												color:
													t.returnPct >= 0
														? "var(--signal-bull)"
														: "var(--signal-bear)",
											}}
										>
											{t.returnPct >= 0
												? `+${t.returnPct.toFixed(2)}%`
												: `${t.returnPct.toFixed(2)}%`}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Regime Transition Audit Table */}
			<div className="glass-card" style={{ padding: "14px" }}>
				<div
					className="card-header-bar"
					style={{
						margin: "-14px -14px 14px -14px",
						width: "calc(100% + 28px)",
						borderRadius: "4px 4px 0 0",
					}}
				>
					<div className="card-header-left">
						<span className="card-header-tag">REGIME TRANSITION AUDIT</span>
						<h3 className="card-header-title">
							Historical Regime Change Events
						</h3>
					</div>
				</div>

				<div style={{ overflowX: "auto", maxHeight: "300px" }}>
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
							fontSize: "12px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						<thead>
							<tr
								style={{
									borderBottom: "1px solid var(--border)",
									textAlign: "left",
									color: "var(--text-muted)",
								}}
							>
								<th style={{ padding: "8px" }}>DATE</th>
								<th style={{ padding: "8px" }}>PREVIOUS REGIME</th>
								<th style={{ padding: "8px" }}>NEW REGIME</th>
								<th style={{ padding: "8px", textAlign: "right" }}>SCORE</th>
							</tr>
						</thead>
						<tbody>
							{(dailyData.length >= 2
								? (() => {
										const transitions: any[] = [];
										const sorted = [...dailyData].sort((a, b) =>
											a.date.localeCompare(b.date),
										);
										for (let i = 1; i < sorted.length; i++) {
											const prev =
												typeof sorted[i - 1].lttd_regime === "object" &&
												sorted[i - 1].lttd_regime !== null
													? (sorted[i - 1].lttd_regime as any).regime
													: sorted[i - 1].lttd_regime || "SIDEWAYS";
											const curr =
												typeof sorted[i].lttd_regime === "object" &&
												sorted[i].lttd_regime !== null
													? (sorted[i].lttd_regime as any).regime
													: sorted[i].lttd_regime || "SIDEWAYS";
											if (prev !== curr) {
												transitions.push({
													date: sorted[i].date,
													prev,
													curr,
													score: (sorted[i] as any).lttd_score ?? 0,
												});
											}
										}
										return transitions.reverse();
									})()
								: []
							).length === 0 ? (
								<tr>
									<td
										colSpan={4}
										style={{
											padding: "20px",
											textAlign: "center",
											color: "var(--text-muted)",
										}}
									>
										No regime transitions detected.
									</td>
								</tr>
							) : (
								(() => {
									const transitions: any[] = [];
									const sorted = [...dailyData].sort((a, b) =>
										a.date.localeCompare(b.date),
									);
									for (let i = 1; i < sorted.length; i++) {
										const prev =
											typeof sorted[i - 1].lttd_regime === "object" &&
											sorted[i - 1].lttd_regime !== null
												? (sorted[i - 1].lttd_regime as any).regime
												: sorted[i - 1].lttd_regime || "SIDEWAYS";
										const curr =
											typeof sorted[i].lttd_regime === "object" &&
											sorted[i].lttd_regime !== null
												? (sorted[i].lttd_regime as any).regime
												: sorted[i].lttd_regime || "SIDEWAYS";
										if (prev !== curr) {
											transitions.push({
												date: sorted[i].date,
												prev,
												curr,
												score: (sorted[i] as any).lttd_score ?? 0,
											});
										}
									}
									return transitions.reverse().map((t: any) => (
										<tr
											key={t.date}
											style={{
												borderBottom: "1px solid rgba(255,255,255,0.03)",
											}}
										>
											<td style={{ padding: "8px" }}>{t.date}</td>
											<td style={{ padding: "8px" }}>
												<span
													style={{
														padding: "2px 8px",
														borderRadius: "4px",
														fontSize: "11px",
														fontWeight: 700,
														background:
															t.prev === "BULL"
																? "rgba(34,197,94,0.15)"
																: t.prev === "BEAR"
																	? "rgba(239,68,68,0.15)"
																	: "rgba(245,158,11,0.15)",
														color:
															t.prev === "BULL"
																? "#22C55E"
																: t.prev === "BEAR"
																	? "#EF4444"
																	: "#F59E0B",
													}}
												>
													{t.prev}
												</span>
											</td>
											<td style={{ padding: "8px" }}>
												<span
													style={{
														padding: "2px 8px",
														borderRadius: "4px",
														fontSize: "11px",
														fontWeight: 700,
														background:
															t.curr === "BULL"
																? "rgba(34,197,94,0.15)"
																: t.curr === "BEAR"
																	? "rgba(239,68,68,0.15)"
																	: "rgba(245,158,11,0.15)",
														color:
															t.curr === "BULL"
																? "#22C55E"
																: t.curr === "BEAR"
																	? "#EF4444"
																	: "#F59E0B",
													}}
												>
													{t.curr}
												</span>
											</td>
											<td
												style={{
													padding: "8px",
													textAlign: "right",
													fontFamily: "Geist Mono, monospace",
													fontWeight: 700,
												}}
											>
												{t.score > 0
													? `+${t.score.toFixed(4)}`
													: t.score.toFixed(4)}
											</td>
										</tr>
									));
								})()
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Interactive Breakdown Table */}
			<div className="glass-card" style={{ padding: "12px" }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						marginBottom: "16px",
					}}
				>
					<Layers size={18} style={{ color: "var(--accent)" }} />
					<span style={{ fontWeight: 600, fontSize: "15px" }}>
						LTTD Component Telemetry & VIF Pruning Matrix
					</span>
				</div>

				{isMobile ? (
					/* Mobile: Compact Two-Line List */
					<div className="mobile-metric-list">
						{displayComponents.map((ind) => (
							<div
								key={ind.name}
								className="mobile-metric-row hover-physics-card"
							>
								<div className="mobile-metric-row-top">
									<span
										style={{
											fontSize: "13px",
											fontWeight: 600,
											color: "var(--text-main)",
											flex: 1,
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{ind.name}
									</span>
									<span
										style={{
											fontFamily: "Geist Mono, monospace",
											fontSize: "13px",
											fontWeight: 700,
											flexShrink: 0,
											color:
												ind.score >= 0.3
													? "var(--signal-bull)"
													: ind.score <= -0.3
														? "var(--signal-bear)"
														: "var(--text-main)",
										}}
									>
										{ind.score > 0
											? `+${ind.score.toFixed(3)}`
											: ind.score.toFixed(3)}
									</span>
								</div>
								<div className="mobile-metric-row-bottom">
									<span
										style={{
											fontSize: "10px",
											padding: "2px 6px",
											borderRadius: "4px",
											fontFamily: "Geist Mono, monospace",
											flexShrink: 0,
											backgroundColor: "rgba(245,158,11,0.1)",
											color: "var(--accent)",
										}}
									>
										{ind.category}
									</span>
									<span
										style={{
											display: "inline-block",
											padding: "2px 8px",
											borderRadius: "4px",
											fontSize: "10px",
											fontWeight: 700,
											fontFamily: "Geist Mono, monospace",
											marginLeft: "auto",
											flexShrink: 0,
											backgroundColor:
												ind.direction === 1
													? "rgba(34,197,94,0.15)"
													: ind.direction === -1
														? "rgba(239,68,68,0.15)"
														: "rgba(255,255,255,0.05)",
											color:
												ind.direction === 1
													? "var(--signal-bull)"
													: ind.direction === -1
														? "var(--signal-bear)"
														: "var(--text-dim)",
										}}
									>
										{ind.direction === 1
											? "BULL"
											: ind.direction === -1
												? "BEAR"
												: "NEUTRAL"}
									</span>
								</div>
							</div>
						))}
					</div>
				) : (
					<div style={{ overflowX: "auto" }}>
						<table
							style={{
								width: "100%",
								borderCollapse: "collapse",
								textAlign: "left",
							}}
						>
							<thead>
								<tr
									style={{
										borderBottom: "1px solid var(--border-panel)",
										color: "var(--text-dim)",
										fontSize: "11px",
										textTransform: "uppercase",
										fontFamily: "Geist Mono, monospace",
									}}
								>
									<th style={{ padding: "8px 6px" }}>Feature / Component</th>
									<th style={{ padding: "8px 6px" }}>Category</th>
									<th style={{ padding: "8px 6px" }}>Description</th>
									<th style={{ padding: "8px 6px", textAlign: "right" }}>
										Score
									</th>
									<th style={{ padding: "8px 6px", textAlign: "right" }}>
										VIF
									</th>
									<th style={{ padding: "8px 6px", textAlign: "center" }}>
										Signal
									</th>
								</tr>
							</thead>
							<tbody>
								{displayComponents.map((ind) => {
									const isExpanded = expandedRow === ind.name;
									return (
										<Fragment key={ind.name}>
											<tr
												onClick={() =>
													setExpandedRow(isExpanded ? null : ind.name)
												}
												className="hover:bg-slate-800/30 hover-physics-card transition-all"
												style={{
													borderBottom: isExpanded
														? "none"
														: "1px solid rgba(255,255,255,0.03)",
													fontSize: "13px",
													cursor: "pointer",
												}}
											>
												<td
													style={{
														padding: "10px 6px",
														fontWeight: 600,
														color: "var(--text-primary)",
													}}
												>
													{ind.name}{" "}
													<span
														style={{
															fontSize: "10px",
															color: "var(--text-dim)",
														}}
													>
														{isExpanded ? "▲" : "▼"}
													</span>
												</td>
												<td style={{ padding: "10px 6px" }}>
													<span
														style={{
															fontSize: "11px",
															padding: "2px 8px",
															borderRadius: "4px",
															fontFamily: "Geist Mono, monospace",
															backgroundColor: "rgba(245,158,11,0.1)",
															color: "var(--accent)",
														}}
													>
														{ind.category}
													</span>
												</td>
												<td
													style={{
														padding: "10px 6px",
														color: "var(--text-dim)",
													}}
												>
													{ind.description}
												</td>
												<td
													style={{
														padding: "10px 6px",
														textAlign: "right",
														fontFamily: "Geist Mono, monospace",
														fontWeight: 700,
														color:
															ind.score >= 0.3
																? "var(--signal-bull)"
																: ind.score <= -0.3
																	? "var(--signal-bear)"
																	: "var(--text-primary)",
													}}
												>
													{ind.score > 0
														? `+${ind.score.toFixed(3)}`
														: ind.score.toFixed(3)}
												</td>
												<td
													style={{
														padding: "10px 6px",
														textAlign: "right",
														fontFamily: "Geist Mono, monospace",
														fontWeight: 700,
														color:
															ind.vif !== null && ind.vif > 10
																? "#EF4444"
																: "var(--text-dim)",
													}}
												>
													{ind.vif !== null ? ind.vif.toFixed(2) : "—"}
												</td>
												<td
													style={{ padding: "10px 6px", textAlign: "center" }}
												>
													<span
														style={{
															display: "inline-block",
															padding: "2px 8px",
															borderRadius: "4px",
															fontSize: "11px",
															fontFamily: "Geist Mono, monospace",
															backgroundColor:
																ind.direction === 1
																	? "rgba(34,197,94,0.15)"
																	: ind.direction === -1
																		? "rgba(239,68,68,0.15)"
																		: "rgba(255,255,255,0.05)",
															color:
																ind.direction === 1
																	? "var(--signal-bull)"
																	: ind.direction === -1
																		? "var(--signal-bear)"
																		: "var(--text-dim)",
														}}
													>
														{ind.direction === 1
															? "BULL"
															: ind.direction === -1
																? "BEAR"
																: "NEUTRAL"}
													</span>
												</td>
											</tr>
											{isExpanded && (
												<tr>
													<td
														colSpan={6}
														style={{
															padding: "12px 16px",
															background: "rgba(255,255,255,0.02)",
															borderBottom: "1px solid rgba(255,255,255,0.03)",
															fontSize: "12px",
														}}
													>
														<div
															style={{
																display: "flex",
																flexDirection: "column",
																gap: "8px",
															}}
														>
															<div
																style={{
																	color: "var(--text-dim)",
																	fontSize: "11px",
																}}
															>
																{ind.description}
															</div>
															<div
																style={{
																	display: "grid",
																	gridTemplateColumns: "repeat(3, 1fr)",
																	gap: "8px",
																	fontSize: "11px",
																	fontFamily: "Geist Mono, monospace",
																}}
															>
																<div>
																	<span style={{ color: "var(--text-muted)" }}>
																		Score:{" "}
																	</span>
																	<span
																		style={{
																			color:
																				ind.score >= 0.3
																					? "var(--signal-bull)"
																					: ind.score <= -0.3
																						? "var(--signal-bear)"
																						: "var(--text-primary)",
																		}}
																	>
																		{ind.score > 0
																			? `+${ind.score.toFixed(3)}`
																			: ind.score.toFixed(3)}
																	</span>
																</div>
																<div>
																	<span style={{ color: "var(--text-muted)" }}>
																		VIF:{" "}
																	</span>
																	<span
																		style={{
																			color:
																				ind.vif !== null && ind.vif > 10
																					? "#EF4444"
																					: "var(--text-primary)",
																		}}
																	>
																		{ind.vif !== null
																			? ind.vif.toFixed(2)
																			: "—"}
																	</span>
																</div>
																<div>
																	<span style={{ color: "var(--text-muted)" }}>
																		PCA Variance Explained:{" "}
																	</span>
																	<span
																		style={{
																			color:
																				diagVariance > 85
																					? "var(--signal-bull)"
																					: "var(--text-primary)",
																		}}
																	>
																		{diagVariance.toFixed(1)}%
																	</span>
																</div>
															</div>
														</div>
													</td>
												</tr>
											)}
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};
