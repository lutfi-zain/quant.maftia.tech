import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
	createChart,
	type IChartApi,
	ColorType,
	CrosshairMode,
	type ISeriesApi,
	type Time,
	LineStyle,
	CandlestickSeries,
	LineSeries,
	PriceScaleMode,
} from "lightweight-charts";
import { quantClient } from "../../api/client";
import { mapToOscillator, type ThresholdConfig } from "../../lib/oscillator";
import type { MetricTimeseriesResponse } from "../../api/types";

type MaximizedPanel = null | "btc" | "raw" | "osc";

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
			return { btc: full * 0.5, raw: 0, osc: 0 };
		case "raw":
			return { btc: 0, raw: full * 0.5, osc: 0 };
		case "osc":
			return { btc: 0, raw: 0, osc: full * 0.5 };
		default:
			return { btc: 260, raw: 220, osc: 200 };
	}
}

interface MetricDetailChartProps {
	metricName: string;
	onClose: () => void;
}

export const MetricDetailChart: React.FC<MetricDetailChartProps> = ({
	metricName,
	onClose,
}) => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveMsg, setSaveMsg] = useState<string | null>(null);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const rawContainerRef = useRef<HTMLDivElement>(null);
	const oscContainerRef = useRef<HTMLDivElement>(null);

	const chartsRef = useRef<{
		btc: IChartApi | null;
		raw: IChartApi | null;
		osc: IChartApi | null;
	}>({ btc: null, raw: null, osc: null });

	const seriesRef = useRef<{
		candle: ISeriesApi<"Candlestick"> | null;
		rawLine: ISeriesApi<"Line"> | null;
		oscLine: ISeriesApi<"Line"> | null;
	}>({ candle: null, rawLine: null, oscLine: null });

	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	const responseDataRef = useRef<MetricTimeseriesResponse["data"] | null>(null);

	// Threshold state
	const [thresholds, setThresholds] = useState<ThresholdConfig>({
		t_minus_2: 2.0,
		t_minus_1: 1.0,
		t_zero: 0.0,
		t_plus_1: -1.0,
		t_plus_2: -2.0,
	});

	const priceLinesRef = useRef<{
		t_minus_2: ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null;
		t_minus_1: ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null;
		t_zero: ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null;
		t_plus_1: ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null;
		t_plus_2: ReturnType<ISeriesApi<"Line">["createPriceLine"]> | null;
	}>({
		t_minus_2: null,
		t_minus_1: null,
		t_zero: null,
		t_plus_1: null,
		t_plus_2: null,
	});

	// Fetch data on mount
	useEffect(() => {
		let cancelled = false;
		const fetchData = async () => {
			try {
				const [ts, config] = await Promise.all([
					quantClient.getMetricTimeseries(metricName),
					quantClient.getMetricConfig(metricName),
				]);

				if (cancelled) return;

				responseDataRef.current = ts.data;
				if (config.thresholds) {
					setThresholds({
						t_minus_2: config.thresholds.t_minus_2,
						t_minus_1: config.thresholds.t_minus_1,
						t_zero: config.thresholds.t_zero,
						t_plus_1: config.thresholds.t_plus_1,
						t_plus_2: config.thresholds.t_plus_2,
					});
				}
				setLoading(false);
			} catch (e: any) {
				if (!cancelled) {
					setError(e.message || "Failed to load metric data");
					setLoading(false);
				}
			}
		};
		fetchData();
		return () => {
			cancelled = true;
		};
	}, [metricName]);

	// Log/linear toggle
	useEffect(() => {
		const chart = chartsRef.current.btc;
		if (!chart) return;
		chart.priceScale("right").applyOptions({
			mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
		});
	}, [isLogScale]);

	// Resize on maximize change
	useEffect(() => {
		const { btc, raw, osc } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized);
		const w = wrapperRef.current?.clientWidth || 900;

		btc.resize(w, heights.btc);
		if (raw) raw.resize(w, heights.raw);
		if (osc) osc.resize(w, heights.osc);

		// Hide time axis on hidden panels
		btc.timeScale().applyOptions({ visible: heights.raw > 0 });
		if (raw) raw.timeScale().applyOptions({ visible: heights.osc > 0 });
		if (osc)
			osc
				.timeScale()
				.applyOptions({ visible: heights.btc > 0 || heights.raw > 0 });
	}, [maximized]);

	// Initialize 3-panel charts
	useEffect(() => {
		if (loading || error || !responseDataRef.current) return;

		const data = responseDataRef.current;
		if (
			!data.raw_values.length ||
			!btcContainerRef.current ||
			!rawContainerRef.current ||
			!oscContainerRef.current
		)
			return;

		const common = makeCommonOptions();
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null);

		// 1. BTC OHLC Candlestick (top)
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

		// 2. Raw Metric Line (middle)
		const rawChart = createChart(rawContainerRef.current, {
			...common,
			width: w,
			height: heights.raw,
			timeScale: { ...common.timeScale, visible: false },
		});
		const rawLineSeries = rawChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 1,
			crosshairMarkerVisible: true,
			crosshairMarkerRadius: 3,
		});

		// 3. Oscillator Line (bottom, shows time axis)
		const oscChart = createChart(oscContainerRef.current, {
			...common,
			width: w,
			height: heights.osc,
			timeScale: { ...common.timeScale, visible: true },
		});
		const oscLineSeries = oscChart.addSeries(LineSeries, {
			color: "#00E5FF",
			lineWidth: 1,
			crosshairMarkerVisible: true,
			crosshairMarkerRadius: 3,
		});

		// Reference lines on oscillator
		oscLineSeries.createPriceLine({
			price: 2.0,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Bottom +2",
		});
		oscLineSeries.createPriceLine({
			price: 0,
			color: "#475569",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
		});
		oscLineSeries.createPriceLine({
			price: -2.0,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Peak -2",
		});

		chartsRef.current = { btc: btcChart, raw: rawChart, osc: oscChart };
		seriesRef.current = {
			candle: candleSeries,
			rawLine: rawLineSeries,
			oscLine: oscLineSeries,
		};

		// Populate data
		const alignedBtc = data.btc_ohlc.map((d: any) => ({
			time: d.date as Time,
			open: d.open,
			high: d.high,
			low: d.low,
			close: d.close,
		}));
		candleSeries.setData(alignedBtc);

		rawLineSeries.setData(
			data.normalized_values.map((d: any) => ({
				time: d.date as Time,
				value: d.value,
			})),
		);

		// Initial oscillator from threshold + raw values
		const oscData = data.normalized_values.map((d: any) => ({
			time: d.date as Time,
			value: mapToOscillator(d.value, thresholds),
		}));
		oscLineSeries.setData(oscData);

		// Crosshair sync
		const allCharts: { chart: IChartApi; series: any; label: string }[] = [
			{ chart: btcChart, series: candleSeries, label: "btc" },
			{ chart: rawChart, series: rawLineSeries, label: "raw" },
			{ chart: oscChart, series: oscLineSeries, label: "osc" },
		];

		allCharts.forEach(({ chart, series }, idx) => {
			chart.subscribeCrosshairMove((param) => {
				if (isSyncingRef.current) return;
				isSyncingRef.current = true;
				if (param.time) {
					allCharts.forEach(({ chart: c, series: s }, i) => {
						if (i !== idx && param.time) {
							c.setCrosshairPosition(0, param.time as Time, s);
						}
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

		btcChart.timeScale().fitContent();

		// ResizeObserver
		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			const nh = getPanelHeights(maximized);
			btcChart.applyOptions({ width: nw });
			rawChart.applyOptions({ width: nw });
			oscChart.applyOptions({ width: nw });
			btcChart.resize(nw, nh.btc);
			rawChart.resize(nw, nh.raw);
			oscChart.resize(nw, nh.osc);
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		// Threshold price lines on raw metric chart
		priceLinesRef.current.t_minus_2 = rawLineSeries.createPriceLine({
			price: thresholds.t_minus_2,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Peak -2",
		});
		priceLinesRef.current.t_minus_1 = rawLineSeries.createPriceLine({
			price: thresholds.t_minus_1,
			color: "#FB7185",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Distrib -1",
		});
		priceLinesRef.current.t_zero = rawLineSeries.createPriceLine({
			price: thresholds.t_zero,
			color: "#475569",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
		});
		priceLinesRef.current.t_plus_1 = rawLineSeries.createPriceLine({
			price: thresholds.t_plus_1,
			color: "#34D399",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Accum +1",
		});
		priceLinesRef.current.t_plus_2 = rawLineSeries.createPriceLine({
			price: thresholds.t_plus_2,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Bottom +2",
		});

		return () => {
			ro.disconnect();
			btcChart.remove();
			rawChart.remove();
			oscChart.remove();
			chartsRef.current = { btc: null, raw: null, osc: null };
			seriesRef.current = { candle: null, rawLine: null, oscLine: null };
			priceLinesRef.current = {
				t_minus_2: null,
				t_minus_1: null,
				t_zero: null,
				t_plus_1: null,
				t_plus_2: null,
			};
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading, error, metricName]);

	// Recalculate oscillator and price lines when thresholds change
	useEffect(() => {
		const data = responseDataRef.current;
		if (!data || !seriesRef.current.oscLine || !seriesRef.current.rawLine)
			return;

		// Update oscillator data
		const oscData = data.normalized_values.map((d: any) => ({
			time: d.date as Time,
			value: mapToOscillator(d.value, thresholds),
		}));
		seriesRef.current.oscLine.setData(oscData);

		// Update price lines on raw chart
		const rawLine = seriesRef.current.rawLine;
		const lineConfigs: {
			key: keyof typeof priceLinesRef.current;
			price: number;
			color: string;
			title: string;
		}[] = [
			{
				key: "t_minus_2",
				price: thresholds.t_minus_2,
				color: "#EF4444",
				title: "Peak -2",
			},
			{
				key: "t_minus_1",
				price: thresholds.t_minus_1,
				color: "#FB7185",
				title: "Distrib -1",
			},
			{ key: "t_zero", price: thresholds.t_zero, color: "#475569", title: "" },
			{
				key: "t_plus_1",
				price: thresholds.t_plus_1,
				color: "#34D399",
				title: "Accum +1",
			},
			{
				key: "t_plus_2",
				price: thresholds.t_plus_2,
				color: "#22C55E",
				title: "Bottom +2",
			},
		];

		for (const cfg of lineConfigs) {
			const existing = priceLinesRef.current[cfg.key];
			if (existing) {
				try {
					rawLine.removePriceLine(existing);
				} catch {
					// ignore
				}
			}
			priceLinesRef.current[cfg.key] = rawLine.createPriceLine({
				price: cfg.price,
				color: cfg.color,
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				axisLabelVisible: true,
				title: cfg.title,
			});
		}
	}, [thresholds]);

	const handleThresholdChange = (key: keyof ThresholdConfig, value: string) => {
		const num = value === "" || value === "-" ? 0 : Number(value);
		setThresholds((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
	};

	const handleSave = async () => {
		setIsSaving(true);
		setSaveMsg(null);
		try {
			await quantClient.saveMetricConfig(metricName, thresholds);
			setSaveMsg("Config saved successfully!");
		} catch (e: any) {
			setSaveMsg(`Error: ${e.message || "Save failed"}`);
		} finally {
			setIsSaving(false);
			setTimeout(() => setSaveMsg(null), 3000);
		}
	};

	if (loading) {
		return (
			<div
				className="glass-card"
				style={{ padding: "40px", textAlign: "center" }}
			>
				<div
					style={{
						color: "var(--text-dim)",
						fontFamily: "JetBrains Mono",
						fontSize: "13px",
					}}
				>
					LOADING METRIC DATA FOR {metricName.toUpperCase()}...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div
				className="glass-card"
				style={{ padding: "40px", textAlign: "center" }}
			>
				<div
					style={{
						color: "#EF4444",
						fontFamily: "JetBrains Mono",
						fontSize: "13px",
					}}
				>
					ERROR: {error}
				</div>
				<button
					className="icon-btn"
					onClick={onClose}
					style={{
						marginTop: "16px",
						padding: "8px 16px",
						cursor: "pointer",
					}}
				>
					Close
				</button>
			</div>
		);
	}

	const heights = getPanelHeights(maximized);

	const panelControls = (label: "btc" | "raw" | "osc") => (
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
				onClick={() => setMaximized(maximized === label ? null : label)}
				title={`${maximized === label ? "Restore" : "Maximize"} ${label} pane`}
			>
				{maximized === label ? "⊡" : "⤢"}
			</button>
		</div>
	);

	return (
		<div className="glass-card" style={{ padding: "16px" }}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "12px",
				}}
			>
				<div>
					<span
						style={{
							fontSize: "14px",
							fontWeight: 700,
							color: "var(--text-primary)",
							fontFamily: "JetBrains Mono",
						}}
					>
						{metricName} · METRIC DETAIL
					</span>
					<span
						style={{
							fontSize: "11px",
							color: "var(--text-dim)",
							marginLeft: "12px",
							fontFamily: "JetBrains Mono",
						}}
					>
						piecewise_linear_threshold()
					</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
					<button
						className="icon-btn"
						onClick={onClose}
						title="Close detail view"
					>
						✕
					</button>
				</div>
			</div>

			{/* Threshold Editor */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					marginBottom: "12px",
					flexWrap: "wrap",
				}}
			>
				{(Object.keys(thresholds) as (keyof ThresholdConfig)[]).map((key) => (
					<div
						key={key}
						style={{ display: "flex", alignItems: "center", gap: "4px" }}
					>
						<label
							style={{
								fontSize: "10px",
								color: "var(--text-dim)",
								fontFamily: "JetBrains Mono",
								whiteSpace: "nowrap",
							}}
						>
							{key.replace(/_/g, " ").toUpperCase()}:
						</label>
						<input
							type="number"
							step="0.1"
							value={thresholds[key]}
							onChange={(e) => handleThresholdChange(key, e.target.value)}
							style={{
								width: "64px",
								padding: "2px 6px",
								fontSize: "11px",
								fontFamily: "JetBrains Mono",
								backgroundColor: "rgba(0,0,0,0.3)",
								border: "1px solid var(--border-panel)",
								borderRadius: "4px",
								color: "var(--text-primary)",
							}}
						/>
					</div>
				))}
				<button
					className="icon-btn"
					onClick={handleSave}
					disabled={isSaving}
					style={{
						padding: "4px 10px",
						fontSize: "11px",
						fontWeight: 600,
						cursor: "pointer",
					}}
				>
					{isSaving ? "SAVING..." : "SAVE CONFIG"}
				</button>
				{saveMsg && (
					<span
						style={{
							fontSize: "11px",
							fontFamily: "JetBrains Mono",
							color: saveMsg.startsWith("Error") ? "#EF4444" : "#22C55E",
						}}
					>
						{saveMsg}
					</span>
				)}
			</div>

			{/* 3-Panel Chart */}
			<div
				className={`chart-panel ${maximized !== null ? "" : ""}`}
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
							BTC USD Candlestick
						</span>
						{panelControls("btc")}
					</div>
					<div
						ref={btcContainerRef}
						style={{ width: "100%", height: `${heights.btc}px` }}
					/>
				</div>

				{/* Raw Metric Pane */}
				<div
					className={`chart-subplot ${heights.raw === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<span
							className="subplot-title"
							style={{ color: "var(--text-dim)" }}
						>
							Raw Metric Score · {metricName}
						</span>
						{panelControls("raw")}
					</div>
					<div
						ref={rawContainerRef}
						style={{ width: "100%", height: `${heights.raw}px` }}
					/>
				</div>

				{/* Oscillator Pane */}
				<div
					className={`chart-subplot ${heights.osc === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<span
							className="subplot-title"
							style={{ color: "var(--text-dim)" }}
						>
							Valuation Oscillator [-2, +2]
						</span>
						{panelControls("osc")}
					</div>
					<div
						ref={oscContainerRef}
						style={{ width: "100%", height: `${heights.osc}px` }}
					/>
				</div>
			</div>
		</div>
	);
};
