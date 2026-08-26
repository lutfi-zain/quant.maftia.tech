import type React from "react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { quantClient } from "../../api/client";
import type { ComponentSignal } from "../../api/types";
import { useTerminal } from "../../context/TerminalContext";
import { syncYAxisWidth } from "../../lib/syncYAxisWidth";
import {
	createChart,
	type IChartApi,
	type IPriceLine,
	type ISeriesApi,
	type SeriesMarker,
	ColorType,
	CrosshairMode,
	type Time,
	type LineData,
	type CandlestickData,
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

type MaximizedPanel = null | "btc" | "imo" | "eq";

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
			return { btc: available, imo: 0, eq: 0 };
		case "imo":
			return {
				btc: Math.floor(available * 0.5),
				imo: Math.floor(available * 0.5),
				eq: 0,
			};
		case "eq":
			return {
				btc: Math.floor(available * 0.5),
				imo: 0,
				eq: Math.floor(available * 0.5),
			};
		default:
			return isMobile
				? { btc: 250, imo: 150, eq: 160 }
				: { btc: 350, imo: 200, eq: 220 };
	}
}

const ICHIMOKU_COMPONENTS_METADATA: Record<
	string,
	{ category: string; description: string; formula: string }
> = {
	"SuperSmoother Tenkan-Kijun (S_TK)": {
		category: "Cloud Momentum",
		description: "Tanh-normalized TK cross delta, ATR-scaled",
		formula: "tanh((Tenkan - Kijun) / ATR)",
	},
	"SuperSmoother Cloud Thickness (S_Cloud)": {
		category: "Cloud Structure",
		description: "Tanh-normalized distance from Close to cloud boundary",
		formula: "tanh((Close - cloud_edge) / ATR)",
	},
	"SuperSmoother Future Cloud (S_Future)": {
		category: "Forward Projection",
		description: "Tanh-normalized Senkou A-B spread",
		formula: "tanh((SenkouA - SenkouB) / ATR)",
	},
	"SuperSmoother Chikou Span (S_Chikou)": {
		category: "Lagging Confirmation",
		description: "Smoothed tanh-normalized 60-bar Chikou displacement",
		formula: "tanh(SuperSmooth((Close - Close[-60]) / ATR, l=4))",
	},
	"Ichimoku Denoised Oscillator (IMO)": {
		category: "Stationary Output",
		description:
			"SuperSmoother-filtered equal-weight average of all 4 S-components",
		formula: "SuperSmooth((S_TK + S_Cloud + S_Future + S_Chikou) / 4, l=7)",
	},
};

export const IchimokuTerminal: React.FC = () => {
	const { dailyData } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const [startDate, setStartDate] = useState("2018-01-01");
	const [endDate, setEndDate] = useState(
		() => new Date().toISOString().split("T")[0],
	);
	const [feeBps, setFeeBps] = useState(10);
	const [showInteractive, setShowInteractive] = useState(false);
	const isMobile = useIsMobile();
	const [params, setParams] = useState({
		p2: 60,
		entropy_thresh: 2.271,
		t_entry: 0.4,
		chikou_exit: -0.3,
	});

	const handleParamChange = (key: string, val: number) => {
		setParams((prev) => ({
			...prev,
			[key]: val,
		}));
	};

	const wrapperRef = useRef<HTMLDivElement>(null);
	const studioContainerRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const imoContainerRef = useRef<HTMLDivElement>(null);
	const eqContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		imo: IChartApi | null;
		eq: IChartApi | null;
	}>({ btc: null, imo: null, eq: null });
	const seriesRef = useRef<{
		candle: ISeriesApi<"Candlestick"> | null;
		tenkan: ISeriesApi<"Line"> | null;
		kijun: ISeriesApi<"Line"> | null;
		spanA: ISeriesApi<"Line"> | null;
		spanB: ISeriesApi<"Line"> | null;
		traditionalChikou: ISeriesApi<"Line"> | null;
		imo: ISeriesApi<"Line"> | null;
		thresh: ISeriesApi<"Line"> | null;
		entropy: ISeriesApi<"Line"> | null;
		chikou: ISeriesApi<"Line"> | null;
		s_tk: ISeriesApi<"Line"> | null;
		s_cloud: ISeriesApi<"Line"> | null;
		s_future: ISeriesApi<"Line"> | null;
		refStrat: ISeriesApi<"Line"> | null;
		refMarket: ISeriesApi<"Line"> | null;
		interactiveStrat: ISeriesApi<"Line"> | null;
		interactiveMarket: ISeriesApi<"Line"> | null;
	}>({
		candle: null,
		tenkan: null,
		kijun: null,
		spanA: null,
		spanB: null,
		traditionalChikou: null,
		imo: null,
		thresh: null,
		entropy: null,
		chikou: null,
		s_tk: null,
		s_cloud: null,
		s_future: null,
		refStrat: null,
		refMarket: null,
		interactiveStrat: null,
		interactiveMarket: null,
	});
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);
	const priceLinesRef = useRef<{
		entropyLimit: IPriceLine | null;
		chikouExit: IPriceLine | null;
	}>({ entropyLimit: null, chikouExit: null });

	const toNum = (val: unknown): number => {
		if (typeof val === "number") return val;
		if (typeof val === "object" && val !== null) {
			const obj = val as Record<string, unknown>;
			const candidate = obj.score ?? obj.oscillator ?? obj.normalized_score;
			return typeof candidate === "number" ? candidate : Number(candidate ?? 0);
		}
		return Number(val ?? 0);
	};

	const backtestData: StudioDailyRecord[] = useMemo(() => {
		return dailyData.map((d) => ({
			date: d.date,
			close: d.close || d.btc_price || 0,
			position: toNum(d.ichimoku_position ?? 0),
			ichimoku_chikou: d.ichimoku_chikou ?? null,
			ichimoku_entropy: d.ichimoku_entropy ?? null,
			ichimoku_er: d.ichimoku_er ?? null,
			ichimoku_active_pos: d.ichimoku_active_pos ?? undefined,
			ichimoku_strat_net_ret: d.ichimoku_strat_net_ret ?? undefined,
		}));
	}, [dailyData]);

	const backtestResult = useMemo(() => {
		return useStudioBacktest(
			backtestData,
			startDate,
			endDate,
			feeBps,
			true, // referenceMode: use authoritative Python backend returns
		);
	}, [backtestData, startDate, endDate, feeBps]);

	// Interactive (what-if) metrics for toggle overlay
	const interactiveResult = useMemo(() => {
		if (!showInteractive) {
			return {
				cumStrat: [],
				cumMarket: [],
				trades: [],
				metrics: backtestResult.metrics,
				markers: [],
			};
		}
		return useStudioBacktest(
			backtestData,
			startDate,
			endDate,
			feeBps,
			false, // interactive mode: recompute from position x close
		);
	}, [showInteractive, backtestData, startDate, endDate, feeBps, backtestResult.metrics]);

	// Determine which metrics to display based on showInteractive toggle
	const displayMetrics = useMemo(
		() => (showInteractive ? interactiveResult.metrics : backtestResult.metrics),
		[showInteractive, interactiveResult.metrics, backtestResult.metrics],
	);

	useEffect(() => {
		if (seriesRef.current.candle && backtestResult.markers.length) {
			createSeriesMarkers(
				seriesRef.current.candle,
				backtestResult.markers.map((m) => ({
					time: m.time as Time,
					position: m.position,
					color: m.color,
					shape: m.shape,
					text: m.text,
				})) as unknown as SeriesMarker<Time>[],
			);
		} else if (seriesRef.current.candle) {
			createSeriesMarkers(seriesRef.current.candle, []);
		}
	}, [backtestResult.markers]);

	// Toggle and update interactive overlay visibility
	useEffect(() => {
		const { interactiveStrat, interactiveMarket } = seriesRef.current;
		if (!interactiveStrat || !interactiveMarket) return;
		if (showInteractive) {
			if (interactiveResult.cumStrat.length) {
				interactiveStrat.setData(
					interactiveResult.cumStrat
						.filter((d) => d.time >= startDate && d.time <= endDate)
						.map((d) => ({
							time: d.time as Time,
							value: parseFloat((d.value * 100).toFixed(2)),
						})),
				);
			}
			if (interactiveResult.cumMarket.length) {
				interactiveMarket.setData(
					interactiveResult.cumMarket
						.filter((d) => d.time >= startDate && d.time <= endDate)
						.map((d) => ({
							time: d.time as Time,
							value: parseFloat((d.value * 100).toFixed(2)),
						})),
				);
			}
		} else {
			interactiveStrat.setData([]);
			interactiveMarket.setData([]);
		}
	}, [showInteractive, interactiveResult.cumStrat, interactiveResult.cumMarket, startDate, endDate]);

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
		const { btc, imo, eq } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		const allNonBtcCharts: Array<{
			chart: IChartApi | null;
			key: string;
			h: number;
		}> = [
			{ chart: imo, key: "imo", h: heights.imo },
			{ chart: eq, key: "eq", h: heights.eq },
		];

		const resizeFn = (containerH?: number) => {
			const total = heights.btc + heights.imo + heights.eq;
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
					[btc, imo, eq].filter(Boolean),
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

	// Initialize 3-pane charts (only runs once on mount/dailyData change)
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!imoContainerRef.current ||
			!eqContainerRef.current
		)
			return;

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

		// Tenkan-sen (blue)
		const tenkanSeries = btcChart.addSeries(LineSeries, {
			color: "#3b82f6",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
			title: "Tenkan-sen",
		});

		// Kijun-sen (amber/coral)
		const kijunSeries = btcChart.addSeries(LineSeries, {
			color: "#f97316",
			lineWidth: 2,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
			title: "Kijun-sen",
		});

		// Span A (vivid bright green)
		const spanASeries = btcChart.addSeries(LineSeries, {
			color: "rgba(34, 197, 94, 0.85)",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
			title: "Span A",
		});

		// Span B (vivid bright red/coral)
		const spanBSeries = btcChart.addSeries(LineSeries, {
			color: "rgba(239, 68, 68, 0.85)",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
			title: "Span B",
		});

		// Chikou Span (violet, lagged displacement)
		const traditionalChikouSeries = btcChart.addSeries(LineSeries, {
			color: "#a855f7",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
			title: "Chikou Span (Lagged)",
		});

		// ── Pane 2: Denoising Gates & Entropy Oscillator ──
		const imoChart = createChart(imoContainerRef.current, {
			...common,
			width: w,
			height: heights.imo,
			timeScale: { ...common.timeScale, visible: false },
		});

		const imoSeries = imoChart.addSeries(LineSeries, {
			color: "#fbbf24",
			lineWidth: 2,
			title: "IMO",
		});

		const threshSeries = imoChart.addSeries(LineSeries, {
			color: "#9ca3af",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Entry Threshold",
		});

		const entropySeries = imoChart.addSeries(LineSeries, {
			color: "#a78bfa",
			lineWidth: 2,
			title: "Entropy",
		});

		const chikouSeries = imoChart.addSeries(LineSeries, {
			color: "#22d3ee",
			lineWidth: 1,
			title: "S_Chikou",
		});

		const sTkSeries = imoChart.addSeries(LineSeries, {
			color: "rgba(248, 113, 113, 0.45)", // light red
			lineWidth: 1,
			title: "S_TK",
		});

		const sCloudSeries = imoChart.addSeries(LineSeries, {
			color: "rgba(34, 197, 94, 0.45)", // light green
			lineWidth: 1,
			title: "S_Cloud",
		});

		const sFutureSeries = imoChart.addSeries(LineSeries, {
			color: "rgba(96, 165, 250, 0.45)", // light blue
			lineWidth: 1,
			title: "S_Future",
		});

		// ── Pane 3: Cumulative Equity Growth (Reference vs Interactive) ──
		const eqChart = createChart(eqContainerRef.current, {
			...common,
			width: w,
			height: heights.eq,
			timeScale: { ...common.timeScale, visible: true },
			localization: {
				priceFormatter: (price: number) =>
					`${price.toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})}%`,
			},
		});

		// Reference curves (API-sourced from prior system's backtest — the truth)
		const refStratSeries = eqChart.addSeries(LineSeries, {
			color: "#22C55E",
			lineWidth: 2,
			title: "Strategy (Net)",
			lastValueVisible: true,
			priceLineVisible: false,
		});
		const refMarketSeries = eqChart.addSeries(LineSeries, {
			color: "#888888",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: true,
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

		// ── Invisible anchor series for crosshair sync (covers ALL dates) ──
		const imoSyncAnchorSeries = imoChart.addSeries(LineSeries, {
			color: "transparent",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});

		const eqSyncAnchorSeries = eqChart.addSeries(LineSeries, {
			color: "transparent",
			lineWidth: 1,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false,
		});

		chartsRef.current = {
			btc: btcChart,
			imo: imoChart,
			eq: eqChart,
		};
		seriesRef.current = {
			candle: candleSeries,
			tenkan: tenkanSeries,
			kijun: kijunSeries,
			spanA: spanASeries,
			spanB: spanBSeries,
			traditionalChikou: traditionalChikouSeries,
			imo: imoSeries,
			thresh: threshSeries,
			entropy: entropySeries,
			chikou: chikouSeries,
			s_tk: sTkSeries,
			s_cloud: sCloudSeries,
			s_future: sFutureSeries,
			refStrat: refStratSeries,
			refMarket: refMarketSeries,
			interactiveStrat: interactiveStratSeries,
			interactiveMarket: interactiveMarketSeries,
		};

		// ── Populate BTC + Ichimoku data (single-pass full dataset transform) ──
		const candleData: CandlestickData<Time>[] = [];
		const tenkanData: LineData<Time>[] = [];
		const kijunData: LineData<Time>[] = [];
		const spanAData: LineData<Time>[] = [];
		const spanBData: LineData<Time>[] = [];
		const traditionalChikouData: LineData<Time>[] = [];
		const chikouData: LineData<Time>[] = [];
		const sTkData: LineData<Time>[] = [];
		const sCloudData: LineData<Time>[] = [];
		const sFutureData: LineData<Time>[] = [];
		const imoData: LineData<Time>[] = [];
		const entropyData: LineData<Time>[] = [];
		const syncAnchorData: LineData<Time>[] = [];

		for (let i = 0; i < dailyData.length; i++) {
			const p = dailyData[i];
			const t = p.date as Time;
			candleData.push({
				time: t,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			});
			syncAnchorData.push({ time: t, value: 0 });
			if (p.ichimoku_tenkan != null) tenkanData.push({ time: t, value: p.ichimoku_tenkan });
			if (p.ichimoku_kijun != null) kijunData.push({ time: t, value: p.ichimoku_kijun });
			if (p.ichimoku_senkou_a != null) spanAData.push({ time: t, value: p.ichimoku_senkou_a });
			if (p.ichimoku_senkou_b != null) spanBData.push({ time: t, value: p.ichimoku_senkou_b });
			if (p.ichimoku_chikou != null) traditionalChikouData.push({ time: t, value: p.ichimoku_chikou });
			if (p.ichimoku_s_chikou != null) chikouData.push({ time: t, value: p.ichimoku_s_chikou });
			if (p.ichimoku_s_tk != null) sTkData.push({ time: t, value: p.ichimoku_s_tk });
			if (p.ichimoku_s_cloud != null) sCloudData.push({ time: t, value: p.ichimoku_s_cloud });
			if (p.ichimoku_s_future != null) sFutureData.push({ time: t, value: p.ichimoku_s_future });
			const imoVal = typeof p.ichimoku_imo === "number"
				? p.ichimoku_imo
				: toNum(p.ichimoku_imo);
			imoData.push({ time: t, value: imoVal });
			if (p.ichimoku_entropy != null) entropyData.push({ time: t, value: p.ichimoku_entropy });
		}

		candleSeries.setData(candleData);
		tenkanSeries.setData(tenkanData);
		kijunSeries.setData(kijunData);
		spanASeries.setData(spanAData);
		spanBSeries.setData(spanBData);
		traditionalChikouSeries.setData(traditionalChikouData);
		chikouSeries.setData(chikouData);
		sTkSeries.setData(sTkData);
		sCloudSeries.setData(sCloudData);
		sFutureSeries.setData(sFutureData);
		imoSeries.setData(imoData);
		entropySeries.setData(entropyData);
		imoSyncAnchorSeries.setData(syncAnchorData);
		eqSyncAnchorSeries.setData(syncAnchorData);

		if (backtestResult.markers.length) {
			createSeriesMarkers(
				candleSeries,
				backtestResult.markers.map((m) => ({
					time: m.time as Time,
					position: m.position,
					color: m.color,
					shape: m.shape,
					text: m.text,
				})) as unknown as SeriesMarker<Time>[],
			);
		}

		if (backtestResult.cumStrat.length) {
			const stratData: LineData<Time>[] = [];
			for (const d of backtestResult.cumStrat) {
				if (d.time >= startDate && d.time <= endDate && d.value != null) {
					stratData.push({
						time: d.time as Time,
						value: parseFloat((d.value * 100).toFixed(2)),
					});
				}
			}
			refStratSeries.setData(stratData);
		}

		if (backtestResult.cumMarket.length) {
			const marketData: LineData<Time>[] = [];
			for (const d of backtestResult.cumMarket) {
				if (d.time >= startDate && d.time <= endDate && d.value != null) {
					marketData.push({
						time: d.time as Time,
						value: parseFloat((d.value * 100).toFixed(2)),
					});
				}
			}
			refMarketSeries.setData(marketData);
		}
		// ── Crosshair sync — 3 charts ──
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: imoChart, series: imoSyncAnchorSeries },
			{ chart: eqChart, series: eqSyncAnchorSeries },
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

		const totalBars = dailyData.length;
		if (totalBars > 0) {
			const barsToShow = isMobile ? 90 : 180;
			const from = Math.max(0, totalBars - barsToShow);
			const to = totalBars + 2;
			const initialRange = { from, to };
			allCharts.forEach(({ chart }) => {
				chart.timeScale().setVisibleLogicalRange(initialRange);
				chart.timeScale().scrollToPosition(0, false);
			});
		}

		// Sync Y-axis widths after initial render
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				syncYAxisWidth(
					btcContainerRef.current,
					[btcChart, imoChart, eqChart],
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
			eqChart.applyOptions({ width: nw });
			eqChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			requestAnimationFrame(() => {
				syncYAxisWidth(
					btcContainerRef.current,
					[btcChart, imoChart, eqChart],
					yWidth,
				);
			});
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			imoChart.remove();
			eqChart.remove();
			chartsRef.current = { btc: null, imo: null, eq: null };
			seriesRef.current = {
				candle: null,
				tenkan: null,
				kijun: null,
				spanA: null,
				spanB: null,
				traditionalChikou: null,
				imo: null,
				thresh: null,
				entropy: null,
				chikou: null,
				s_tk: null,
				s_cloud: null,
				s_future: null,
				refStrat: null,
				refMarket: null,
				interactiveStrat: null,
				interactiveMarket: null,
			};
		};
	}, [dailyData]); // eslint-disable-line react-hooks/exhaustive-deps

	// Update equity curve data when backtest/date range changes (without resetting scroll)
	useEffect(() => {
		const { eq } = chartsRef.current;
		const { refStrat, refMarket } = seriesRef.current;
		if (!eq || !refStrat || !refMarket) return;

		const stratData: LineData<Time>[] = [];
		for (const d of backtestResult.cumStrat) {
			if (d.time >= startDate && d.time <= endDate && d.value != null) {
				stratData.push({
					time: d.time as Time,
					value: parseFloat((d.value * 100).toFixed(2)),
				});
			}
		}
		refStrat.setData(stratData);

		const marketData: LineData<Time>[] = [];
		for (const d of backtestResult.cumMarket) {
			if (d.time >= startDate && d.time <= endDate && d.value != null) {
				marketData.push({
					time: d.time as Time,
					value: parseFloat((d.value * 100).toFixed(2)),
				});
			}
		}
		refMarket.setData(marketData);
	}, [backtestResult.cumStrat, backtestResult.cumMarket, startDate, endDate]);

	// Dynamically update parameters, threshold lines, and displacement data
	useEffect(() => {
		const { btc, imo, eq } = chartsRef.current;
		const {
			candle,
			traditionalChikou,
			imo: imoSer,
			thresh,
			entropy,
			chikou,
		} = seriesRef.current;
		if (!btc || !imo || !eq || !candle || dailyData.length === 0) return;

		const filteredDailyData = dailyData.filter(
			(p) =>
				(!startDate || p.date >= startDate) && (!endDate || p.date <= endDate),
		);

		// 1. Update traditionalChikou data based on params.p2
		const traditionalChikouData: LineData<Time>[] = [];
		for (let i = 0; i < filteredDailyData.length; i++) {
			if (i + params.p2 < filteredDailyData.length) {
				traditionalChikouData.push({
					time: filteredDailyData[i].date as Time,
					value: filteredDailyData[i + params.p2].close,
				});
			}
		}
		if (traditionalChikou) {
			traditionalChikou.setData(traditionalChikouData);
		}

		// 2. Update thresh data based on params.t_entry
		if (thresh) {
			const threshData: LineData<Time>[] = [];
			for (const p of filteredDailyData) {
				if (p.ichimoku_imo_std != null) {
					threshData.push({
						time: p.date as Time,
						value: p.ichimoku_imo_std * params.t_entry,
					});
				}
			}
			thresh.setData(threshData);
		}

		// 3. Update price lines on entropy and chikou series
		if (priceLinesRef.current.entropyLimit && entropy) {
			entropy.removePriceLine(priceLinesRef.current.entropyLimit);
		}
		if (priceLinesRef.current.chikouExit && chikou) {
			chikou.removePriceLine(priceLinesRef.current.chikouExit);
		}

		if (entropy) {
			priceLinesRef.current.entropyLimit = entropy.createPriceLine({
				price: params.entropy_thresh,
				color: "rgba(239, 68, 68, 0.4)",
				lineWidth: 1,
				lineStyle: LineStyle.Dotted,
				axisLabelVisible: true,
				title: "Entropy Limit",
			});
		}

		if (chikou) {
			priceLinesRef.current.chikouExit = chikou.createPriceLine({
				price: params.chikou_exit,
				color: "rgba(239, 68, 68, 0.4)",
				lineWidth: 1,
				lineStyle: LineStyle.Dotted,
				axisLabelVisible: true,
				title: "Chikou Exit",
			});
		}
	}, [params, dailyData, startDate, endDate]);

	const latestPoint = useMemo(
		() => (dailyData.length ? dailyData[dailyData.length - 1] : null),
		[dailyData],
	);
	const latestImo = useMemo(
		() => toNum(latestPoint?.ichimoku_imo),
		[latestPoint],
	);
	if (
		typeof window !== "undefined" &&
		(window as any).process?.env?.NODE_ENV === "development"
	) {
		console.assert(
			typeof latestImo === "number" && !isNaN(latestImo),
			"latestImo must be a valid number",
		);
	}
	const cloudState = useMemo(() => {
		if (latestImo > 0.15) return "BULL CLOUD";
		if (latestImo < -0.15) return "BEAR CLOUD";
		return "NEUTRAL CLOUD";
	}, [latestImo]);

	const displayComponents = useMemo(() => {
		const compMap: Record<string, ComponentSignal> = {};
		for (const c of components) {
			compMap[c.component_name] = c;
		}
		return Object.entries(ICHIMOKU_COMPONENTS_METADATA).map(
			([name, meta]) => {
				const signal = compMap[name];
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
				const sNum = toNum(score);
				return {
					name,
					category: meta.category,
					description: meta.description,
					formula: meta.formula,
					score: sNum,
					direction: sNum > 0.15 ? 1 : sNum < -0.15 ? -1 : 0,
				};
			},
		);
	}, [components, latestImo, latestPoint]);

	const heights = useMemo(
		() => getPanelHeights(maximized, isMobile),
		[maximized, isMobile],
	);

	const formattedTrades = useMemo(() => {
		return backtestResult.trades.map((t) => ({
			id: t.id,
			entryDate: t.entryDate,
			exitDate: t.exitDate,
			holdDays: t.holdDays,
			exitReason: t.exitReason,
			entryPriceFormatted: t.entryPrice.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}),
			exitPriceFormatted: t.exitPrice.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}),
			isBull: t.exitReason.includes("Bull"),
			isBearOrStop:
				t.exitReason.includes("Bear") || t.exitReason.includes("Stop"),
			returnPctFormatted:
				t.returnPct >= 0
					? `+${t.returnPct.toFixed(2)}%`
					: `${t.returnPct.toFixed(2)}%`,
			isPositiveReturn: t.returnPct >= 0,
		}));
	}, [backtestResult.trades]);
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
					<span
						className="studio-metric-label"
						title="tanh(S_TK + S_Cloud + S_Future + S_Chikou) / 4 → SuperSmoother (l=7) → [-1.0, +1.0]"
					>
						IMO DENOISED OSCILLATOR
					</span>
					<span
						className="studio-metric-value"
						style={{
							color: latestImo > 0 ? "var(--accent)" : "var(--signal-bear)",
						}}
					>
						{latestImo > 0 ? `+${latestImo.toFixed(2)}` : latestImo.toFixed(2)}
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

				{/* Pane 2: Denoising Gates & Entropy Oscillator */}
				<div
					className={`chart-subplot ${heights.imo === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">EHLERS IIR</span>
							<span>Denoising Gates & Entropy Oscillator</span>
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

				{/* Pane 3: Cumulative Equity Growth */}
				<div
					className={`chart-subplot ${heights.eq === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">CAUSAL COMP</span>
							<span
								className="subplot-badge"
								style={{
									background: "rgba(34, 197, 94, 0.1)",
									color: "#22c55e",
									borderColor: "rgba(34, 197, 94, 0.25)",
								}}
							>
								PY ENGINE
							</span>
							<span>Cumulative Equity Growth</span>
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
								setParams({
									p2: 60,
									entropy_thresh: 2.271,
									t_entry: 0.4,
									chikou_exit: -0.3,
								});
							}}
							style={{ fontSize: "11px", padding: "4px 8px" }}
						>
							Reset Defaults
						</button>
					</div>
				</div>

				{showInteractive && (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
							gap: "16px",
							background: "rgba(255, 255, 255, 0.02)",
							border: "1px solid var(--border)",
							borderRadius: "6px",
							padding: "12px",
							marginTop: "4px",
							marginBottom: "4px",
						}}
					>
						<div
							style={{ display: "flex", flexDirection: "column", gap: "4px" }}
						>
							<label
								style={{
									fontSize: "11px",
									color: "var(--text-muted)",
									display: "flex",
									justifyContent: "space-between",
								}}
							>
								<span>Kijun Displacement (p2):</span>
								<span style={{ color: "var(--accent)", fontWeight: 600 }}>
									{params.p2}d
								</span>
							</label>
							<input
								type="range"
								min="10"
								max="120"
								step="1"
								value={params.p2}
								onChange={(e) =>
									handleParamChange("p2", Number(e.target.value))
								}
								style={{ width: "100%", accentColor: "var(--accent)" }}
							/>
						</div>
						<div
							style={{ display: "flex", flexDirection: "column", gap: "4px" }}
						>
							<label
								style={{
									fontSize: "11px",
									color: "var(--text-muted)",
									display: "flex",
									justifyContent: "space-between",
								}}
							>
								<span>Entry Threshold (t_entry):</span>
								<span style={{ color: "var(--accent)", fontWeight: 600 }}>
									{params.t_entry.toFixed(2)}x
								</span>
							</label>
							<input
								type="range"
								min="0.10"
								max="1.50"
								step="0.05"
								value={params.t_entry}
								onChange={(e) =>
									handleParamChange("t_entry", Number(e.target.value))
								}
								style={{ width: "100%", accentColor: "var(--accent)" }}
							/>
						</div>
						<div
							style={{ display: "flex", flexDirection: "column", gap: "4px" }}
						>
							<label
								style={{
									fontSize: "11px",
									color: "var(--text-muted)",
									display: "flex",
									justifyContent: "space-between",
								}}
							>
								<span>Entropy Limit (thresh):</span>
								<span style={{ color: "var(--accent)", fontWeight: 600 }}>
									{params.entropy_thresh.toFixed(3)}
								</span>
							</label>
							<input
								type="range"
								min="1.5"
								max="3.0"
								step="0.01"
								value={params.entropy_thresh}
								onChange={(e) =>
									handleParamChange("entropy_thresh", Number(e.target.value))
								}
								style={{ width: "100%", accentColor: "var(--accent)" }}
							/>
						</div>
						<div
							style={{ display: "flex", flexDirection: "column", gap: "4px" }}
						>
							<label
								style={{
									fontSize: "11px",
									color: "var(--text-muted)",
									display: "flex",
									justifyContent: "space-between",
								}}
							>
								<span>Chikou Exit Limit:</span>
								<span style={{ color: "var(--accent)", fontWeight: 600 }}>
									{params.chikou_exit.toFixed(2)}
								</span>
							</label>
							<input
								type="range"
								min="-1.0"
								max="0.0"
								step="0.05"
								value={params.chikou_exit}
								onChange={(e) =>
									handleParamChange("chikou_exit", Number(e.target.value))
								}
								style={{ width: "100%", accentColor: "var(--accent)" }}
							/>
						</div>
					</div>
				)}

				{/* Metrics Source Indicator */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						marginBottom: "8px",
						fontSize: "11px",
						fontFamily: "Geist Mono, monospace",
						color: "var(--text-muted)",
					}}
				>
					<span>METRICS SOURCE:</span>
					<span
						style={{
							color:
								displayMetrics.source === "reference"
									? "var(--signal-bull)"
									: "var(--text-main)",
							fontWeight: 600,
						}}
					>
						{displayMetrics.source === "reference"
							? "REFERENCE (Python backend)"
							: "COMPUTED (client-side)"}
					</span>
					<span
						style={{
							padding: "2px 8px",
							borderRadius: "4px",
							fontSize: "10px",
							background:
								displayMetrics.source === "reference"
									? "rgba(34,197,94,0.15)"
									: "rgba(255,255,255,0.05)",
							color:
								displayMetrics.source === "reference"
									? "var(--signal-bull)"
									: "var(--text-dim)",
						}}
					>
						{displayMetrics.source}
					</span>
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
									displayMetrics.winRate >= 50
										? "var(--signal-bull)"
										: "var(--text-main)",
							}}
						>
							{displayMetrics.winRate.toFixed(1)}%
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
									displayMetrics.profitFactor >= 1.5
										? "var(--signal-bull)"
										: displayMetrics.profitFactor >= 1.0
											? "var(--text-main)"
											: "var(--signal-bear)",
							}}
						>
							{displayMetrics.profitFactor.toFixed(2)}
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
							{displayMetrics.totalTrades}
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
									displayMetrics.sharpeRatio >=
									displayMetrics.sharpeRatioMarket
										? "var(--signal-bull)"
										: "var(--text-main)",
							}}
						>
							{displayMetrics.sharpeRatio.toFixed(2)}
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs {displayMetrics.sharpeRatioMarket.toFixed(2)})
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
									displayMetrics.annReturnStrat >=
									displayMetrics.annReturnMarket
										? "var(--signal-bull)"
										: "var(--signal-bear)",
							}}
						>
							{displayMetrics.annReturnStrat >= 0
								? `+${displayMetrics.annReturnStrat.toFixed(1)}%`
								: `${displayMetrics.annReturnStrat.toFixed(1)}%`}
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs{" "}
								{displayMetrics.annReturnMarket >= 0
									? `+${displayMetrics.annReturnMarket.toFixed(1)}%`
									: `${displayMetrics.annReturnMarket.toFixed(1)}%`}
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
							{displayMetrics.annVolatilityStrat.toFixed(1)}%
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs {displayMetrics.annVolatilityMarket.toFixed(1)}%)
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
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs -{displayMetrics.maxDrawdownMarket.toFixed(1)}%)
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
									displayMetrics.totalReturnStrat >=
									displayMetrics.totalReturnMarket
										? "var(--signal-bull)"
										: "var(--signal-bear)",
							}}
						>
							{displayMetrics.totalReturnStrat >= 0
								? `+${displayMetrics.totalReturnStrat.toFixed(1)}%`
								: `${displayMetrics.totalReturnStrat.toFixed(1)}%`}
							<span
								style={{
									fontSize: "11px",
									fontWeight: 400,
									color: "var(--text-muted)",
									marginLeft: "4px",
								}}
							>
								(vs{" "}
								{displayMetrics.totalReturnMarket >= 0
									? `+${displayMetrics.totalReturnMarket.toFixed(1)}%`
									: `${displayMetrics.totalReturnMarket.toFixed(1)}%`}
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
							{formattedTrades.length === 0 ? (
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
								formattedTrades.map((t) => (
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
											${t.entryPriceFormatted}
										</td>
										<td style={{ padding: "8px" }}>{t.exitDate}</td>
										<td style={{ padding: "8px" }}>
											${t.exitPriceFormatted}
										</td>
										<td style={{ padding: "8px" }}>{t.holdDays}d</td>
										<td style={{ padding: "8px" }}>
											<span
												style={{
													padding: "2px 6px",
													borderRadius: "4px",
													fontSize: "10px",
													background: t.isBull
														? "rgba(34,197,94,0.1)"
														: t.isBearOrStop
															? "rgba(239,68,68,0.1)"
															: "rgba(255,255,255,0.05)",
													color: t.isBull
														? "var(--signal-bull)"
														: t.isBearOrStop
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
												color: t.isPositiveReturn
													? "var(--signal-bull)"
													: "var(--signal-bear)",
											}}
										>
											{t.returnPctFormatted}
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
