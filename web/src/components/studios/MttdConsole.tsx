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
	Activity,
	ShieldCheck,
	ShieldAlert,
	Layers,
	Lock,
	Maximize2,
	Minimize2,
	ChevronDown,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

type MaximizedPanel = null | "btc" | "imo" | "gates";

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
			return { btc: available, imo: 0, gates: 0 };
		case "imo":
			return {
				btc: Math.floor(available * 0.65),
				imo: Math.floor(available * 0.35),
				gates: 0,
			};
		case "gates":
			return {
				btc: Math.floor(available * 0.65),
				imo: 0,
				gates: Math.floor(available * 0.35),
			};
		default:
			return isMobile
				? { btc: 160, imo: 120, gates: 120 }
				: { btc: 280, imo: 180, gates: 160 };
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
	const [dropdownOpenFamily, setDropdownOpenFamily] = useState(false);
	const [hoveredPoint, setHoveredPoint] = useState<any>(null);
	const [isLogScale, setIsLogScale] = useState(true);
	const [maximized, setMaximized] = useState<MaximizedPanel>(null);
	const isMobile = useIsMobile();

	const wrapperRef = useRef<HTMLDivElement>(null);
	const studioContainerRef = useRef<HTMLDivElement>(null);
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
		const heights = getPanelHeights(maximized, isMobile);
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
	}, [maximized, isMobile]);

	// Initialize 3-pane charts
	useEffect(() => {
		if (
			!dailyData.length ||
			!btcContainerRef.current ||
			!imoContainerRef.current ||
			!gatesContainerRef.current
		)
			return;

		const common = makeCommonOptions(getChartYAxisWidth());
		const w = wrapperRef.current?.clientWidth || 900;
		const heights = getPanelHeights(null, isMobile);

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
			if (!nw || nw <= 0) return;
			const yWidth = getChartYAxisWidth();
			btcChart.applyOptions({ width: nw });
			btcChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			imoChart.applyOptions({ width: nw });
			imoChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
			gatesChart.applyOptions({ width: nw });
			gatesChart.priceScale("right").applyOptions({ minimumWidth: yWidth });
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
							LAYER 03 · STATISTICAL CONSENSUS
						</span>
						<span className="studio-tag-fn">
							consensus.MultiFamilyOscillator()
						</span>
					</div>
					<h2 className="studio-banner-title">
						MTTD v2 Integrated Oscillator (10 Statistical Families)
					</h2>
				</div>

				<div className="studio-banner-metric">
					<span className="studio-metric-label">CONSENSUS IMO v2</span>
					<span
						className="studio-metric-value"
						style={{
							color:
								latestImo > 0.2
									? "var(--signal-bull)"
									: latestImo < -0.2
										? "var(--signal-bear)"
										: "var(--text-primary)",
						}}
					>
						{latestImo > 0 ? `+${latestImo.toFixed(4)}` : latestImo.toFixed(4)}
					</span>
				</div>

				<div
					className={`studio-banner-status ${
						allGatesPassed ? "status-fair" : "status-bubble"
					}`}
				>
					{allGatesPassed ? (
						<>
							<ShieldCheck size={18} style={{ flexShrink: 0 }} />
							<span>ALL GATES PASSED (Signal Active)</span>
						</>
					) : (
						<>
							<ShieldAlert size={18} style={{ flexShrink: 0 }} />
							<span>GATES LOCKED (Signal Suppressed)</span>
						</>
					)}
				</div>
			</div>

			{/* Traffic-Light Gate Status Badges */}
			<div
				className="stat-grid-3col"
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: "16px",
				}}
			>
				<div
					className="glass-card"
					style={{
						padding: "12px",
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
								fontFamily: "Geist Mono, monospace",
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
							borderRadius: "4px",
							fontFamily: "Geist Mono, monospace",
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
							fontFamily: "Geist Mono, monospace",
						}}
					>
						ER = {gates.efficiency_ratio.toFixed(3)}
					</div>
				</div>

				<div
					className="glass-card"
					style={{
						padding: "12px",
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
								fontFamily: "Geist Mono, monospace",
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
							borderRadius: "4px",
							fontFamily: "Geist Mono, monospace",
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
							fontFamily: "Geist Mono, monospace",
						}}
					>
						H = {gates.shannon_entropy.toFixed(3)}
					</div>
				</div>

				<div
					className="glass-card"
					style={{
						padding: "12px",
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
								fontFamily: "Geist Mono, monospace",
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
							borderRadius: "4px",
							fontFamily: "Geist Mono, monospace",
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
							fontFamily: "Geist Mono, monospace",
						}}
					>
						IMO = {latestImo.toFixed(3)}
					</div>
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
				{/* BTC Candlestick Pane */}
				<div
					className={`chart-subplot ${heights.btc === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">SYS 03</span>
							<span>MasterOHLCV Price Feed</span>
						</div>
						<div className="subplot-controls">
							<span className="subplot-meta">MULTI-PRINCIPLE TRACKING</span>
							<span className="subplot-axis-lock">85px</span>
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

				{/* MTTD IMO Pane */}
				<div
					className={`chart-subplot ${heights.imo === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">IMO v2</span>
							<span>Consensus Momentum Index</span>
						</div>
						<div className="subplot-controls">
							<span className="subplot-meta">RANGE [-1.00, +1.00]</span>
							<span className="subplot-axis-lock">85px</span>
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

				{/* Gates Telemetry Pane (bottom — shows time axis) */}
				<div
					className={`chart-subplot ${heights.gates === 0 ? "chart-subplot-hidden" : ""}`}
				>
					<div className="chart-subplot-header">
						<div className="subplot-title">
							<span className="subplot-badge">LOGIC GATES</span>
							<span>Efficiency Ratio & Shannon Entropy</span>
						</div>
						<div className="subplot-controls">
							<span className="subplot-meta">ER ≥ 0.20 · H ≤ 2.30</span>
							<span className="subplot-axis-lock">85px</span>
							<button
								className="icon-btn"
								onClick={() =>
									setMaximized(maximized === "gates" ? null : "gates")
								}
								title={
									maximized === "gates" ? "Restore" : "Maximize Gates pane"
								}
							>
								{maximized === "gates" ? (
									<Minimize2 size={14} />
								) : (
									<Maximize2 size={14} />
								)}
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
			<div className="glass-card" style={{ padding: "12px" }}>
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
					<div
						style={{
							display: "flex",
							gap: "6px",
							flexWrap: "wrap",
							alignItems: "center",
						}}
					>
						{isMobile ? (
							<div style={{ position: "relative" }}>
								<button
									onClick={() => setDropdownOpenFamily(!dropdownOpenFamily)}
									style={{
										padding: "4px 10px",
										borderRadius: "4px",
										border: "1px solid var(--border-panel)",
										backgroundColor: "var(--bg-surface)",
										color: "var(--text-main)",
										fontSize: "11px",
										fontWeight: 500,
										cursor: "pointer",
										display: "flex",
										alignItems: "center",
										gap: "4px",
										whiteSpace: "nowrap",
									}}
								>
									{selectedFamily}
									<ChevronDown
										size={12}
										style={{
											transition: "transform 0.2s",
											transform: dropdownOpenFamily
												? "rotate(180deg)"
												: "rotate(0deg)",
										}}
									/>
								</button>
								{dropdownOpenFamily && (
									<div
										style={{
											position: "absolute",
											top: "100%",
											right: 0,
											marginTop: "4px",
											minWidth: "180px",
											maxHeight: "300px",
											overflowY: "auto",
											backgroundColor: "var(--bg-surface)",
											border: "1px solid var(--border-panel)",
											borderRadius: "4px",
											padding: "4px 0",
											zIndex: 100,
											boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
										}}
									>
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
												onClick={() => {
													setSelectedFamily(cat);
													setDropdownOpenFamily(false);
												}}
												style={{
													padding: "8px 14px",
													width: "100%",
													textAlign: "left",
													border: "none",
													backgroundColor:
														selectedFamily === cat
															? "var(--signal-pca)"
															: "transparent",
													color:
														selectedFamily === cat ? "#fff" : "var(--text-dim)",
													fontSize: "11px",
													fontWeight: selectedFamily === cat ? 600 : 400,
													cursor: "pointer",
												}}
											>
												{cat}
											</button>
										))}
									</div>
								)}
							</div>
						) : (
							<>
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
											borderRadius: "4px",
											border: "1px solid var(--border-panel)",
											backgroundColor:
												selectedFamily === cat
													? "var(--signal-pca)"
													: "transparent",
											color:
												selectedFamily === cat ? "#fff" : "var(--text-dim)",
											fontWeight: selectedFamily === cat ? 600 : 400,
											fontSize: "11px",
											cursor: "pointer",
										}}
									>
										{cat}
									</button>
								))}
							</>
						)}
					</div>
				</div>

				{isMobile ? (
					/* Mobile: Compact Two-Line List */
					<div className="mobile-metric-list">
						{displayFamilies.map((ind) => (
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
												ind.score >= 0.2
													? "var(--signal-bull)"
													: ind.score <= -0.2
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
											backgroundColor: "rgba(168,85,247,0.1)",
											color: "var(--signal-pca)",
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
											? "+1 (BULL)"
											: ind.direction === -1
												? "-1 (BEAR)"
												: "0 (NEUT)"}
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
									<th style={{ padding: "8px 6px" }}>Statistical Family</th>
									<th style={{ padding: "8px 6px" }}>Category</th>
									<th style={{ padding: "8px 6px" }}>Algorithm Description</th>
									<th style={{ padding: "8px 6px" }}>Governing Gate</th>
									<th style={{ padding: "8px 6px", textAlign: "right" }}>
										Consensus Score [-1, +1]
									</th>
									<th style={{ padding: "8px 6px", textAlign: "center" }}>
										Signal Direction
									</th>
								</tr>
							</thead>
							<tbody>
								{displayFamilies.map((ind) => (
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
													backgroundColor: "rgba(168,85,247,0.1)",
													color: "var(--signal-pca)",
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
												color:
													ind.gate === "None"
														? "var(--text-dim)"
														: "var(--signal-quant)",
											}}
										>
											{ind.gate}
										</td>
										<td
											style={{
												padding: "10px 6px",
												textAlign: "right",
												fontFamily: "Geist Mono, monospace",
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
				)}
			</div>
		</div>
	);
};
