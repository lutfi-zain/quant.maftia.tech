import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
	createChart,
	type IChartApi,
	ColorType,
	CrosshairMode,
	type ISeriesApi,
	type Time,
	type SeriesMarker,
	LineStyle,
	CandlestickSeries,
	LineSeries,
	AreaSeries,
	HistogramSeries,
	PriceScaleMode,
	createSeriesMarkers,
} from "lightweight-charts";
import type { DailyAnalyticsPoint } from "../../api/types";

type MaximizedPanel = null | "btc" | "val" | "lttd" | "mttd";

interface MultiPaneChartProps {
	data: DailyAnalyticsPoint[];
}

// Bloomberg Slate chart options — institutional dark palette
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

// Heights per panel state
function getPanelHeights(maximized: MaximizedPanel, isMobile: boolean) {
	const full = window.visualViewport?.height || window.innerHeight;
	switch (maximized) {
		case "btc":
			return { btc: full, val: 0, lttd: 0, mttd: 0 };
		case "val":
			return {
				btc: Math.floor(full * 0.65),
				val: Math.floor(full * 0.35),
				lttd: 0,
				mttd: 0,
			};
		case "lttd":
			return {
				btc: Math.floor(full * 0.65),
				val: 0,
				lttd: Math.floor(full * 0.35),
				mttd: 0,
			};
		case "mttd":
			return {
				btc: Math.floor(full * 0.65),
				val: 0,
				lttd: 0,
				mttd: Math.floor(full * 0.35),
			};
		default:
			// Mobile: smaller heights to fit phone viewport
			return isMobile
				? { btc: 160, val: 120, lttd: 120, mttd: 120 }
				: { btc: 300, val: 160, lttd: 160, mttd: 160 };
	}
}

export const MultiPaneChart: React.FC<MultiPaneChartProps> = ({ data }) => {
	const priceContainerRef = useRef<HTMLDivElement>(null);
	const valContainerRef = useRef<HTMLDivElement>(null);
	const lttdContainerRef = useRef<HTMLDivElement>(null);
	const mttdContainerRef = useRef<HTMLDivElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);

	const chartsRef = useRef<{
		btc: IChartApi | null;
		val: IChartApi | null;
		lttd: IChartApi | null;
		mttd: IChartApi | null;
	}>({
		btc: null,
		val: null,
		lttd: null,
		mttd: null,
	});
	const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
	const valSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
	const lttdSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
	const mttdSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	const [hoveredPoint, setHoveredPoint] = useState<DailyAnalyticsPoint | null>(
		null,
	);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const isMobile = useIsMobile();

	// Toggle log/linear on price chart
	useEffect(() => {
		const chart = chartsRef.current.btc;
		if (!chart) return;
		chart.priceScale("right").applyOptions({
			mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
		});
	}, [isLogScale]);

	// Handle maximize: resize charts and update time axis visibility
	useEffect(() => {
		const { btc, val, lttd, mttd } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		btc.resize(w, heights.btc);
		// Only bottom visible pane shows time axis
		const panels: Array<[IChartApi | null, number, string]> = [
			[val, heights.val, "val"],
			[lttd, heights.lttd, "lttd"],
			[mttd, heights.mttd, "mttd"],
		];
		// Find bottom-most visible non-btc panel
		const visiblePanels = panels.filter(([, h]) => h > 0);
		panels.forEach(([chart, h, id]) => {
			if (!chart) return;
			chart.resize(w, h);
			const isBottom =
				visiblePanels.length > 0 &&
				visiblePanels[visiblePanels.length - 1][2] === id;
			chart.timeScale().applyOptions({ visible: isBottom });
		});
		// BTC time axis visible only when it's the only pane or nothing below it
		btc.timeScale().applyOptions({ visible: visiblePanels.length === 0 });
	}, [maximized, isMobile]);

	// Chart initialization — runs once on data available
	useEffect(() => {
		if (!data.length) return;
		if (
			!priceContainerRef.current ||
			!valContainerRef.current ||
			!lttdContainerRef.current ||
			!mttdContainerRef.current
		)
			return;

		const common = makeCommonOptions(getChartYAxisWidth());
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null, isMobile);

		// ── BTC Price Chart ──
		const btcChart = createChart(priceContainerRef.current, {
			...common,
			width: w,
			height: heights.btc,
			timeScale: { ...common.timeScale, visible: false }, // time hidden by default; shown only on bottom pane
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

		// Ichimoku IMO as thin overlay line (proper signal, not price approximation)
		const imoOverlaySeries = btcChart.addSeries(LineSeries, {
			color: "rgba(245,158,11,0.0)", // transparent — purely for crosshair positioning
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
		});

		// ── Valuation Chart ──
		const valChart = createChart(valContainerRef.current, {
			...common,
			width: w,
			height: heights.val,
			timeScale: { ...common.timeScale, visible: false },
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

		// ── LTTD Chart ──
		const lttdChart = createChart(lttdContainerRef.current, {
			...common,
			width: w,
			height: heights.lttd,
			timeScale: { ...common.timeScale, visible: false },
		});
		const lttdSeries = lttdChart.addSeries(HistogramSeries, {
			priceFormat: { type: "volume" },
		});

		// ── MTTD Chart ── (bottom — shows time axis)
		const mttdChart = createChart(mttdContainerRef.current, {
			...common,
			width: w,
			height: heights.mttd,
			timeScale: { ...common.timeScale, visible: true },
		});
		const mttdSeries = mttdChart.addSeries(LineSeries, {
			color: "#A78BFA",
			lineWidth: 2,
		});
		mttdSeries.createPriceLine({
			price: 0.2,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			axisLabelVisible: true,
			title: "ER Gate ≥0.20",
		});
		mttdSeries.createPriceLine({
			price: -0.3,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			axisLabelVisible: true,
			title: "Chikou Exit <-0.30",
		});

		chartsRef.current = {
			btc: btcChart,
			val: valChart,
			lttd: lttdChart,
			mttd: mttdChart,
		};
		candleSeriesRef.current = candleSeries;
		valSeriesRef.current = valSeries;
		lttdSeriesRef.current = lttdSeries;
		mttdSeriesRef.current = mttdSeries;

		// ── Populate data ──
		candleSeries.setData(
			data.map((p) => ({
				time: p.date as Time,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			})),
		);
		imoOverlaySeries.setData(
			data.map((p) => ({ time: p.date as Time, value: p.close })),
		);
		valSeries.setData(
			data.map((p) => ({ time: p.date as Time, value: p.valuation_composite })),
		);
		lttdSeries.setData(
			data.map((p) => ({
				time: p.date as Time,
				value:
					p.lttd_prob_bull ??
					(p.lttd_regime === "BULL"
						? 1.0
						: p.lttd_regime === "BEAR"
							? -0.5
							: 0.0),
				color:
					p.lttd_regime === "BULL"
						? "#22C55E"
						: p.lttd_regime === "BEAR"
							? "#EF4444"
							: "#F59E0B",
			})),
		);
		mttdSeries.setData(
			data.map((p) => ({ time: p.date as Time, value: p.mttd_imo })),
		);

		// ── Buy/Sell Markers ──
		const markers: SeriesMarker<Time>[] = [];
		data.forEach((p) => {
			if (p.valuation_composite <= -1.0 && p.lttd_regime === "BULL") {
				markers.push({
					time: p.date as Time,
					position: "belowBar",
					color: "#F59E0B",
					shape: "arrowUp",
					text: "BUY",
				});
			} else if (p.valuation_composite >= 1.5 && p.lttd_regime === "BEAR") {
				markers.push({
					time: p.date as Time,
					position: "aboveBar",
					color: "#EF4444",
					shape: "arrowDown",
					text: "SELL",
				});
			}
		});
		createSeriesMarkers(candleSeries, markers);

		// ── Crosshair Sync ──
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: valChart, series: valSeries },
			{ chart: lttdChart, series: lttdSeries },
			{ chart: mttdChart, series: mttdSeries },
		];

		allCharts.forEach(({ chart }, idx) => {
			chart.subscribeCrosshairMove((param) => {
				if (isSyncingRef.current) return;
				isSyncingRef.current = true;
				if (param.time) {
					const timeStr = param.time as string;
					setHoveredPoint(data.find((p) => p.date === timeStr) || null);
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

		// ── Resize Observer ──
		const resizeObserver = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const newW = wrapperRef.current.clientWidth;
			if (!newW || newW <= 0) return;
			const yWidth = getChartYAxisWidth();
			[btcChart, valChart, lttdChart, mttdChart].forEach((chart) => {
				if (!chart) return;
				chart.applyOptions({ width: newW });
				chart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			});
		});
		if (wrapperRef.current) resizeObserver.observe(wrapperRef.current);

		btcChart.timeScale().fitContent();

		return () => {
			resizeObserver.disconnect();
			[btcChart, valChart, lttdChart, mttdChart].forEach((c) => c.remove());
			chartsRef.current = { btc: null, val: null, lttd: null, mttd: null };
		};
	}, [data]); // eslint-disable-line react-hooks/exhaustive-deps

	const displayPoint =
		hoveredPoint || (data.length > 0 ? data[data.length - 1] : null);
	const toNum = (val: any): number =>
		typeof val === "object" && val !== null
			? Number(val.score ?? val.oscillator ?? 0)
			: Number(val ?? 0);
	const regime =
		typeof displayPoint?.lttd_regime === "object"
			? (displayPoint?.lttd_regime as any)?.regime
			: displayPoint?.lttd_regime || "SIDEWAYS";

	const subplots: Array<{
		id: MaximizedPanel;
		label: string;
		containerRef: React.RefObject<HTMLDivElement | null>;
		color: string;
	}> = [
		{
			id: "btc",
			label: "MasterOHLCV Price · LOG/LIN · Ichimoku Buy/Sell Markers",
			containerRef: priceContainerRef,
			color: "var(--signal-bull)",
		},
		{
			id: "val",
			label:
				"Valuation Composite [-2.0 → +2.0] · Bubble +1.50 / Discount -1.00",
			containerRef: valContainerRef,
			color: "var(--signal-quant)",
		},
		{
			id: "lttd",
			label: "LTTD Regime Probability · BULL / BEAR / SIDEWAYS",
			containerRef: lttdContainerRef,
			color: "var(--signal-neutral)",
		},
		{
			id: "mttd",
			label: "MTTD IMO [-1.0 → +1.0] · ER Gate ≥0.20 · Chikou Exit",
			containerRef: mttdContainerRef,
			color: "var(--signal-pca)",
		},
	];

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
			{/* Tooltip Bar */}
			<div
				className="glass-card"
				style={{
					padding: "10px 20px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					fontFamily: "JetBrains Mono",
					fontSize: "12px",
					flexWrap: "wrap",
					gap: "8px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
					<span style={{ color: "var(--text-dim)" }}>
						DATE:{" "}
						<strong style={{ color: "var(--text-mono)" }}>
							{displayPoint?.date || "—"}
						</strong>
					</span>
					<span style={{ color: "var(--text-dim)" }}>
						CLOSE:{" "}
						<strong style={{ color: "var(--signal-bull)" }}>
							${toNum(displayPoint?.close).toLocaleString()}
						</strong>
					</span>
					<span style={{ color: "var(--text-dim)" }}>
						VAL:{" "}
						<strong
							style={{
								color:
									toNum(displayPoint?.valuation_composite) >= 1.5
										? "var(--signal-bear)"
										: "var(--signal-quant)",
							}}
						>
							{toNum(displayPoint?.valuation_composite).toFixed(3)}
						</strong>
					</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
					<span style={{ color: "var(--text-dim)" }}>
						LTTD:{" "}
						<strong
							style={{
								color:
									regime === "BULL"
										? "var(--signal-bull)"
										: regime === "BEAR"
											? "var(--signal-bear)"
											: "var(--signal-neutral)",
							}}
						>
							{regime}
						</strong>
					</span>
					<span style={{ color: "var(--text-dim)" }}>
						MTTD:{" "}
						<strong style={{ color: "var(--signal-pca)" }}>
							{toNum(displayPoint?.mttd_imo).toFixed(3)}
						</strong>
					</span>
					<span style={{ color: "var(--text-dim)" }}>
						IMO:{" "}
						<strong style={{ color: "var(--accent)" }}>
							{toNum(displayPoint?.ichimoku_imo).toFixed(3)}
						</strong>
					</span>
				</div>
				{/* LOG/LIN + Maximize controls */}
				<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
			</div>

			{/* Single seamless chart panel — all 4 subplots */}
			<div
				className={`chart-panel ${maximized !== null ? "fullscreen" : ""}`}
				ref={wrapperRef}
			>
				{subplots.map(({ id, label, containerRef }) => {
					const heights = getPanelHeights(maximized, isMobile);
					const heightKey = id as string;
					const h = heights[heightKey as keyof typeof heights];
					const hiddenClass = h === 0 ? "chart-subplot-hidden" : "";
					return (
						<div key={id} className={`chart-subplot ${hiddenClass}`}>
							<div className="chart-subplot-header">
								<span
									className="subplot-title"
									style={{ color: "var(--text-dim)" }}
								>
									{label}
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
											setMaximized(
												maximized === id ? null : (id as MaximizedPanel),
											)
										}
										title={
											maximized === id
												? "Restore"
												: `Maximize ${id?.toUpperCase()} pane`
										}
									>
										{maximized === id ? "⊡" : "⤢"}
									</button>
								</div>
							</div>
							<div
								ref={containerRef}
								style={{ width: "100%", height: `${h}px` }}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
};
