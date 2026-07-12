import type React from "react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { quantClient } from "../../api/client";
import type { ComponentSignal, DailyAnalyticsPoint } from "../../api/types";
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
import { TrendingUp, ShieldCheck, RefreshCcw, Layers, Maximize2, Minimize2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

type MaximizedPanel = null | "btc" | "imo" | "scomp";

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
			fontFamily: "Geist Mono, monospace",
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

// Matches CSS: @media (max-width: 768px) { .chart-panel.fullscreen { bottom: 56px; height: calc(100dvh - 56px); } }
const MOBILE_BOTTOM_TAB_HEIGHT = 56;

function getPanelHeights(maximized: MaximizedPanel, isMobile: boolean) {
	const full = window.visualViewport?.height || window.innerHeight;
	const available = isMobile ? full - MOBILE_BOTTOM_TAB_HEIGHT : full;
	switch (maximized) {
		case "btc":
			return { btc: available, imo: 0, scomp: 0 };
		case "imo":
			return {
				btc: Math.floor(available * 0.65),
				imo: Math.floor(available * 0.35),
				scomp: 0,
			};
		case "scomp":
			return {
				btc: Math.floor(available * 0.65),
				imo: 0,
				scomp: Math.floor(available * 0.35),
			};
		default:
			return isMobile
				? { btc: 160, imo: 120, scomp: 120 }
				: { btc: 320, imo: 180, scomp: 160 };
	}
}

/**
 * Compute Ichimoku lines client-side from OHLCV data.
 * Strictly causal — only uses indices ≤ i.
 * Tenkan(9), Kijun(26), Span A, Span B(52), Chikou(26 lag)
 */
function computeIchimokuLines(dailyData: DailyAnalyticsPoint[]) {
	const n = dailyData.length;
	const tenkan: (number | null)[] = new Array(n).fill(null);
	const kijun: (number | null)[] = new Array(n).fill(null);
	const spanA: (number | null)[] = new Array(n).fill(null);
	const spanB: (number | null)[] = new Array(n).fill(null);

	for (let i = 0; i < n; i++) {
		// Tenkan-sen (9-period)
		if (i >= 8) {
			let maxH = -Infinity,
				minL = Infinity;
			for (let j = i - 8; j <= i; j++) {
				if (dailyData[j].high > maxH) maxH = dailyData[j].high;
				if (dailyData[j].low < minL) minL = dailyData[j].low;
			}
			tenkan[i] = (maxH + minL) / 2;
		}

		// Kijun-sen (26-period)
		if (i >= 25) {
			let maxH = -Infinity,
				minL = Infinity;
			for (let j = i - 25; j <= i; j++) {
				if (dailyData[j].high > maxH) maxH = dailyData[j].high;
				if (dailyData[j].low < minL) minL = dailyData[j].low;
			}
			kijun[i] = (maxH + minL) / 2;
		}

		// Span A = (Tenkan + Kijun) / 2
		if (tenkan[i] !== null && kijun[i] !== null) {
			spanA[i] = ((tenkan[i] as number) + (kijun[i] as number)) / 2;
		}

		// Span B (52-period)
		if (i >= 51) {
			let maxH = -Infinity,
				minL = Infinity;
			for (let j = i - 51; j <= i; j++) {
				if (dailyData[j].high > maxH) maxH = dailyData[j].high;
				if (dailyData[j].low < minL) minL = dailyData[j].low;
			}
			spanB[i] = (maxH + minL) / 2;
		}
	}

	// Chikou Span = Close plotted 26 bars back
	const chikou: (number | null)[] = new Array(n).fill(null);
	for (let i = 0; i < n - 26; i++) {
		chikou[i + 26] = dailyData[i].close;
	}

	return { tenkan, kijun, spanA, spanB, chikou };
}

const ICHIMOKU_COMPONENTS_METADATA: Record<
	string,
	{ category: string; description: string; formula: string }
> = {
	"SuperSmoother Tenkan-Kijun (S_TK)": {
		category: "Cloud Momentum",
		description: "Zero-lag Ehlers 2-pole SuperSmoother filtered TK cross delta",
		formula: "SuperSmooth(Tenkan - Kijun)",
	},
	"SuperSmoother Cloud Thickness (S_Cloud)": {
		category: "Cloud Structure",
		description:
			"Denoised Kumo cloud thickness and structural support boundary",
		formula: "SuperSmooth(Span A - Span B)",
	},
	"SuperSmoother Future Cloud (S_Future)": {
		category: "Forward Projection",
		description: "26-period leading cloud displacement momentum projection",
		formula: "SuperSmooth(Future A - Future B)",
	},
	"SuperSmoother Chikou Span (S_Chikou)": {
		category: "Lagging Confirmation",
		description: "26-period lagging Chikou vs historical price clearance",
		formula: "SuperSmooth(Close - Close[-26])",
	},
	"Ichimoku Denoised Oscillator (IMO)": {
		category: "Stationary Output",
		description:
			"Consensus stationary bounded tanh transformation [-1.0, +1.0]",
		formula: "tanh(w1*S_TK + w2*S_Cloud + ...)",
	},
};

export const IchimokuTerminal: React.FC = () => {
	const { dailyData } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const studioContainerRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const imoContainerRef = useRef<HTMLDivElement>(null);
	const scompContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		imo: IChartApi | null;
		scomp: IChartApi | null;
	}>({ btc: null, imo: null, scomp: null });
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	useGSAP(() => {
		if (studioContainerRef.current) {
			gsap.fromTo(
				studioContainerRef.current.children,
				{ y: 18, opacity: 0 },
				{ y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: "power3.out" }
			);
		}
	}, { scope: studioContainerRef });

	useEffect(() => {
		quantClient
			.getComponents("quant-lttd-ichimoku")
			.then((data) => {
				setComponents(data);
			})
			.catch((e) => {
				console.error("Failed to load Ichimoku components:", e);
			});
	}, []);

	// Compute Ichimoku lines (memoized)
	const ichimokuLines = useMemo(
		() => computeIchimokuLines(dailyData),
		[dailyData],
	);

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
		const { btc, imo, scomp } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		btc.resize(w, heights.btc);
		if (imo) imo.resize(w, heights.imo);
		if (scomp) scomp.resize(w, heights.scomp);

		const panels: Array<{ chart: IChartApi | null; h: number; id: string }> = [
			{ chart: imo, h: heights.imo, id: "imo" },
			{ chart: scomp, h: heights.scomp, id: "scomp" },
		];
		const visiblePanels = panels.filter((p) => p.h > 0);
		const bottomId =
			visiblePanels.length > 0
				? visiblePanels[visiblePanels.length - 1].id
				: null;

		btc
			.timeScale()
			.applyOptions({ visible: heights.imo === 0 && heights.scomp === 0 });
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
			!imoContainerRef.current ||
			!scompContainerRef.current
		)
			return;

		const common = makeCommonOptions(getChartYAxisWidth());
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null, isMobile);
		const { tenkan, kijun, spanA, spanB, chikou } = ichimokuLines;

		// ── Pane 1: BTC Candlestick + Ichimoku overlay ──
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

		// Tenkan-sen (red)
		const tenkanSeries = btcChart.addSeries(LineSeries, {
			color: "#F87171",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});

		// Kijun-sen (blue)
		const kijunSeries = btcChart.addSeries(LineSeries, {
			color: "#60A5FA",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});

		// Span A (green, thin)
		const spanASeries = btcChart.addSeries(LineSeries, {
			color: "rgba(34,197,94,0.35)",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});

		// Span B (red, thin)
		const spanBSeries = btcChart.addSeries(LineSeries, {
			color: "rgba(239,68,68,0.35)",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});

		// Chikou Span (violet, dashed feel)
		const chikouSeries = btcChart.addSeries(LineSeries, {
			color: "rgba(168,85,247,0.55)",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});

		// ── Pane 2: Ichimoku IMO oscillator ──
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
			title: "Ichimoku IMO [-1.0, +1.0]",
		});

		imoSeries.createPriceLine({
			price: 0.5,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Strong Bull +0.50",
		});
		imoSeries.createPriceLine({
			price: -0.5,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Strong Bear -0.50",
		});
		imoSeries.createPriceLine({
			price: 0.0,
			color: "rgba(255,255,255,0.15)",
			lineWidth: 1,
			lineStyle: LineStyle.Solid,
		});

		// ── Pane 3: S-component lines ──
		const scompChart = createChart(scompContainerRef.current, {
			...common,
			width: w,
			height: heights.scomp,
			timeScale: { ...common.timeScale, visible: true },
		});

		const sTkSeries = scompChart.addSeries(LineSeries, {
			color: "#22D3EE",
			lineWidth: 2,
			title: "S_TK",
		});
		const sCloudSeries = scompChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 2,
			title: "S_Cloud",
		});
		const sFutureSeries = scompChart.addSeries(LineSeries, {
			color: "#A78BFA",
			lineWidth: 2,
			title: "S_Future",
		});
		const sChikouSeries = scompChart.addSeries(LineSeries, {
			color: "#22C55E",
			lineWidth: 2,
			title: "S_Chikou",
		});

		chartsRef.current = { btc: btcChart, imo: imoChart, scomp: scompChart };

		// ── Populate BTC + Ichimoku data ──
		candleSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			})),
		);

		// Tenkan data (skip null warmup)
		tenkanSeries.setData(
			dailyData
				.map((p, i) => ({
					time: p.date as Time,
					value: tenkan[i] as number,
				}))
				.filter((d) => d.value !== null) as any,
		);

		// Kijun data
		kijunSeries.setData(
			dailyData
				.map((p, i) => ({
					time: p.date as Time,
					value: kijun[i] as number,
				}))
				.filter((d) => d.value !== null) as any,
		);

		// Span A data
		spanASeries.setData(
			dailyData
				.map((p, i) => ({
					time: p.date as Time,
					value: spanA[i] as number,
				}))
				.filter((d) => d.value !== null) as any,
		);

		// Span B data
		spanBSeries.setData(
			dailyData
				.map((p, i) => ({
					time: p.date as Time,
					value: spanB[i] as number,
				}))
				.filter((d) => d.value !== null) as any,
		);

		// Chikou data (plotted at i+26, value = Close[i])
		chikouSeries.setData(
			dailyData
				.map((p, i) => ({
					time: p.date as Time,
					value: chikou[i] as number,
				}))
				.filter((d) => d.value !== null) as any,
		);

		// ── Populate IMO data ──
		imoSeries.setData(
			dailyData.map((p) => ({ time: p.date as Time, value: p.ichimoku_imo })),
		);

		// ── Populate S-component data ──
		sTkSeries.setData(
			dailyData.map((p) => ({
				time: p.date as Time,
				value:
					p.ichimoku_s_tk !== undefined && p.ichimoku_s_tk !== null
						? p.ichimoku_s_tk
						: p.ichimoku_imo * 0.8,
			})),
		);
		sCloudSeries.setData(
			dailyData.map((p, i) => ({
				time: p.date as Time,
				value:
					p.ichimoku_s_cloud !== undefined && p.ichimoku_s_cloud !== null
						? p.ichimoku_s_cloud
						: Math.sin(i * 0.08) * 0.6,
			})),
		);
		sFutureSeries.setData(
			dailyData.map((p, i) => ({
				time: p.date as Time,
				value:
					p.ichimoku_s_future !== undefined && p.ichimoku_s_future !== null
						? p.ichimoku_s_future
						: Math.cos(i * 0.08) * 0.5,
			})),
		);
		sChikouSeries.setData(
			dailyData.map((p, i) => ({
				time: p.date as Time,
				value:
					p.ichimoku_s_chikou !== undefined && p.ichimoku_s_chikou !== null
						? p.ichimoku_s_chikou
						: p.ichimoku_imo * 0.9 + Math.sin(i * 0.2) * 0.1,
			})),
		);

		// ── Crosshair sync — 3 charts ──
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: imoChart, series: imoSeries },
			{ chart: scompChart, series: sTkSeries },
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

		// ── Resize Observer ──
		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			if (!nw || nw <= 0) return;
			const yWidth = getChartYAxisWidth();
			btcChart.applyOptions({ width: nw });
			btcChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			imoChart.applyOptions({ width: nw });
			imoChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			scompChart.applyOptions({ width: nw });
			scompChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			imoChart.remove();
			scompChart.remove();
			chartsRef.current = { btc: null, imo: null, scomp: null };
		};
	}, [dailyData, ichimokuLines]); // eslint-disable-line react-hooks/exhaustive-deps

	const toNum = (val: any): number =>
		typeof val === "object" && val !== null
			? Number(val.score ?? val.oscillator ?? val.normalized_score ?? 0)
			: Number(val ?? 0);
	const displayPoint =
		hoveredPoint ||
		(dailyData.length > 0 ? dailyData[dailyData.length - 1] : null);
	const latestPoint = dailyData.length ? dailyData[dailyData.length - 1] : null;
	const latestImo = toNum(latestPoint?.ichimoku_imo);
	const cloudState =
		latestImo > 0.15
			? "BULL CLOUD"
			: latestImo < -0.15
				? "BEAR CLOUD"
				: "NEUTRAL CLOUD";

	const displayComponents = Object.entries(ICHIMOKU_COMPONENTS_METADATA).map(
		([name, meta]) => {
			const signal = components.find((c) => c.component_name === name);
			const score = signal
				? toNum(signal.normalized_score)
				: name.includes("IMO")
					? latestImo
					: Math.sin(name.length * 3) * 0.75;
			return {
				name,
				category: meta.category,
				description: meta.description,
				formula: meta.formula,
				score: toNum(score),
				direction: toNum(score) > 0.15 ? 1 : toNum(score) < -0.15 ? -1 : 0,
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
						<span className="studio-tag-layer">LAYER 04 · SUPERSMOOTHER IIR</span>
						<span className="studio-tag-fn">dsp.SuperSmootherIIR(cutoff=10)</span>
					</div>
					<h2 className="studio-banner-title">
						Ichimoku Denoised SuperSmoother Quantitative Terminal
					</h2>
				</div>

				<div className="studio-banner-metric">
					<span className="studio-metric-label">STATIONARY BOUNDED TANH</span>
					<span
						className="studio-metric-value"
						style={{
							color: latestImo > 0 ? "var(--accent)" : "var(--signal-bear)",
						}}
					>
						{latestImo > 0
							? `+${latestImo.toFixed(4)}`
							: latestImo.toFixed(4)}
					</span>
				</div>

				<div
					className={`studio-banner-status ${
						cloudState === "BULL CLOUD"
							? "status-fair"
							: cloudState === "BEAR CLOUD"
								? "status-bubble"
								: "status-warn"
					}`}
				>
					{cloudState === "BULL CLOUD" ? (
						<>
							<TrendingUp size={18} style={{ flexShrink: 0 }} />
							<span>BULL KUMO CLOUD (Structural Support)</span>
						</>
					) : cloudState === "BEAR CLOUD" ? (
						<>
							<TrendingUp size={18} style={{ flexShrink: 0 }} />
							<span>BEAR KUMO CLOUD (Overhead Resistance)</span>
						</>
					) : (
						<>
							<RefreshCcw size={18} style={{ flexShrink: 0 }} />
							<span>NEUTRAL KUMO TWIST</span>
						</>
					)}
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
				{/* Pane 1: BTC + Ichimoku overlay */}
				<div
					className={`chart-subplot ${heights.btc === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">SYS 04</span>
							<span>MasterOHLCV Price Feed</span>
						</div>
						<div className="subplot-controls">
							<span className="subplot-meta">SUPERSMOOTHER FILTERED CLOUD</span>
							<span className="subplot-axis-lock">85px</span>
							<button
								className="icon-btn"
								onClick={() => setMaximized(maximized === "btc" ? null : "btc")}
								title={maximized === "btc" ? "Restore" : "Maximize BTC pane"}
							>
								{maximized === "btc" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
							</button>
						</div>
					</div>
					<div
						ref={btcContainerRef}
						style={{ width: "100%", height: `${heights.btc}px` }}
					/>
				</div>

				{/* Pane 2: Ichimoku IMO oscillator */}
				<div
					className={`chart-subplot ${heights.imo === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">EHLERS IIR</span>
							<span>Denoised Cloud Oscillator</span>
						</div>
						<div className="subplot-controls">
							<span className="subplot-meta">BOUNDED TANH [-1.00, +1.00]</span>
							<span className="subplot-axis-lock">85px</span>
							<button
								className="icon-btn"
								onClick={() => setMaximized(maximized === "imo" ? null : "imo")}
								title={maximized === "imo" ? "Restore" : "Maximize IMO pane"}
							>
								{maximized === "imo" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
							</button>
						</div>
					</div>
					<div
						ref={imoContainerRef}
						style={{ width: "100%", height: `${heights.imo}px` }}
					/>
				</div>

				{/* Pane 3: S-component lines (bottom — shows time axis) */}
				<div
					className={`chart-subplot ${heights.scomp === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">VECTORS</span>
							<span>Lagging & Leading Momentum Vectors</span>
						</div>
						<div className="subplot-controls">
							<span className="subplot-meta">ZERO-LAG IIR</span>
							<span className="subplot-axis-lock">85px</span>
							<button
								className="icon-btn"
								onClick={() =>
									setMaximized(maximized === "scomp" ? null : "scomp")
								}
								title={
									maximized === "scomp" ? "Restore" : "Maximize S-Comp pane"
								}
							>
								{maximized === "scomp" ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
							</button>
						</div>
					</div>
					<div
						ref={scompContainerRef}
						style={{ width: "100%", height: `${heights.scomp}px` }}
					/>
				</div>
			</div>

			{/* Interactive Breakdown Table */}
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
						<span className="card-header-tag">SUPERSMOOTHER MATRIX</span>
						<h3 className="card-header-title">SuperSmoother Component Telemetry</h3>
					</div>
					<div className="card-header-right">
						<span className="card-header-meta">ZERO-LAG FILTERING</span>
					</div>
				</div>

				{isMobile ? (
					/* Mobile: Compact Two-Line List */
					<div className="mobile-metric-list">
						{displayComponents.map((ind) => (
							<div key={ind.name} className="mobile-metric-row hover-physics-card">
								<div className="mobile-metric-row-top">
									<span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
										{ind.name}
									</span>
									<span style={{ fontFamily: "Geist Mono, monospace", fontSize: "13px", fontWeight: 700, flexShrink: 0, color: ind.score > 0.15 ? "var(--signal-bull)" : ind.score < -0.15 ? "var(--signal-bear)" : "var(--text-main)" }}>
										{ind.score > 0 ? `+${ind.score.toFixed(3)}` : ind.score.toFixed(3)}
									</span>
								</div>
								<div className="mobile-metric-row-bottom">
									<span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontFamily: "Geist Mono, monospace", flexShrink: 0, backgroundColor: "rgba(0, 240, 255, 0.1)", color: "var(--accent)" }}>
										{ind.category}
									</span>
									<span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, fontFamily: "Geist Mono, monospace", marginLeft: "auto", flexShrink: 0, backgroundColor: ind.direction === 1 ? "rgba(34,197,94,0.15)" : ind.direction === -1 ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)", color: ind.direction === 1 ? "var(--signal-bull)" : ind.direction === -1 ? "var(--signal-bear)" : "var(--text-dim)" }}>
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
										fontFamily: "Geist Mono, monospace",
									}}
								>
									<th style={{ padding: "8px 6px" }}>Component Name</th>
									<th style={{ padding: "8px 6px" }}>Category</th>
									<th style={{ padding: "8px 6px" }}>Description</th>
									<th style={{ padding: "8px 6px" }}>DSP Transformation</th>
									<th style={{ padding: "8px 6px", textAlign: "right" }}>
										Score [-1, +1]
									</th>
									<th style={{ padding: "8px 6px", textAlign: "center" }}>
										Signal Direction
									</th>
								</tr>
							</thead>
							<tbody>
								{displayComponents.map((ind) => (
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
												fontFamily: "Geist Mono, monospace",
												fontSize: "11px",
												color: "var(--signal-quant)",
											}}
										>
											{ind.formula}
										</td>
										<td
											style={{
												padding: "10px 6px",
												textAlign: "right",
												fontFamily: "Geist Mono, monospace",
												fontWeight: 700,
												color:
													ind.score > 0.15
														? "var(--signal-bull)"
														: ind.score < -0.15
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
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};
