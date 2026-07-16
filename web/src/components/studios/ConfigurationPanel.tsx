import type React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { quantClient } from "../../api/client";
import {
	Settings,
	Play,
	Save,
	RefreshCw,
	AlertCircle,
	CheckCircle2,
	Copy,
	Calendar,
	Sliders,
	Activity,
} from "lucide-react";

const METRIC_NAMES: Record<string, string> = {
	aviv_ratio: "AVIV Ratio",
	aviv_nupl: "AVIV Net Unrealized PnL (AVIV NUPL)",
	cvdd_ratio: "Cumulative Value Destruction Days (CVDD)",
	mvrv_z: "MVRV Z-Score",
	lth_sth_sopr_ratio: "LTH/STH SOPR Ratio",
	terminal_price_ratio: "Terminal Price Ratio",
	unrealized_sell_risk: "Unrealized Sell Risk",
	sharpe_ratio_52w: "52-Week Sharpe Ratio",
	pi_cycle_top: "Pi Cycle Top Indicator",
	vpli: "Volume-Price Inversion Index (VPLI)",
	risk_metrics: "Core Risk Composite",
	dvrsi: "DV RSI Oscillator",
	williams_r: "Williams %R",
	two_year_ma: "2-Year Moving Average Multiplier",
	ahr999: "AHR999 Index",
	fear_greed_og: "Fear & Greed Index (OG)",
	fear_greed_cmc: "Fear & Greed Index (CMC)",
};

export const ConfigurationPanel: React.FC = () => {
	// Scheduler states
	const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
	const [cronInput, setCronInput] = useState("0 2 * * *");
	const [schedulerActive, setSchedulerActive] = useState(true);
	const [preset, setPreset] = useState("daily");
	const [schedulerLoading, setSchedulerLoading] = useState(false);
	const [schedulerMessage, setSchedulerMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

	// Valuation Threshold states
	const [metrics, setMetrics] = useState<string[]>([]);
	const [selectedMetric, setSelectedMetric] = useState("");
	const [thresholds, setThresholds] = useState<any>({
		t_minus_2: "",
		t_minus_1: "",
		t_zero: "",
		t_plus_1: "",
		t_plus_2: "",
	});
	const [thresholdsLoading, setThresholdsLoading] = useState(false);
	const [thresholdsMessage, setThresholdsMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

	// Sync trigger states
	const [syncTriggering, setSyncTriggering] = useState(false);
	const [logsClipped, setLogsClipped] = useState(false);

	const logsEndRef = useRef<HTMLDivElement>(null);

	// Fetch scheduler status
	const fetchScheduler = useCallback(async () => {
		try {
			const res = await quantClient.getSchedulerStatus();
			if (res.status === "success" && res.data) {
				setSchedulerStatus(res.data);
				setCronInput(res.data.cronString);
				setSchedulerActive(res.data.isActive);
				
				// Set preset based on cron
				if (res.data.cronString === "0 2 * * *") {
					setPreset("daily");
				} else if (res.data.cronString === "0 0 * * *") {
					setPreset("midnight");
				} else if (res.data.cronString === "0 */12 * * *") {
					setPreset("12hours");
				} else {
					setPreset("custom");
				}
			}
		} catch (err: any) {
			console.error("Failed to load scheduler configuration:", err);
		}
	}, []);

	// Fetch metrics list
	const fetchMetricsList = useCallback(async () => {
		try {
			const res = await quantClient.fetchMetricDefaults();
			if (res.status === "success" && res.defaults) {
				const keys = Object.keys(res.defaults);
				setMetrics(keys);
				if (keys.length > 0) {
					setSelectedMetric(keys[0]);
				}
			}
		} catch (err: any) {
			console.error("Failed to fetch metric defaults:", err);
			// Fallback list
			const fallback = Object.keys(METRIC_NAMES);
			setMetrics(fallback);
			setSelectedMetric(fallback[0]);
		}
	}, []);

	// Fetch selected metric thresholds
	const fetchMetricThresholds = useCallback(async (metric: string) => {
		if (!metric) return;
		setThresholdsLoading(true);
		setThresholdsMessage(null);
		try {
			const res = await quantClient.getMetricConfig(metric);
			if (res.status === "success" && res.thresholds) {
				setThresholds({
					t_minus_2: res.thresholds.t_minus_2 ?? "",
					t_minus_1: res.thresholds.t_minus_1 ?? "",
					t_zero: res.thresholds.t_zero ?? "",
					t_plus_1: res.thresholds.t_plus_1 ?? "",
					t_plus_2: res.thresholds.t_plus_2 ?? "",
				});
			}
		} catch (err: any) {
			console.error(`Failed to fetch config for metric "${metric}":`, err);
		} finally {
			setThresholdsLoading(false);
		}
	}, []);

	// Initial data loading
	useEffect(() => {
		fetchScheduler();
		fetchMetricsList();
	}, [fetchScheduler, fetchMetricsList]);

	// Fetch thresholds when selected metric changes
	useEffect(() => {
		if (selectedMetric) {
			fetchMetricThresholds(selectedMetric);
		}
	}, [selectedMetric, fetchMetricThresholds]);

	// Auto scroll logs console to bottom
	useEffect(() => {
		if (schedulerStatus?.isSyncing) {
			logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [schedulerStatus?.lastRunLog, schedulerStatus?.isSyncing]);

	// Polling logic when syncing is active
	useEffect(() => {
		let pollInterval: any = null;
		if (schedulerStatus?.isSyncing) {
			pollInterval = setInterval(() => {
				fetchScheduler();
			}, 3000);
		}
		return () => {
			if (pollInterval) clearInterval(pollInterval);
		};
	}, [schedulerStatus?.isSyncing, fetchScheduler]);

	// Handle preset changes
	const handlePresetChange = (newPreset: string) => {
		setPreset(newPreset);
		if (newPreset === "daily") {
			setCronInput("0 2 * * *");
		} else if (newPreset === "midnight") {
			setCronInput("0 0 * * *");
		} else if (newPreset === "12hours") {
			setCronInput("0 */12 * * *");
		}
	};

	// Save scheduler settings
	const handleSaveScheduler = async (e: React.FormEvent) => {
		e.preventDefault();
		setSchedulerLoading(true);
		setSchedulerMessage(null);
		try {
			const res = await quantClient.saveSchedulerConfig({
				cronString: cronInput,
				isActive: schedulerActive,
			});
			if (res.status === "success") {
				setSchedulerMessage({ text: "Scheduler configuration saved successfully.", type: "success" });
				setSchedulerStatus(res.data);
			} else {
				setSchedulerMessage({ text: res.error || "Failed to save configuration.", type: "error" });
			}
		} catch (err: any) {
			setSchedulerMessage({ text: err.message || "Failed to update configuration.", type: "error" });
		} finally {
			setSchedulerLoading(false);
		}
	};

	// Save metric thresholds
	const handleSaveThresholds = async (e: React.FormEvent) => {
		e.preventDefault();
		setThresholdsLoading(true);
		setThresholdsMessage(null);
		try {
			const config = {
				t_minus_2: thresholds.t_minus_2 !== "" ? Number(thresholds.t_minus_2) : null,
				t_minus_1: thresholds.t_minus_1 !== "" ? Number(thresholds.t_minus_1) : null,
				t_zero: thresholds.t_zero !== "" ? Number(thresholds.t_zero) : null,
				t_plus_1: thresholds.t_plus_1 !== "" ? Number(thresholds.t_plus_1) : null,
				t_plus_2: thresholds.t_plus_2 !== "" ? Number(thresholds.t_plus_2) : null,
			};
			const res = await quantClient.saveMetricConfig(selectedMetric, config);
			if (res.status === "saved") {
				setThresholdsMessage({ text: "Metric thresholds updated successfully.", type: "success" });
			} else {
				setThresholdsMessage({ text: "Failed to update thresholds.", type: "error" });
			}
		} catch (err: any) {
			setThresholdsMessage({ text: err.message || "Failed to update thresholds.", type: "error" });
		} finally {
			setThresholdsLoading(false);
		}
	};

	// Trigger manual sync execution
	const handleTriggerSync = async () => {
		if (schedulerStatus?.isSyncing) return;
		setSyncTriggering(true);
		try {
			const res = await quantClient.triggerSyncRun();
			if (res.status === "running") {
				setSchedulerStatus((prev: any) => ({
					...prev,
					isSyncing: true,
					lastRunLog: "Starting ingestion pipeline...\n",
				}));
			}
		} catch (err: any) {
			alert(`Manual sync trigger failed: ${err.message}`);
		} finally {
			setSyncTriggering(false);
		}
	};

	// Copy logs to clipboard
	const handleCopyLogs = () => {
		if (!schedulerStatus?.lastRunLog) return;
		navigator.clipboard.writeText(schedulerStatus.lastRunLog);
		setLogsClipped(true);
		setTimeout(() => setLogsClipped(false), 2000);
	};

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "20px",
				width: "100%",
				maxWidth: "1400px",
				margin: "0 auto",
				paddingBottom: "40px",
			}}
		>
			{/* Overview Banner */}
			<div
				className="glass-card"
				style={{
					padding: "20px",
					border: "1px solid var(--border-panel)",
					background: "rgba(15, 23, 42, 0.4)",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<Settings size={22} style={{ color: "var(--accent)" }} />
					<div>
						<h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>
							System Control & Synchronization Console
						</h2>
						<p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>
							Manage daily ingestion intervals, trigger background reports calculations, and fine-tune macro Valuation indicators.
						</p>
					</div>
				</div>
			</div>

			<div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
				{/* Column 1: Scheduler & Trigger */}
				<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
					
					{/* Sync Scheduler Card */}
					<div
						className="glass-card"
						style={{
							padding: "20px",
							border: "1px solid var(--border-panel)",
							display: "flex",
							flexDirection: "column",
							gap: "16px",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
							<Calendar size={18} style={{ color: "var(--accent)" }} />
							<h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
								Sync Scheduler (BE Cron)
							</h3>
						</div>

						<form onSubmit={handleSaveScheduler} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
							{/* Active Toggle */}
							<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
								<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Active Status</span>
								<label className="toggle-switch" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
									<input
										type="checkbox"
										checked={schedulerActive}
										onChange={(e) => setSchedulerActive(e.target.checked)}
										style={{ display: "none" }}
									/>
									<div
										style={{
											width: "36px",
											height: "20px",
											borderRadius: "10px",
											backgroundColor: schedulerActive ? "var(--accent)" : "rgba(255,255,255,0.1)",
											position: "relative",
											transition: "background-color 0.2s",
										}}
									>
										<div
											style={{
												width: "14px",
												height: "14px",
												borderRadius: "50%",
												backgroundColor: "#000",
												position: "absolute",
												top: "3px",
												left: schedulerActive ? "19px" : "3px",
												transition: "left 0.2s",
											}}
										/>
									</div>
								</label>
							</div>

							{/* Presets */}
							<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
								<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Schedule Preset</span>
								<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
									{[
										{ id: "daily", label: "Daily" },
										{ id: "midnight", label: "Midnight" },
										{ id: "12hours", label: "12 Hrs" },
										{ id: "custom", label: "Custom" },
									].map((p) => (
										<button
											key={p.id}
											type="button"
											className={`tactile-btn ${preset === p.id ? "tactile-btn-primary" : ""}`}
											onClick={() => handlePresetChange(p.id)}
											style={{ padding: "6px 0", fontSize: "11px" }}
										>
											{p.label}
										</button>
									))}
								</div>
							</div>

							{/* Cron input */}
							<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
								<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Cron Expression</span>
								<input
									type="text"
									value={cronInput}
									onChange={(e) => {
										setCronInput(e.target.value);
										setPreset("custom");
									}}
									disabled={preset !== "custom"}
									placeholder="e.g. 0 2 * * *"
									style={{
										width: "100%",
										padding: "8px 12px",
										backgroundColor: "var(--bg-root)",
										border: "1px solid var(--border-subtle)",
										borderRadius: "4px",
										color: "var(--text-main)",
										fontFamily: "JetBrains Mono, monospace",
										fontSize: "12px",
									}}
								/>
							</div>

							{schedulerMessage && (
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "8px",
										padding: "8px 12px",
										borderRadius: "4px",
										backgroundColor: schedulerMessage.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
										border: `1px solid ${schedulerMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
										color: schedulerMessage.type === "success" ? "var(--status-success)" : "var(--status-danger)",
										fontSize: "11px",
									}}
								>
									{schedulerMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
									<span>{schedulerMessage.text}</span>
								</div>
							)}

							<button
								type="submit"
								disabled={schedulerLoading}
								className="tactile-btn tactile-btn-primary"
								style={{ width: "100%", padding: "10px", marginTop: "4px" }}
							>
								{schedulerLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
								<span style={{ marginLeft: "6px" }}>Save Scheduler Config</span>
							</button>
						</form>
					</div>

					{/* Manual Execution / Status Card */}
					<div
						className="glass-card"
						style={{
							padding: "20px",
							border: "1px solid var(--border-panel)",
							display: "flex",
							flexDirection: "column",
							gap: "14px",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
							<Activity size={18} style={{ color: "var(--accent)" }} />
							<h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
								Scheduler Status
							</h3>
						</div>

						{schedulerStatus ? (
							<div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<span style={{ color: "var(--text-dim)" }}>Scheduler Active:</span>
									<span style={{ fontWeight: 600, color: schedulerStatus.isActive ? "var(--status-success)" : "var(--text-muted)" }}>
										{schedulerStatus.isActive ? "RUNNING" : "STOPPED"}
									</span>
								</div>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<span style={{ color: "var(--text-dim)" }}>Pipeline Sync Mode:</span>
									<span style={{ fontWeight: 600, color: schedulerStatus.isSyncing ? "var(--accent)" : "var(--status-success)" }}>
										{schedulerStatus.isSyncing ? "SYNCHRONIZING..." : "IDLE"}
									</span>
								</div>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<span style={{ color: "var(--text-dim)" }}>Next Run:</span>
									<span style={{ fontFamily: "JetBrains Mono", color: "var(--text-main)" }}>
										{schedulerStatus.nextRun ? new Date(schedulerStatus.nextRun).toLocaleString() : "Never"}
									</span>
								</div>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<span style={{ color: "var(--text-dim)" }}>Last Completed Run:</span>
									<span style={{ fontFamily: "JetBrains Mono", color: "var(--text-main)" }}>
										{schedulerStatus.lastRunTimestamp ? new Date(schedulerStatus.lastRunTimestamp).toLocaleString() : "Never"}
									</span>
								</div>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<span style={{ color: "var(--text-dim)" }}>Last Completion Status:</span>
									<span
										style={{
											fontWeight: 600,
											color: schedulerStatus.lastRunStatus === "success" ? "var(--status-success)" : "var(--status-danger)",
										}}
									>
										{schedulerStatus.lastRunStatus ? schedulerStatus.lastRunStatus.toUpperCase() : "N/A"}
									</span>
								</div>
							</div>
						) : (
							<div style={{ display: "flex", justifyContent: "center", padding: "10px" }}>
								<RefreshCw className="animate-spin" size={18} style={{ color: "var(--text-dim)" }} />
							</div>
						)}

						<button
							onClick={handleTriggerSync}
							disabled={schedulerStatus?.isSyncing || syncTriggering}
							className="tactile-btn"
							style={{
								width: "100%",
								padding: "10px",
								marginTop: "6px",
								borderColor: schedulerStatus?.isSyncing ? "var(--border-subtle)" : "var(--accent)",
								color: schedulerStatus?.isSyncing ? "var(--text-dim)" : "var(--accent)",
								backgroundColor: "transparent",
							}}
						>
							{schedulerStatus?.isSyncing || syncTriggering ? (
								<RefreshCw size={14} className="animate-spin" />
							) : (
								<Play size={14} />
							)}
							<span style={{ marginLeft: "6px" }}>
								{schedulerStatus?.isSyncing ? "Execution In Progress..." : "Trigger Manual Sync Now"}
							</span>
						</button>
					</div>

				</div>

				{/* Column 2: Valuation Threshold Config */}
				<div
					className="glass-card"
					style={{
						padding: "20px",
						border: "1px solid var(--border-panel)",
						display: "flex",
						flexDirection: "column",
						gap: "16px",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
						<Sliders size={18} style={{ color: "var(--accent)" }} />
						<h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
							Valuation Metrics Config
						</h3>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Target Indicator</span>
						<select
							value={selectedMetric}
							onChange={(e) => setSelectedMetric(e.target.value)}
							style={{
								width: "100%",
								padding: "8px 12px",
								backgroundColor: "var(--bg-root)",
								border: "1px solid var(--border-subtle)",
								borderRadius: "4px",
								color: "var(--text-main)",
								fontFamily: "Geist, sans-serif",
								fontSize: "12px",
								outline: "none",
							}}
						>
							{metrics.map((m) => (
								<option key={m} value={m}>
									{METRIC_NAMES[m] || m}
								</option>
							))}
						</select>
					</div>

					<form onSubmit={handleSaveThresholds} style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
						<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Piecewise Linear Thresholds</span>
						
						{["t_minus_2", "t_minus_1", "t_zero", "t_plus_1", "t_plus_2"].map((field) => {
							// Determine label and description
							let desc = "";
							let score = "";
							if (field === "t_minus_2") { desc = "Deep Bubble/Overvaluation Floor"; score = "Score = +2.0"; }
							else if (field === "t_minus_1") { desc = "Warning Bubble/Overvaluation Border"; score = "Score = +1.0"; }
							else if (field === "t_zero") { desc = "Neutral Target Value"; score = "Score = 0.0"; }
							else if (field === "t_plus_1") { desc = "Undervaluation Floor"; score = "Score = -1.0"; }
							else if (field === "t_plus_2") { desc = "Deep Undervaluation / Floor Floor"; score = "Score = -2.0"; }

							return (
								<div key={field} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "10px", alignItems: "center" }}>
									<div>
										<div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>{field.toUpperCase()} ({score})</div>
										<div style={{ fontSize: "10px", color: "var(--text-dim)" }}>{desc}</div>
									</div>
									<input
										type="number"
										step="any"
										value={thresholds[field]}
										onChange={(e) => setThresholds((prev: any) => ({ ...prev, [field]: e.target.value }))}
										placeholder="NULL (unset)"
										style={{
											padding: "6px 10px",
											backgroundColor: "var(--bg-root)",
											border: "1px solid var(--border-subtle)",
											borderRadius: "4px",
											color: "var(--text-main)",
											fontFamily: "JetBrains Mono, monospace",
											fontSize: "12px",
											textAlign: "right",
										}}
									/>
								</div>
							);
						})}

						<div style={{ flex: 1 }} />

						{thresholdsMessage && (
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									padding: "8px 12px",
									borderRadius: "4px",
									backgroundColor: thresholdsMessage.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
									border: `1px solid ${thresholdsMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
									color: thresholdsMessage.type === "success" ? "var(--status-success)" : "var(--status-danger)",
									fontSize: "11px",
								}}
							>
								{thresholdsMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
								<span>{thresholdsMessage.text}</span>
							</div>
						)}

						<button
							type="submit"
							disabled={thresholdsLoading}
							className="tactile-btn tactile-btn-primary"
							style={{ width: "100%", padding: "10px", marginTop: "10px" }}
						>
							{thresholdsLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
							<span style={{ marginLeft: "6px" }}>Save Threshold Configuration</span>
						</button>
					</form>
				</div>
			</div>

			{/* Execution Console Logs Panel */}
			<div
				className="glass-card"
				style={{
					border: "1px solid var(--border-panel)",
					display: "flex",
					flexDirection: "column",
					height: "400px",
					overflow: "hidden",
				}}
			>
				{/* Top bar */}
				<div
					style={{
						padding: "10px 16px",
						borderBottom: "1px solid var(--border-subtle)",
						backgroundColor: "rgba(0,0,0,0.3)",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<div
							style={{
								width: "8px",
								height: "8px",
								borderRadius: "50%",
								backgroundColor: schedulerStatus?.isSyncing ? "var(--accent)" : "rgba(255,255,255,0.2)",
								boxShadow: schedulerStatus?.isSyncing ? "0 0 8px var(--accent)" : "none",
							}}
						/>
						<span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.8px", color: "var(--text-muted)" }}>
							REAL-TIME SYNC EXECUTION CONSOLE
						</span>
					</div>
					<button
						onClick={handleCopyLogs}
						disabled={!schedulerStatus?.lastRunLog}
						className="tactile-btn"
						style={{
							padding: "4px 8px",
							fontSize: "10px",
							display: "flex",
							alignItems: "center",
							gap: "6px",
							borderColor: "var(--border-subtle)",
						}}
					>
						<Copy size={12} />
						<span>{logsClipped ? "COPIED" : "COPY LOGS"}</span>
					</button>
				</div>

				{/* Code Area */}
				<div
					style={{
						flex: 1,
						backgroundColor: "#030712",
						padding: "16px",
						overflowY: "auto",
						fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace",
						fontSize: "12px",
						color: "#10B981",
						lineHeight: "1.6",
						whiteSpace: "pre-wrap",
					}}
				>
					{schedulerStatus?.lastRunLog ? (
						<>
							{schedulerStatus.lastRunLog}
							<div ref={logsEndRef} />
						</>
					) : (
						<span style={{ color: "var(--text-dim)" }}>
							No logs present. Run the ingestion pipeline manually or wait for scheduled trigger to generate logs.
						</span>
					)}
				</div>
			</div>
		</div>
	);
};
