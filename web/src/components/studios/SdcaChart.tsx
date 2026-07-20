/**
 * DCA History Chart Component
 *
 * Lightweight Charts v5.2 chart showing:
 * - BTC price candlestick
 * - SDCA multiplier area series (secondary Y-axis)
 * - Buy/sell markers on price chart
 *
 * Follows all chart rules: 85px Y-axis lock, vertical crosshair sync, responsive.
 */

import type React from "react";
import { useEffect, useRef, useCallback } from "react";

import {
	createChart,
	type IChartApi,
	ColorType,
	CrosshairMode,
	type Time,
	CandlestickSeries,
	AreaSeries,
	createSeriesMarkers,
} from "lightweight-charts";
import { syncYAxisWidth } from "../../lib/syncYAxisWidth";
import type { SdcaSignal } from "../../lib/sdcaEngine";
import type { PortfolioState } from "../../lib/sdcaPortfolio";

// ─── Constants ──────────────────────────────────────────────────────────────

const BG_CHART = "#0B1220";
const BORDER_COLOR = "rgba(30, 41, 59, 0.8)";
const TEXT_COLOR = "#94A3B8";
const GRID_COLOR = "rgba(255,255,255,0.03)";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OHLCData {
	time: string;
	open: number;
	high: number;
	low: number;
	close: number;
}

interface SdcaChartProps {
	/** OHLC price data */
	priceData: OHLCData[];
	/** SDCA signals array (aligned by date with priceData) */
	signals: SdcaSignal[];
	/** Portfolio state for transaction markers */
	portfolio: PortfolioState;
	/** Height of the chart */
	height?: number;
	/** Callback when crosshair moves (for sync) */
	onCrosshairMove?: (time: Time | undefined) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SdcaChart: React.FC<SdcaChartProps> = ({
	priceData,
	signals,
	portfolio,
	height = 200,
	onCrosshairMove,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const candleSeriesRef = useRef<any>(null);
	const multiplierSeriesRef = useRef<any>(null);
	// Get Y-axis width from CSS variable
	const getYAxisWidth = useCallback(() => {
		const raw = getComputedStyle(document.documentElement)
			.getPropertyValue("--chart-yaxis-width")
			.trim();
		return Number(raw) || 85;
	}, []);

	// Initialize chart
	useEffect(() => {
		if (!containerRef.current) return;

		const yAxisWidth = getYAxisWidth();

		const chart = createChart(containerRef.current, {
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
			leftPriceScale: {
				minimumWidth: yAxisWidth,
				borderColor: BORDER_COLOR,
				autoScale: true,
			},
			timeScale: {
				borderColor: BORDER_COLOR,
				timeVisible: false,
			},
			crosshair: { mode: CrosshairMode.Normal },
			handleScroll: { vertTouchDrag: true },
		});

		chartRef.current = chart;

		// Candlestick series for BTC price
		const candleSeries = chart.addSeries(CandlestickSeries, {
			priceScaleId: "right",
			upColor: "#22c55e",
			downColor: "#ef4444",
			borderUpColor: "#22c55e",
			borderDownColor: "#ef4444",
			wickUpColor: "#22c55e",
			wickDownColor: "#ef4444",
			priceFormat: { type: "price", precision: 0, minMove: 1 },
		});
		candleSeriesRef.current = candleSeries;

		// Area series for multiplier (left axis)
		const multiplierSeries = chart.addSeries(AreaSeries, {
			priceScaleId: "left",
			lineColor: "#3b82f6",
			lineWidth: 1,
			topColor: "rgba(59, 130, 246, 0.3)",
			bottomColor: "rgba(59, 130, 246, 0.0)",
			priceFormat: { type: "price", precision: 1, minMove: 0.1 },
			crosshairMarkerVisible: false,
		});
		multiplierSeriesRef.current = multiplierSeries;

		// Set data
		if (priceData.length > 0) {
			candleSeries.setData(priceData as any);
		}

		// Multiplier data (from signals)
		if (signals.length > 0) {
			const multiplierData = signals.map((s) => ({
				time: s.date as Time,
				value: s.multiplier,
			}));
			multiplierSeries.setData(multiplierData as any);
		}

		// Buy/sell markers from portfolio transactions
		if (portfolio.transactionLog.length > 0) {
			const markers = portfolio.transactionLog.map((tx) => ({
				time: tx.timestamp.slice(0, 10) as Time,
				position:
					tx.action && tx.action.startsWith("BUY")
						? ("belowBar" as const)
						: ("aboveBar" as const),
				color: tx.action && tx.action.startsWith("BUY") ? "#22c55e" : "#ef4444",
				shape:
					tx.action && tx.action.startsWith("BUY")
						? ("arrowUp" as const)
						: ("arrowDown" as const),
				text: `${tx.action} $${tx.amountUsd.toFixed(0)}`,
			}));

			// Sort by time (required by Lightweight Charts)
			markers.sort((a, b) =>
				(a.time as string).localeCompare(b.time as string),
			);
			createSeriesMarkers(candleSeries, markers as any);
		}

		// Crosshair sync
		chart.subscribeCrosshairMove((param) => {
			if (onCrosshairMove) {
				onCrosshairMove(param.time);
			}
		});

		// Sync Y-axis width
		syncYAxisWidth(containerRef.current, [chart], yAxisWidth);

		return () => {
			chart.remove();
			chartRef.current = null;
			candleSeriesRef.current = null;
			multiplierSeriesRef.current = null;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Update data when props change
	useEffect(() => {
		if (!candleSeriesRef.current || priceData.length === 0) return;
		candleSeriesRef.current.setData(priceData as any);
	}, [priceData]);

	useEffect(() => {
		if (!multiplierSeriesRef.current || signals.length === 0) return;
		const multiplierData = signals.map((s) => ({
			time: s.date as Time,
			value: s.multiplier,
		}));
		multiplierSeriesRef.current.setData(multiplierData as any);
	}, [signals]);

	// Update markers when portfolio changes
	useEffect(() => {
		if (!candleSeriesRef.current || portfolio.transactionLog.length === 0)
			return;

		const markers = portfolio.transactionLog.map((tx) => ({
			time: tx.timestamp.slice(0, 10) as Time,
			position:
				tx.action && tx.action.startsWith("BUY")
					? ("belowBar" as const)
					: ("aboveBar" as const),
			color: tx.action && tx.action.startsWith("BUY") ? "#22c55e" : "#ef4444",
			shape:
				tx.action && tx.action.startsWith("BUY")
					? ("arrowUp" as const)
					: ("arrowDown" as const),
			text: `${tx.action} $${tx.amountUsd.toFixed(0)}`,
		}));
		markers.sort((a, b) => (a.time as string).localeCompare(b.time as string));
		createSeriesMarkers(candleSeriesRef.current, markers as any);
	}, [portfolio.transactionLog]);

	// Resize handling
	useEffect(() => {
		if (!containerRef.current || !chartRef.current) return;

		const observer = new ResizeObserver(() => {
			if (containerRef.current && chartRef.current) {
				chartRef.current.applyOptions({
					width: containerRef.current.clientWidth,
				});
				const yAxisWidth = getYAxisWidth();
				syncYAxisWidth(containerRef.current, [chartRef.current], yAxisWidth);
			}
		});

		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [getYAxisWidth]);

	return (
		<div
			ref={containerRef}
			style={{
				width: "100%",
				height: `${height}px`,
				position: "relative",
			}}
		/>
	);
};
