import type React from "react";
import { useState } from "react";
import { quantClient } from "../../api/client";
import {
	Play,
	RotateCcw,
	Zap,
	Search,
	Database,
	Terminal,
	CheckCircle,
	AlertCircle,
	Loader2,
} from "lucide-react";

interface LogEntry {
	id: string;
	timestamp: string;
	action: string;
	status: "running" | "success" | "error";
	output?: string;
}

const ACTIONS = [
	{
		id: "sync_today",
		name: "Sync Today",
		description: "Run run_pipeline.py for today",
		icon: <Play size={18} />,
		confirm: false,
	},
	{
		id: "recover_10d",
		name: "Recover 10d",
		description: "Backfill last 10 days",
		icon: <RotateCcw size={18} />,
		confirm: false,
	},
	{
		id: "sync_gap",
		name: "Sync Gap",
		description: "Auto-detect & backfill missing days",
		icon: <Zap size={18} />,
		confirm: false,
	},
	{
		id: "vif_audit",
		name: "VIF Audit",
		description: "Check multicollinearity > 10",
		icon: <Search size={18} />,
		confirm: false,
	},
	{
		id: "full_repopulation",
		name: "Full Repopulation",
		description: "Run backfill_all.py (Heavy)",
		icon: <Database size={18} />,
		confirm: true,
		confirmMsg: "Full repopulation will take a long time. Proceed?",
	},
];

export const LttdControlCenter: React.FC = () => {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [runningAction, setRunningAction] = useState<string | null>(null);

	const handleTrigger = async (
		actionId: string,
		actionName: string,
		needsConfirm?: boolean,
		confirmMsg?: string,
	) => {
		if (isRunning) return;

		if (needsConfirm && confirmMsg) {
			if (!window.confirm(confirmMsg)) return;
		}

		setIsRunning(true);
		setRunningAction(actionId);

		const logId = Math.random().toString(36).substring(7);
		const now = new Date().toLocaleTimeString();

		setLogs((prev) => [
			{
				id: logId,
				timestamp: now,
				action: actionName,
				status: "running",
			},
			...prev.slice(0, 4),
		]);

		try {
			const data = await quantClient.triggerLttdAction(actionId);

			setLogs((prev) =>
				prev.map((log) =>
					log.id === logId
						? {
								...log,
								status: data.success ? "success" : "error",
								output: data.success
									? data.output.substring(0, 500)
									: data.error_output || "Unknown error",
							}
						: log,
				),
			);
		} catch (err: any) {
			setLogs((prev) =>
				prev.map((log) =>
					log.id === logId
						? { ...log, status: "error", output: err.message }
						: log,
				),
			);
		} finally {
			setIsRunning(false);
			setRunningAction(null);
		}
	};

	return (
		<div className="glass-card" style={{ padding: "14px" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					marginBottom: "14px",
				}}
			>
				<Terminal size={16} style={{ color: "var(--accent)" }} />
				<span
					style={{
						fontSize: "11px",
						fontWeight: 700,
						color: "var(--text-dim)",
						fontFamily: "Geist Mono, monospace",
						letterSpacing: "0.05em",
					}}
				>
					PIPELINE CONTROL CENTER
				</span>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
					gap: "8px",
					marginBottom: "14px",
				}}
			>
				{ACTIONS.map((act) => {
					const isCurrentAction = runningAction === act.id;
					return (
						<button
							key={act.id}
							onClick={() =>
								handleTrigger(act.id, act.name, act.confirm, act.confirmMsg)
							}
							disabled={isRunning}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "8px",
								padding: "10px 12px",
								borderRadius: "6px",
								border: "1px solid rgba(255,255,255,0.06)",
								background: isCurrentAction
									? "rgba(245,158,11,0.08)"
									: "rgba(255,255,255,0.02)",
								color: "var(--text-main)",
								fontSize: "12px",
								fontFamily: "Geist Mono, monospace",
								cursor: isRunning ? "not-allowed" : "pointer",
								opacity: isRunning && !isCurrentAction ? 0.5 : 1,
								transition: "all 0.15s",
							}}
							onMouseEnter={(e) => {
								if (!isRunning)
									e.currentTarget.style.background = "rgba(255,255,255,0.05)";
							}}
							onMouseLeave={(e) => {
								if (!isRunning)
									e.currentTarget.style.background = "rgba(255,255,255,0.02)";
							}}
						>
							{isCurrentAction ? (
								<Loader2
									size={16}
									style={{ animation: "spin 1s linear infinite" }}
								/>
							) : (
								act.icon
							)}
							<div style={{ textAlign: "left" }}>
								<div style={{ fontWeight: 600 }}>{act.name}</div>
								<div
									style={{
										fontSize: "10px",
										color: "var(--text-muted)",
									}}
								>
									{act.description}
								</div>
							</div>
						</button>
					);
				})}
			</div>

			{/* Execution Logs */}
			{logs.length > 0 && (
				<div
					style={{
						borderTop: "1px solid rgba(255,255,255,0.05)",
						paddingTop: "12px",
					}}
				>
					<div
						style={{
							fontSize: "10px",
							color: "var(--text-dim)",
							fontFamily: "Geist Mono, monospace",
							marginBottom: "8px",
						}}
					>
						EXECUTION LOG
					</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "6px",
							maxHeight: "200px",
							overflowY: "auto",
						}}
					>
						{logs.map((log) => (
							<div
								key={log.id}
								style={{
									padding: "8px 10px",
									borderRadius: "4px",
									background: "rgba(255,255,255,0.02)",
									border: "1px solid rgba(255,255,255,0.04)",
									fontSize: "11px",
									fontFamily: "Geist Mono, monospace",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "8px",
										marginBottom: "4px",
									}}
								>
									<span
										style={{ color: "var(--text-muted)", fontSize: "10px" }}
									>
										{log.timestamp}
									</span>
									<span style={{ color: "var(--text-main)", fontWeight: 600 }}>
										{log.action}
									</span>
									{log.status === "running" && (
										<span
											style={{
												marginLeft: "auto",
												color: "var(--accent)",
												fontSize: "10px",
												display: "flex",
												alignItems: "center",
												gap: "4px",
											}}
										>
											<Loader2
												size={12}
												style={{ animation: "spin 1s linear infinite" }}
											/>{" "}
											Running
										</span>
									)}
									{log.status === "success" && (
										<span
											style={{
												marginLeft: "auto",
												color: "#22C55E",
												fontSize: "10px",
												display: "flex",
												alignItems: "center",
												gap: "4px",
											}}
										>
											<CheckCircle size={12} /> Success
										</span>
									)}
									{log.status === "error" && (
										<span
											style={{
												marginLeft: "auto",
												color: "#EF4444",
												fontSize: "10px",
												display: "flex",
												alignItems: "center",
												gap: "4px",
											}}
										>
											<AlertCircle size={12} /> Failed
										</span>
									)}
								</div>
								{log.output && (
									<pre
										style={{
											fontSize: "10px",
											color: "var(--text-muted)",
											whiteSpace: "pre-wrap",
											wordBreak: "break-word",
											margin: 0,
											padding: "4px 0",
											maxHeight: "60px",
											overflow: "hidden",
										}}
									>
										{log.output}
									</pre>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};
