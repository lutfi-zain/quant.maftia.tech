import { Hono } from "hono";
import { Cron } from "croner";
import { getSchedulerStatus, startScheduler, triggerSync } from "../lib/scheduler.js";
import { executeRun } from "../db.js";

export const configRouter = new Hono();

// GET /api/v1/config/scheduler
configRouter.get("/scheduler", (c) => {
	try {
		const status = getSchedulerStatus();
		return c.json({
			status: "success",
			data: status,
		});
	} catch (err: any) {
		console.error("Error fetching scheduler config:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});

// POST /api/v1/config/scheduler
configRouter.post("/scheduler", async (c) => {
	try {
		const body = await c.req.json();
		const { cronString, isActive } = body;

		if (cronString !== undefined) {
			// Validate cron syntax
			try {
				new Cron(cronString);
			} catch (validationErr) {
				return c.json({ error: `Invalid cron expression syntax: ${cronString}` }, 400);
			}
			executeRun(
				"INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
				["sync_schedule", cronString],
			);
		}

		if (isActive !== undefined) {
			executeRun(
				"INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
				["scheduler_active", isActive ? "true" : "false"],
			);
		}

		// Reload the scheduler with the new settings
		startScheduler();

		const status = getSchedulerStatus();
		return c.json({
			status: "success",
			message: "Scheduler configuration updated successfully.",
			data: status,
		});
	} catch (err: any) {
		console.error("Error updating scheduler config:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});

// POST /api/v1/config/sync/run
configRouter.post("/sync/run", (c) => {
	const status = getSchedulerStatus();
	if (status.isSyncing) {
		return c.json({ error: "A synchronization run is already in progress." }, 409);
	}

	// Trigger execution asynchronously in the background
	triggerSync().catch((err) => {
		console.error("Background manual sync execution failed:", err);
	});

	return c.json(
		{
			status: "running",
			message: "Quantitative sync pipeline started in background.",
		},
		202,
	);
});
