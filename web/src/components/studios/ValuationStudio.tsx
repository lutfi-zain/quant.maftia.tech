import type React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
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
import { AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import { Sparkline } from "../../components/Sparkline";
import { MetricDetailChart } from "./MetricDetailChart";
import { exportChartPng } from "../../lib/exportPng";

type MaximizedPanel = null | "btc" | "val";

const BG_CHART = "#0B1220";
const BORDER_COLOR = "rgba(30, 41, 59, 0.8)";
const TEXT_COLOR = "#94A3B8";
const GRID_COLOR = "rgba(255,255,255,0.03)";

function makeCommonOptions() {
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
	};
}

function getPanelHeights(maximized: MaximizedPanel) {
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
			return { btc: 300, val: 240 };
	}
}

const INDICATOR_METADATA: Record<
  string,
  { name: string; category: string; description: string; dbName: string }
> = {
  'mvrv_z': {
    name: 'MVRV Z-Score',
    category: 'Fundamental',
    description: 'Market Value to Realized Value standardized Z-score',
    dbName: 'mvrv_z',
  },
  'pi_cycle_top': {
    name: 'Pi Cycle Top Indicator',
    category: 'Technical',
    description: 'Intersection of 111d SMA and 2x 350d SMA',
    dbName: 'pi_cycle_top',
  },
  'fear_greed_cmc': {
    name: 'Fear & Greed Index (CMC)',
    category: 'Sentiment',
    description: 'Multi-factor social & market sentiment composite',
    dbName: 'fear_greed_cmc',
  },
  'fear_greed_og': {
    name: 'Fear & Greed Index (OG)',
    category: 'Sentiment',
    description: 'Alternative fear & greed data source',
    dbName: 'fear_greed_og',
  },
  'aviv_nupl': {
    name: 'Net Unrealized Profit/Loss (NUPL)',
    category: 'Sentiment',
    description: 'Adjusted realized profit/loss ratio from AVIV metric',
    dbName: 'aviv_nupl',
  },
  'aviv_ratio': {
    name: 'Aviv Ratio',
    category: 'Fundamental',
    description: 'Adjusted value-in/value-out ratio by AVIV',
    dbName: 'aviv_ratio',
  },
  'ahr999': {
    name: 'AHR999 Index',
    category: 'Fundamental',
    description: 'Bitcoin cost-based valuation index for accumulation',
    dbName: 'ahr999',
  },
  'cvdd_ratio': {
    name: 'CVDD (Cumulative Value Destroyed/Days)',
    category: 'Fundamental',
    description: 'Market cap weighted cumulative value destroyed ratio',
    dbName: 'cvdd_ratio',
  },
  'dvrsi': {
    name: 'Dynamic RSI (DVRSI)',
    category: 'Technical',
    description: 'Volatility-adjusted relative strength index',
    dbName: 'dvrsi',
  },
  'lth_sth_sopr_ratio': {
    name: 'LTH/STH SOPR Ratio',
    category: 'Fundamental',
    description: 'Long-term holder vs short-term holder spent output profit ratio',
    dbName: 'lth_sth_sopr_ratio',
  },
  'risk_metrics': {
    name: 'Risk Metrics Index',
    category: 'Sentiment',
    description: 'Multi-factor risk assessment composite',
    dbName: 'risk_metrics',
  },
  'sharpe_ratio_52w': {
    name: 'Sharpe Ratio (52W)',
    category: 'Technical',
    description: 'Risk-adjusted return over 52-week rolling window',
    dbName: 'sharpe_ratio_52w',
  },
  'terminal_price_ratio': {
    name: 'Terminal Price Ratio',
    category: 'Fundamental',
    description: 'Bitcoin price relative to terminal price model',
    dbName: 'terminal_price_ratio',
  },
  'two_year_ma': {
    name: 'Two-Year MA Multiplier',
    category: 'Technical',
    description: 'Log-scale two-year moving average multiplier',
    dbName: 'two_year_ma',
  },
  'unrealized_sell_risk': {
    name: 'Unrealized Sell Risk',
    category: 'Sentiment',
    description: 'Proportion of unrealized profit being spent',
    dbName: 'unrealized_sell_risk',
  },
  'vpli': {
    name: 'VPLI (Volume Price Lock In)',
    category: 'Technical',
    description: 'Volume-price relationship divergence indicator',
    dbName: 'vpli',
  },
  'williams_r': {
    name: 'Williams %R',
    category: 'Technical',
    description: 'Momentum oscillator measuring overbought/oversold levels',
    dbName: 'williams_r',
  },
};

export const ValuationStudio: React.FC = () => {
	const { dailyData } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [selectedCategory, setSelectedCategory] = useState<string>("All");
	const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);

	// Sparkline data: map of component_name → last 90 normalized values
	const [sparklineData, setSparklineData] = useState<
		Record<string, { date: string; value: number }[]>
	>({});

	const wrapperRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const valContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{ btc: IChartApi | null; val: IChartApi | null }>({
		btc: null,
		val: null,
	});
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	// Fetch component signals and build sparkline data
	useEffect(() => {
		let cancelled = false;
		const fetchData = async () => {
			try {
				const data = await quantClient.getComponents(
					"VALUATION",
				);
				if (cancelled) return;
				setComponents(data);

				// Build sparkline data: group by component_name, sort, take last 90
				const grouped = new Map<string, ComponentSignal[]>();
				for (const d of data) {
					const existing = grouped.get(d.component_name) || [];
					existing.push(d);
					grouped.set(d.component_name, existing);
				}

				const sparkMap: Record<string, { date: string; value: number }[]> = {};
				for (const [name, signals] of grouped) {
					if (!(name in INDICATOR_METADATA)) continue;
					const sorted = signals
						.sort((a, b) => a.date.localeCompare(b.date))
						.slice(-90)
						.map((s) => ({
							date: s.date,
							value: s.normalized_score,
						}));
					sparkMap[name] = sorted;
				}
				setSparklineData(sparkMap);
			} catch (e) {
				if (!cancelled) {
					console.error("Failed to load valuation components:", e);
				}
			}
		};
		fetchData();
		return () => {
			cancelled = true;
		};
	}, []);

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
		const heights = getPanelHeights(maximized);
		const w = wrapperRef.current?.clientWidth || 900;

		btc.resize(w, heights.btc);
		if (val) val.resize(w, heights.val);

		btc.timeScale().applyOptions({ visible: heights.val === 0 });
		if (val) val.timeScale().applyOptions({ visible: heights.val > 0 });
	}, [maximized]);

	// Initialize 2-pane charts
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!valContainerRef.current
		)
			return;

		const common = makeCommonOptions();
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null);

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

		chartsRef.current = { btc: btcChart, val: valChart };

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

		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			btcChart.applyOptions({ width: nw });
			valChart.applyOptions({ width: nw });
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
		.map(([dbKey, meta]) => {
			const signal = components.find(
				(c) => c.component_name === meta.dbName,
			);
			const score = signal
				? toNum(signal.normalized_score) * 2
				: Math.sin(dbKey.length) * 1.5;
			return {
				dbKey,
				name: meta.name,
				dbName: meta.dbName,
				category: meta.category,
				description: meta.description,
				score: toNum(score),
				direction:
					toNum(score) >= 1.0
						? (1 as -1 | 0 | 1)
						: toNum(score) <= -0.8
							? (-1 as -1 | 0 | 1)
							: (0 as -1 | 0 | 1),
			};
		});

	const handleExportPng = useCallback(() => {
		if (selectedMetric) {
			// Export the detail chart — the MetricDetailChart handles its own export
			return;
		}
		exportChartPng([btcContainerRef.current, valContainerRef.current], {
			filename: `btc-valuation-composite-${new Date().toISOString().split("T")[0]}.png`,
		});
	}, [selectedMetric]);

	const heights = getPanelHeights(maximized);

	return (
		<div
			className={maximized !== null ? "chart-fullscreen-active" : ""}
			style={{ display: "flex", flexDirection: "column", gap: "24px" }}
		>
			{/* Pillar Header Info Bar */}
			<div
				className="glass-card"
				style={{
					padding: "20px 24px",
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
							padding: "10px 16px",
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

			{/* Controls: LOG/LIN, SAVE PNG */}
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
					className="icon-btn"
					onClick={handleExportPng}
					title="Save chart as PNG"
					style={{
						cursor: "pointer",
						fontSize: "12px",
						padding: "4px 10px",
						fontWeight: 600,
					}}
				>
					📸 SAVE PNG
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

			{/* Conditional rendering: composite chart OR metric detail chart */}
			{selectedMetric ? (
				<MetricDetailChart
					metricName={selectedMetric}
					onClose={() => setSelectedMetric(null)}
				/>
			) : (
				<>
					{/* Single seamless chart panel — 2 subplots */}
					<div
						className={`chart-panel ${maximized !== null ? "fullscreen" : ""}`}
						ref={wrapperRef}
					>
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
								style={{
									width: "100%",
									height: `${heights.btc}px`,
								}}
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
								style={{
									width: "100%",
									height: `${heights.val}px`,
								}}
							/>
						</div>
					</div>
				</>
			)}

			{/* Interactive Breakdown Table — always visible */}
			<div className="glass-card" style={{ padding: "20px" }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: "16px",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
									borderRadius: "6px",
									border: "1px solid var(--border-panel)",
									backgroundColor:
										selectedCategory === cat ? "var(--accent)" : "transparent",
									color: selectedCategory === cat ? "#000" : "var(--text-dim)",
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
								<th style={{ padding: "12px 8px" }}>Indicator</th>
								<th style={{ padding: "12px 8px" }}>Category</th>
								<th style={{ padding: "12px 8px" }}>Description</th>
								<th style={{ padding: "12px 8px", width: "90px" }}>
									Trend (90d)
								</th>
								<th style={{ padding: "12px 8px", textAlign: "right" }}>
									Piecewise Score [-2, +2]
								</th>
								<th style={{ padding: "12px 8px", textAlign: "center" }}>
									Signal Direction
								</th>
							</tr>
						</thead>
						<tbody>
							{displayIndicators.map((ind) => {
								const sparkColor =
									ind.direction === 1
										? "#EF4444"
										: ind.direction === -1
											? "#22C55E"
											: "#64748B";
								return (
									<tr
										key={ind.name}
										onClick={() => setSelectedMetric(ind.dbName)}
										style={{
											borderBottom: "1px solid rgba(255,255,255,0.03)",
											fontSize: "13px",
											cursor: "pointer",
											transition: "background-color 0.15s",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor =
												"rgba(96,165,250,0.05)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = "transparent";
										}}
									>
						<td
							style={{
								padding: "14px 8px",
								fontWeight: 600,
								color: "var(--text-primary)",
							}}
						>
							{ind.name}
							<span
								style={{
									fontSize: "9px",
									color: "var(--text-dim)",
									fontFamily: "JetBrains Mono",
									marginLeft: "6px",
									opacity: 0.5,
								}}
							>
								{ind.dbName}
							</span>
						</td>
										<td style={{ padding: "14px 8px" }}>
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
												padding: "14px 8px",
												color: "var(--text-dim)",
											}}
										>
											{ind.description}
										</td>
										<td
											style={{
												padding: "14px 8px",
												verticalAlign: "middle",
											}}
										>
											<Sparkline
												data={sparklineData[ind.dbName] || []}
												color={sparkColor}
											/>
										</td>
										<td
											style={{
												padding: "14px 8px",
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
											style={{
												padding: "14px 8px",
												textAlign: "center",
											}}
										>
											<span
												style={{
													fontSize: "11px",
													fontWeight: 700,
													padding: "4px 10px",
													borderRadius: "12px",
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
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};
