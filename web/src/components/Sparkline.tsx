import type React from "react";
import { useState, useRef, useCallback } from "react";

export interface SparklineDataPoint {
	date: string;
	value: number;
}

interface SparklineProps {
	data: SparklineDataPoint[];
	color?: string;
	width?: number;
	height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
	data,
	color = "#64748B",
	width = 80,
	height = 24,
}) => {
	const [tooltip, setTooltip] = useState<{
		x: number;
		y: number;
		date: string;
		value: number;
	} | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	const sorted = data
		.filter(
			(d) => d !== null && typeof d.value === "number" && isFinite(d.value),
		)
		.sort((a, b) => a.date.localeCompare(b.date));

	if (sorted.length < 2) {
		return (
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				style={{ display: "block" }}
			>
				<line
					x1={0}
					y1={height / 2}
					x2={width}
					y2={height / 2}
					stroke="#334155"
					strokeWidth={1}
					strokeDasharray="2,2"
				/>
			</svg>
		);
	}

	const values = sorted.map((d) => d.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min || 1;

	const paddingX = 2;
	const paddingY = 2;
	const drawWidth = width - paddingX * 2;
	const drawHeight = height - paddingY * 2;

	const xScale = (i: number) =>
		paddingX + (i / (sorted.length - 1)) * drawWidth;
	const yScale = (v: number) =>
		paddingY + drawHeight - ((v - min) / range) * drawHeight;

	const points = sorted
		.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.value).toFixed(1)}`)
		.join(" ");

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			if (!svgRef.current) return;
			const rect = svgRef.current.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;

			// Find nearest data point
			const nearestIdx = Math.round(
				((mouseX - paddingX) / drawWidth) * (sorted.length - 1),
			);
			const clampedIdx = Math.max(0, Math.min(sorted.length - 1, nearestIdx));
			const point = sorted[clampedIdx];
			if (!point) return;

			setTooltip({
				x: xScale(clampedIdx),
				y: yScale(point.value),
				date: point.date,
				value: point.value,
			});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[sorted, width, height],
	);

	const handleMouseLeave = useCallback(() => {
		setTooltip(null);
	}, []);

	return (
		<div style={{ position: "relative", display: "inline-block" }}>
			<svg
				ref={svgRef}
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				style={{ display: "block", cursor: "crosshair" }}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				{/* Sparkline area fill */}
				<polygon
					points={`${paddingX},${height - paddingY} ${points} ${xScale(sorted.length - 1)},${height - paddingY}`}
					fill={`${color}20`}
				/>
				{/* Sparkline polyline */}
				<polyline
					points={points}
					fill="none"
					stroke={color}
					strokeWidth={1.5}
					strokeLinejoin="round"
					strokeLinecap="round"
				/>
				{/* End dot */}
				<circle
					cx={xScale(sorted.length - 1)}
					cy={yScale(sorted[sorted.length - 1].value)}
					r={2}
					fill={color}
				/>
			</svg>

			{tooltip && (
				<div
					style={{
						position: "absolute",
						left: Math.min(tooltip.x + 8, width - 80),
						top: Math.max(tooltip.y - 28, 0),
						backgroundColor: "#1e293b",
						border: "1px solid #334155",
						borderRadius: "4px",
						padding: "2px 6px",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: "9px",
						color: "#e2e8f0",
						whiteSpace: "nowrap",
						pointerEvents: "none",
						zIndex: 50,
						lineHeight: "14px",
					}}
				>
					{tooltip.date}
					<br />
					{tooltip.value.toFixed(4)}
				</div>
			)}
		</div>
	);
};
