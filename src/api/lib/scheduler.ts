import { spawn } from "node:child_process";
import path from "node:path";
import { Cron } from "croner";
import { executeQuerySingle, executeRun } from "../db.js";

let cronJob: Cron | null = null;
let isSyncing = false;
let currentLogBuffer = "";

export function getSchedulerStatus() {
	const scheduleRow = executeQuerySingle<{ value: string }>(
		"SELECT value FROM system_config WHERE key = 'sync_schedule'",
	);
	const activeRow = executeQuerySingle<{ value: string }>(
		"SELECT value FROM system_config WHERE key = 'scheduler_active'",
	);
	const lastTime = executeQuerySingle<{ value: string }>(
		"SELECT value FROM system_config WHERE key = 'last_sync_timestamp'",
	);
	const lastStatus = executeQuerySingle<{ value: string }>(
		"SELECT value FROM system_config WHERE key = 'last_sync_status'",
	);
	const lastLog = executeQuerySingle<{ value: string }>(
		"SELECT value FROM system_config WHERE key = 'last_sync_log'",
	);

	const cronString = scheduleRow?.value || "0 2 * * *";
	const isActive = activeRow?.value === "true";

	let nextRun: string | null = null;
	if (cronJob && isActive) {
		const nextDate = cronJob.nextRun();
		if (nextDate) {
			nextRun = nextDate.toISOString();
		}
	}

	return {
		cronString,
		isActive,
		isSyncing,
		nextRun,
		lastRunTimestamp: lastTime?.value || null,
		lastRunStatus: lastStatus?.value || null,
		lastRunLog: lastLog?.value || null,
	};
}

export function startScheduler() {
	const status = getSchedulerStatus();

	if (cronJob) {
		cronJob.stop();
		cronJob = null;
	}

	if (!status.isActive) {
		console.log("Scheduler is disabled in configuration.");
		return;
	}

	try {
		console.log(
			`Starting cron scheduler with expression: "${status.cronString}"`,
		);
		cronJob = new Cron(status.cronString, () => {
			triggerSync().catch((err) => {
				console.error("Scheduled sync execution failed:", err);
			});
		});
	} catch (err) {
		console.error(`Invalid cron string "${status.cronString}":`, err);
	}
}

export function triggerSync(): Promise<void> {
	if (isSyncing) {
		return Promise.reject(
			new Error("A synchronization run is already in progress."),
		);
	}

	isSyncing = true;
	currentLogBuffer = "";

	console.log("Starting quantitative pipeline execution...");

	return new Promise<void>((resolve, reject) => {
		const workingDir = path.resolve(import.meta.dir, "../../..");

		const child = spawn("python3", ["run_report_pipeline.py"], {
			cwd: workingDir,
			env: { ...process.env, PYTHONUNBUFFERED: "1" },
		});

		child.stdout.on("data", (data) => {
			const chunk = data.toString();
			currentLogBuffer += chunk;
			process.stdout.write(chunk);
		});

		child.stderr.on("data", (data) => {
			const chunk = data.toString();
			currentLogBuffer += chunk;
			process.stderr.write(chunk);
		});

		let finished = false;
		const handleFinish = (code: number | null, error?: Error) => {
			if (finished) return;
			finished = true;
			
			isSyncing = false;
			const timestamp = new Date().toISOString();
			const status = error ? "error" : (code === 0 ? "success" : "error");

			try {
				executeRun(
					"INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
					["last_sync_timestamp", timestamp],
				);
				executeRun(
					"INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
					["last_sync_status", status],
				);
				const cappedLog = currentLogBuffer.slice(-50000);
				executeRun(
					"INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
					["last_sync_log", cappedLog],
				);
			} catch (dbErr) {
				console.error("Failed to persist sync status to SQLite database:", dbErr);
			}

			if (error) {
				reject(error);
			} else if (code === 0) {
				console.log("Quantitative pipeline completed successfully.");
				resolve();
			} else {
				const errMsg = `Pipeline execution failed with exit code ${code}`;
				console.error(errMsg);
				reject(new Error(errMsg));
			}
		};

		child.on("close", (code) => handleFinish(code));
		child.on("exit", (code) => handleFinish(code));
		child.on("error", (err) => handleFinish(null, err));
	});
}
