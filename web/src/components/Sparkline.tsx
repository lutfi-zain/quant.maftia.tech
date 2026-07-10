import type React from "react";
import { useState, useRef } from "react";

interface SparklinePoint {
	date: string;
	value: number;
}

interface SparklineProps {
	data: SparklinePoint[];
	color?: string;
	width?: number;
	height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, color = "#64748B", width = 80, height = 24 }) => {
	const [hoveredPoint, setHoveredPoint] = useState<SparklinePoint | null>(null);
	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);

	if (!data || data.length < 2) {
		return <span className="text-slate-500 font-mono">-</span>;
	}

	// Calculate limits
	const values = data.map((d) => d.value);
	const minVal = Math.min(...values);
	const maxVal = Math.max(...values);
	const valRange = maxVal - minVal;

	// Scale points to viewBox: width x height
	const points = data.map((d, index) => {
		const x = (index / (data.length - 1)) * width;
		// Invert Y since SVG y=0 is top
		const y = valRange === 0 ? height / 2 : height - ((d.value - minVal) / valRange) * height;
		return { x, y, date: d.date, value: d.value };
	});

	const pathData = points.map((p) => `${p.x},${p.y}`).join(" ");

	const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;

		// Find nearest point
		let nearestPoint = points[0];
		let minDiff = Math.abs(points[0].x - mouseX);

		for (const p of points) {
			const diff = Math.abs(p.x - mouseX);
			if (diff < minDiff) {
				minDiff = diff;
				nearestPoint = p;
			}
		}

		setHoveredPoint({ date: nearestPoint.date, value: nearestPoint.value });
		setTooltipPos({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top - 40,
		});
	};

	const handleMouseLeave = () => {
		setHoveredPoint(null);
	};

	return (
		<div ref={containerRef} className="relative inline-block" style={{ width, height }}>
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				className="cursor-crosshair overflow-visible"
			>
				<title>Trend Sparkline</title>
				<polyline fill="none" stroke={color} strokeWidth="1.5" points={pathData} />
				{hoveredPoint && (
					<circle
						cx={points.find((p) => p.date === hoveredPoint.date)?.x ?? 0}
						cy={points.find((p) => p.date === hoveredPoint.date)?.y ?? 0}
						r="3"
						fill={color}
					/>
				)}
			</svg>
			{hoveredPoint && (
				<div
					className="absolute z-50 pointer-events-none bg-slate-900 text-white text-xs py-1 px-1.5 rounded border border-slate-700 shadow-lg whitespace-nowrap"
					style={{
						left: `${Math.max(0, Math.min(width - 60, tooltipPos.x - 30))}px`,
						top: `${tooltipPos.y}px`,
					}}
				>
					<div className="font-mono font-bold text-center">{hoveredPoint.value.toFixed(2)}</div>
					<div className="text-[9px] text-slate-400 font-mono">{hoveredPoint.date}</div>
				</div>
			)}
		</div>
	);
};
