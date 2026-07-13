import type React from "react";
import { useEffect, useRef, useState } from "react";
import { quantClient } from "../../api/client";
import type { LttdOnchainRecord } from "../../api/types";
import {
	createChart,
	type IChartApi,
	ColorType,
	LineSeries,
	LineStyle,
} from "lightweight-charts";

const BG_CHART = "#0B1220";
const BORDER_COLOR = "rgba(30, 41, 59, 0.8)";
const TEXT_COLOR = "#94A3B8";
const GRID_COLOR = "rgba(255,255,255,0.03)";

const chartOptions = {
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
		minimumWidth: 85,
		borderColor: BORDER_COLOR,
		autoScale: true,
	},
	timeScale: {
		borderColor: BORDER_COLOR,
		timeVisible: true,
		secondsVisible: false,
	},
};

interface SimpleChartProps {
	data: { time: string; value: number }[];
	title: string;
	color: string;
	threshold?: { price: number; label: string; color?: string };
	containerRef: React.RefObject<HTMLDivElement | null>;
	height: number;
}

function SimpleLineChart({
	data,
	color,
	threshold,
	containerRef,
	height,
}: SimpleChartProps) {
	const chartRef = useRef<IChartApi | null>(null);

	useEffect(() => {
		if (!containerRef.current || data.length === 0) return;

		if (chartRef.current) {
			chartRef.current.remove();
			chartRef.current = null;
		}

		const chart = createChart(containerRef.current, {
			...chartOptions,
			width: containerRef.current.clientWidth,
			height,
			timeScale: {
				...chartOptions.timeScale,
				visible: true,
			},
		});
		chartRef.current = chart;

		const series = chart.addSeries(LineSeries, {
			color,
			lineWidth: 2,
		});
		series.setData(data as any);

		if (threshold) {
			series.createPriceLine({
				price: threshold.price,
				color: threshold.color || "#EF4444",
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				axisLabelVisible: true,
				title: threshold.label,
			});
		}

		chart.timeScale().fitContent();

		const ro = new ResizeObserver(() => {
			if (containerRef.current && chartRef.current) {
				chartRef.current.applyOptions({
					width: containerRef.current.clientWidth,
				});
			}
		});
		if (containerRef.current) ro.observe(containerRef.current);

		return () => {
			ro.disconnect();
			chart.remove();
			chartRef.current = null;
		};
	}, [data, color, threshold, containerRef, height]);

	return null;
}

export const LttdOnchainPanel: React.FC = () => {
	const [onchainData, setOnchainData] = useState<LttdOnchainRecord[]>([]);
	const mvrvRef = useRef<HTMLDivElement | null>(null);
	const nuplRef = useRef<HTMLDivElement | null>(null);
	const soprRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		quantClient
			.fetchLttdOnchain()
			.then((data) => {
				setOnchainData(data);
			})
			.catch((e) => {
				console.error("Failed to fetch LTTD on-chain data:", e);
			});
	}, []);

	const latestVal =
		onchainData.length > 0 ? onchainData[onchainData.length - 1] : null;

	const mkSeries = (
		field: "sth_mvrv" | "sth_nupl" | "sth_sopr_24h",
	): { time: string; value: number }[] =>
		onchainData
			.filter((r) => r[field] !== null)
			.map((r) => ({
				time: r.date,
				value: r[field]!,
			}));

	const isMvrvAlert =
		latestVal && latestVal.sth_mvrv !== null && latestVal.sth_mvrv > 2.0;
	const isNuplAlert =
		latestVal && latestVal.sth_nupl !== null && latestVal.sth_nupl > 0.75;

	return (
		<div className="glass-card" style={{ padding: "14px" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					marginBottom: "16px",
				}}
			>
				<span
					style={{
						fontSize: "11px",
						fontWeight: 700,
						color: "var(--text-dim)",
						fontFamily: "Geist Mono, monospace",
						letterSpacing: "0.05em",
					}}
				>
					ON-CHAIN METRICS
				</span>
			</div>

			{/* Current values bar */}
			{latestVal && (
				<div
					style={{
						display: "flex",
						flexWrap: "wrap",
						gap: "12px",
						marginBottom: "16px",
						padding: "8px 12px",
						background: "rgba(255,255,255,0.02)",
						borderRadius: "6px",
						border: "1px solid rgba(255,255,255,0.05)",
						fontSize: "11px",
						fontFamily: "Geist Mono, monospace",
					}}
				>
					<span style={{ color: "var(--text-dim)" }}>{latestVal.date}</span>
					<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
						<span>
							<span style={{ color: "var(--text-dim)" }}>STH-MVRV: </span>
							<span
								style={{ color: isMvrvAlert ? "#EF4444" : "var(--text-main)" }}
							>
								{latestVal.sth_mvrv?.toFixed(2) ?? "N/A"}
								{isMvrvAlert && (
									<span
										style={{
											color: "#EF4444",
											marginLeft: "4px",
											fontSize: "10px",
										}}
									>
										⚠ OVERRIDE
									</span>
								)}
							</span>
						</span>
						<span>
							<span style={{ color: "var(--text-dim)" }}>STH-NUPL: </span>
							<span
								style={{ color: isNuplAlert ? "#EF4444" : "var(--text-main)" }}
							>
								{latestVal.sth_nupl?.toFixed(2) ?? "N/A"}
								{isNuplAlert && (
									<span
										style={{
											color: "#EF4444",
											marginLeft: "4px",
											fontSize: "10px",
										}}
									>
										⚠ OVERRIDE
									</span>
								)}
							</span>
						</span>
						<span>
							<span style={{ color: "var(--text-dim)" }}>STH-SOPR: </span>
							<span style={{ color: "var(--text-main)" }}>
								{latestVal.sth_sopr_24h?.toFixed(3) ?? "N/A"}
							</span>
						</span>
					</div>
				</div>
			)}

			{/* Charts */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
					gap: "16px",
				}}
			>
				<div>
					<div
						style={{
							fontSize: "10px",
							color: "var(--text-dim)",
							marginBottom: "4px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						STH-MVRV
					</div>
					<div
						ref={mvrvRef}
						style={{
							width: "100%",
							height: "120px",
							border: "1px solid rgba(255,255,255,0.05)",
							borderRadius: "4px",
							overflow: "hidden",
						}}
					>
						<SimpleLineChart
							data={mkSeries("sth_mvrv")}
							title="STH-MVRV"
							color="#A78BFA"
							threshold={{
								price: 2.0,
								label: "OVERRIDE >2.0",
								color: "#EF4444",
							}}
							containerRef={mvrvRef}
							height={120}
						/>
					</div>
				</div>
				<div>
					<div
						style={{
							fontSize: "10px",
							color: "var(--text-dim)",
							marginBottom: "4px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						STH-NUPL
					</div>
					<div
						ref={nuplRef}
						style={{
							width: "100%",
							height: "120px",
							border: "1px solid rgba(255,255,255,0.05)",
							borderRadius: "4px",
							overflow: "hidden",
						}}
					>
						<SimpleLineChart
							data={mkSeries("sth_nupl")}
							title="STH-NUPL"
							color="#34D399"
							threshold={{
								price: 0.75,
								label: "OVERRIDE >0.75",
								color: "#EF4444",
							}}
							containerRef={nuplRef}
							height={120}
						/>
					</div>
				</div>
				<div>
					<div
						style={{
							fontSize: "10px",
							color: "var(--text-dim)",
							marginBottom: "4px",
							fontFamily: "Geist Mono, monospace",
						}}
					>
						STH-SOPR
					</div>
					<div
						ref={soprRef}
						style={{
							width: "100%",
							height: "120px",
							border: "1px solid rgba(255,255,255,0.05)",
							borderRadius: "4px",
							overflow: "hidden",
						}}
					>
						<SimpleLineChart
							data={mkSeries("sth_sopr_24h")}
							title="STH-SOPR"
							color="#F59E0B"
							containerRef={soprRef}
							height={120}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
