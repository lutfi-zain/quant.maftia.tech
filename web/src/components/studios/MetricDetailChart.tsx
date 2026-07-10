import type React from "react";
import { useEffect, useState, useRef } from "react";
import { createChart, type IChartApi, ColorType, CrosshairMode, type ISeriesApi, LineStyle, PriceScaleMode, CandlestickSeries, LineSeries, type Time } from "lightweight-charts";
import { ArrowLeft, Save, Sparkles, Maximize2, Minimize2, Download } from "lucide-react";
import { quantClient } from "../../api/client";
import { mapToOscillator } from "../../lib/oscillator";
import { exportChartsToPng } from "../../lib/exportPng";

const BG_CHART = "#0B1220";
const BORDER_COLOR = "rgba(30, 41, 59, 0.8)";
const TEXT_COLOR = "#94A3B8";
const GRID_COLOR = "rgba(255,255,255,0.03)";

interface MetricDetailChartProps {
	metricName: string;
	metricDisplayName: string;
	onClose: () => void;
}

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

export const MetricDetailChart: React.FC<MetricDetailChartProps> = ({ metricName, metricDisplayName, onClose }) => {
	const [loading, setLoading] = useState(true);
	const [timeseriesData, setTimeseriesData] = useState<any>(null);
	const [thresholds, setThresholds] = useState<any>({
		t_minus_2: 0,
		t_minus_1: 0,
		t_zero: 0,
		t_plus_1: 0,
		t_plus_2: 0,
	});
	const [saving, setSaving] = useState(false);
	const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
	const [maximizedPanel, setMaximizedPanel] = useState<"btc" | "raw" | "osc" | null>(null);
	const [isLogScale, setIsLogScale] = useState(true);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const rawContainerRef = useRef<HTMLDivElement>(null);
	const oscContainerRef = useRef<HTMLDivElement>(null);

	const chartsRef = useRef<{ btc: IChartApi | null; raw: IChartApi | null; osc: IChartApi | null }>({
		btc: null,
		raw: null,
		osc: null,
	});
	const seriesRef = useRef<{ btc: ISeriesApi<"Candlestick"> | null; raw: ISeriesApi<"Line"> | null; osc: ISeriesApi<"Line"> | null }>({
		btc: null,
		raw: null,
		osc: null,
	});

	const priceLinesRef = useRef<any>({});
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	// Load metric timeseries & threshold config
	useEffect(() => {
		let isMounted = true;
		setLoading(true);

		Promise.all([quantClient.getMetricTimeseries(metricName), quantClient.getMetricConfig(metricName)])
			.then(([tsRes, configRes]) => {
				if (!isMounted) return;
				setTimeseriesData(tsRes.data);
				if (configRes && configRes.thresholds) {
					setThresholds(configRes.thresholds);
				}
				setLoading(false);
			})
			.catch((err) => {
				console.error("Error loading metric detail:", err);
				if (isMounted) setLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [metricName]);

	// Initialize charts
	useEffect(() => {
		if (loading || !timeseriesData || !btcContainerRef.current || !rawContainerRef.current || !oscContainerRef.current) return;

		const common = makeCommonOptions();
		const w = wrapperRef.current?.clientWidth || 900;

		const btcHeight = maximizedPanel === "btc" ? 500 : maximizedPanel === null ? 220 : 0;
		const rawHeight = maximizedPanel === "raw" ? 500 : maximizedPanel === null ? 180 : 0;
		const oscHeight = maximizedPanel === "osc" ? 500 : maximizedPanel === null ? 160 : 0;

		// 1. BTC Price Chart
		const btcChart = createChart(btcContainerRef.current, {
			...common,
			width: w,
			height: btcHeight,
			timeScale: { ...common.timeScale, visible: btcHeight > 0 && rawHeight === 0 && oscHeight === 0 },
		});
		const btcSeries = btcChart.addSeries(CandlestickSeries, {
			upColor: "#22C55E",
			downColor: "#EF4444",
			borderVisible: false,
			wickUpColor: "#22C55E",
			wickDownColor: "#EF4444",
		});
		btcChart.priceScale("right").applyOptions({
			mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
			minimumWidth: 85,
		});

		// 2. Raw Metric Chart
		const rawChart = createChart(rawContainerRef.current, {
			...common,
			width: w,
			height: rawHeight,
			timeScale: { ...common.timeScale, visible: rawHeight > 0 && oscHeight === 0 },
		});
		rawChart.priceScale("right").applyOptions({
			minimumWidth: 85,
		});
		const rawSeries = rawChart.addSeries(LineSeries, {
			color: "#38BDF8",
			lineWidth: 2,
		});

		// 3. Oscillator Chart
		const oscChart = createChart(oscContainerRef.current, {
			...common,
			width: w,
			height: oscHeight,
			timeScale: { ...common.timeScale, visible: oscHeight > 0 },
		});
		oscChart.priceScale("right").applyOptions({
			minimumWidth: 85,
		});
		const oscSeries = oscChart.addSeries(LineSeries, {
			color: "#A855F7",
			lineWidth: 2,
		});

		chartsRef.current = { btc: btcChart, raw: rawChart, osc: oscChart };
		seriesRef.current = { btc: btcSeries, raw: rawSeries, osc: oscSeries };

		// Populate data
		btcSeries.setData(
			timeseriesData.btc_ohlc.map((p: any) => ({
				time: p.date as Time,
				open: p.open,
				high: p.high,
				low: p.low,
				close: p.close,
			})),
		);

		rawSeries.setData(
			timeseriesData.raw_values.map((p: any) => ({
				time: p.date as Time,
				value: p.value,
			})),
		);

		// Compute initial oscillator values client-side
		const oscData = timeseriesData.raw_values.map((p: any) => {
			const oscVal = mapToOscillator(p.value, thresholds.t_plus_2, thresholds.t_plus_1, thresholds.t_minus_1, thresholds.t_minus_2);
			return {
				time: p.date as Time,
				value: oscVal ?? 0.0,
			};
		});
		oscSeries.setData(oscData);

		// Reference lines on Oscillator chart
		oscSeries.createPriceLine({
			price: 2.0,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Bottom (+2.00)",
		});
		oscSeries.createPriceLine({
			price: 0,
			color: "#64748B",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Neutral (0.00)",
		});
		oscSeries.createPriceLine({
			price: -2.0,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			axisLabelVisible: true,
			title: "Peak (-2.00)",
		});

		// Create dynamic threshold lines on raw chart
		priceLinesRef.current = {};
		updateRawPriceLines(rawSeries, thresholds);

		// Sync logic
		const allCharts = [
			{ chart: btcChart, series: btcSeries },
			{ chart: rawChart, series: rawSeries },
			{ chart: oscChart, series: oscSeries },
		];

		allCharts.forEach(({ chart, series }, idx) => {
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

		btcChart.timeScale().fitContent();

		// Resize observer
		const ro = new ResizeObserver(() => {
			if (!wrapperRef.current) return;
			const nw = wrapperRef.current.clientWidth;
			btcChart.applyOptions({ width: nw });
			rawChart.applyOptions({ width: nw });
			oscChart.applyOptions({ width: nw });
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			rawChart.remove();
			oscChart.remove();
			chartsRef.current = { btc: null, raw: null, osc: null };
			seriesRef.current = { btc: null, raw: null, osc: null };
		};
	}, [loading, timeseriesData]); // eslint-disable-line react-hooks/exhaustive-deps

	// Update price lines helper
	const updateRawPriceLines = (series: any, currentThresholds: any) => {
		// Clear existing
		for (const key of Object.keys(priceLinesRef.current)) {
			if (priceLinesRef.current[key]) {
				series.removePriceLine(priceLinesRef.current[key]);
			}
		}

		priceLinesRef.current = {};

		const keys = [
			{ key: "t_minus_2", color: "#EF4444", title: "Peak (T-2)" },
			{ key: "t_minus_1", color: "#F87171", title: "Warning (T-1)" },
			{ key: "t_zero", color: "#64748B", title: "Neutral (T-0)" },
			{ key: "t_plus_1", color: "#4ADE80", title: "Opportunity (T+1)" },
			{ key: "t_plus_2", color: "#22C55E", title: "Bottom (T+2)" },
		];

		for (const item of keys) {
			const val = currentThresholds[item.key];
			if (val !== null && val !== undefined) {
				priceLinesRef.current[item.key] = series.createPriceLine({
					price: Number(val),
					color: item.color,
					lineWidth: 1.5,
					lineStyle: LineStyle.Dashed,
					axisLabelVisible: true,
					title: item.title,
				});
			}
		}
	};

	// Recalculate oscillator and price lines on threshold local change
	const handleThresholdChange = (key: string, value: string) => {
		const numVal = value === "" ? null : Number(value);
		const updated = {
			...thresholds,
			[key]: numVal,
		};
		setThresholds(updated);

		// Real-time update chart elements
		const rawSeries = seriesRef.current.raw;
		if (rawSeries) {
			updateRawPriceLines(rawSeries, updated);
		}

		const oscSeries = seriesRef.current.osc;
		if (oscSeries && timeseriesData) {
			const oscData = timeseriesData.raw_values.map((p: any) => {
				const oscVal = mapToOscillator(p.value, updated.t_plus_2, updated.t_plus_1, updated.t_minus_1, updated.t_minus_2);
				return {
					time: p.date as Time,
					value: oscVal ?? 0.0,
				};
			});
			oscSeries.setData(oscData);
		}
	};

	// Save thresholds to backend
	const handleSaveConfig = () => {
		setSaving(true);
		setToast(null);

		quantClient
			.saveMetricConfig(metricName, thresholds)
			.then(() => {
				setSaving(false);
				setToast({ type: "success", message: "Threshold configurations saved successfully" });
				setTimeout(() => setToast(null), 3000);
			})
			.catch((err) => {
				setSaving(false);
				setToast({ type: "error", message: `Failed to save configurations: ${err.message || err}` });
				setTimeout(() => setToast(null), 4000);
			});
	};

	// Trigger PNG download of the detailed chart subplots
	const handleExportPng = () => {
		if (!wrapperRef.current) return;
		const subplots = Array.from(wrapperRef.current.querySelectorAll(".chart-subplot")) as HTMLElement[];
		const today = new Date().toISOString().split("T")[0];
		exportChartsToPng(subplots, `btc-valuation-${metricName}-${today}.png`);
	};

	// Panel heights resize effect when maximizedPanel changes
	useEffect(() => {
		const { btc, raw, osc } = chartsRef.current;
		const w = wrapperRef.current?.clientWidth || 900;

		const bHeight = maximizedPanel === "btc" ? 500 : maximizedPanel === null ? 220 : 0;
		const rHeight = maximizedPanel === "raw" ? 500 : maximizedPanel === null ? 180 : 0;
		const oHeight = maximizedPanel === "osc" ? 500 : maximizedPanel === null ? 160 : 0;

		if (btc) {
			btc.resize(w, bHeight);
			btc.timeScale().applyOptions({ visible: bHeight > 0 && rHeight === 0 && oHeight === 0 });
		}
		if (raw) {
			raw.resize(w, rHeight);
			raw.timeScale().applyOptions({ visible: rHeight > 0 && oHeight === 0 });
		}
		if (osc) {
			osc.resize(w, oHeight);
			osc.timeScale().applyOptions({ visible: oHeight > 0 });
		}
	}, [maximizedPanel]);

	// Apply log scale effect
	useEffect(() => {
		const btc = chartsRef.current.btc;
		if (btc) {
			btc.priceScale("right").applyOptions({
				mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
			});
		}
	}, [isLogScale]);

	if (loading) {
		return (
			<div className="glass-card flex flex-col items-center justify-center" style={{ height: "400px" }}>
				<div className="text-slate-400 font-mono text-sm animate-pulse flex items-center gap-2">
					<Sparkles className="animate-spin text-sky-400" size={18} />
					FETCHING METRIC CYCLE HISTORY...
				</div>
			</div>
		);
	}

	const bHeight = maximizedPanel === "btc" ? 500 : maximizedPanel === null ? 220 : 0;
	const rHeight = maximizedPanel === "raw" ? 500 : maximizedPanel === null ? 180 : 0;
	const oHeight = maximizedPanel === "osc" ? 500 : maximizedPanel === null ? 160 : 0;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
			{/* Metric Detail Header Navigation */}
			<div className="glass-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
					<button onClick={onClose} className="icon-btn flex items-center justify-center" style={{ width: "36px", height: "36px" }} title="Back to Composite">
						<ArrowLeft size={18} />
					</button>
					<div>
						<span style={{ fontSize: "11px", fontWeight: 600, color: "var(--signal-quant)" }}>DETAILED COMPONENT ZOOM</span>
						<h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{metricDisplayName}</h3>
					</div>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					{maximizedPanel !== null && (
						<button onClick={() => setMaximizedPanel(null)} className="icon-btn flex items-center gap-1" style={{ fontSize: "12px", width: "auto", padding: "0 12px" }}>
							<Minimize2 size={14} /> Restore subplots
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
							padding: "6px 12px",
							borderRadius: "6px",
							cursor: "pointer",
							color: "var(--text-primary)",
							fontSize: "12px",
							fontWeight: 600,
						}}
					>
						<Download size={14} /> SAVE PNG
					</button>
					<div className="toggle-group">
						<button className={`toggle-btn ${!isLogScale ? "active" : ""}`} onClick={() => setIsLogScale(false)}>
							LIN
						</button>
						<button className={`toggle-btn ${isLogScale ? "active" : ""}`} onClick={() => setIsLogScale(true)}>
							LOG
						</button>
					</div>
				</div>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", alignItems: "start" }}>
				{/* The 3-panel Chart Subplots */}
				<div className="chart-panel" ref={wrapperRef}>
					{/* Subplot 1: BTC price */}
					<div className={`chart-subplot ${bHeight === 0 ? "chart-subplot-hidden" : ""}`}>
						<div className="chart-subplot-header">
							<span className="subplot-title">BTC Price (Candlestick)</span>
							<div className="subplot-controls">
								<span className="px-width">85px</span>
								<button onClick={() => setMaximizedPanel(maximizedPanel === "btc" ? null : "btc")} className="icon-btn" title="Toggle maximize BTC subplot">
									{maximizedPanel === "btc" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
								</button>
							</div>
						</div>
						<div ref={btcContainerRef} style={{ width: "100%", height: `${bHeight}px` }} />
					</div>

					{/* Subplot 2: Raw metric values */}
					<div className={`chart-subplot ${rHeight === 0 ? "chart-subplot-hidden" : ""}`}>
						<div className="chart-subplot-header">
							<span className="subplot-title">Raw Metric Timeseries & Thresholds</span>
							<div className="subplot-controls">
								<span className="px-width">85px</span>
								<button onClick={() => setMaximizedPanel(maximizedPanel === "raw" ? null : "raw")} className="icon-btn" title="Toggle maximize Raw subplot">
									{maximizedPanel === "raw" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
								</button>
							</div>
						</div>
						<div ref={rawContainerRef} style={{ width: "100%", height: `${rHeight}px` }} />
					</div>

					{/* Subplot 3: Piecewise normalized oscillator */}
					<div className={`chart-subplot ${oHeight === 0 ? "chart-subplot-hidden" : ""}`}>
						<div className="chart-subplot-header">
							<span className="subplot-title">Piecewise Mapped Oscillator [-2.00, +2.00]</span>
							<div className="subplot-controls">
								<span className="px-width">85px</span>
								<button onClick={() => setMaximizedPanel(maximizedPanel === "osc" ? null : "osc")} className="icon-btn" title="Toggle maximize Oscillator subplot">
									{maximizedPanel === "osc" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
								</button>
							</div>
						</div>
						<div ref={oscContainerRef} style={{ width: "100%", height: `${oHeight}px` }} />
					</div>
				</div>

				{/* Inline Threshold Editor Sidebar */}
				<div className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
					<h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, borderBottom: "1px solid var(--border-panel)", paddingBottom: "8px" }}>
						Piecewise Threshold Editor
					</h4>

					<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<div>
							<label style={{ display: "block", fontSize: "11px", color: "#EF4444", fontWeight: 600, marginBottom: "4px" }}>
								Peak (t_minus_2)
							</label>
							<input
								type="number"
								step="any"
								value={thresholds.t_minus_2 ?? ""}
								onChange={(e) => handleThresholdChange("t_minus_2", e.target.value)}
								style={{ width: "100%", padding: "6px 8px", backgroundColor: "#060a13", border: "1px solid var(--border-panel)", borderRadius: "4px", color: "#fff", fontFamily: "JetBrains Mono", fontSize: "12px" }}
							/>
						</div>

						<div>
							<label style={{ display: "block", fontSize: "11px", color: "#F87171", fontWeight: 600, marginBottom: "4px" }}>
								Warning (t_minus_1)
							</label>
							<input
								type="number"
								step="any"
								value={thresholds.t_minus_1 ?? ""}
								onChange={(e) => handleThresholdChange("t_minus_1", e.target.value)}
								style={{ width: "100%", padding: "6px 8px", backgroundColor: "#060a13", border: "1px solid var(--border-panel)", borderRadius: "4px", color: "#fff", fontFamily: "JetBrains Mono", fontSize: "12px" }}
							/>
						</div>

						<div>
							<label style={{ display: "block", fontSize: "11px", color: "#64748B", fontWeight: 600, marginBottom: "4px" }}>
								Neutral (t_zero)
							</label>
							<input
								type="number"
								step="any"
								value={thresholds.t_zero ?? ""}
								onChange={(e) => handleThresholdChange("t_zero", e.target.value)}
								style={{ width: "100%", padding: "6px 8px", backgroundColor: "#060a13", border: "1px solid var(--border-panel)", borderRadius: "4px", color: "#fff", fontFamily: "JetBrains Mono", fontSize: "12px" }}
							/>
						</div>

						<div>
							<label style={{ display: "block", fontSize: "11px", color: "#4ADE80", fontWeight: 600, marginBottom: "4px" }}>
								Opportunity (t_plus_1)
							</label>
							<input
								type="number"
								step="any"
								value={thresholds.t_plus_1 ?? ""}
								onChange={(e) => handleThresholdChange("t_plus_1", e.target.value)}
								style={{ width: "100%", padding: "6px 8px", backgroundColor: "#060a13", border: "1px solid var(--border-panel)", borderRadius: "4px", color: "#fff", fontFamily: "JetBrains Mono", fontSize: "12px" }}
							/>
						</div>

						<div>
							<label style={{ display: "block", fontSize: "11px", color: "#22C55E", fontWeight: 600, marginBottom: "4px" }}>
								Bottom (t_plus_2)
							</label>
							<input
								type="number"
								step="any"
								value={thresholds.t_plus_2 ?? ""}
								onChange={(e) => handleThresholdChange("t_plus_2", e.target.value)}
								style={{ width: "100%", padding: "6px 8px", backgroundColor: "#060a13", border: "1px solid var(--border-panel)", borderRadius: "4px", color: "#fff", fontFamily: "JetBrains Mono", fontSize: "12px" }}
							/>
						</div>
					</div>

					<button
						onClick={handleSaveConfig}
						disabled={saving}
						style={{
							marginTop: "8px",
							width: "100%",
							padding: "10px",
							backgroundColor: "var(--signal-quant)",
							color: "#000",
							border: "none",
							borderRadius: "4px",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "8px",
							cursor: saving ? "not-allowed" : "pointer",
							opacity: saving ? 0.7 : 1,
						}}
					>
						<Save size={16} />
						{saving ? "SAVING CONFIG..." : "SAVE CONFIG"}
					</button>

					{toast && (
						<div
							style={{
								padding: "8px 12px",
								borderRadius: "4px",
								fontSize: "11px",
								lineHeight: "1.3",
								fontFamily: "JetBrains Mono",
								backgroundColor: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
								color: toast.type === "success" ? "var(--signal-quant)" : "#FFAAAA",
								border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
							}}
						>
							{toast.message}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
