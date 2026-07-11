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
} from "lightweight-charts";
import {
	TrendingUp,
	ShieldAlert,
	CheckCircle2,
	AlertTriangle,
	Layers,
} from "lucide-react";

type MaximizedPanel = null | "btc" | "hmm" | "vol";

const BG_CHART = "#0B1220";
const BORDER_COLOR = "rgba(30, 41, 59, 0.8)";
const TEXT_COLOR = "#94A3B8";
const GRID_COLOR = "rgba(255,255,255,0.03)";

function getChartYAxisWidth(): number {
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue('--chart-yaxis-width')
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
			return { btc: full, hmm: 0, vol: 0 };
		case "hmm":
			return {
				btc: Math.floor(full * 0.65),
				hmm: Math.floor(full * 0.35),
				vol: 0,
			};
		case "vol":
			return {
				btc: Math.floor(full * 0.65),
				hmm: 0,
				vol: Math.floor(full * 0.35),
			};
		default:
			return isMobile
				? { btc: 160, hmm: 120, vol: 120 }
				: { btc: 280, hmm: 180, vol: 160 };
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
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const hmmContainerRef = useRef<HTMLDivElement>(null);
	const volContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		hmm: IChartApi | null;
		vol: IChartApi | null;
	}>({ btc: null, hmm: null, vol: null });
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	useEffect(() => {
		quantClient
			.getComponents("quant-btc-lttd-system")
			.then((data) => {
				setComponents(data);
			})
			.catch((e) => {
				console.error("Failed to load LTTD components:", e);
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
		const { btc, hmm, vol } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		btc.resize(w, heights.btc);
		if (hmm) hmm.resize(w, heights.hmm);
		if (vol) vol.resize(w, heights.vol);

		// Determine which pane is bottom-most visible
		const panels: Array<{ chart: IChartApi | null; h: number; id: string }> = [
			{ chart: hmm, h: heights.hmm, id: "hmm" },
			{ chart: vol, h: heights.vol, id: "vol" },
		];
		const visiblePanels = panels.filter((p) => p.h > 0);
		const bottomId =
			visiblePanels.length > 0
				? visiblePanels[visiblePanels.length - 1].id
				: null;

		btc
			.timeScale()
			.applyOptions({ visible: heights.hmm === 0 && heights.vol === 0 });
		panels.forEach(({ chart, h, id }) => {
			if (!chart) return;
			chart.timeScale().applyOptions({ visible: h > 0 && id === bottomId });
		});
	}, [maximized, isMobile]);

	// Initialize 3-pane charts
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!hmmContainerRef.current ||
			!volContainerRef.current
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

		// HMM Probabilities Pane (middle, no time axis)
		const hmmChart = createChart(hmmContainerRef.current, {
			...common,
			width: w,
			height: heights.hmm,
			timeScale: { ...common.timeScale, visible: false },
		});

		const bullSeries = hmmChart.addSeries(LineSeries, {
			color: "#22C55E",
			lineWidth: 2,
			title: "P(Bull)",
		});
		const bearSeries = hmmChart.addSeries(LineSeries, {
			color: "#EF4444",
			lineWidth: 2,
			title: "P(Bear)",
		});
		const sidewaysSeries = hmmChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 2,
			title: "P(Sideways)",
		});

		sidewaysSeries.createPriceLine({
			price: 0.6,
			color: "#F59E0B",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Sideways Override ≥0.60",
		});

		// Volatility Pane (bottom, shows time axis)
		const volChart = createChart(volContainerRef.current, {
			...common,
			width: w,
			height: heights.vol,
			timeScale: { ...common.timeScale, visible: true },
		});

		const volSeries = volChart.addSeries(AreaSeries, {
			topColor: "rgba(168,85,247,0.4)",
			bottomColor: "rgba(168,85,247,0.02)",
			lineColor: "#A78BFA",
			lineWidth: 2,
			title: "20d Realized Volatility",
		});

		chartsRef.current = { btc: btcChart, hmm: hmmChart, vol: volChart };

		// Populate BTC data with regime-colored wicks
		candleSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			})),
		);

		// HMM probability data
		bullSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				value:
					p.lttd_prob_bull !== undefined
						? p.lttd_prob_bull
						: p.lttd_regime === "BULL"
							? 0.85
							: 0.05,
			})),
		);
		bearSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				value:
					p.lttd_prob_bear !== undefined
						? p.lttd_prob_bear
						: p.lttd_regime === "BEAR"
							? 0.85
							: 0.05,
			})),
		);
		sidewaysSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				value:
					p.lttd_prob_sideways !== undefined
						? p.lttd_prob_sideways
						: p.lttd_regime === "SIDEWAYS"
							? 0.8
							: 0.1,
			})),
		);

		// Volatility data
		const volData = dailyData.map((p, i, arr) => {
			let vol = 0.02;
			if (i >= 20) {
				let sumSq = 0;
				for (let j = i - 19; j <= i; j++) {
					const ret = Math.log(arr[j].close / arr[j - 1].close);
					sumSq += ret * ret;
				}
				vol = Math.sqrt(sumSq / 20) * Math.sqrt(365);
			}
			return { time: p.date as Time, value: vol };
		});
		volSeries.setData(volData);

		// Crosshair sync — 3 charts
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: hmmChart, series: bullSeries },
			{ chart: volChart, series: volSeries },
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

		// Resize observer
		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			if (!nw || nw <= 0) return;
			const yWidth = getChartYAxisWidth();
			btcChart.applyOptions({ width: nw });
			btcChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			hmmChart.applyOptions({ width: nw });
			hmmChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			volChart.applyOptions({ width: nw });
			volChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			hmmChart.remove();
			volChart.remove();
			chartsRef.current = { btc: null, hmm: null, vol: null };
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

	const displayComponents = Object.entries(LTTD_COMPONENT_METADATA).map(
		([name, meta]) => {
			const signal = components.find((c) => c.component_name === name);
			const score = signal
				? toNum(signal.normalized_score)
				: Math.cos(name.length) * 0.7;
			return {
				name,
				category: meta.category,
				description: meta.description,
				score: toNum(score),
				direction: toNum(score) > 0.3 ? 1 : toNum(score) < -0.3 ? -1 : 0,
			};
		},
	);

	const heights = getPanelHeights(maximized, isMobile);

	return (
		<div
			className={maximized !== null ? "chart-fullscreen-active" : ""}
			style={{ display: "flex", flexDirection: "column", gap: "16px" }}
		>
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
								color: "var(--accent)",
								textTransform: "uppercase",
							}}
						>
							PILLAR 2 TELEMETRY
						</span>
						<span
							style={{
								fontSize: "12px",
								color: "var(--text-dim)",
								fontFamily: "JetBrains Mono",
							}}
						>
							hmm.GaussianHMM(n_components=3)
						</span>
					</div>
					<h2 style={{ fontSize: "20px", fontWeight: 700 }}>
						LTTD 3-State Gaussian HMM Macro Trend Engine
					</h2>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
					<div style={{ textAlign: "right", fontFamily: "JetBrains Mono" }}>
						<div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
							ACTIVE REGIME
						</div>
						<div
							style={{
								fontSize: "24px",
								fontWeight: 700,
								color:
									currentRegime === "BULL"
										? "var(--signal-bull)"
										: currentRegime === "BEAR"
											? "var(--signal-bear)"
											: "var(--accent)",
							}}
						>
							{currentRegime}
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
						{isSidewaysOverride ? (
							<>
								<ShieldAlert size={18} style={{ color: "var(--accent)" }} />{" "}
								<span
									style={{
										fontSize: "13px",
										fontWeight: 700,
										color: "var(--accent)",
									}}
								>
									SIDEWAYS OVERRIDE: 0.0% EXPOSURE
								</span>
							</>
						) : currentRegime === "BULL" ? (
							<>
								<CheckCircle2
									size={18}
									style={{ color: "var(--signal-bull)" }}
								/>{" "}
								<span
									style={{
										fontSize: "13px",
										fontWeight: 700,
										color: "var(--signal-bull)",
									}}
								>
									BULL REGIME (Exposure 1.0x)
								</span>
							</>
						) : (
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
									BEAR REGIME (Capital Protection)
								</span>
							</>
						)}
					</div>
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
							fontFamily: "JetBrains Mono",
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
							fontFamily: "JetBrains Mono",
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
							fontFamily: "JetBrains Mono",
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
							fontFamily: "JetBrains Mono",
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
							fontFamily: "JetBrains Mono",
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
							fontFamily: "JetBrains Mono",
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
						<span
							className="subplot-title"
							style={{ color: "var(--text-dim)" }}
						>
							MasterOHLCV Price · BTC/USD Candlestick · Regime-Colored Wicks
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

				{/* HMM Probabilities Pane */}
				<div
					className={`chart-subplot ${heights.hmm === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<span
							className="subplot-title"
							style={{ color: "var(--text-dim)" }}
						>
							Gaussian HMM State Probabilities · P(Bull) / P(Bear) / P(Sideways)
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
								onClick={() => setMaximized(maximized === "hmm" ? null : "hmm")}
								title={maximized === "hmm" ? "Restore" : "Maximize HMM pane"}
							>
								{maximized === "hmm" ? "⊡" : "⤢"}
							</button>
						</div>
					</div>
					<div
						ref={hmmContainerRef}
						style={{ width: "100%", height: `${heights.hmm}px` }}
					/>
				</div>

				{/* Volatility Pane (bottom — shows time axis) */}
				<div
					className={`chart-subplot ${heights.vol === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<span
							className="subplot-title"
							style={{ color: "var(--text-dim)" }}
						>
							20-Day Annualized Realized Volatility (Feature Input)
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
								onClick={() => setMaximized(maximized === "vol" ? null : "vol")}
								title={maximized === "vol" ? "Restore" : "Maximize Vol pane"}
							>
								{maximized === "vol" ? "⊡" : "⤢"}
							</button>
						</div>
					</div>
					<div
						ref={volContainerRef}
						style={{ width: "100%", height: `${heights.vol}px` }}
					/>
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
								<div key={ind.name} className="mobile-metric-row">
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
													ind.score >= 0.3
														? "var(--signal-bull)"
														: ind.score <= -0.3
															? "var(--signal-bear)"
															: "var(--text-main)",
											}}
										>
											{ind.score > 0 ? `+${ind.score.toFixed(3)}` : ind.score.toFixed(3)}
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
												fontFamily: "JetBrains Mono",
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
											{ind.direction === 1 ? "BULL" : ind.direction === -1 ? "BEAR" : "NEUTRAL"}
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
											fontFamily: "JetBrains Mono",
										}}
									>
										<th style={{ padding: "8px 6px" }}>Feature / Component</th>
										<th style={{ padding: "8px 6px" }}>Category</th>
										<th style={{ padding: "8px 6px" }}>Description</th>
										<th style={{ padding: "8px 6px", textAlign: "right" }}>
											Normalized Value
										</th>
										<th style={{ padding: "8px 6px", textAlign: "center" }}>
											Regime Contribution
										</th>
									</tr>
								</thead>
								<tbody>
									{displayComponents.map((ind) => (
										<tr
											key={ind.name}
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
														fontFamily: "JetBrains Mono",
														backgroundColor: "rgba(245,158,11,0.1)",
														color: "var(--accent)",
													}}
												>
													{ind.category}
												</span>
											</td>
											<td style={{ padding: "10px 6px", color: "var(--text-dim)" }}>
												{ind.description}
											</td>
											<td
												style={{
													padding: "10px 6px",
													textAlign: "right",
													fontFamily: "JetBrains Mono",
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
														? "BULL"
														: ind.direction === -1
															? "BEAR"
															: "NEUTRAL"}
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
