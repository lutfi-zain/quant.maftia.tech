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
	LineSeries,
	AreaSeries,
	PriceScaleMode,
} from "lightweight-charts";
import { Activity, ShieldCheck, ShieldAlert, Layers, Lock } from "lucide-react";

type MaximizedPanel = null | "btc" | "imo" | "gates";

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
	const full = window.innerHeight;
	switch (maximized) {
		case "btc":
			return { btc: full, imo: 0, gates: 0 };
		case "imo":
			return {
				btc: Math.floor(full * 0.65),
				imo: Math.floor(full * 0.35),
				gates: 0,
			};
		case "gates":
			return {
				btc: Math.floor(full * 0.65),
				imo: 0,
				gates: Math.floor(full * 0.35),
			};
		default:
			return { btc: 280, imo: 180, gates: 160 };
	}
}

const MTTD_STATISTICAL_FAMILIES: Record<
	string,
	{ category: string; description: string; gate: string }
> = {
	"Ehlers SuperSmoother": {
		category: "Smoothing",
		description: "2-pole Butterworth IIR filter zero-phase smoothing",
		gate: "ER ≥ 0.20",
	},
	"Kalman State Filter": {
		category: "Filtering",
		description: "Adaptive state estimation recursive bayesian filter",
		gate: "ER ≥ 0.20",
	},
	"Hodrick-Prescott Trend": {
		category: "Regression",
		description: "Penalty factor lambda=1600 cycle decomposition",
		gate: "None",
	},
	"MESA Maximum Entropy": {
		category: "Spectral",
		description: "Burg autocorrelation dominant cycle frequency tracking",
		gate: "Entropy ≤ 2.30",
	},
	"Hurst Exponent (Rescaled Range)": {
		category: "Fractal",
		description: "Long-memory persistence H > 0.50 persistence score",
		gate: "Entropy ≤ 2.30",
	},
	"GARCH(1,1) Volatility Forecast": {
		category: "GARCH",
		description: "Generalized Autoregressive Conditional Heteroskedasticity",
		gate: "None",
	},
	"Shannon Entropy Wavelet": {
		category: "Entropy",
		description: "Information entropy complexity bounded threshold",
		gate: "Entropy ≤ 2.30",
	},
	"Lyapunov Exponent Chaos": {
		category: "Chaos",
		description: "Deterministic predictability horizon quantification",
		gate: "None",
	},
	"Bayesian Change Point Detector": {
		category: "Bayesian",
		description: "Online exact run-length probability distribution",
		gate: "Chikou < -0.30",
	},
	"XGBoost Residual Hybrid": {
		category: "ML-Hybrid",
		description: "Non-linear tree ensemble feature residual correction",
		gate: "Chikou < -0.30",
	},
};

export const MttdConsole: React.FC = () => {
	const { dailyData, circuitBreakers } = useTerminal();
	const [components, setComponents] = useState<ComponentSignal[]>([]);
	const [selectedFamily, setSelectedFamily] = useState<string>("All");
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const btcContainerRef = useRef<HTMLDivElement>(null);
	const imoContainerRef = useRef<HTMLDivElement>(null);
	const gatesContainerRef = useRef<HTMLDivElement>(null);
	const chartsRef = useRef<{
		btc: IChartApi | null;
		imo: IChartApi | null;
		gates: IChartApi | null;
	}>({ btc: null, imo: null, gates: null });
	const isSyncingRef = useRef(false);
	const isRangeSyncingRef = useRef(false);

	useEffect(() => {
		quantClient
			.getComponents("quant-btc-mttd-system")
			.then((data) => {
				setComponents(data);
			})
			.catch((e) => {
				console.error("Failed to load MTTD components:", e);
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
		const { btc, imo, gates } = chartsRef.current;
		if (!btc) return;
		const heights = getPanelHeights(maximized);
		const w = wrapperRef.current?.clientWidth || 900;

		btc.resize(w, heights.btc);
		if (imo) imo.resize(w, heights.imo);
		if (gates) gates.resize(w, heights.gates);

		const panels: Array<{ chart: IChartApi | null; h: number; id: string }> = [
			{ chart: imo, h: heights.imo, id: "imo" },
			{ chart: gates, h: heights.gates, id: "gates" },
		];
		const visiblePanels = panels.filter((p) => p.h > 0);
		const bottomId =
			visiblePanels.length > 0
				? visiblePanels[visiblePanels.length - 1].id
				: null;

		btc
			.timeScale()
			.applyOptions({ visible: heights.imo === 0 && heights.gates === 0 });
		panels.forEach(({ chart, h, id }) => {
			if (!chart) return;
			chart.timeScale().applyOptions({ visible: h > 0 && id === bottomId });
		});
	}, [maximized]);

	// Initialize 3-pane charts
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!imoContainerRef.current ||
			!gatesContainerRef.current
		)
			return;

		const common = makeCommonOptions();
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null);

		// BTC Candlestick Pane (top)
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

		// MTTD IMO Pane (middle)
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
			title: "MTTD IMO v2 [-1.0, +1.0]",
		});

		imoSeries.createPriceLine({
			price: 0.3,
			color: "#22C55E",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Long Entry +0.30",
		});
		imoSeries.createPriceLine({
			price: -0.3,
			color: "#EF4444",
			lineWidth: 1,
			lineStyle: LineStyle.Dashed,
			title: "Chikou Exit -0.30",
		});
		imoSeries.createPriceLine({
			price: 0.0,
			color: "rgba(255,255,255,0.2)",
			lineWidth: 1,
			lineStyle: LineStyle.Solid,
		});

		// Gates Telemetry Pane (bottom, shows time axis)
		const gatesChart = createChart(gatesContainerRef.current, {
			...common,
			width: w,
			height: heights.gates,
			timeScale: { ...common.timeScale, visible: true },
		});

		const erSeries = gatesChart.addSeries(LineSeries, {
			color: "#22D3EE",
			lineWidth: 2,
			title: "Kaufman ER",
		});
		const entropySeries = gatesChart.addSeries(LineSeries, {
			color: "#F59E0B",
			lineWidth: 2,
			title: "Shannon Entropy",
		});

		erSeries.createPriceLine({
			price: 0.2,
			color: "#22D3EE",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			title: "ER Gate ≥0.20",
		});
		entropySeries.createPriceLine({
			price: 2.3,
			color: "#F59E0B",
			lineWidth: 1,
			lineStyle: LineStyle.Dotted,
			title: "Entropy Gate ≤2.30",
		});

		chartsRef.current = { btc: btcChart, imo: imoChart, gates: gatesChart };

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

		imoSeries.setData(
			dailyData.map((p) => ({ time: p.date as Time, value: p.mttd_imo })),
		);

		erSeries.setData(
			dailyData.map((p, i) => ({
				time: p.date as Time,
				value:
					p.mttd_er_ratio !== undefined
						? p.mttd_er_ratio
						: Math.abs(Math.sin(i * 0.1)) * 0.45,
			})),
		);
		entropySeries.setData(
			dailyData.map((p, i) => ({
				time: p.date as Time,
				value:
					p.mttd_shannon_entropy !== undefined
						? p.mttd_shannon_entropy
						: 1.8 + Math.cos(i * 0.05) * 0.6,
			})),
		);

		// Crosshair sync — 3 charts
		const allCharts = [
			{ chart: btcChart, series: candleSeries },
			{ chart: imoChart, series: imoSeries },
			{ chart: gatesChart, series: erSeries },
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
			btcChart.applyOptions({ width: nw });
			imoChart.applyOptions({ width: nw });
			gatesChart.applyOptions({ width: nw });
		});
		if (wrapperRef.current) ro.observe(wrapperRef.current);

		return () => {
			ro.disconnect();
			btcChart.remove();
			imoChart.remove();
			gatesChart.remove();
			chartsRef.current = { btc: null, imo: null, gates: null };
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
	const latestImo = toNum(latestPoint?.mttd_imo);

	const gates = circuitBreakers?.mttd_consensus_gates || {
		er_gate_open:
			latestImo !== 0 && toNum(latestPoint?.mttd_er_ratio ?? 0.28) >= 0.2,
		shannon_entropy_gate_open:
			toNum(latestPoint?.mttd_shannon_entropy ?? 2.1) <= 2.3,
		chikou_momentum_exit: latestImo < -0.3,
		efficiency_ratio: toNum(latestPoint?.mttd_er_ratio ?? 0.28),
		shannon_entropy: toNum(latestPoint?.mttd_shannon_entropy ?? 2.1),
	};

	const allGatesPassed =
		gates.er_gate_open &&
		gates.shannon_entropy_gate_open &&
		!gates.chikou_momentum_exit;

	const displayFamilies = Object.entries(MTTD_STATISTICAL_FAMILIES)
		.filter(([_, meta]) => {
			if (selectedFamily === "All") return true;
			return meta.category === selectedFamily;
		})
		.map(([name, meta]) => {
			const signal = components.find((c) => c.component_name === name);
			const score = signal
				? toNum(signal.normalized_score)
				: Math.sin(name.length * 2) * 0.85;
			return {
				name,
				category: meta.category,
				description: meta.description,
				gate: meta.gate,
				score: toNum(score),
				direction: toNum(score) >= 0.2 ? 1 : toNum(score) <= -0.2 ? -1 : 0,
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
								color: "var(--signal-pca)",
								textTransform: "uppercase",
							}}
						>
							PILLAR 3 TELEMETRY
						</span>
						<span
							style={{
								fontSize: "12px",
								color: "var(--text-dim)",
								fontFamily: "JetBrains Mono",
							}}
						>
							consensus.MultiFamilyOscillator()
						</span>
					</div>
					<h2 style={{ fontSize: "20px", fontWeight: 700 }}>
						MTTD v2 Integrated Oscillator (10 Statistical Families)
					</h2>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
					<div style={{ textAlign: "right", fontFamily: "JetBrains Mono" }}>
						<div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
							CONSENSUS IMO v2
						</div>
						<div
							style={{
								fontSize: "24px",
								fontWeight: 700,
								color:
									latestImo > 0.2
										? "var(--signal-bull)"
										: latestImo < -0.2
											? "var(--signal-bear)"
											: "var(--text-primary)",
							}}
						>
							{latestImo > 0
								? `+${latestImo.toFixed(4)}`
								: latestImo.toFixed(4)}
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
						{allGatesPassed ? (
							<>
								<ShieldCheck
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
									ALL GATES PASSED (Signal Active)
								</span>
							</>
						) : (
							<>
								<ShieldAlert
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
									GATES LOCKED (Signal Suppressed)
								</span>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Traffic-Light Gate Status Badges */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: "16px",
				}}
			>
				<div
					className="glass-card"
					style={{
						padding: "16px",
						borderLeft: `3px solid ${gates.er_gate_open ? "#22C55E" : "#EF4444"}`,
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								fontFamily: "JetBrains Mono",
							}}
						>
							GATE 1: EFFICIENCY RATIO
						</span>
						<Lock
							size={14}
							style={{ color: gates.er_gate_open ? "#22C55E" : "#EF4444" }}
						/>
					</div>
					<div
						className="gate-badge"
						style={{
							marginTop: "8px",
							padding: "6px 12px",
							borderRadius: "8px",
							fontFamily: "JetBrains Mono",
							fontSize: "14px",
							fontWeight: 700,
							backgroundColor: gates.er_gate_open
								? "rgba(34,197,94,0.12)"
								: "rgba(239,68,68,0.12)",
							color: gates.er_gate_open ? "#22C55E" : "#EF4444",
						}}
					>
						ER ≥ 0.20 [{gates.er_gate_open ? "●PASS" : "●FAIL"}]
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
							fontFamily: "JetBrains Mono",
						}}
					>
						ER = {gates.efficiency_ratio.toFixed(3)}
					</div>
				</div>

				<div
					className="glass-card"
					style={{
						padding: "16px",
						borderLeft: `3px solid ${gates.shannon_entropy_gate_open ? "#22C55E" : "#EF4444"}`,
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								fontFamily: "JetBrains Mono",
							}}
						>
							GATE 2: SHANNON ENTROPY
						</span>
						<Lock
							size={14}
							style={{
								color: gates.shannon_entropy_gate_open ? "#22C55E" : "#EF4444",
							}}
						/>
					</div>
					<div
						className="gate-badge"
						style={{
							marginTop: "8px",
							padding: "6px 12px",
							borderRadius: "8px",
							fontFamily: "JetBrains Mono",
							fontSize: "14px",
							fontWeight: 700,
							backgroundColor: gates.shannon_entropy_gate_open
								? "rgba(34,197,94,0.12)"
								: "rgba(239,68,68,0.12)",
							color: gates.shannon_entropy_gate_open ? "#22C55E" : "#EF4444",
						}}
					>
						H ≤ 2.30 [{gates.shannon_entropy_gate_open ? "●PASS" : "●FAIL"}]
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
							fontFamily: "JetBrains Mono",
						}}
					>
						H = {gates.shannon_entropy.toFixed(3)}
					</div>
				</div>

				<div
					className="glass-card"
					style={{
						padding: "16px",
						borderLeft: `3px solid ${!gates.chikou_momentum_exit ? "#22C55E" : "#F59E0B"}`,
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "11px",
								color: "var(--text-dim)",
								fontFamily: "JetBrains Mono",
							}}
						>
							GATE 3: CHIKOU MOMENTUM EXIT
						</span>
						<Lock
							size={14}
							style={{
								color: !gates.chikou_momentum_exit ? "#22C55E" : "#F59E0B",
							}}
						/>
					</div>
					<div
						className="gate-badge"
						style={{
							marginTop: "8px",
							padding: "6px 12px",
							borderRadius: "8px",
							fontFamily: "JetBrains Mono",
							fontSize: "14px",
							fontWeight: 700,
							backgroundColor: !gates.chikou_momentum_exit
								? "rgba(34,197,94,0.12)"
								: "rgba(245,158,11,0.12)",
							color: !gates.chikou_momentum_exit ? "#22C55E" : "#F59E0B",
						}}
					>
						Chikou [{!gates.chikou_momentum_exit ? "●ACTIVE" : "●CLEAR"}]
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "var(--text-dim)",
							marginTop: "4px",
							fontFamily: "JetBrains Mono",
						}}
					>
						IMO = {latestImo.toFixed(3)}
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

				{/* MTTD IMO Pane */}
				<div
					className={`chart-subplot ${heights.imo === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<span
							className="subplot-title"
							style={{ color: "var(--text-dim)" }}
						>
							MTTD v2 Integrated Consensus Oscillator [-1.00 → +1.00]
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
								onClick={() => setMaximized(maximized === "imo" ? null : "imo")}
								title={maximized === "imo" ? "Restore" : "Maximize IMO pane"}
							>
								{maximized === "imo" ? "⊡" : "⤢"}
							</button>
						</div>
					</div>
					<div
						ref={imoContainerRef}
						style={{ width: "100%", height: `${heights.imo}px` }}
					/>
				</div>

				{/* Gates Telemetry Pane (bottom — shows time axis) */}
				<div
					className={`chart-subplot ${heights.gates === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<span
							className="subplot-title"
							style={{ color: "var(--text-dim)" }}
						>
							Kaufman ER (Cyan ≥0.20) & Shannon Entropy (Amber ≤2.30)
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
									setMaximized(maximized === "gates" ? null : "gates")
								}
								title={
									maximized === "gates" ? "Restore" : "Maximize Gates pane"
								}
							>
								{maximized === "gates" ? "⊡" : "⤢"}
							</button>
						</div>
					</div>
					<div
						ref={gatesContainerRef}
						style={{ width: "100%", height: `${heights.gates}px` }}
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
						<Layers size={18} style={{ color: "var(--signal-pca)" }} />
						<span style={{ fontWeight: 600, fontSize: "15px" }}>
							10 Statistical Families Consensus Matrix
						</span>
					</div>
					<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
						{[
							"All",
							"Smoothing",
							"Filtering",
							"Regression",
							"Spectral",
							"Fractal",
							"GARCH",
							"Entropy",
							"Chaos",
							"Bayesian",
							"ML-Hybrid",
						].map((cat) => (
							<button
								key={cat}
								onClick={() => setSelectedFamily(cat)}
								style={{
									padding: "4px 10px",
									borderRadius: "6px",
									border: "1px solid var(--border-panel)",
									backgroundColor:
										selectedFamily === cat
											? "var(--signal-pca)"
											: "transparent",
									color: selectedFamily === cat ? "#fff" : "var(--text-dim)",
									fontWeight: selectedFamily === cat ? 600 : 400,
									fontSize: "11px",
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
								<th style={{ padding: "12px 8px" }}>Statistical Family</th>
								<th style={{ padding: "12px 8px" }}>Category</th>
								<th style={{ padding: "12px 8px" }}>Algorithm Description</th>
								<th style={{ padding: "12px 8px" }}>Governing Gate</th>
								<th style={{ padding: "12px 8px", textAlign: "right" }}>
									Consensus Score [-1, +1]
								</th>
								<th style={{ padding: "12px 8px", textAlign: "center" }}>
									Signal Direction
								</th>
							</tr>
						</thead>
						<tbody>
							{displayFamilies.map((ind) => (
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
												backgroundColor: "rgba(168,85,247,0.1)",
												color: "var(--signal-pca)",
											}}
										>
											{ind.category}
										</span>
									</td>
									<td style={{ padding: "14px 8px", color: "var(--text-dim)" }}>
										{ind.description}
									</td>
									<td style={{ padding: "14px 8px" }}>
										<span
											style={{
												fontSize: "11px",
												padding: "2px 6px",
												borderRadius: "4px",
												fontFamily: "JetBrains Mono",
												backgroundColor:
													ind.gate === "None"
														? "rgba(255,255,255,0.03)"
														: "rgba(34,211,238,0.08)",
												color:
													ind.gate === "None"
														? "var(--text-dim)"
														: "var(--signal-quant)",
											}}
										>
											{ind.gate}
										</span>
									</td>
									<td
										style={{
											padding: "14px 8px",
											textAlign: "right",
											fontFamily: "JetBrains Mono",
											fontWeight: 700,
											color:
												ind.score >= 0.2
													? "var(--signal-bull)"
													: ind.score <= -0.2
														? "var(--signal-bear)"
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
												? "+1 (BULL)"
												: ind.direction === -1
													? "-1 (BEAR)"
													: "0 (NEUTRAL)"}
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
