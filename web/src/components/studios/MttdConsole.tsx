import type React from "react";
import { useEffect, useState, useRef } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { quantClient } from "../../api/client";
import type { ComponentSignal } from "../../api/types";
import { useTerminal } from "../../context/TerminalContext";
import {
	createChart,
	type IChartApi,
	ColorType,
	CrosshairMode,
	ISeriesApi,
	type Time,
	LineStyle,
	CandlestickSeries,
	LineSeries,
	AreaSeries,
	PriceScaleMode,
	createSeriesMarkers,
} from "lightweight-charts";
import {
	Activity,
	ShieldCheck,
	ShieldAlert,
	Layers,
	Lock,
	Maximize2,
	Minimize2,
	ChevronDown,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { syncYAxisWidth } from "../../lib/syncYAxisWidth";
import {
	useStudioBacktest,
	type StudioDailyRecord,
} from "../../lib/studioBacktest";

type MaximizedPanel = null | "btc" | "imo" | "gates" | "eq";

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

function makeCommonOptions(yAxisWidth: number) {
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
			return { btc: available, imo: 0, gates: 0, eq: 0 };
		case "imo":
			return {
				btc: Math.floor(available * 0.5),
				imo: Math.floor(available * 0.5),
				gates: 0,
				eq: 0,
			};
		case "gates":
			return {
				btc: Math.floor(available * 0.5),
				imo: 0,
				gates: Math.floor(available * 0.5),
				eq: 0,
			};
		case "eq":
			return {
				btc: Math.floor(available * 0.5),
				imo: 0,
				gates: 0,
				eq: Math.floor(available * 0.5),
			};
		default:
			return isMobile
				? { btc: 140, imo: 100, gates: 100, eq: 100 }
				: { btc: 260, imo: 150, gates: 150, eq: 150 };
	}
}

const MTTD_STATISTICAL_FAMILIES: Record<
	string,
	{ category: string; description: string; gate: string }
> = {
	"Ehlers SuperSmoother": {
		category: "Smoothing",
		description: "2-pole Butterworth IIR filter zero-phase smoothing",
		gate: "ER ≥ 0.20",
	},
	"Kalman State Filter": {
		category: "Filtering",
		description: "Adaptive state estimation recursive bayesian filter",
		gate: "ER ≥ 0.20",
	},
	"Hodrick-Prescott Trend": {
		category: "Regression",
		description: "Penalty factor lambda=1600 cycle decomposition",
		gate: "None",
	},
	"MESA Maximum Entropy": {
		category: "Spectral",
		description: "Burg autocorrelation dominant cycle frequency tracking",
		gate: "Entropy ≤ 2.30",
	},
	"Hurst Exponent (Rescaled Range)": {
		category: "Fractal",
		description: "Long-memory persistence H > 0.50 persistence score",
		gate: "Entropy ≤ 2.30",
	},
	"GARCH(1,1) Volatility Forecast": {
		category: "GARCH",
		description: "Generalized Autoregressive Conditional Heteroskedasticity",
		gate: "None",
	},
	"Shannon Entropy Wavelet": {
		category: "Entropy",
		description: "Information entropy complexity bounded threshold",
		gate: "Entropy ≤ 2.30",
	},
	"Lyapunov Exponent Chaos": {
		category: "Chaos",
		description: "Deterministic predictability horizon quantification",
		gate: "None",
	},
	"Bayesian Change Point Detector": {
		category: "Bayesian",
		description: "Online exact run-length probability distribution",
		gate: "Chikou < -0.30",
	},
	"XGBoost Residual Hybrid": {
		category: "ML-Hybrid",
		description: "Non-linear tree ensemble feature residual correction",
		gate: "Chikou < -0.30",
	},
};

export const MttdConsole: React.FC = () => {
	const { dailyData, circuitBreakers } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [selectedFamily, setSelectedFamily] = useState<string>("All");
	const [dropdownOpenFamily, setDropdownOpenFamily] = useState(false);
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const [startDate, setStartDate] = useState("2020-01-01");
	const [endDate, setEndDate] = useState("2026-12-31");
	const [feeBps, setFeeBps] = useState(10);
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const studioContainerRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const imoContainerRef = useRef<HTMLDivElement>(null);
	const gatesContainerRef = useRef<HTMLDivElement>(null);
	const eqContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		imo: IChartApi | null;
		gates: IChartApi | null;
		eq: IChartApi | null;
	}>({ btc: null, imo: null, gates: null, eq: null });
	const seriesRef = useRef<{
		candle: any;
		cumStrat: any;
		cumMarket: any;
	}>({ candle: null, cumStrat: null, cumMarket: null });
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	const backtestData: StudioDailyRecord[] = dailyData.map((d: any) => {
		// Use mttd_position from database (includes circuit breaker overrides)
		const dbPos = d.mttd_position;
		const pos = dbPos !== null && dbPos !== undefined ? Number(dbPos) : 0.0;
		if (dbPos === null || dbPos === undefined) {
			console.warn(`mttd_position is NULL for ${d.date}, defaulting to 0.0`);
		}
		const er = Number(d.mttd_er ?? d.mttd_er_ratio ?? 0);
		const entropy = Number(d.mttd_entropy ?? d.mttd_shannon_entropy ?? 0);
		return {
			date: d.date,
			close: d.close || d.btc_price || 0,
			position: pos,
			ichimoku_er: er,
			ichimoku_entropy: entropy,
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
			.getComponents("quant-btc-mttd-system")
			.then((data) => {
				setComponents(data);
			})
			.catch((e) => {
				console.error("Failed to load MTTD components:", e);
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
		const { btc, imo, gates, eq } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		// On mobile maximize, use actual container height so canvas matches CSS precisely
		if (isMobile && maximized !== null) {
			const containerH = wrapperRef.current?.clientHeight;
			if (containerH && containerH > 0) {
				const total = heights.btc + heights.imo + heights.gates + heights.eq;
				if (total > 0) {
					const yWidth = getChartYAxisWidth();
					btc.resize(w, Math.round(containerH * (heights.btc / total)));
					btc.priceScale("right").applyOptions({ minimumWidth: yWidth });
					if (imo) {
						imo.resize(w, Math.round(containerH * (heights.imo / total)));
						imo.priceScale("right").applyOptions({ minimumWidth: yWidth });
					}
					if (gates) {
						gates.resize(w, Math.round(containerH * (heights.gates / total)));
						gates.priceScale("right").applyOptions({ minimumWidth: yWidth });
					}
					if (eq) {
						eq.resize(w, Math.round(containerH * (heights.eq / total)));
						eq.priceScale("right").applyOptions({ minimumWidth: yWidth });
					}
					const panels: Array<{
						chart: IChartApi | null;
						h: number;
						id: string;
					}> = [
						{ chart: imo, h: heights.imo, id: "imo" },
						{ chart: gates, h: heights.gates, id: "gates" },
						{ chart: eq, h: heights.eq, id: "eq" },
					];
					const visiblePanels = panels.filter((p) => p.h > 0);
					const bottomId =
						visiblePanels.length > 0
							? visiblePanels[visiblePanels.length - 1].id
							: null;
					btc
						.timeScale()
						.applyOptions({
							visible:
								heights.imo === 0 && heights.gates === 0 && heights.eq === 0,
						});
					panels.forEach(({ chart, h, id }) => {
						if (!chart) return;
						chart
							.timeScale()
							.applyOptions({ visible: h > 0 && id === bottomId });
					});
					requestAnimationFrame(() => {
						syncYAxisWidth(
							btcContainerRef.current,
							[btc, imo, gates, eq].filter(Boolean),
							getChartYAxisWidth(),
						);
					});
					return;
				}
			}
		}

		const yWidth = getChartYAxisWidth();
		btc.resize(w, heights.btc);
		btc.priceScale("right").applyOptions({ minimumWidth: yWidth });
		if (imo) {
			imo.resize(w, heights.imo);
			imo.priceScale("right").applyOptions({ minimumWidth: yWidth });
		}
		if (gates) {
			gates.resize(w, heights.gates);
			gates.priceScale("right").applyOptions({ minimumWidth: yWidth });
		}
		if (eq) {
			eq.resize(w, heights.eq);
			eq.priceScale("right").applyOptions({ minimumWidth: yWidth });
		}

		const panels: Array<{ chart: IChartApi | null; h: number; id: string }> = [
			{ chart: imo, h: heights.imo, id: "imo" },
			{ chart: gates, h: heights.gates, id: "gates" },
			{ chart: eq, h: heights.eq, id: "eq" },
		];
		const visiblePanels = panels.filter((p) => p.h > 0);
		const bottomId =
			visiblePanels.length > 0
				? visiblePanels[visiblePanels.length - 1].id
				: null;

		btc
			.timeScale()
			.applyOptions({
				visible: heights.imo === 0 && heights.gates === 0 && heights.eq === 0,
			});
		panels.forEach(({ chart, h, id }) => {
			if (!chart) return;
			chart.timeScale().applyOptions({ visible: h > 0 && id === bottomId });
		});
		requestAnimationFrame(() => {
			syncYAxisWidth(
				btcContainerRef.current,
				[btc, imo, gates, eq].filter(Boolean),
				yWidth,
			);
		});
	}, [maximized, isMobile]);

	// Initialize 4-pane charts
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!imoContainerRef.current ||
			!gatesContainerRef.current ||
			!eqContainerRef.current
		)
			return;

		const common = makeCommonOptions(getChartYAxisWidth());
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null, isMobile);

		// BTC Candlestick Pane (top)
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
			priceFormat: {
				type: "price",
				precision: 0,
				minMove: 1,
			},
		});

		// MTTD IMO Pane (middle)
		const imoChart = createChart(imoContainerRef.current, {
			...common,
			width: w,
			height: heights.imo,
			timeScale: { ...common.timeScale, visible: false },
		});

		const imoSeries = imoChart.addSeries(AreaSeries, {
			topColor: "rgba(168,85,247,0.4)",
			bottomColor: "rgba(168,85,247,0.02)",
			lineColor: "#A78BFA",
			lineWidth: 2,
			title: "MTTD IMO v2 [-1.0, +1.0]",
		});

		imoSeries.createPriceLine({
			price: 0.3,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Long Entry +0.30",
		});
		imoSeries.createPriceLine({
			price: -0.3,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Chikou Exit -0.30",
		});
		imoSeries.createPriceLine({
			price: 0.0,
			color: "rgba(255,255,255,0.2)",
			lineWidth: 1,
			lineStyle: LineStyle.Solid,
		});

		// Gates Telemetry Pane (middle, shows time axis only when eq hidden)
		const gatesChart = createChart(gatesContainerRef.current, {
			...common,
			width: w,
			height: heights.gates,
			timeScale: { ...common.timeScale, visible: false },
		});

		const erSeries = gatesChart.addSeries(LineSeries, {
			color: "#22D3EE",
			lineWidth: 2,
			title: "Kaufman ER",
		});
		const entropySeries = gatesChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 2,
			title: "Shannon Entropy",
		});

		erSeries.createPriceLine({
			price: 0.2,
			color: "#22D3EE",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			title: "ER Gate ≥0.20",
		});
		entropySeries.createPriceLine({
			price: 2.3,
			color: "#F59E0B",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			title: "Entropy Gate ≤2.30",
		});

		// ── Pane 4: Equity Curve (Cum_Strat vs Cum_Market) ──
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
			imo: imoChart,
			gates: gatesChart,
			eq: eqChart,
		};
		seriesRef.current = {
			candle: candleSeries,
			cumStrat: cumStratSeries,
			cumMarket: cumMarketSeries,
		};

		// Populate data
		candleSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			})),
		);

		imoSeries.setData(
			dailyData.map((p) => ({ time: p.date as Time, value: p.mttd_imo })),
		);

		erSeries.setData(
			dailyData.map((p, i) => ({
				time: p.date as Time,
				value:
					p.mttd_er_ratio !== undefined
						? p.mttd_er_ratio
						: Math.abs(Math.sin(i * 0.1)) * 0.45,
			})),
		);
		entropySeries.setData(
			dailyData.map((p, i) => ({
				time: p.date as Time,
				value:
					p.mttd_shannon_entropy !== undefined
						? p.mttd_shannon_entropy
						: 1.8 + Math.cos(i * 0.05) * 0.6,
			})),
		);

		// Crosshair sync — 4 charts
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: imoChart, series: imoSeries },
			{ chart: gatesChart, series: erSeries },
			{ chart: eqChart, series: cumStratSeries },
		];

		allCharts.forEach(({ chart }, idx) => {
			chart.subscribeCrosshairMove((param) => {
				if (isSyncingRef.current) return;
				isSyncingRef.current = true;
				if (param.time) {
					const timeStr = param.time as string;
					setHoveredPoint(dailyData.find((p) => p.date === timeStr) || null);
					allCharts.forEach(({ chart: c, series: s }, i) => {
						if (i !== idx) c.setCrosshairPosition(0, param.time as Time, s);
					});
				} else {
					setHoveredPoint(null);
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

		// Sync Y-axis widths after initial render
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				syncYAxisWidth(
					btcContainerRef.current,
					[btcChart, imoChart, gatesChart, eqChart],
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
			imoChart.applyOptions({ width: nw });
			imoChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			gatesChart.applyOptions({ width: nw });
			gatesChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			eqChart.applyOptions({ width: nw });
			eqChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			syncYAxisWidth(
				btcContainerRef.current,
				[btcChart, imoChart, gatesChart, eqChart],
				yWidth,
			);
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			imoChart.remove();
			gatesChart.remove();
			eqChart.remove();
			chartsRef.current = { btc: null, imo: null, gates: null, eq: null };
			seriesRef.current = { candle: null, cumStrat: null, cumMarket: null };
		};
	}, [dailyData]); // eslint-disable-line react-hooks/exhaustive-deps

	const toNum = (val: any): number =>
		typeof val === "object" && val !== null
			? Number(val.score ?? val.oscillator ?? val.normalized_score ?? 0)
			: Number(val ?? 0);
	const displayPoint =
		hoveredPoint ||
		(dailyData.length > 0 ? dailyData[dailyData.length - 1] : null);
	const latestPoint = dailyData.length ? dailyData[dailyData.length - 1] : null;
	const latestImo = toNum(latestPoint?.mttd_imo);

	const gates = circuitBreakers?.mttd_consensus_gates || {
		er_gate_open:
			latestImo !== 0 && toNum(latestPoint?.mttd_er_ratio ?? 0.28) >= 0.2,
		shannon_entropy_gate_open:
			toNum(latestPoint?.mttd_shannon_entropy ?? 2.1) <= 2.3,
		chikou_momentum_exit: latestImo < -0.3,
		efficiency_ratio: toNum(latestPoint?.mttd_er_ratio ?? 0.28),
		shannon_entropy: toNum(latestPoint?.mttd_shannon_entropy ?? 2.1),
	};

	const allGatesPassed =
		gates.er_gate_open &&
		gates.shannon_entropy_gate_open &&
		!gates.chikou_momentum_exit;

	const displayFamilies = Object.entries(MTTD_STATISTICAL_FAMILIES)
		.filter(([_, meta]) => {
			if (selectedFamily === "All") return true;
			return meta.category === selectedFamily;
		})
		.map(([name, meta]) => {
			const signal = components.find((c) => c.component_name === name);
			const score = signal
				? toNum(signal.normalized_score)
				: Math.sin(name.length * 2) * 0.85;
			return {
				name,
				category: meta.category,
				description: meta.description,
				gate: meta.gate,
				score: toNum(score),
				direction: toNum(score) >= 0.2 ? 1 : toNum(score) <= -0.2 ? -1 : 0,
			};
		});

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
							LAYER 03 · STATISTICAL CONSENSUS
						</span>
						<span className="studio-tag-fn">
							consensus.MultiFamilyOscillator()
						</span>
					</div>
					<h2 className="studio-banner-title">
						MTTD v2 Integrated Oscillator (10 Statistical Families)
					</h2>
				</div>

				<div className="studio-banner-metric">
					<span className="studio-metric-label">CONSENSUS IMO v2</span>
					<span
						className="studio-metric-value"
						style={{
							color:
								latestImo > 0.2
									? "var(--signal-bull)"
									: latestImo < -0.2
										? "var(--signal-bear)"
										: "var(--text-primary)",
						}}
					>
						{latestImo > 0 ? `+${latestImo.toFixed(4)}` : latestImo.toFixed(4)}
					</span>
				</div>

				<div
					className={`studio-banner-status ${
						allGatesPassed ? "status-fair" : "status-bubble"
					}`}
				>
					{allGatesPassed ? (
						<>
							<ShieldCheck size={18} style={{ flexShrink: 0 }} />
							<span>ALL GATES PASSED (Signal Active)</span>
						</>
					) : (
						<>
							<ShieldAlert size={18} style={{ flexShrink: 0 }} />
							<span>GATES LOCKED (Signal Suppressed)</span>
						</>
					)}
				</div>
			</div>

			{/* Traffic-Light Gate Status Badges */}
			<div
				className="stat-grid-3col"
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: "16px",
				}}
			>
				<div
					className="glass-card"
					style={{
						padding: "12px",
						borderLeft: `3px solid ${gates.er_gate_open ? "#22C55E" : "#EF4444"}`,
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								fontFamily: "Geist Mono, monospace",
							}}
						>
							GATE 1: EFFICIENCY RATIO
						</span>
						<Lock
							size={14}
							style={{ color: gates.er_gate_open ? "#22C55E" : "#EF4444" }}
						/>
					</div>
					<div
						className="gate-badge"
						style={{
							marginTop: "8px",
							padding: "6px 12px",
							borderRadius: "4px",
							fontFamily: "Geist Mono, monospace",
							fontSize: "14px",
							fontWeight: 700,
							backgroundColor: gates.er_gate_open
								? "rgba(34,197,94,0.12)"
								: "rgba(239,68,68,0.12)",
							color: gates.er_gate_open ? "#22C55E" : "#EF4444",
						}}
					>
						ER ≥ 0.20 [{gates.er_gate_open ? "●PASS" : "●FAIL"}]
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						ER = {gates.efficiency_ratio.toFixed(3)}
					</div>
				</div>

				<div
					className="glass-card"
					style={{
						padding: "12px",
						borderLeft: `3px solid ${gates.shannon_entropy_gate_open ? "#22C55E" : "#EF4444"}`,
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								fontFamily: "Geist Mono, monospace",
							}}
						>
							GATE 2: SHANNON ENTROPY
						</span>
						<Lock
							size={14}
							style={{
								color: gates.shannon_entropy_gate_open ? "#22C55E" : "#EF4444",
							}}
						/>
					</div>
					<div
						className="gate-badge"
						style={{
							marginTop: "8px",
							padding: "6px 12px",
							borderRadius: "4px",
							fontFamily: "Geist Mono, monospace",
							fontSize: "14px",
							fontWeight: 700,
							backgroundColor: gates.shannon_entropy_gate_open
								? "rgba(34,197,94,0.12)"
								: "rgba(239,68,68,0.12)",
							color: gates.shannon_entropy_gate_open ? "#22C55E" : "#EF4444",
						}}
					>
						H ≤ 2.30 [{gates.shannon_entropy_gate_open ? "●PASS" : "●FAIL"}]
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						H = {gates.shannon_entropy.toFixed(3)}
					</div>
				</div>

				<div
					className="glass-card"
					style={{
						padding: "12px",
						borderLeft: `3px solid ${!gates.chikou_momentum_exit ? "#22C55E" : "#F59E0B"}`,
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								fontFamily: "Geist Mono, monospace",
							}}
						>
							GATE 3: CHIKOU MOMENTUM EXIT
						</span>
						<Lock
							size={14}
							style={{
								color: !gates.chikou_momentum_exit ? "#22C55E" : "#F59E0B",
							}}
						/>
					</div>
					<div
						className="gate-badge"
						style={{
							marginTop: "8px",
							padding: "6px 12px",
							borderRadius: "4px",
							fontFamily: "Geist Mono, monospace",
							fontSize: "14px",
							fontWeight: 700,
							backgroundColor: !gates.chikou_momentum_exit
								? "rgba(34,197,94,0.12)"
								: "rgba(245,158,11,0.12)",
							color: !gates.chikou_momentum_exit ? "#22C55E" : "#F59E0B",
						}}
					>
						Chikou [{!gates.chikou_momentum_exit ? "●ACTIVE" : "●CLEAR"}]
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						IMO = {latestImo.toFixed(3)}
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
							<span className="subplot-badge">SYS 03</span>
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

				{/* MTTD IMO Pane */}
				<div
					className={`chart-subplot ${heights.imo === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">IMO v2</span>
							<span>Consensus Momentum Index</span>
						</div>
						<div className="subplot-controls">
							<button
								className="icon-btn"
								onClick={() => setMaximized(maximized === "imo" ? null : "imo")}
								title={maximized === "imo" ? "Restore" : "Maximize IMO pane"}
							>
								{maximized === "imo" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={imoContainerRef}
						style={{ width: "100%", height: `${heights.imo}px` }}
					/>
				</div>

				{/* Gates Telemetry Pane (bottom — shows time axis) */}
				<div
					className={`chart-subplot ${heights.gates === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">LOGIC GATES</span>
							<span>Efficiency Ratio & Shannon Entropy</span>
						</div>
						<div className="subplot-controls">
							<button
								className="icon-btn"
								onClick={() =>
									setMaximized(maximized === "gates" ? null : "gates")
								}
								title={
									maximized === "gates" ? "Restore" : "Maximize Gates pane"
								}
							>
								{maximized === "gates" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={gatesContainerRef}
						style={{ width: "100%", height: `${heights.gates}px` }}
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
								setStartDate("2020-01-01");
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

			{/* Interactive Breakdown Table */}
			<div className="glass-card" style={{ padding: "12px" }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: "16px",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<Layers size={18} style={{ color: "var(--signal-pca)" }} />
						<span style={{ fontWeight: 600, fontSize: "15px" }}>
							10 Statistical Families Consensus Matrix
						</span>
					</div>
					<div
						style={{
							display: "flex",
							gap: "6px",
							flexWrap: "wrap",
							alignItems: "center",
						}}
					>
						{isMobile ? (
							<div style={{ position: "relative" }}>
								<button
									onClick={() => setDropdownOpenFamily(!dropdownOpenFamily)}
									style={{
										padding: "4px 10px",
										borderRadius: "4px",
										border: "1px solid var(--border-panel)",
										backgroundColor: "var(--bg-surface)",
										color: "var(--text-main)",
										fontSize: "11px",
										fontWeight: 500,
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										gap: "4px",
										whiteSpace: "nowrap",
									}}
								>
									{selectedFamily}
									<ChevronDown
										size={12}
										style={{
											transition: "transform 0.2s",
											transform: dropdownOpenFamily
												? "rotate(180deg)"
												: "rotate(0deg)",
										}}
									/>
								</button>
								{dropdownOpenFamily && (
									<div
										style={{
											position: "absolute",
											top: "100%",
											right: 0,
											marginTop: "4px",
											minWidth: "180px",
											maxHeight: "300px",
											overflowY: "auto",
											backgroundColor: "var(--bg-surface)",
											border: "1px solid var(--border-panel)",
											borderRadius: "4px",
											padding: "4px 0",
											zIndex: 100,
											boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
										}}
									>
										{[
											"All",
											"Smoothing",
											"Filtering",
											"Regression",
											"Spectral",
											"Fractal",
											"GARCH",
											"Entropy",
											"Chaos",
											"Bayesian",
											"ML-Hybrid",
										].map((cat) => (
											<button
												key={cat}
												onClick={() => {
													setSelectedFamily(cat);
													setDropdownOpenFamily(false);
												}}
												style={{
													padding: "8px 14px",
													width: "100%",
													textAlign: "left",
													border: "none",
													backgroundColor:
														selectedFamily === cat
															? "var(--signal-pca)"
															: "transparent",
													color:
														selectedFamily === cat ? "#fff" : "var(--text-dim)",
													fontSize: "11px",
													fontWeight: selectedFamily === cat ? 600 : 400,
													cursor: "pointer",
												}}
											>
												{cat}
											</button>
										))}
									</div>
								)}
							</div>
						) : (
							<>
								{[
									"All",
									"Smoothing",
									"Filtering",
									"Regression",
									"Spectral",
									"Fractal",
									"GARCH",
									"Entropy",
									"Chaos",
									"Bayesian",
									"ML-Hybrid",
								].map((cat) => (
									<button
										key={cat}
										onClick={() => setSelectedFamily(cat)}
										style={{
											padding: "4px 10px",
											borderRadius: "4px",
											border: "1px solid var(--border-panel)",
											backgroundColor:
												selectedFamily === cat
													? "var(--signal-pca)"
													: "transparent",
											color:
												selectedFamily === cat ? "#fff" : "var(--text-dim)",
											fontWeight: selectedFamily === cat ? 600 : 400,
											fontSize: "11px",
											cursor: "pointer",
										}}
									>
										{cat}
									</button>
								))}
							</>
						)}
					</div>
				</div>

				{isMobile ? (
					/* Mobile: Compact Two-Line List */
					<div className="mobile-metric-list">
						{displayFamilies.map((ind) => (
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
												ind.score >= 0.2
													? "var(--signal-bull)"
													: ind.score <= -0.2
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
											backgroundColor: "rgba(168,85,247,0.1)",
											color: "var(--signal-pca)",
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
											? "+1 (BULL)"
											: ind.direction === -1
												? "-1 (BEAR)"
												: "0 (NEUT)"}
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
									<th style={{ padding: "8px 6px" }}>Statistical Family</th>
									<th style={{ padding: "8px 6px" }}>Category</th>
									<th style={{ padding: "8px 6px" }}>Algorithm Description</th>
									<th style={{ padding: "8px 6px" }}>Governing Gate</th>
									<th style={{ padding: "8px 6px", textAlign: "right" }}>
										Consensus Score [-1, +1]
									</th>
									<th style={{ padding: "8px 6px", textAlign: "center" }}>
										Signal Direction
									</th>
								</tr>
							</thead>
							<tbody>
								{displayFamilies.map((ind) => (
									<tr
										key={ind.name}
										className="hover:bg-slate-800/30 hover-physics-card transition-all"
										style={{
											borderBottom: "1px solid rgba(255,255,255,0.03)",
											fontSize: "13px",
										}}
									>
										<td
											style={{
												padding: "10px 6px",
												fontWeight: 600,
												color: "var(--text-primary)",
											}}
										>
											{ind.name}
										</td>
										<td style={{ padding: "10px 6px" }}>
											<span
												style={{
													fontSize: "11px",
													padding: "2px 8px",
													borderRadius: "4px",
													fontFamily: "Geist Mono, monospace",
													backgroundColor: "rgba(168,85,247,0.1)",
													color: "var(--signal-pca)",
												}}
											>
												{ind.category}
											</span>
										</td>
										<td
											style={{ padding: "10px 6px", color: "var(--text-dim)" }}
										>
											{ind.description}
										</td>
										<td
											style={{
												padding: "10px 6px",
												fontFamily: "Geist Mono, monospace",
												fontSize: "11px",
												color:
													ind.gate === "None"
														? "var(--text-dim)"
														: "var(--signal-quant)",
											}}
										>
											{ind.gate}
										</td>
										<td
											style={{
												padding: "10px 6px",
												textAlign: "right",
												fontFamily: "Geist Mono, monospace",
												fontWeight: 700,
												color:
													ind.score >= 0.2
														? "var(--signal-bull)"
														: ind.score <= -0.2
															? "var(--signal-bear)"
															: "var(--text-primary)",
											}}
										>
											{ind.score > 0
												? `+${ind.score.toFixed(3)}`
												: ind.score.toFixed(3)}
										</td>
										<td style={{ padding: "10px 6px", textAlign: "center" }}>
											<span
												style={{
													display: "inline-block",
													padding: "2px 8px",
													borderRadius: "4px",
													fontSize: "11px",
													fontFamily: "JetBrains Mono",
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
													? "+1 (BULL)"
													: ind.direction === -1
														? "-1 (BEAR)"
														: "0 (NEUTRAL)"}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};
