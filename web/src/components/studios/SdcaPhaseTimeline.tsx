import type React from "react";

interface SdcaPhaseTimelineProps {
	data: { date: string; phase: string }[];
}

const PHASE_COLORS: Record<string, string> = {
	deep_discount: "#10B981",
	value: "#3B82F6",
	fair: "#6B7280",
	expansion: "#F59E0B",
	euphoria: "#EF4444",
};

const PHASE_LABELS: Record<string, string> = {
	deep_discount: "Deep Discount",
	value: "Value",
	fair: "Fair",
	expansion: "Expansion",
	euphoria: "Euphoria",
};

export const SdcaPhaseTimeline: React.FC<SdcaPhaseTimelineProps> = ({
	data,
}) => {
	if (!data || data.length === 0) {
		return (
			<div
				style={{
					height: "24px",
					background: "rgba(255,255,255,0.03)",
					borderRadius: "4px",
				}}
			/>
		);
	}

	// Collapse consecutive same-phase segments
	const segments: { phase: string; start: number; end: number }[] = [];
	for (let i = 0; i < data.length; i++) {
		const phase = data[i].phase || "fair";
		if (segments.length > 0 && segments[segments.length - 1].phase === phase) {
			segments[segments.length - 1].end = (i + 1) / data.length;
		} else {
			segments.push({
				phase,
				start: i / data.length,
				end: (i + 1) / data.length,
			});
		}
	}

	return (
		<div
			style={{
				marginTop: "8px",
				background: "rgba(255,255,255,0.03)",
				borderRadius: "4px",
				padding: "6px 8px",
			}}
		>
			<div
				style={{
					display: "flex",
					fontSize: "10px",
					color: "rgba(255,255,255,0.5)",
					marginBottom: "4px",
					gap: "12px",
				}}
			>
				<span>SDCA Regime Timeline</span>
				{Object.entries(PHASE_LABELS).map(([key, label]) => (
					<span
						key={key}
						style={{ display: "flex", alignItems: "center", gap: "3px" }}
					>
						<span
							style={{
								width: "6px",
								height: "6px",
								borderRadius: "50%",
								background: PHASE_COLORS[key] || "#6B7280",
								display: "inline-block",
							}}
						/>
						{label}
					</span>
				))}
			</div>
			<div
				style={{
					width: "100%",
					height: "8px",
					borderRadius: "4px",
					overflow: "hidden",
					display: "flex",
				}}
			>
				{segments.map((seg, i) => (
					<div
						key={i}
						style={{
							flex: `${(seg.end - seg.start) * 10000} 1 0`,
							height: "100%",
							background: PHASE_COLORS[seg.phase] || "#6B7280",
							opacity: 0.85,
						}}
						title={`${seg.phase}: ${(seg.end - seg.start) * 100}% of range`}
					/>
				))}
			</div>
		</div>
	);
};
