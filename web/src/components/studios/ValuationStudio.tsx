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
	type Time,
	LineStyle,
	CandlestickSeries,
	AreaSeries,
	PriceScaleMode,
} from "lightweight-charts";
import { AlertTriangle, CheckCircle2, Layers, Download } from "lucide-react";
import { Sparkline } from "../Sparkline";
import { MetricDetailChart } from "./MetricDetailChart";
import { exportChartsToPng } from "../../lib/exportPng";

type MaximizedPanel = null | "btc" | "val";

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
			fontFamily: "JetBrains Mono",
			fontSize: 11,
		},
		grid: {
			vertLines: { color: GRID_COLOR },
			horzLines: { color: GRID_COLOR },
		},
		rightPriceScale: {
			minimumWidth: yAxisWidth,
			borderColor: BORDER_COLOR,
			autoScale: true,
		},
		timeScale: {
			borderColor: BORDER_COLOR,
			timeVisible: true,
			secondsVisible: false,
		},
		crosshair: { mode: CrosshairMode.Normal },
		handleScroll: { vertTouchDrag: false },
	};
}

function getPanelHeights(maximized: MaximizedPanel, isMobile: boolean) {
	const full = window.visualViewport?.height || window.innerHeight;
	switch (maximized) {
		case "btc":
			return { btc: full, val: 0 };
		case "val":
			return {
				btc: Math.floor(full * 0.65),
				val: Math.floor(full * 0.35),
			};
		default:
			return isMobile ? { btc: 160, val: 120 } : { btc: 300, val: 240 };
	}
}

const INDICATOR_METADATA: Record<
	string,
	{ name: string; category: string; description: string }
> = {
	aviv_ratio: {
		name: "AVIV Ratio",
		category: "Fundamental",
		description: "Active Value to Investor Value ratio",
	},
	aviv_nupl: {
		name: "AVIV NUPL",
		category: "Fundamental",
		description: "Active Value Net Unrealized Profit/Loss",
	},
	cvdd_ratio: {
		name: "CVDD Ratio",
		category: "Fundamental",
		description: "Cumulative Value Coins Destroyed Days ratio",
	},
	mvrv_z: {
		name: "MVRV Z-Score",
		category: "Fundamental",
		description: "Market Value to Realized Value standardized Z-score",
	},
	lth_sth_sopr_ratio: {
		name: "LTH/STH SOPR Ratio",
		category: "Fundamental",
		description: "Long-term to Short-term holder Spent Output Profit Ratio",
	},
	terminal_price_ratio: {
		name: "Terminal Price Ratio",
		category: "Fundamental",
		description: "Current price relative to the terminal cycle bottom model",
	},
	unrealized_sell_risk: {
		name: "Unrealized Sell Risk",
		category: "Fundamental",
		description: "Proportion of total supply at risk of profit taking",
	},
	sharpe_ratio_52w: {
		name: "Sharpe Ratio (52w)",
		category: "Technical",
		description: "52-week risk-adjusted return ratio",
	},
	pi_cycle_top: {
		name: "Pi Cycle Top",
		category: "Technical",
		description: "Intersection proximity of 111d SMA and 2x 350d SMA",
	},
	vpli: {
		name: "VPLI",
		category: "Technical",
		description: "Volatility Price Leverage Index",
	},
	risk_metrics: {
		name: "Risk Metrics",
		category: "Technical",
		description: "Composite technical market cycle risk score",
	},
	dvrsi: {
		name: "DVRSI",
		category: "Technical",
		description: "Denoised Volatility Relative Strength Index",
	},
	williams_r: {
		name: "Williams %R",
		category: "Technical",
		description:
			"Bounded momentum oscillator showing overbought/oversold levels",
	},
	two_year_ma: {
		name: "2-Year MA Multiplier",
		category: "Technical",
		description: "Price relative to the 2-year simple moving average",
	},
	ahr999: {
		name: "AHR999 Index",
		category: "Technical",
		description:
			"Bitcoin cheapness index based on MA and log growth regression",
	},
	fear_greed_og: {
		name: "Fear & Greed (OG)",
		category: "Sentiment",
		description: "Original multi-factor market sentiment index",
	},
	fear_greed_cmc: {
		name: "Fear & Greed (CMC)",
		category: "Sentiment",
		description: "CoinMarketCap-aligned market sentiment index",
	},
};

export const ValuationStudio: React.FC = () => {
	const { dailyData, isLoading: terminalLoading, error: terminalError, refreshData } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [localLoading, setLocalLoading] = useState(true);
	const [localError, setLocalError] = useState<string | null>(null);
	const [retryTrigger, setRetryTrigger] = useState(0);

	const isLoading = terminalLoading || localLoading;
	const currentError = terminalError || localError;

	const [selectedCategory, setSelectedCategory] = useState<string>("All");
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const valContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{ btc: IChartApi | null; val: IChartApi | null }>({
		btc: null,
		val: null,
	});
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	useEffect(() => {
		setLocalLoading(true);
		setLocalError(null);
		quantClient
			.getComponents("quant-btc-valuation-system", undefined, 2000)
			.then((data) => {
				setComponents(data);
				setLocalLoading(false);
			})
			.catch((e) => {
				console.error("Failed to load valuation components:", e);
				setLocalError(e.message || "Failed to load valuation components");
				setLocalLoading(false);
			});
	}, [retryTrigger]);

	// Log/linear toggle on BTC price scale
	useEffect(() => {
		const chart = chartsRef.current.btc;
		if (!chart) return;
		chart.priceScale("right").applyOptions({
			mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
		});
	}, [isLogScale]);

	// Handle maximize: resize charts and update time axis visibility
	useEffect(() => {
		const { btc, val } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		btc.resize(w, heights.btc);
		if (val) val.resize(w, heights.val);

		// BTC time axis visible only when it's the only visible pane
		btc.timeScale().applyOptions({ visible: heights.val === 0 });
		if (val) val.timeScale().applyOptions({ visible: heights.val > 0 });
	}, [maximized, isMobile]);

	// Initialize 2-pane charts
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!valContainerRef.current
		)
			return;

		const common = makeCommonOptions(getChartYAxisWidth());
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null, isMobile);

		// BTC Candlestick Pane (top, no time axis)
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
		});

		// Valuation Composite Pane (bottom, shows time axis)
		const valChart = createChart(valContainerRef.current, {
			...common,
			width: w,
			height: heights.val,
			timeScale: { ...common.timeScale, visible: true },
		});

		const valSeries = valChart.addSeries(AreaSeries, {
			topColor: "rgba(96,165,250,0.35)",
			bottomColor: "rgba(96,165,250,0.02)",
			lineColor: "#60A5FA",
			lineWidth: 2,
		});
		valSeries.createPriceLine({
			price: 1.5,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Bubble +1.50",
		});
		valSeries.createPriceLine({
			price: -1.0,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Discount -1.00",
		});
		valSeries.createPriceLine({
			price: 2.0,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Extreme Overvalued +2.00",
		});
		valSeries.createPriceLine({
			price: 0,
			color: "#64748B",
			lineWidth: 1,
			lineStyle: LineStyle.Solid,
			axisLabelVisible: true,
			title: "Neutral 0.00",
		});
		valSeries.createPriceLine({
			price: -2.0,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Extreme Undervalued -2.00",
		});

		chartsRef.current = { btc: btcChart, val: valChart };

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
		valSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				value: p.valuation_composite,
			})),
		);

		// Build O(1) lookups for crosshair synchronization
		const btcDataMap = new Map<string, number>();
		const valDataMap = new Map<string, number>();
		for (const p of dailyData) {
			btcDataMap.set(p.date, p.close);
			valDataMap.set(p.date, p.valuation_composite);
		}

		// Crosshair sync
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: valChart, series: valSeries },
		];

		allCharts.forEach(({ chart }, idx) => {
			chart.subscribeCrosshairMove((param) => {
				if (isSyncingRef.current) return;
				isSyncingRef.current = true;
				if (param.time) {
					const timeStr = param.time as string;
					const hovered = dailyData.find((p) => p.date === timeStr);
					setHoveredPoint(hovered || null);
					allCharts.forEach(({ chart: c, series: s }, i) => {
						if (i === idx) return;
						const val = i === 0
							? (btcDataMap.get(timeStr) ?? 0)
							: (valDataMap.get(timeStr) ?? 0);
						c.setCrosshairPosition(val, param.time as Time, s);
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

		// Resize observer
		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			if (!nw || nw <= 0) return;
			const yWidth = getChartYAxisWidth();
			btcChart.applyOptions({ width: nw });
			btcChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			valChart.applyOptions({ width: nw });
			valChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			valChart.remove();
			chartsRef.current = { btc: null, val: null };
		};
	}, [dailyData]); // eslint-disable-line react-hooks/exhaustive-deps

	const toNum = (val: any): number =>
		typeof val === "object" && val !== null
			? Number(val.score ?? val.oscillator ?? val.normalized_score ?? 0)
			: Number(val ?? 0);
	const displayPoint =
		hoveredPoint ||
		(dailyData.length > 0 ? dailyData[dailyData.length - 1] : null);
	const latestValScore = displayPoint
		? toNum(displayPoint.valuation_composite)
		: 0;
	const isBubble = latestValScore >= 1.5;
	const isDiscount = latestValScore <= -1.0;

	const displayIndicators = Object.entries(INDICATOR_METADATA)
		.filter(([_, meta]) => {
			if (selectedCategory === "All") return true;
			return meta.category === selectedCategory;
		})
		.map(([key, meta]) => {
			const metricSignals = components.filter((c) => c.component_name === key);
			const sortedHistory = [...metricSignals].sort((a, b) =>
				a.date.localeCompare(b.date),
			);

			const sparklinePoints = sortedHistory.slice(-90).map((s) => ({
				date: s.date.split("T")[0],
				value: toNum(s.normalized_score),
			}));

			const latestSignal = sortedHistory[sortedHistory.length - 1];
			const score = latestSignal ? toNum(latestSignal.normalized_score) : 0;
			const direction = latestSignal ? latestSignal.signal_direction : 0;

			return {
				key,
				name: meta.name,
				category: meta.category,
				description: meta.description,
				score,
				direction,
				sparklineData: sparklinePoints,
			};
		});

	const handleExportPng = () => {
		const chartPanel = document.querySelector(".chart-panel");
		if (!chartPanel) return;
		const subplots = Array.from(
			chartPanel.querySelectorAll(".chart-subplot"),
		) as HTMLElement[];
		const today = new Date().toISOString().split("T")[0];
		const filename = selectedMetric
			? `btc-valuation-${selectedMetric}-${today}.png`
			: `btc-valuation-${today}.png`;
		exportChartsToPng(subplots, filename);
	};

	const heights = getPanelHeights(maximized, isMobile);

	return (
		<div
			className={maximized !== null ? "chart-fullscreen-active" : ""}
			style={{ display: "flex", flexDirection: "column", gap: "16px" }}
		>
			{selectedMetric ? (
				<MetricDetailChart
					metricName={selectedMetric}
					metricDisplayName={
						INDICATOR_METADATA[selectedMetric]?.name || selectedMetric
					}
					onClose={() => setSelectedMetric(null)}
				/>
			) : (
				<>
					{/* Pillar Header Info Bar */}
					<div
						className="glass-card"
						style={{
							padding: "12px 16px",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<div>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									marginBottom: "4px",
								}}
							>
								<span
									style={{
										fontSize: "12px",
										fontWeight: 600,
										color: "var(--signal-quant)",
										textTransform: "uppercase",
									}}
								>
									PILLAR 1 TELEMETRY
								</span>
								<span
									style={{
										fontSize: "12px",
										color: "var(--text-dim)",
										fontFamily: "JetBrains Mono",
									}}
								>
									piecewise_linear_interpolate()
								</span>
							</div>
							<h2 style={{ fontSize: "20px", fontWeight: 700 }}>
								17-Indicator Piecewise Linear Valuation Model
							</h2>
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
							<div style={{ textAlign: "right", fontFamily: "JetBrains Mono" }}>
								<div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
									COMPOSITE SCORE
								</div>
								<div
									style={{
										fontSize: "24px",
										fontWeight: 700,
										color: isBubble
											? "var(--signal-bear)"
											: isDiscount
												? "var(--signal-quant)"
												: "var(--text-primary)",
									}}
								>
									{latestValScore > 0
										? `+${latestValScore.toFixed(4)}`
										: latestValScore.toFixed(4)}
								</div>
							</div>
							<div
								className="glass-card"
								style={{
									padding: "8px 12px",
									display: "flex",
									alignItems: "center",
									gap: "8px",
								}}
							>
								{isBubble ? (
									<>
										<AlertTriangle
											size={18}
											style={{ color: "var(--signal-bear)" }}
										/>{" "}
										<span
											style={{
												fontSize: "13px",
												fontWeight: 700,
												color: "var(--signal-bear)",
											}}
										>
											BUBBLE FILTER ACTIVE
										</span>
									</>
								) : isDiscount ? (
									<>
										<CheckCircle2
											size={18}
											style={{ color: "var(--signal-quant)" }}
										/>{" "}
										<span
											style={{
												fontSize: "13px",
												fontWeight: 700,
												color: "var(--signal-quant)",
											}}
										>
											ACCUMULATION ZONE (Discount ≤ -1.00)
										</span>
									</>
								) : (
									<>
										<CheckCircle2
											size={18}
											style={{ color: "var(--signal-bull)" }}
										/>{" "}
										<span
											style={{
												fontSize: "13px",
												fontWeight: 600,
												color: "var(--signal-bull)",
											}}
										>
											FAIR MARKET CYCLE ZONE
										</span>
									</>
								)}
							</div>
						</div>
					</div>

					{/* LOG/LIN + Maximize controls */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "10px",
							justifyContent: "flex-end",
						}}
					>
						{maximized !== null && (
							<button
								className="icon-btn"
								onClick={() => setMaximized(null)}
								title="Restore all panels"
								style={{ fontSize: "15px", width: "auto", padding: "0 8px" }}
							>
								✕ Restore
							</button>
						)}
						<button
							className="toggle-btn"
							onClick={handleExportPng}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "6px",
								backgroundColor: "rgba(30, 41, 59, 0.5)",
								border: "1px solid var(--border-panel)",
								padding: "6px 12px",
								borderRadius: "4px",
								cursor: "pointer",
								color: "var(--text-primary)",
								fontSize: "12px",
								fontWeight: 600,
							}}
						>
							<Download size={14} /> SAVE PNG
						</button>
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

					{/* Single seamless chart panel — 2 subplots */}
					<div
						className={`chart-panel ${maximized !== null ? "fullscreen" : ""}`}
						ref={wrapperRef}
						style={{ position: "relative", pointerEvents: isLoading ? "none" : "auto" }}
					>
						{/* Loading overlay */}
						{isLoading && (
							<div style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								backgroundColor: "rgba(11, 18, 32, 0.8)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								zIndex: 10,
								pointerEvents: "all"
							}}>
								<div className="text-slate-400 font-mono text-sm animate-pulse flex items-center gap-2">
									<svg className="animate-spin" style={{ width: "18px", height: "18px", color: "var(--signal-quant)" }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
										<path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									LOADING VALUATION TELEMETRY...
								</div>
							</div>
						)}

						{/* Error overlay */}
						{currentError && (
							<div style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								backgroundColor: "rgba(11, 18, 32, 0.95)",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								zIndex: 11,
								gap: "16px",
								padding: "20px",
								pointerEvents: "all"
							}}>
								<div style={{ color: "#FFAAAA", fontSize: "14px", fontFamily: "JetBrains Mono" }}>
									ERROR: {currentError}
								</div>
								<button
									onClick={() => {
										refreshData();
										setRetryTrigger(prev => prev + 1);
									}}
									style={{
										padding: "8px 16px",
										backgroundColor: "var(--signal-bear)",
										color: "#fff",
										border: "none",
										borderRadius: "4px",
										fontWeight: 600,
										cursor: "pointer"
									}}
								>
									RETRY CONNECTION
								</button>
							</div>
						)}

						{/* BTC Candlestick Pane */}
						<div
							className={`chart-subplot ${heights.btc === 0 ? "chart-subplot-hidden" : ""}`}
						>
							<div className="chart-subplot-header">
								<span
									className="subplot-title"
									style={{ color: "var(--text-dim)" }}
								>
									MasterOHLCV Price · BTC/USD Candlestick
								</span>
								<div className="subplot-controls">
									<span
										style={{
											fontFamily: "JetBrains Mono",
											fontSize: "10px",
											color: "rgba(255,255,255,0.2)",
										}}
									>
										85px
									</span>
									<button
										className="icon-btn"
										onClick={() =>
											setMaximized(maximized === "btc" ? null : "btc")
										}
										title={
											maximized === "btc" ? "Restore" : "Maximize BTC pane"
										}
									>
										{maximized === "btc" ? "⊡" : "⤢"}
									</button>
								</div>
							</div>
							<div
								ref={btcContainerRef}
								style={{ width: "100%", height: `${heights.btc}px` }}
							/>
						</div>

						{/* Valuation Composite Pane */}
						<div
							className={`chart-subplot ${heights.val === 0 ? "chart-subplot-hidden" : ""}`}
						>
							<div className="chart-subplot-header">
								<span
									className="subplot-title"
									style={{ color: "var(--text-dim)" }}
								>
									Valuation Composite [-2.00 → +2.00] · Bubble +1.50 / Discount
									-1.00
								</span>
								<div className="subplot-controls">
									<span
										style={{
											fontFamily: "JetBrains Mono",
											fontSize: "10px",
											color: "rgba(255,255,255,0.2)",
										}}
									>
										85px
									</span>
									<button
										className="icon-btn"
										onClick={() =>
											setMaximized(maximized === "val" ? null : "val")
										}
										title={
											maximized === "val"
												? "Restore"
												: "Maximize Valuation pane"
										}
									>
										{maximized === "val" ? "⊡" : "⤢"}
									</button>
								</div>
							</div>
							<div
								ref={valContainerRef}
								style={{ width: "100%", height: `${heights.val}px` }}
							/>
						</div>
					</div>

					{/* Interactive Breakdown Table */}
					<div className="glass-card" style={{ padding: "12px" }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								marginBottom: "12px",
							}}
						>
							<div
								style={{ display: "flex", alignItems: "center", gap: "8px" }}
							>
								<Layers size={18} style={{ color: "var(--signal-quant)" }} />
								<span style={{ fontWeight: 600, fontSize: "15px" }}>
									Piecewise Linear Component Matrix
								</span>
							</div>
							<div style={{ display: "flex", gap: "6px" }}>
								{["All", "Fundamental", "Technical", "Sentiment"].map((cat) => (
									<button
										key={cat}
										onClick={() => setSelectedCategory(cat)}
										style={{
											padding: "6px 14px",
											borderRadius: "4px",
											border: "1px solid var(--border-panel)",
											backgroundColor:
												selectedCategory === cat
													? "var(--accent)"
													: "transparent",
											color:
												selectedCategory === cat ? "#000" : "var(--text-dim)",
											fontWeight: selectedCategory === cat ? 600 : 400,
											fontSize: "12px",
											cursor: "pointer",
										}}
									>
										{cat}
									</button>
								))}
							</div>
						</div>

						{isMobile ? (
							/* Mobile: Compact Two-Line List */
							<div className="mobile-metric-list">
								{displayIndicators.map((ind) => (
									<div
										key={ind.key}
										className="mobile-metric-row"
										onClick={() => setSelectedMetric(ind.key)}
										role="button"
										tabIndex={0}
										onKeyDown={(e) =>
											e.key === "Enter" && setSelectedMetric(ind.key)
										}
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
													fontFamily: "JetBrains Mono",
													fontSize: "13px",
													fontWeight: 700,
													flexShrink: 0,
													color:
														ind.score >= 1.0
															? "var(--signal-bear)"
															: ind.score <= -1.0
																? "var(--signal-quant)"
																: "var(--text-main)",
												}}
											>
												{ind.score > 0
													? `+${ind.score.toFixed(2)}`
													: ind.score.toFixed(2)}
											</span>
										</div>
										<div className="mobile-metric-row-bottom">
											<span
												style={{
													fontSize: "10px",
													padding: "2px 6px",
													borderRadius: "4px",
													fontFamily: "JetBrains Mono",
													flexShrink: 0,
													backgroundColor:
														ind.category === "Fundamental"
															? "rgba(96,165,250,0.1)"
															: ind.category === "Technical"
																? "rgba(168,85,247,0.1)"
																: "rgba(245,158,11,0.1)",
													color:
														ind.category === "Fundamental"
															? "var(--signal-quant)"
															: ind.category === "Technical"
																? "var(--signal-pca)"
																: "var(--accent)",
												}}
											>
												{ind.category}
											</span>
											<Sparkline
												data={ind.sparklineData}
												color={
													ind.direction === -1
														? "#22C55E"
														: ind.direction === 1
															? "#EF4444"
															: "#64748B"
												}
											/>
											<span
												style={{
													fontSize: "10px",
													fontWeight: 700,
													padding: "2px 8px",
													borderRadius: "4px",
													fontFamily: "JetBrains Mono",
													marginLeft: "auto",
													flexShrink: 0,
													backgroundColor:
														ind.direction === 1
															? "rgba(239,68,68,0.15)"
															: ind.direction === -1
																? "rgba(96,165,250,0.15)"
																: "rgba(255,255,255,0.05)",
													color:
														ind.direction === 1
															? "var(--signal-bear)"
															: ind.direction === -1
																? "var(--signal-quant)"
																: "var(--text-dim)",
												}}
											>
												{ind.direction === 1
													? "OVER"
													: ind.direction === -1
														? "DISC"
														: "NEUT"}
											</span>
										</div>
									</div>
								))}
							</div>
						) : (
							/* Desktop: Full Table */
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
												fontFamily: "JetBrains Mono",
											}}
										>
											<th style={{ padding: "8px 6px" }}>Indicator Name</th>
											<th style={{ padding: "8px 6px" }}>Category</th>
											<th style={{ padding: "8px 6px" }}>Description</th>
											<th style={{ padding: "8px 6px", textAlign: "center" }}>
												Trend
											</th>
											<th style={{ padding: "8px 6px", textAlign: "right" }}>
												Piecewise Score [-2, +2]
											</th>
											<th style={{ padding: "8px 6px", textAlign: "center" }}>
												Signal Direction
											</th>
										</tr>
									</thead>
									<tbody>
										{displayIndicators.map((ind) => (
											<tr
												key={ind.key}
												onClick={() => setSelectedMetric(ind.key)}
												style={{
													borderBottom: "1px solid rgba(255,255,255,0.03)",
													fontSize: "13px",
													cursor: "pointer",
												}}
												className="hover:bg-slate-800/30 transition-colors"
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
															fontFamily: "JetBrains Mono",
															backgroundColor:
																ind.category === "Fundamental"
																	? "rgba(96,165,250,0.1)"
																	: ind.category === "Technical"
																		? "rgba(168,85,247,0.1)"
																		: "rgba(245,158,11,0.1)",
															color:
																ind.category === "Fundamental"
																	? "var(--signal-quant)"
																	: ind.category === "Technical"
																		? "var(--signal-pca)"
																		: "var(--accent)",
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
													style={{ padding: "10px 6px", textAlign: "center" }}
												>
													<Sparkline
														data={ind.sparklineData}
														color={
															ind.direction === -1
																? "#22C55E"
																: ind.direction === 1
																	? "#EF4444"
																	: "#64748B"
														}
													/>
												</td>
												<td
													style={{
														padding: "10px 6px",
														textAlign: "right",
														fontFamily: "JetBrains Mono",
														fontWeight: 700,
														color:
															ind.score >= 1.0
																? "var(--signal-bear)"
																: ind.score <= -1.0
																	? "var(--signal-quant)"
																	: "var(--text-primary)",
													}}
												>
													{ind.score > 0
														? `+${ind.score.toFixed(3)}`
														: ind.score.toFixed(3)}
												</td>
												<td
													style={{ padding: "10px 6px", textAlign: "center" }}
												>
													<span
														style={{
															fontSize: "11px",
															fontWeight: 700,
															padding: "4px 10px",
															borderRadius: "4px",
															fontFamily: "JetBrains Mono",
															backgroundColor:
																ind.direction === 1
																	? "rgba(239,68,68,0.15)"
																	: ind.direction === -1
																		? "rgba(96,165,250,0.15)"
																		: "rgba(255,255,255,0.05)",
															color:
																ind.direction === 1
																	? "var(--signal-bear)"
																	: ind.direction === -1
																		? "var(--signal-quant)"
																	: "var(--text-dim)",
														}}
													>
														{ind.direction === 1
															? "OVERVALUED (+1)"
															: ind.direction === -1
																? "DISCOUNT (-1)"
																: "NEUTRAL (0)"}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};
