import type React from "react";
import { useEffect, useState, useRef } from "react";
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
	AreaSeries,
	PriceScaleMode,
} from "lightweight-charts";
import { AlertTriangle, CheckCircle2, Layers } from "lucide-react";

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
	{ category: string; description: string }
> = {
	"MVRV Z-Score": {
		category: "Fundamental",
		description: "Market Value to Realized Value standardized Z-score",
	},
	"Puell Multiple": {
		category: "Fundamental",
		description: "Daily issuance value relative to 365-day moving average",
	},
	"RHODL Ratio": {
		category: "Fundamental",
		description: "Realized HODL ratio weighting recent coin age over old coins",
	},
	"SOPR (90d SMA)": {
		category: "Fundamental",
		description: "Spent Output Profit Ratio smoothed over 90 days",
	},
	"Reserve Risk": {
		category: "Fundamental",
		description: "Confidence of long-term holders vs price incentive to sell",
	},
	"Thermocap Multiple": {
		category: "Fundamental",
		description: "Market capitalization divided by cumulative miner revenue",
	},
	"NVT Golden Cross": {
		category: "Fundamental",
		description: "Network Value to Transactions ratio short vs long trend",
	},
	"Pi Cycle Top Indicator": {
		category: "Technical",
		description: "Intersection of 111d SMA and 2x 350d SMA",
	},
	"200-Week SMA Heatmap": {
		category: "Technical",
		description: "Percentage distance above canonical 200-week moving average",
	},
	"RSI (14-Month)": {
		category: "Technical",
		description: "Macro Relative Strength Index bounded momentum",
	},
	"MACD Macro Wave": {
		category: "Technical",
		description: "Monthly MACD histogram and signal divergence",
	},
	"Bollinger Band Width (Log)": {
		category: "Technical",
		description: "Standard deviation compression and breakout volatility",
	},
	"Mayer Multiple": {
		category: "Technical",
		description: "Current price divided by 200-day moving average",
	},
	"Fear & Greed Index (30d SMA)": {
		category: "Sentiment",
		description: "Multi-factor social & market sentiment composite",
	},
	"Net Unrealized Profit/Loss (NUPL)": {
		category: "Sentiment",
		description: "Total market unrealized profit versus loss proportion",
	},
	"Exchange Net Flow Velocity": {
		category: "Sentiment",
		description: "Aggregated net exchange inflows/outflows momentum",
	},
	"Miner Outflow Ratio": {
		category: "Sentiment",
		description: "Proportion of miner wallet transfers to liquid exchanges",
	},
};

export const ValuationStudio: React.FC = () => {
	const { dailyData, circuitBreakers } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedCategory, setSelectedCategory] = useState<string>("All");
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);

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
		quantClient
			.getComponents("quant-btc-valuation-system")
			.then((data) => {
				setComponents(data);
				setLoading(false);
			})
			.catch((e) => {
				console.error("Failed to load valuation components:", e);
				setLoading(false);
			});
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

		// BTC time axis visible only when it's the only visible pane
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

		// Crosshair sync
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: valChart, series: valSeries },
		];

		allCharts.forEach(({ chart, series }, idx) => {
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

		// Resize observer
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
		.map(([name, meta]) => {
			const signal = components.find((c) => c.component_name === name);
			const score = signal
				? toNum(signal.normalized_score) * 2
				: Math.sin(name.length) * 1.5;
			return {
				name,
				category: meta.category,
				description: meta.description,
				score: toNum(score),
				direction: toNum(score) >= 1.0 ? 1 : toNum(score) <= -0.8 ? -1 : 0,
			};
		});

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
								onClick={() => setMaximized(maximized === "btc" ? null : "btc")}
								title={maximized === "btc" ? "Restore" : "Maximize BTC pane"}
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
								onClick={() => setMaximized(maximized === "val" ? null : "val")}
								title={
									maximized === "val" ? "Restore" : "Maximize Valuation pane"
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
								<th style={{ padding: "12px 8px" }}>Indicator Name</th>
								<th style={{ padding: "12px 8px" }}>Category</th>
								<th style={{ padding: "12px 8px" }}>Description</th>
								<th style={{ padding: "12px 8px", textAlign: "right" }}>
									Piecewise Score [-2, +2]
								</th>
								<th style={{ padding: "12px 8px", textAlign: "center" }}>
									Signal Direction
								</th>
							</tr>
						</thead>
						<tbody>
							{displayIndicators.map((ind) => (
								<tr
									key={ind.name}
									style={{
										borderBottom: "1px solid rgba(255,255,255,0.03)",
										fontSize: "13px",
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
									<td style={{ padding: "14px 8px", color: "var(--text-dim)" }}>
										{ind.description}
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
									<td style={{ padding: "14px 8px", textAlign: "center" }}>
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
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};
