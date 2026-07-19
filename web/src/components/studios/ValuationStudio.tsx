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
	LineSeries,
	PriceScaleMode,
	createSeriesMarkers,
} from "lightweight-charts";
import {
	AlertTriangle,
	CheckCircle2,
	Layers,
	Download,
	Maximize2,
	Minimize2,
	ChevronDown,
} from "lucide-react";
import { Sparkline } from "../Sparkline";
import { MetricDetailChart } from "./MetricDetailChart";
import { syncYAxisWidth } from "../../lib/syncYAxisWidth";
import { exportChartsToPng } from "../../lib/exportPng";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {} from "../../lib/studioBacktest";
import type { SdcaSignal } from "../../lib/sdcaEngine";
import { SdcaPanel } from "./SdcaPanel";
import { SdcaChart } from "./SdcaChart";
import type { PortfolioState } from "../../lib/sdcaPortfolio";
import {
	createInitialState,
	loadPortfolioState,
} from "../../lib/sdcaPortfolio";

type MaximizedPanel = null | "btc" | "val" | "eq";

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
			return { btc: available, val: 0, eq: 0 };
		case "val":
			return {
				btc: Math.floor(available * 0.55),
				val: Math.floor(available * 0.45),
				eq: 0,
			};
		case "eq":
			return {
				btc: Math.floor(available * 0.55),
				val: 0,
				eq: Math.floor(available * 0.45),
			};
		default:
			return isMobile
				? { btc: 150, val: 110, eq: 110 }
				: { btc: 280, val: 180, eq: 160 };
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
	const {
		dailyData,
		isLoading: terminalLoading,
		error: terminalError,
		refreshData,
	} = useTerminal();
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
	const [dropdownOpenValuation, setDropdownOpenValuation] = useState(false);
	const [startDate, setStartDate] = useState("2020-01-01");
	const [endDate, setEndDate] = useState("2026-12-31");
	const [feeBps, setFeeBps] = useState(10);
	const [portfolioState] = useState<PortfolioState>(() => {
		return loadPortfolioState() || createInitialState();
	});
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const studioContainerRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const valContainerRef = useRef<HTMLDivElement>(null);
	const eqContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		val: IChartApi | null;
		eq: IChartApi | null;
	}>({
		btc: null,
		val: null,
		eq: null,
	});
	const seriesRef = useRef<{
		candle: any;
		cumStrat: any;
		cumMarket: any;
	}>({ candle: null, cumStrat: null, cumMarket: null });
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	const [backtestResult, setBacktestResult] = useState<any>({
		cumStrat: [],
		cumMarket: [],
		trades: [],
		metrics: {
			winRate: 0,
			profitFactor: 0,
			totalTrades: 0,
			sharpeRatio: 0,
			sharpeRatioMarket: 0,
			annReturnStrat: 0,
			annReturnMarket: 0,
			annVolatilityStrat: 0,
			annVolatilityMarket: 0,
			maxDrawdown: 0,
			maxDrawdownMarket: 0,
			totalReturnStrat: 0,
			totalReturnMarket: 0,
			avgCostBasis: 0,
		},
		markers: [],
	});

	useEffect(() => {
		let isMounted = true;
		const fetchBacktest = async () => {
			try {
				const data = await quantClient.getSdcaBacktest();

				if (!isMounted || !data.dailyRecords) return;

				const cumStrat = data.dailyRecords.map((r: any) => ({
					time: r.date,
					value: r.stratEquity,
				}));
				const cumMarket = data.dailyRecords.map((r: any) => ({
					time: r.date,
					value: r.marketEquity,
				}));
				const markers = data.dailyRecords
					.filter((r: any) => r.action)
					.map((r: any) => ({
						time: r.date,
						position: r.action === "BUY" ? "belowBar" : "aboveBar",
						color: r.action === "BUY" ? "#10B981" : "#EF4444",
						shape: r.action === "BUY" ? "arrowUp" : "arrowDown",
						text: r.action,
					}));

				// Filter to startDate - endDate range and sort ascending for Lightweight Charts
				const filteredStrat = cumStrat
					.filter((r: any) => r.time >= startDate && r.time <= endDate)
					.sort((a: any, b: any) => a.time.localeCompare(b.time));
				const filteredMarket = cumMarket
					.filter((r: any) => r.time >= startDate && r.time <= endDate)
					.sort((a: any, b: any) => a.time.localeCompare(b.time));
				const filteredMarkers = markers
					.filter((r: any) => r.time >= startDate && r.time <= endDate)
					.sort((a: any, b: any) => a.time.localeCompare(b.time));
				const filteredTrades = (data.trades || [])
					.filter((r: any) => r.date >= startDate && r.date <= endDate)
					.sort((a: any, b: any) => b.date.localeCompare(a.date)) // newest first for table
					.map((r: any, idx: number) => ({
						...r,
						id: `TXN-${(data.trades.length - idx).toString().padStart(4, "0")}`,
						returnPct: r.profitPct ?? 0,
					}));

				setBacktestResult({
					cumStrat: filteredStrat,
					cumMarket: filteredMarket,
					trades: filteredTrades,
					metrics: {
						winRate: data.metrics?.winRate ?? 0,
						profitFactor: data.metrics?.profitFactor ?? 1.5,
						totalTrades: data.metrics?.totalTrades ?? 0,
						sharpeRatio: data.metrics?.sharpe ?? 0,
						sharpeRatioMarket: data.metrics?.sharpeMarket ?? 0,
						annReturnStrat: data.metrics?.cagr ?? 0,
						annReturnMarket: data.metrics?.cagrMarket ?? 0,
						annVolatilityStrat: data.metrics?.annVolatilityStrat ?? 0,
						annVolatilityMarket: data.metrics?.annVolatilityMarket ?? 0,
						maxDrawdown: data.metrics?.maxDrawdown ?? 0,
						maxDrawdownMarket: data.metrics?.maxDrawdownMarket ?? 0,
						totalReturnStrat: data.metrics?.totalReturnStrat ?? 0,
						totalReturnMarket: data.metrics?.totalReturnMarket ?? 0,
						avgCostBasis: data.metrics?.avgCostBasis ?? 0,
					},
					markers: filteredMarkers,
				});
			} catch (err) {
				console.error("Failed to fetch SDCA backtest", err);
			}
		};
		fetchBacktest();
		return () => {
			isMounted = false;
		};
	}, [startDate, endDate]);

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
		const { btc, val, eq } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized, isMobile);
		const w = wrapperRef.current?.clientWidth || 900;

		// On mobile maximize, use actual container height so canvas matches CSS precisely
		if (isMobile && maximized !== null) {
			const containerH = wrapperRef.current?.clientHeight;
			if (containerH && containerH > 0) {
				const total = heights.btc + heights.val + heights.eq;
				if (total > 0) {
					const yWidth = getChartYAxisWidth();
					btc.resize(w, Math.round(containerH * (heights.btc / total)));
					btc.priceScale("right").applyOptions({ minimumWidth: yWidth });
					if (val) {
						val.resize(w, Math.round(containerH * (heights.val / total)));
						val.priceScale("right").applyOptions({ minimumWidth: yWidth });
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
						{ chart: val, h: heights.val, id: "val" },
						{ chart: eq, h: heights.eq, id: "eq" },
					];
					const visiblePanels = panels.filter((p) => p.h > 0);
					const bottomId =
						visiblePanels.length > 0
							? visiblePanels[visiblePanels.length - 1].id
							: null;
					btc
						.timeScale()
						.applyOptions({ visible: heights.val === 0 && heights.eq === 0 });
					panels.forEach(({ chart, h, id }) => {
						if (!chart) return;
						chart
							.timeScale()
							.applyOptions({ visible: h > 0 && id === bottomId });
					});
					requestAnimationFrame(() => {
						syncYAxisWidth(
							btcContainerRef.current,
							[btc, val, eq].filter(Boolean),
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
		if (val) {
			val.resize(w, heights.val);
			val.priceScale("right").applyOptions({ minimumWidth: yWidth });
		}
		if (eq) {
			eq.resize(w, heights.eq);
			eq.priceScale("right").applyOptions({ minimumWidth: yWidth });
		}

		const panels: Array<{ chart: IChartApi | null; h: number; id: string }> = [
			{ chart: val, h: heights.val, id: "val" },
			{ chart: eq, h: heights.eq, id: "eq" },
		];
		const visiblePanels = panels.filter((p) => p.h > 0);
		const bottomId =
			visiblePanels.length > 0
				? visiblePanels[visiblePanels.length - 1].id
				: null;

		btc
			.timeScale()
			.applyOptions({ visible: heights.val === 0 && heights.eq === 0 });
		panels.forEach(({ chart, h, id }) => {
			if (!chart) return;
			chart.timeScale().applyOptions({ visible: h > 0 && id === bottomId });
		});
		requestAnimationFrame(() => {
			syncYAxisWidth(
				btcContainerRef.current,
				[btc, val, eq].filter(Boolean),
				yWidth,
			);
		});
	}, [maximized, isMobile]);

	// Initialize 3-pane charts
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!valContainerRef.current ||
			!eqContainerRef.current
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
			priceFormat: {
				type: "price",
				precision: 0,
				minMove: 1,
			},
		});

		// Valuation Composite Pane (middle, no time axis when eq visible)
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

		// ── Pane 3: Equity Curve (Cum_Strat vs Cum_Market) ──
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

		chartsRef.current = { btc: btcChart, val: valChart, eq: eqChart };
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
			{ chart: eqChart, series: cumStratSeries },
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
						if (i !== idx) {
							// Find actual series value at this time for proper crosshair position
							const data = s.data();
							const point = data.find((d: any) => d.time === param.time);
							const price = point
								? ((point as any).value ?? (point as any).close ?? 0)
								: 0;
							c.setCrosshairPosition(price, param.time as Time, s);
						}
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
		// Sync Y-axis widths after initial render
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				syncYAxisWidth(
					btcContainerRef.current,
					[btcChart, valChart, eqChart],
					getChartYAxisWidth(),
				);
			});
		});

		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			if (!nw || nw <= 0) return;
			const yWidth = getChartYAxisWidth();
			btcChart.applyOptions({ width: nw });
			btcChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			valChart.applyOptions({ width: nw });
			valChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			eqChart.applyOptions({ width: nw });
			eqChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			syncYAxisWidth(
				btcContainerRef.current,
				[btcChart, valChart, eqChart],
				yWidth,
			);
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			valChart.remove();
			eqChart.remove();
			chartsRef.current = { btc: null, val: null, eq: null };
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
	const latestValScore = displayPoint
		? toNum(displayPoint.valuation_composite)
		: 0;
	// Database convention: negative = overvalued (bubble), positive = undervalued (discount)
	const isBubble = latestValScore <= -1.5;
	const isDiscount = latestValScore >= 1.0;

	// SDCA signal: map from basic API fields instead of calculating
	const hoveredIndex = displayPoint
		? dailyData.findIndex((d) => d.date === displayPoint.date)
		: -1;
	const sdcaSignal: SdcaSignal | null =
		dailyData.length > 0 && hoveredIndex >= 0
			? {
					date: dailyData[hoveredIndex].date,
					multiplier: Number(dailyData[hoveredIndex].sdca_multiplier ?? 0),
					phase: (dailyData[hoveredIndex].sdca_phase as any) ?? "fair",
					action: (dailyData[hoveredIndex].sdca_action as any) ?? "HOLD",
					confidence: (dailyData[hoveredIndex].sdca_confidence as any) ?? "LOW",
					pricePercentile: 0,
					trendPositive: true,
				}
			: null;

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
			ref={studioContainerRef}
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
					{/* Institutional Cockpit Studio Banner */}
					<div className="studio-telemetry-banner">
						<div className="studio-banner-left">
							<div className="studio-banner-tags">
								<span className="studio-tag-layer">
									LAYER 01 · PILLAR TELEMETRY
								</span>
								<span className="studio-tag-fn">
									piecewise_linear_interpolate()
								</span>
							</div>
							<h2 className="studio-banner-title">
								17-Indicator Piecewise Linear Valuation Model
							</h2>
							{sdcaSignal && (
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 10,
										marginTop: 2,
									}}
								>
									<span
										style={{
											fontFamily: "var(--font-mono)",
											fontSize: 12,
											fontWeight: 700,
											color:
												sdcaSignal.multiplier >= 2.0
													? "var(--accent)"
													: sdcaSignal.multiplier <= 0.0
														? "var(--signal-bear)"
														: "var(--signal-bull)",
										}}
									>
										SDCA {sdcaSignal.multiplier > 0 ? "+" : ""}
										{sdcaSignal.multiplier.toFixed(1)}x
									</span>
									<span
										style={{
											fontSize: 10,
											color: "var(--text-muted)",
											textTransform: "uppercase",
										}}
									>
										{sdcaSignal.phase.replace(/_/g, " ")} •
										{sdcaSignal.action.replace(/_/g, " ")}
									</span>
								</div>
							)}
						</div>

						<div className="studio-banner-metric">
							<span className="studio-metric-label">COMPOSITE SCORE</span>
							<span
								className="studio-metric-value"
								style={{
									color: isBubble
										? "var(--signal-bear)"
										: isDiscount
											? "var(--accent)"
											: "var(--signal-bull)",
								}}
							>
								{latestValScore > 0
									? `+${latestValScore.toFixed(4)}`
									: latestValScore.toFixed(4)}
							</span>
						</div>

						<div
							className={`studio-banner-status ${
								isBubble
									? "status-bubble"
									: isDiscount
										? "status-discount"
										: "status-fair"
							}`}
						>
							{isBubble ? (
								<>
									<AlertTriangle size={18} style={{ flexShrink: 0 }} />
									<span>BUBBLE FILTER ACTIVE (Composite ≤ -1.5)</span>
								</>
							) : isDiscount ? (
								<>
									<CheckCircle2 size={18} style={{ flexShrink: 0 }} />
									<span>ACCUMULATION ZONE (Composite ≥ +1.0)</span>
								</>
							) : (
								<>
									<CheckCircle2 size={18} style={{ flexShrink: 0 }} />
									<span>FAIR MARKET CYCLE ZONE</span>
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
						<button
							className="toggle-btn"
							onClick={handleExportPng}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "6px",
								backgroundColor: "rgba(30, 41, 59, 0.5)",
								border: "1px solid var(--border-panel)",
								cursor: "pointer",
								color: "var(--text-primary)",
								fontSize: "11px",
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
						style={{
							position: "relative",
							pointerEvents: isLoading ? "none" : "auto",
						}}
					>
						{/* Loading overlay */}
						{isLoading && (
							<div
								style={{
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
									pointerEvents: "all",
								}}
							>
								<div className="text-slate-400 font-mono text-sm animate-pulse flex items-center gap-2">
									<svg
										className="animate-spin"
										style={{
											width: "18px",
											height: "18px",
											color: "var(--signal-quant)",
										}}
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											style={{ opacity: 0.25 }}
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										></circle>
										<path
											style={{ opacity: 0.75 }}
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									LOADING VALUATION TELEMETRY...
								</div>
							</div>
						)}

						{/* Error overlay */}
						{currentError && (
							<div
								style={{
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
									pointerEvents: "all",
								}}
							>
								<div
									style={{
										color: "#FFAAAA",
										fontSize: "14px",
										fontFamily: "Geist Mono, monospace",
									}}
								>
									ERROR: {currentError}
								</div>
								<button
									onClick={() => {
										refreshData();
										setRetryTrigger((prev) => prev + 1);
									}}
									style={{
										padding: "8px 16px",
										backgroundColor: "var(--signal-bear)",
										color: "#fff",
										border: "none",
										borderRadius: "4px",
										fontWeight: 600,
										cursor: "pointer",
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
								<div className="subplot-title">
									<span className="subplot-badge">SYS 01</span>
									<span>MasterOHLCV Price Feed</span>
								</div>
								<div className="subplot-controls">
									<button
										className="icon-btn"
										onClick={() =>
											setMaximized(maximized === "btc" ? null : "btc")
										}
										title={
											maximized === "btc" ? "Restore" : "Maximize BTC pane"
										}
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

						{/* Valuation Composite Pane */}
						<div
							className={`chart-subplot ${heights.val === 0 ? "chart-subplot-hidden" : ""}`}
						>
							<div className="chart-subplot-header">
								<div className="subplot-title">
									<span className="subplot-badge">PIECEWISE</span>
									<span>Valuation Composite Score</span>
								</div>
								<div className="subplot-controls">
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
										{maximized === "val" ? (
											<Minimize2 size={14} />
										) : (
											<Maximize2 size={14} />
										)}
									</button>
								</div>
							</div>
							<div
								ref={valContainerRef}
								style={{ width: "100%", height: `${heights.val}px` }}
							/>
						</div>
						{/* Pane 3: Equity Curve Subplot (Cum_Strat vs Cum_Market) */}
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
										onClick={() =>
											setMaximized(maximized === "eq" ? null : "eq")
										}
										title={
											maximized === "eq" ? "Restore" : "Maximize Equity pane"
										}
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

					{/* SDCA Strategy Panel */}
					<SdcaPanel
						signal={sdcaSignal}
						currentPrice={displayPoint?.close || 0}
						fullscreen={maximized !== null}
					/>

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
								<div
									style={{ display: "flex", alignItems: "center", gap: "6px" }}
								>
									<label
										style={{ fontSize: "11px", color: "var(--text-muted)" }}
									>
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
								<div
									style={{ display: "flex", alignItems: "center", gap: "6px" }}
								>
									<label
										style={{ fontSize: "11px", color: "var(--text-muted)" }}
									>
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
								<div
									style={{ display: "flex", alignItems: "center", gap: "8px" }}
								>
									<label
										style={{ fontSize: "11px", color: "var(--text-muted)" }}
									>
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
								gridTemplateColumns: isMobile
									? "repeat(2, 1fr)"
									: "repeat(3, 1fr)",
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
										(vs {backtestResult.metrics.annVolatilityMarket.toFixed(1)}
										%)
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
									AVG COST BASIS
								</div>
								<div
									style={{
										fontSize: "15px",
										fontWeight: 700,
										fontFamily: "Geist Mono, monospace",
										color: "var(--text-main)",
									}}
								>
									$
									{backtestResult.metrics.avgCostBasis.toLocaleString(
										undefined,
										{ minimumFractionDigits: 2, maximumFractionDigits: 2 },
									)}
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
										<th style={{ padding: "8px", width: "80px" }}>TXN ID</th>
										<th style={{ padding: "8px", width: "120px" }}>DATE</th>
										<th style={{ padding: "8px", width: "80px" }}>ACTION</th>
										<th style={{ padding: "8px", width: "120px" }}>PRICE</th>
										<th style={{ padding: "8px", width: "120px" }}>USD VOL</th>
										<th style={{ padding: "8px", width: "80px" }}>MULT</th>
										<th
											style={{
												padding: "8px",
												width: "80px",
												textAlign: "right",
											}}
										>
											NET PNL
										</th>
									</tr>
								</thead>
								<tbody>
									{backtestResult.trades.length === 0 ? (
										<tr>
											<td
												colSpan={7}
												style={{
													padding: "24px",
													textAlign: "center",
													color: "var(--text-muted)",
												}}
											>
												No transactions generated in this window
											</td>
										</tr>
									) : (
										backtestResult.trades.map((t: any) => (
											<tr
												key={t.id}
												style={{
													borderBottom: "1px solid rgba(255,255,255,0.03)",
													transition: "background 0.15s",
												}}
											>
												<td
													style={{ padding: "8px", color: "var(--text-muted)" }}
												>
													{t.id}
												</td>
												<td style={{ padding: "8px" }}>{t.date}</td>
												<td style={{ padding: "8px" }}>
													<span
														style={{
															padding: "2px 6px",
															borderRadius: "4px",
															fontSize: "10px",
															background:
																t.action === "BUY"
																	? "rgba(34,197,94,0.1)"
																	: "rgba(239,68,68,0.1)",
															color:
																t.action === "BUY"
																	? "var(--signal-bull)"
																	: "var(--signal-bear)",
														}}
													>
														{t.action}
													</span>
												</td>
												<td style={{ padding: "8px" }}>
													$
													{(t.price || 0).toLocaleString(undefined, {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</td>
												<td style={{ padding: "8px" }}>
													$
													{(t.amount || 0).toLocaleString(undefined, {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</td>
												<td style={{ padding: "8px" }}>
													{t.multiplier ? `${t.multiplier.toFixed(1)}x` : "-"}
												</td>
												<td
													style={{
														padding: "8px",
														textAlign: "right",
														fontWeight: 700,
														color:
															t.action === "BUY"
																? "var(--text-muted)"
																: t.returnPct >= 0
																	? "var(--signal-bull)"
																	: "var(--signal-bear)",
													}}
												>
													{t.action === "BUY"
														? "-"
														: t.returnPct >= 0
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
								<span className="card-header-tag">COMPONENT BREAKDOWN</span>
								<h3 className="card-header-title">
									17-Indicator Quantitative Matrix
								</h3>
							</div>
							<div className="card-header-right">
								{isMobile ? (
									<div style={{ position: "relative" }}>
										<button
											onClick={() =>
												setDropdownOpenValuation(!dropdownOpenValuation)
											}
											style={{
												padding: "6px 14px",
												borderRadius: "4px",
												border: "1px solid var(--border-panel)",
												backgroundColor: "var(--bg-surface)",
												color: "var(--text-main)",
												fontSize: "12px",
												fontWeight: 500,
												cursor: "pointer",
												display: "flex",
												alignItems: "center",
												gap: "6px",
												whiteSpace: "nowrap",
											}}
										>
											{selectedCategory}
											<ChevronDown
												size={14}
												style={{
													transition: "transform 0.2s",
													transform: dropdownOpenValuation
														? "rotate(180deg)"
														: "rotate(0deg)",
												}}
											/>
										</button>
										{dropdownOpenValuation && (
											<div
												style={{
													position: "absolute",
													top: "100%",
													right: 0,
													marginTop: "4px",
													minWidth: "160px",
													backgroundColor: "var(--bg-surface)",
													border: "1px solid var(--border-panel)",
													borderRadius: "4px",
													padding: "4px 0",
													zIndex: 100,
													boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
												}}
											>
												{["All", "Fundamental", "Technical", "Sentiment"].map(
													(cat) => (
														<button
															key={cat}
															onClick={() => {
																setSelectedCategory(cat);
																setDropdownOpenValuation(false);
															}}
															style={{
																padding: "8px 14px",
																width: "100%",
																textAlign: "left",
																border: "none",
																backgroundColor:
																	selectedCategory === cat
																		? "var(--accent)"
																		: "transparent",
																color:
																	selectedCategory === cat
																		? "#000"
																		: "var(--text-dim)",
																fontSize: "12px",
																fontWeight:
																	selectedCategory === cat ? 600 : 400,
																cursor: "pointer",
															}}
														>
															{cat}
														</button>
													),
												)}
											</div>
										)}
									</div>
								) : (
									<>
										{["All", "Fundamental", "Technical", "Sentiment"].map(
											(cat) => (
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
															selectedCategory === cat
																? "#000"
																: "var(--text-dim)",
														fontWeight: selectedCategory === cat ? 600 : 400,
														fontSize: "12px",
														cursor: "pointer",
													}}
												>
													{cat}
												</button>
											),
										)}
									</>
								)}
							</div>
						</div>

						{isMobile ? (
							/* Mobile: Compact Two-Line List */
							<div className="mobile-metric-list">
								{displayIndicators.map((ind) => (
									<div
										key={ind.key}
										className="mobile-metric-row hover-physics-card"
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
													fontFamily: "Geist Mono, monospace",
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
													fontFamily: "Geist Mono, monospace",
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
													fontFamily: "Geist Mono, monospace",
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
												fontFamily: "Geist Mono, monospace",
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
												className="hover:bg-slate-800/30 hover-physics-card transition-all"
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
														fontFamily: "Geist Mono, monospace",
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
															fontFamily: "Geist Mono, monospace",
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
