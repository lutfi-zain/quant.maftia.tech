/**
 * SDCA Panel Component
 *
 * Displays SDCA state, multiplier gauge, phase indicator,
 * portfolio metrics, and transaction log.
 */

import type React from "react";
import { useState, useEffect, useMemo } from "react";
import {
	ChevronDown,
	Download,
	TrendingUp,
	TrendingDown,
	Minus,
	ArrowUp,
	ArrowDown,
} from "lucide-react";
import type { SdcaSignal, SdcaPhase } from "../../lib/sdcaEngine";
import type { PortfolioState } from "../../lib/sdcaPortfolio";
import {
	computeMetrics,
	exportTransactionsCsv,
	savePortfolioState,
	loadPortfolioState,
	createInitialState,
	executeBuy,
	executeSell,
	resetPortfolio,
} from "../../lib/sdcaPortfolio";

// ─── Constants ──────────────────────────────────────────────────────────────

const PANEL_STATE_KEY = "sdca_panel_collapsed";
const SIGN_FIX_ACKNOWLEDGED_KEY = "sdca_sign_fix_acknowledged_v1";
const SDCA_PRESET_KEY = "sdca_preset_selection";

// ─── Preset Definitions ─────────────────────────────────────────────

interface SdcaPreset {
	buy_threshold: number;
	sell_threshold: number;
	description: string;
}

const SDCA_PRESETS: Record<string, SdcaPreset> = {
	optimized: {
		buy_threshold: 0.5,
		sell_threshold: -1.5,
		description: "Grid search optimized (default)",
	},
	conservative: {
		buy_threshold: 0.5,
		sell_threshold: -1.5,
		description: "Lower drawdown focus",
	},
	moderate: {
		buy_threshold: 1.0,
		sell_threshold: -1.0,
		description: "Balanced risk/return",
	},
	aggressive: {
		buy_threshold: 1.5,
		sell_threshold: -0.5,
		description: "Higher risk, higher return",
	},
};

const PHASE_COLORS: Record<SdcaPhase, string> = {
	deep_discount: "#22c55e",
	value: "#4ade80",
	fair: "#3b82f6",
	expansion: "#f59e0b",
	euphoria: "#ef4444",
	neutral: "#3b82f6",
	sell_all: "#ef4444",
	sell_dca: "#f59e0b",
	buy_all: "#22c55e",
	buy_dca: "#4ade80",
};

const PHASE_LABELS: Record<SdcaPhase, string> = {
	deep_discount: "DEEP VALUE",
	value: "VALUE",
	fair: "FAIR",
	expansion: "EXPANSION",
	euphoria: "EUPHORIA",
	neutral: "NEUTRAL",
	sell_all: "SELL ALL",
	sell_dca: "SELL DCA",
	buy_all: "BUY ALL",
	buy_dca: "BUY DCA",
};

const PHASE_ICONS: Record<SdcaPhase, React.ReactNode> = {
	deep_discount: <ArrowDown size={14} />,
	value: <TrendingDown size={14} />,
	fair: <Minus size={14} />,
	expansion: <TrendingUp size={14} />,
	euphoria: <ArrowUp size={14} />,
	neutral: <Minus size={14} />,
	sell_all: <ArrowUp size={14} />,
	sell_dca: <TrendingUp size={14} />,
	buy_all: <ArrowDown size={14} />,
	buy_dca: <TrendingDown size={14} />,
};

function getMultiplierColor(multiplier: number): string {
	if (multiplier === 999.0) return "#22c55e";
	if (multiplier >= 2.0) return "#22c55e";
	if (multiplier >= 1.5) return "#4ade80";
	if (multiplier >= 1.0) return "#3b82f6";
	if (multiplier >= 0.5) return "#eab308";
	if (multiplier >= 0.0) return "#f97316";
	return "#ef4444";
}

function getMultiplierLabel(multiplier: number): string {
	if (multiplier === 999.0) return "BUY ALL (100% Cash)";
	if (multiplier === -1.0) return "SELL ALL (100% Position)";
	if (multiplier >= 2.0) return "Aggressive Buy";
	if (multiplier >= 1.5) return "Value Buy";
	if (multiplier >= 1.0) return "Normal DCA";
	if (multiplier >= 0.5) return "Reduce";
	if (multiplier >= 0.0) return "Pause";
	return "Sell DCA";
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface SdcaPanelProps {
	/** Current SDCA signal from engine */
	signal: SdcaSignal | null;
	/** Current BTC price */
	currentPrice: number;
	/** Whether panel is in fullscreen mode */
	fullscreen?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SdcaPanel: React.FC<SdcaPanelProps> = ({
	signal,
	currentPrice,
	fullscreen = false,
}) => {
	const [collapsed, setCollapsed] = useState(() => {
		try {
			return localStorage.getItem(PANEL_STATE_KEY) === "true";
		} catch {
			return false;
		}
	});

	const [selectedPreset, setSelectedPreset] = useState<string>(() => {
		try {
			return localStorage.getItem(SDCA_PRESET_KEY) || "optimized";
		} catch {
			return "optimized";
		}
	});

	// Backtest metrics from API (set by parent or fetched internally)
	const [backtestMetrics, _setBacktestMetrics] = useState<{
		sharpeRatio: number;
		totalReturn: number;
		cagr: number;
		maxDrawdown: number;
		winRate: number;
		simpleDcaReturn?: number;
	} | null>(null);

	const [portfolio, setPortfolio] = useState<PortfolioState>(() => {
		return loadPortfolioState() || createInitialState();
	});

	// One-time sign convention fix notification
	const [showSignFixNotice, setShowSignFixNotice] = useState(() => {
		try {
			return localStorage.getItem(SIGN_FIX_ACKNOWLEDGED_KEY) !== "true";
		} catch {
			return true;
		}
	});

	const handleDismissNotice = () => {
		setShowSignFixNotice(false);
		try {
			localStorage.setItem(SIGN_FIX_ACKNOWLEDGED_KEY, "true");
		} catch {
			// Ignore
		}
	};

	const handleResetWithNotice = () => {
		const fresh = resetPortfolio();
		setPortfolio(fresh);
		handleDismissNotice();
	};

	// Auto-execute DCA based on signal
	useEffect(() => {
		if (!signal || currentPrice <= 0) return;

		const today = new Date().toISOString().slice(0, 10);
		const lastTxDate = portfolio.transactionLog.length
			? portfolio.transactionLog[
					portfolio.transactionLog.length - 1
				].timestamp.slice(0, 10)
			: "";

		// Only execute once per day
		if (lastTxDate === today) return;

		// Execute based on action
		if (signal.multiplier > 0 && signal.action !== "HOLD") {
			const newState = { ...portfolio };
			executeBuy(newState, currentPrice, signal.multiplier, signal.phase);
			setPortfolio(newState);
			savePortfolioState(newState);
		} else if (signal.multiplier < 0) {
			const newState = { ...portfolio };
			const sellAll = signal.action === "SELL_ALL";
			executeSell(
				newState,
				currentPrice,
				signal.multiplier,
				signal.phase,
				sellAll,
			);
			setPortfolio(newState);
			savePortfolioState(newState);
		}
	}, [signal, currentPrice]); // eslint-disable-line react-hooks/exhaustive-deps

	// Save collapsed state
	useEffect(() => {
		try {
			localStorage.setItem(PANEL_STATE_KEY, String(collapsed));
		} catch {
			// Ignore
		}
	}, [collapsed]);

	const metrics = useMemo(
		() => computeMetrics(portfolio, currentPrice),
		[portfolio, currentPrice],
	);

	const handleReset = () => {
		if (confirm("Reset portfolio? This will clear all transaction history.")) {
			const fresh = resetPortfolio();
			setPortfolio(fresh);
		}
	};

	const handleExport = () => {
		exportTransactionsCsv(portfolio);
	};

	return (
		<div
			className={`chart-panel ${fullscreen ? "fullscreen" : ""}`}
			style={{
				background: "#0B1220",
				border: "1px solid rgba(30, 41, 59, 0.8)",
				borderRadius: "8px",
				marginTop: "8px",
				overflow: "hidden",
			}}
		>
			{/* Header */}
			<div
				onClick={(e) => {
					// Only collapse if the click wasn't on a button or select inside
					if ((e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'SELECT') {
						setCollapsed(!collapsed);
					}
				}}
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					width: "100%",
					padding: "12px 16px",
					background: "transparent",
					border: "none",
					cursor: "pointer",
					color: "#94A3B8",
					fontFamily: "Geist Mono, monospace",
					fontSize: "12px",
					textAlign: "left",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					{/* Sign convention fix notice */}
					{showSignFixNotice && (
						<div
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								zIndex: 10,
								padding: "12px 16px",
								background: "rgba(234, 179, 8, 0.15)",
								borderBottom: "1px solid rgba(234, 179, 8, 0.3)",
								display: "flex",
								alignItems: "center",
								gap: "12px",
								flexWrap: "wrap",
							}}
						>
							<span
								style={{ color: "#FBBF24", fontSize: "11px", fontWeight: 600 }}
							>
								⚠️ Sign convention fixed
							</span>
							<span style={{ color: "#94A3B8", fontSize: "10px" }}>
								The SDCA engine now correctly buys at bottoms (positive
								composite) and sells at tops (negative composite). Previous
								positions may be based on inverted signals.
							</span>
							<div style={{ display: "flex", gap: "8px" }}>
								<button
									type="button"
									onClick={handleResetWithNotice}
									style={{
										background: "rgba(234, 179, 8, 0.3)",
										border: "1px solid rgba(234, 179, 8, 0.5)",
										borderRadius: "4px",
										padding: "4px 12px",
										color: "#FBBF24",
										cursor: "pointer",
										fontSize: "10px",
										fontWeight: 600,
									}}
								>
									Reset Portfolio
								</button>
								<button
									type="button"
									onClick={handleDismissNotice}
									style={{
										background: "transparent",
										border: "1px solid rgba(100, 116, 139, 0.5)",
										borderRadius: "4px",
										padding: "4px 12px",
										color: "#94A3B8",
										cursor: "pointer",
										fontSize: "10px",
									}}
								>
									Dismiss
								</button>
							</div>
						</div>
					)}
					<span style={{ fontWeight: 600, color: "#E2E8F0" }}>
						⚡ SDCA STRATEGY
					</span>
					{signal && (
						<>
							<span
								style={{
									color: getMultiplierColor(signal.multiplier),
									fontWeight: 600,
								}}
							>
								{signal.multiplier > 0 ? "+" : ""}
								{signal.multiplier.toFixed(1)}x
							</span>
							<span
								style={{
									background: PHASE_COLORS[signal.phase],
									color: "#000",
									padding: "2px 8px",
									borderRadius: "4px",
									fontSize: "10px",
									fontWeight: 600,
									display: "flex",
									alignItems: "center",
									gap: "4px",
								}}
							>
								{PHASE_ICONS[signal.phase]}
								{PHASE_LABELS[signal.phase]}
							</span>
							<span style={{ color: "#64748B", fontSize: "10px" }}>
								{signal.action.replace(/_/g, " ")}
							</span>
						</>
					)}
					{/* Preset Selector */}
					{!collapsed && (
						<select
							value={selectedPreset}
							onChange={(e) => {
								setSelectedPreset(e.target.value);
								try {
									localStorage.setItem(SDCA_PRESET_KEY, e.target.value);
								} catch {
									// Ignore
								}
							}}
							style={{
								background: "rgba(59, 130, 246, 0.15)",
								border: "1px solid rgba(59, 130, 246, 0.3)",
								borderRadius: "4px",
								padding: "2px 6px",
								color: "#93C5FD",
								fontSize: "10px",
								cursor: "pointer",
								fontFamily: "Geist Mono, monospace",
							}}
						>
							{Object.entries(SDCA_PRESETS).map(([key, preset]) => (
								<option key={key} value={key}>
									{preset.description}
								</option>
							))}
						</select>
					)}
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					{!collapsed && (
						<>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleExport();
								}}
								style={{
									background: "rgba(59, 130, 246, 0.2)",
									border: "1px solid rgba(59, 130, 246, 0.4)",
									borderRadius: "4px",
									padding: "4px 8px",
									color: "#3b82f6",
									cursor: "pointer",
									fontSize: "10px",
									display: "flex",
									alignItems: "center",
									gap: "4px",
								}}
							>
								<Download size={12} />
								Export CSV
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleReset();
								}}
								style={{
									background: "rgba(239, 68, 68, 0.2)",
									border: "1px solid rgba(239, 68, 68, 0.4)",
									borderRadius: "4px",
									padding: "4px 8px",
									color: "#ef4444",
									cursor: "pointer",
									fontSize: "10px",
								}}
							>
								Reset
							</button>
						</>
					)}
					<ChevronDown
						size={16}
						style={{
							transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
							transition: "transform 0.2s",
						}}
					/>
				</div>
			</div>

			{/* Collapsed Summary */}
			{collapsed && (
				<div
					style={{
						padding: "0 16px 12px",
						display: "flex",
						gap: "16px",
						fontSize: "11px",
						color: "#64748B",
					}}
				>
					<span>Position: {portfolio.btcBalance.toFixed(8)} BTC</span>
					<span>
						Value: $
						{metrics.portfolioValue.toLocaleString(undefined, {
							maximumFractionDigits: 0,
						})}
					</span>
					<span
						style={{
							color: metrics.unrealizedPnl >= 0 ? "#22c55e" : "#ef4444",
						}}
					>
						P&L: {metrics.unrealizedPnl >= 0 ? "+" : ""}$
						{metrics.unrealizedPnl.toLocaleString(undefined, {
							maximumFractionDigits: 0,
						})}
					</span>
				</div>
			)}

			{/* Expanded Content */}
			{!collapsed && (
				<div style={{ padding: "0 16px 16px" }}>
					{/* Multiplier Gauge */}
					<div style={{ marginBottom: "16px" }}>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontSize: "10px",
								color: "#64748B",
								marginBottom: "4px",
							}}
						>
							<span>-0.5x</span>
							<span>0.0x</span>
							<span>1.0x</span>
							<span>2.0x</span>
							<span>3.0x</span>
						</div>
						<div
							style={{
								height: "8px",
								background: "rgba(255,255,255,0.05)",
								borderRadius: "4px",
								position: "relative",
								overflow: "hidden",
							}}
						>
							{/* Color gradient background */}
							<div
								style={{
									position: "absolute",
									inset: 0,
									background:
										"linear-gradient(to right, #ef4444 0%, #f97316 15%, #eab308 30%, #3b82f6 50%, #4ade80 70%, #22c55e 100%)",
									opacity: 0.3,
								}}
							/>
							{/* Multiplier indicator */}
							{signal && (
								<div
									style={{
										position: "absolute",
										left: `${Math.max(0, Math.min(100, (((signal.multiplier === 999.0 ? 3.0 : signal.multiplier === -1.0 || signal.multiplier === -999.0 ? -0.5 : signal.multiplier) + 0.5) / 3.5) * 100))}%`,
										top: "-4px",
										width: "4px",
										height: "16px",
										background: getMultiplierColor(signal.multiplier),
										borderRadius: "2px",
										transform: "translateX(-50%)",
										boxShadow: `0 0 8px ${getMultiplierColor(signal.multiplier)}`,
									}}
								/>
							)}
						</div>
						{signal && (
							<div
								style={{
									textAlign: "center",
									marginTop: "8px",
									fontSize: "11px",
									color: getMultiplierColor(signal.multiplier),
									fontWeight: 600,
								}}
							>
								{getMultiplierLabel(signal.multiplier)}
							</div>
						)}
					</div>

					{/* Portfolio Metrics Grid */}
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(5, 1fr)",
							gap: "12px",
							marginBottom: "16px",
						}}
						className="sdca-metrics-grid"
					>
						<MetricCell
							label="Position"
							value={`${portfolio.btcBalance.toFixed(8)} BTC`}
						/>
						<MetricCell
							label="Avg Cost"
							value={
								portfolio.avgCostBasis > 0
									? `$${portfolio.avgCostBasis.toLocaleString()}`
									: "-"
							}
						/>
						<MetricCell
							label="Unrealized P&L"
							value={`${metrics.unrealizedPnl >= 0 ? "+" : ""}$${Math.abs(metrics.unrealizedPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
							subvalue={`${metrics.unrealizedPnlPct >= 0 ? "+" : ""}${metrics.unrealizedPnlPct.toFixed(1)}%`}
							color={metrics.unrealizedPnl >= 0 ? "#22c55e" : "#ef4444"}
						/>
						<MetricCell
							label="Portfolio Value"
							value={`$${metrics.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
						/>
						<MetricCell
							label="Cash Balance"
							value={`$${portfolio.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
						/>
					</div>

					{/* Fee & Stats Row */}
					<div
						style={{
							display: "flex",
							gap: "16px",
							fontSize: "10px",
							color: "#64748B",
							marginBottom: "16px",
							flexWrap: "wrap",
						}}
					>
						<span>Total Fees Paid: ${portfolio.totalFeesPaid.toFixed(2)}</span>
						<span>Transactions: {portfolio.transactionLog.length}</span>
						{signal && <span>Regime Confidence: {signal.confidence}</span>}
						{signal && signal.price_ma200_ratio !== undefined && (
							<span style={{ color: "#3b82f6" }}>
								Price/MA200: {signal.price_ma200_ratio.toFixed(2)}x
							</span>
						)}
						{signal && signal.ath_drawdown !== undefined && (
							<span style={{ color: signal.ath_drawdown >= 20.0 ? "#ef4444" : "#f59e0b" }}>
								ATH Drawdown: {signal.ath_drawdown.toFixed(1)}%
							</span>
						)}
					</div>

					{/* Threshold Display with Optimization Badge */}
					<div
						style={{
							display: "flex",
							gap: "12px",
							marginBottom: "12px",
							alignItems: "center",
							flexWrap: "wrap",
						}}
					>
						<div
							style={{
								padding: "4px 10px",
								background: "rgba(34, 197, 94, 0.1)",
								border: "1px solid rgba(34, 197, 94, 0.3)",
								borderRadius: "4px",
								fontSize: "10px",
								color: "#4ade80",
								fontFamily: "Geist Mono, monospace",
							}}
						>
							Buy &ge; {SDCA_PRESETS[selectedPreset]?.buy_threshold ?? 0.5}
						</div>
						<div
							style={{
								padding: "4px 10px",
								background: "rgba(239, 68, 68, 0.1)",
								border: "1px solid rgba(239, 68, 68, 0.3)",
								borderRadius: "4px",
								fontSize: "10px",
								color: "#f87171",
								fontFamily: "Geist Mono, monospace",
							}}
						>
							Sell &le; {SDCA_PRESETS[selectedPreset]?.sell_threshold ?? -1.5}
						</div>
						{selectedPreset !== "moderate" && (
							<div
								style={{
									padding: "2px 8px",
									background: "rgba(234, 179, 8, 0.15)",
									border: "1px solid rgba(234, 179, 8, 0.3)",
									borderRadius: "4px",
									fontSize: "9px",
									color: "#FBBF24",
									fontWeight: 600,
								}}
							>
								⚡ OPTIMIZED
							</div>
						)}
					</div>

					{/* Alpha Comparison (SDCA vs Simple DCA) */}
					{backtestMetrics && (
						<div
							style={{
								padding: "8px 12px",
								background:
									backtestMetrics.totalReturn >
									(backtestMetrics.simpleDcaReturn ?? 0)
										? "rgba(34, 197, 94, 0.08)"
										: "rgba(239, 68, 68, 0.08)",
								border: `1px solid ${backtestMetrics.totalReturn > (backtestMetrics.simpleDcaReturn ?? 0) ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
								borderRadius: "4px",
								marginBottom: "12px",
								fontSize: "11px",
								fontFamily: "Geist Mono, monospace",
							}}
						>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<span style={{ color: "#94A3B8" }}>SDCA vs Simple DCA</span>
								<span
									style={{
										color:
											backtestMetrics.totalReturn >
											(backtestMetrics.simpleDcaReturn ?? 0)
												? "#22c55e"
												: "#ef4444",
										fontWeight: 600,
									}}
								>
									{backtestMetrics.totalReturn >
									(backtestMetrics.simpleDcaReturn ?? 0)
										? "+"
										: ""}
									{(
										backtestMetrics.totalReturn -
										(backtestMetrics.simpleDcaReturn ?? 0)
									).toFixed(1)}
									%
									{backtestMetrics.totalReturn >
									(backtestMetrics.simpleDcaReturn ?? 0)
										? " alpha"
										: " underperformance"}
								</span>
							</div>
						</div>
					)}

					{/* Transaction Log */}
					<div
						style={{
							border: "1px solid rgba(30, 41, 59, 0.8)",
							borderRadius: "4px",
							overflow: "hidden",
						}}
					>
						<div
							style={{
								padding: "8px 12px",
								background: "rgba(255,255,255,0.02)",
								fontSize: "10px",
								color: "#64748B",
								fontWeight: 600,
							}}
						>
							TRANSACTION LOG (Last 20)
						</div>
						<div style={{ maxHeight: "200px", overflowY: "auto" }}>
							<table
								style={{
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "11px",
									fontFamily: "Geist Mono, monospace",
								}}
							>
								<thead>
									<tr style={{ color: "#64748B" }}>
										<th style={thStyle}>Date</th>
										<th style={thStyle}>Action</th>
										<th style={thStyle}>Amount</th>
										<th style={thStyle}>Price</th>
										<th style={thStyle}>BTC</th>
									</tr>
								</thead>
								<tbody>
									{portfolio.transactionLog.length === 0 ? (
										<tr>
											<td
												colSpan={5}
												style={{
													padding: "12px",
													textAlign: "center",
													color: "#475569",
												}}
											>
												No transactions yet
											</td>
										</tr>
									) : (
										portfolio.transactionLog
											.slice(-20)
											.reverse()
											.map((tx, i) => (
												<tr
													key={`${tx.timestamp}-${i}`}
													style={{
														borderTop: "1px solid rgba(30, 41, 59, 0.4)",
														background:
															tx.action === "BUY"
																? "rgba(34, 197, 94, 0.05)"
																: "rgba(239, 68, 68, 0.05)",
													}}
												>
													<td style={tdStyle}>{tx.timestamp.slice(0, 10)}</td>
													<td
														style={{
															...tdStyle,
															color:
																tx.action === "BUY" ? "#22c55e" : "#ef4444",
															fontWeight: 600,
														}}
													>
														{tx.action}
													</td>
													<td style={tdStyle}>${tx.amountUsd.toFixed(0)}</td>
													<td style={tdStyle}>${tx.price.toLocaleString()}</td>
													<td style={tdStyle}>{tx.btcAmount.toFixed(6)}</td>
												</tr>
											))
									)}
								</tbody>
							</table>
						</div>
					</div>

					{/* Responsive CSS override */}
					<style>{`
						@media (max-width: 768px) {
							.sdca-metrics-grid {
								grid-template-columns: repeat(2, 1fr) !important;
							}
						}
					`}</style>
				</div>
			)}
		</div>
	);
};

// ─── Sub-Components ─────────────────────────────────────────────────────────

const MetricCell: React.FC<{
	label: string;
	value: string;
	subvalue?: string;
	color?: string;
}> = ({ label, value, subvalue, color }) => (
	<div
		style={{
			padding: "8px 12px",
			background: "rgba(255,255,255,0.02)",
			borderRadius: "4px",
			border: "1px solid rgba(30, 41, 59, 0.6)",
		}}
	>
		<div style={{ fontSize: "10px", color: "#64748B", marginBottom: "4px" }}>
			{label}
		</div>
		<div
			style={{ fontSize: "12px", color: color || "#E2E8F0", fontWeight: 600 }}
		>
			{value}
		</div>
		{subvalue && (
			<div style={{ fontSize: "10px", color, marginTop: "2px" }}>
				{subvalue}
			</div>
		)}
	</div>
);

// ─── Table Styles ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
	padding: "8px 12px",
	textAlign: "left",
	fontWeight: 600,
	fontSize: "10px",
	borderBottom: "1px solid rgba(30, 41, 59, 0.8)",
};

const tdStyle: React.CSSProperties = {
	padding: "8px 12px",
	fontSize: "11px",
	color: "#E2E8F0",
};
