import type React from "react";
import { useEffect, useState, useRef } from "react";
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
	PriceScaleMode,
	createSeriesMarkers,
} from "lightweight-charts";
import { TrendingUp, RefreshCcw, Maximize2, Minimize2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
	useStudioBacktest,
	type StudioDailyRecord,
} from "../../lib/studioBacktest";

type MaximizedPanel = null | "btc" | "imo" | "scomp" | "eq";

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
			return { btc: available, imo: 0, scomp: 0, eq: 0 };
		case "imo":
			return {
				btc: Math.floor(available * 0.55),
				imo: Math.floor(available * 0.45),
				scomp: 0,
				eq: 0,
			};
		case "scomp":
			return {
				btc: Math.floor(available * 0.55),
				imo: 0,
				scomp: Math.floor(available * 0.45),
				eq: 0,
			};
		case "eq":
			return {
				btc: Math.floor(available * 0.55),
				imo: 0,
				scomp: 0,
				eq: Math.floor(available * 0.45),
			};
		default:
			return isMobile
				? { btc: 150, imo: 105, scomp: 105, eq: 110 }
				: { btc: 280, imo: 145, scomp: 135, eq: 135 };
	}
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
	const [, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const [startDate, setStartDate] = useState("2018-01-01");
	const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
	const [feeBps, setFeeBps] = useState(10);
	const [showInteractive, setShowInteractive] = useState(false);
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const studioContainerRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const imoContainerRef = useRef<HTMLDivElement>(null);
	const scompContainerRef = useRef<HTMLDivElement>(null);
	const eqContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		imo: IChartApi | null;
		scomp: IChartApi | null;
		eq: IChartApi | null;
	}>({ btc: null, imo: null, scomp: null, eq: null });
	const seriesRef = useRef<{
		candle: any;
		refStrat: any;
		refMarket: any;
		interactiveStrat: any;
		interactiveMarket: any;
	}>({
		candle: null,
		refStrat: null,
		refMarket: null,
		interactiveStrat: null,
		interactiveMarket: null,
	});
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	const toNum = (val: any): number =>
		typeof val === "object" && val !== null
			? Number(val.score ?? val.oscillator ?? val.normalized_score ?? 0)
			: Number(val ?? 0);

	const backtestData: StudioDailyRecord[] = dailyData.map((d: any) => ({
		date: d.date,
		close: d.close || d.btc_price || 0,
		position: toNum(d.ichimoku_position ?? d.ichi_pos ?? 0),
		ichimoku_chikou: d.ichimoku_chikou ?? null,
		ichimoku_entropy: d.ichimoku_entropy ?? null,
		ichimoku_er: d.ichimoku_er ?? null,
	}));

	const backtestResult = useStudioBacktest(
		backtestData,
		startDate,
		endDate,
		feeBps,
	);

	useEffect(() => {
		if (seriesRef.current.interactiveStrat && backtestResult.cumStrat.length) {
			seriesRef.current.interactiveStrat.setData(
				backtestResult.cumStrat as any,
			);
		}
		if (
			seriesRef.current.interactiveMarket &&
			backtestResult.cumMarket.length
		) {
			seriesRef.current.interactiveMarket.setData(
				backtestResult.cumMarket as any,
			);
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

	// Toggle interactive overlay visibility
	useEffect(() => {
		const { interactiveStrat, interactiveMarket } = seriesRef.current;
		if (!interactiveStrat || !interactiveMarket) return;
		if (showInteractive) {
			// Data already populated by backtestResult effect
		} else {
			interactiveStrat.setData([]);
			interactiveMarket.setData([]);
		}
	}, [showInteractive]);

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
			.getComponents("quant-lttd-ichimoku")
			.then((data) => {
				setComponents(data);
			})
			.catch((e) => {
				console.error("Failed to load Ichimoku components:", e);
			});
	}, []);

	// Ichimoku lines are now served from API via dailyData.ichimoku_tenkan etc.

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
		const { btc, imo, scomp, eq } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		// On mobile maximize, use actual container height so canvas matches CSS precisely
		if (isMobile && maximized !== null) {
			const containerH = wrapperRef.current?.clientHeight;
			if (containerH && containerH > 0) {
				const total = heights.btc + heights.imo + heights.scomp + heights.eq;
				if (total > 0) {
					const yWidth = getChartYAxisWidth();
					btc.resize(w, Math.round(containerH * (heights.btc / total)));
					btc.priceScale("right").applyOptions({ minimumWidth: yWidth });
					if (imo) {
						imo.resize(w, Math.round(containerH * (heights.imo / total)));
						imo.priceScale("right").applyOptions({ minimumWidth: yWidth });
					}
					if (scomp) {
						scomp.resize(w, Math.round(containerH * (heights.scomp / total)));
						scomp.priceScale("right").applyOptions({ minimumWidth: yWidth });
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
						{ chart: scomp, h: heights.scomp, id: "scomp" },
						{ chart: eq, h: heights.eq, id: "eq" },
					];
					const visiblePanels = panels.filter((p) => p.h > 0);
					const bottomId =
						visiblePanels.length > 0
							? visiblePanels[visiblePanels.length - 1].id
							: null;
					btc.timeScale().applyOptions({
						visible:
							heights.imo === 0 && heights.scomp === 0 && heights.eq === 0,
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
							[btc, imo, scomp, eq].filter(Boolean),
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
		if (scomp) {
			scomp.resize(w, heights.scomp);
			scomp.priceScale("right").applyOptions({ minimumWidth: yWidth });
		}
		if (eq) {
			eq.resize(w, heights.eq);
			eq.priceScale("right").applyOptions({ minimumWidth: yWidth });
		}

		const panels: Array<{ chart: IChartApi | null; h: number; id: string }> = [
			{ chart: imo, h: heights.imo, id: "imo" },
			{ chart: scomp, h: heights.scomp, id: "scomp" },
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
				visible: heights.imo === 0 && heights.scomp === 0 && heights.eq === 0,
			});
		panels.forEach(({ chart, h, id }) => {
			if (!chart) return;
			chart.timeScale().applyOptions({ visible: h > 0 && id === bottomId });
		});
		requestAnimationFrame(() => {
			syncYAxisWidth(
				btcContainerRef.current,
				[btc, imo, scomp, eq].filter(Boolean),
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
			!scompContainerRef.current ||
			!eqContainerRef.current
		)
			return;

		const filteredDailyData = dailyData.filter(
			(p) => (!startDate || p.date >= startDate) && (!endDate || p.date <= endDate),
		);
		if (!filteredDailyData.length) return;

		const common = makeCommonOptions(getChartYAxisWidth());
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null, isMobile);

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
			priceFormat: {
				type: "price",
				precision: 0,
				minMove: 1,
			},
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
			timeScale: { ...common.timeScale, visible: false },
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

		// ── Pane 4: Equity Curve (Reference from API vs Interactive What-If) ──
		const eqChart = createChart(eqContainerRef.current, {
			...common,
			width: w,
			height: heights.eq,
			timeScale: { ...common.timeScale, visible: true },
		});

		// Reference curves (API-sourced from prior system's backtest — the truth)
		const refStratSeries = eqChart.addSeries(LineSeries, {
			color: "#22C55E",
			lineWidth: 2,
			title: "Cum_Strat (Reference)",
			lastValueVisible: true,
			priceLineVisible: false,
		});
		const refMarketSeries = eqChart.addSeries(LineSeries, {
			color: "#3B82F6",
			lineWidth: 2,
			title: "Cum_Market (BTC Reference)",
			lastValueVisible: true,
			priceLineVisible: false,
		});

		// Interactive curves (What-If exploration, hidden by default)
		const interactiveStratSeries = eqChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Interactive (What-If)",
			lastValueVisible: false,
			priceLineVisible: false,
		});
		const interactiveMarketSeries = eqChart.addSeries(LineSeries, {
			color: "#94A3B8",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			title: "Interactive Market (What-If)",
			lastValueVisible: false,
			priceLineVisible: false,
		});

		// ── Invisible anchor series for crosshair sync (covers ALL dates in window) ──
		const imoSyncAnchorSeries = imoChart.addSeries(LineSeries, {
			color: "transparent",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});
		imoSyncAnchorSeries.setData(
			filteredDailyData.map((p) => ({ time: p.date as Time, value: 0 })),
		);

		const syncAnchorSeries = scompChart.addSeries(LineSeries, {
			color: "transparent",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});
		syncAnchorSeries.setData(
			filteredDailyData.map((p) => ({ time: p.date as Time, value: 0 })),
		);

		const eqSyncAnchorSeries = eqChart.addSeries(LineSeries, {
			color: "transparent",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});
		eqSyncAnchorSeries.setData(
			filteredDailyData.map((p) => ({ time: p.date as Time, value: 0 })),
		);

		chartsRef.current = {
			btc: btcChart,
			imo: imoChart,
			scomp: scompChart,
			eq: eqChart,
		};
		seriesRef.current = {
			candle: candleSeries,
			refStrat: refStratSeries,
			refMarket: refMarketSeries,
			interactiveStrat: interactiveStratSeries,
			interactiveMarket: interactiveMarketSeries,
		};

		// ── Populate BTC + Ichimoku data ──
		candleSeries.setData(
			filteredDailyData.map((p) => ({
				time: p.date as Time,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			})),
		);

		// Tenkan data from API (skip null warmup)
		tenkanSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_tenkan,
				}))
				.filter((d) => d.value != null) as any,
		);

		// Kijun data from API
		kijunSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_kijun,
				}))
				.filter((d) => d.value != null) as any,
		);

		// Span A data from API
		spanASeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_senkou_a,
				}))
				.filter((d) => d.value != null) as any,
		);

		// Span B data from API
		spanBSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_senkou_b,
				}))
				.filter((d) => d.value != null) as any,
		);

		// Chikou data from API (60-bar displacement from prior system)
		chikouSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_chikou,
				}))
				.filter((d) => d.value != null) as any,
		);

		// ── Populate IMO data + Entropy/ER/imo_std ──
		imoSeries.setData(
			filteredDailyData.map((p) => ({
				time: p.date as Time,
				value:
					typeof p.ichimoku_imo === "number"
						? p.ichimoku_imo
						: ((p.ichimoku_imo as any)?.oscillator ?? 0),
			})),
		);

		const entropySeries = imoChart.addSeries(LineSeries, {
			color: "#A78BFA",
			lineWidth: 1,
			title: "Entropy",
		});
		entropySeries.createPriceLine({
			price: 2.271,
			color: "#A78BFA",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Shannon Gate 2.271",
		});
		const erSeries = imoChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 1,
			title: "ER",
		});
		erSeries.createPriceLine({
			price: 0.25,
			color: "#F59E0B",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "ER Gate 0.25",
		});
		const imoStdSeries = imoChart.addSeries(LineSeries, {
			color: "#3B82F6",
			lineWidth: 1,
			title: "0.40*IMO_Std",
		});

		entropySeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_entropy,
				}))
				.filter((d) => d.value != null) as any,
		);
		erSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_er,
				}))
				.filter((d) => d.value != null) as any,
		);
		imoStdSeries.setData(
			filteredDailyData
				.map((p) => {
					const val = p.ichimoku_imo_std;
					return {
						time: p.date as Time,
						value: val != null ? 0.4 * val : null,
					};
				})
				.filter((d) => d.value != null) as any,
		);

		// ── Populate S-component data from API (no synthetic fallback) ──
		sTkSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_s_tk,
				}))
				.filter((d) => d.value != null) as any,
		);
		sCloudSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_s_cloud,
				}))
				.filter((d) => d.value != null) as any,
		);
		sFutureSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_s_future,
				}))
				.filter((d) => d.value != null) as any,
		);
		sChikouSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_s_chikou,
				}))
				.filter((d) => d.value != null) as any,
		);

		// ── Populate reference equity from API data ──
		refStratSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_cum_strat,
				}))
				.filter((d) => d.value != null) as any,
		);
		refMarketSeries.setData(
			filteredDailyData
				.map((p) => ({
					time: p.date as Time,
					value: p.ichimoku_cum_market,
				}))
				.filter((d) => d.value != null) as any,
		);

		// ── Crosshair sync — 4 charts ──
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: imoChart, series: imoSyncAnchorSeries },
			{ chart: scompChart, series: syncAnchorSeries },
			{ chart: eqChart, series: eqSyncAnchorSeries },
		];

		allCharts.forEach(({ chart }, idx) => {
			chart.subscribeCrosshairMove((param) => {
				if (isSyncingRef.current) return;
				isSyncingRef.current = true;
				if (param.time) {
					const timeStr = param.time as string;
					setHoveredPoint(filteredDailyData.find((p) => p.date === timeStr) || null);
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
					[btcChart, imoChart, scompChart, eqChart],
					getChartYAxisWidth(),
				);
			});
		});

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
			eqChart.applyOptions({ width: nw });
			eqChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			syncYAxisWidth(
				btcContainerRef.current,
				[btcChart, imoChart, scompChart, eqChart],
				yWidth,
			);
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			imoChart.remove();
			scompChart.remove();
			eqChart.remove();
			chartsRef.current = { btc: null, imo: null, scomp: null, eq: null };
			seriesRef.current = {
				candle: null,
				refStrat: null,
				refMarket: null,
				interactiveStrat: null,
				interactiveMarket: null,
			};
		};
	}, [dailyData, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

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
			let score: number;
			if (signal) {
				score = toNum(signal.normalized_score);
			} else if (name === "Ichimoku Denoised Oscillator (IMO)") {
				score = latestImo;
			} else {
				// Use latest daily point's S-component values as fallback
				const sKey = name.includes("S_TK")
					? "ichimoku_s_tk"
					: name.includes("S_Cloud")
						? "ichimoku_s_cloud"
						: name.includes("S_Future")
							? "ichimoku_s_future"
							: name.includes("S_Chikou")
								? "ichimoku_s_chikou"
								: null;
				score = sKey && latestPoint ? toNum((latestPoint as any)[sKey]) : 0;
			}
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
						<span className="studio-tag-layer">
							LAYER 04 · SUPERSMOOTHER IIR
						</span>
						<span className="studio-tag-fn">
							dsp.SuperSmootherIIR(cutoff=10)
						</span>
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
						{latestImo > 0 ? `+${latestImo.toFixed(4)}` : latestImo.toFixed(4)}
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
					<button
						className={`toggle-btn ${showInteractive ? "active" : ""}`}
						onClick={() => setShowInteractive(!showInteractive)}
						style={{ fontSize: "11px", padding: "4px 8px" }}
					>
						{showInteractive ? "Hide" : "Show"} What-If
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
							<button
								className="icon-btn"
								onClick={() =>
									setMaximized(maximized === "scomp" ? null : "scomp")
								}
								title={
									maximized === "scomp" ? "Restore" : "Maximize S-Comp pane"
								}
							>
								{maximized === "scomp" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
							</button>
						</div>
					</div>
					<div
						ref={scompContainerRef}
						style={{ width: "100%", height: `${heights.scomp}px` }}
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
						gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
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
									backtestResult.metrics.sharpeRatio >= backtestResult.metrics.sharpeRatioMarket
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
									backtestResult.metrics.annReturnStrat >= backtestResult.metrics.annReturnMarket
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
								(vs {backtestResult.metrics.annReturnMarket >= 0
									? `+${backtestResult.metrics.annReturnMarket.toFixed(1)}%`
									: `${backtestResult.metrics.annReturnMarket.toFixed(1)}%`})
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
						<h3 className="card-header-title">
							SuperSmoother Component Telemetry
						</h3>
					</div>
					<div className="card-header-right">
						<span className="card-header-meta">ZERO-LAG FILTERING</span>
					</div>
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
												ind.score > 0.15
													? "var(--signal-bull)"
													: ind.score < -0.15
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
											backgroundColor: "rgba(0, 240, 255, 0.1)",
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
