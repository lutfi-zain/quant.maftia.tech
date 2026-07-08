import React, { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  IChartApi, 
  ColorType, 
  CrosshairMode, 
  ISeriesApi, 
  Time,
  SeriesMarker,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  createSeriesMarkers
} from 'lightweight-charts';
import { DailyAnalyticsPoint } from '../../api/types';

interface MultiPaneChartProps {
  data: DailyAnalyticsPoint[];
}

export const MultiPaneChart: React.FC<MultiPaneChartProps> = ({ data }) => {
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const valContainerRef = useRef<HTMLDivElement>(null);
  const lttdContainerRef = useRef<HTMLDivElement>(null);
  const mttdContainerRef = useRef<HTMLDivElement>(null);

  const chartsRef = useRef<IChartApi[]>([]);
  const isSyncingRef = useRef<boolean>(false);
  const isRangeSyncingRef = useRef<boolean>(false);

  const [hoveredPoint, setHoveredPoint] = useState<DailyAnalyticsPoint | null>(null);

  useEffect(() => {
    if (!data.length) return;
    if (!priceContainerRef.current || !valContainerRef.current || !lttdContainerRef.current || !mttdContainerRef.current) return;

    // Common styling enforcing strict 85px Y-axis lock across all subplots
    const commonChartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#111622' },
        textColor: '#94a3b8',
        fontFamily: 'JetBrains Mono',
        fontSize: 11
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      rightPriceScale: {
        minimumWidth: 85, // STRICT 85PX LOCK RULE
        borderColor: 'rgba(255, 255, 255, 0.1)',
        autoScale: true
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    };

    // 1. Subplot 1: Price OHLC + Ichimoku Cloud + Markers
    const priceChart = createChart(priceContainerRef.current, {
      ...commonChartOptions,
      height: 280,
    });
    const candlestickSeries = priceChart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ff2a5f',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ff2a5f',
    });

    const cloudSpanASeries = priceChart.addSeries(LineSeries, {
      color: 'rgba(0, 240, 255, 0.4)',
      lineWidth: 1,
      priceLineVisible: false,
      title: 'Span A'
    });
    const cloudSpanBSeries = priceChart.addSeries(LineSeries, {
      color: 'rgba(255, 184, 0, 0.4)',
      lineWidth: 1,
      priceLineVisible: false,
      title: 'Span B'
    });

    // 2. Subplot 2: Valuation Composite [-2.0 to +2.0]
    const valChart = createChart(valContainerRef.current, {
      ...commonChartOptions,
      height: 160,
    });
    const valSeries = valChart.addSeries(AreaSeries, {
      topColor: 'rgba(0, 240, 255, 0.3)',
      bottomColor: 'rgba(0, 240, 255, 0.02)',
      lineColor: '#00f0ff',
      lineWidth: 2,
    });
    // Add reference threshold lines
    valSeries.createPriceLine({
      price: 1.50,
      color: '#ff2a5f',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Bubble Risk (+1.50)'
    });
    valSeries.createPriceLine({
      price: -1.00,
      color: '#00f0ff',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Deep Discount (-1.00)'
    });

    // 3. Subplot 3: LTTD Regime Score & Probabilities
    const lttdChart = createChart(lttdContainerRef.current, {
      ...commonChartOptions,
      height: 160,
    });
    const lttdHistogram = lttdChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
    });

    // 4. Subplot 4: MTTD Integrated Oscillator [-1.0 to +1.0] & Kaufman ER Overlay
    const mttdChart = createChart(mttdContainerRef.current, {
      ...commonChartOptions,
      height: 160,
    });
    const mttdSeries = mttdChart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
    });
    mttdSeries.createPriceLine({
      price: 0.20,
      color: '#10b981',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: 'ER Gate (0.20)'
    });

    const charts = [priceChart, valChart, lttdChart, mttdChart];
    const chartPanes = [
      { chart: priceChart, series: candlestickSeries },
      { chart: valChart, series: valSeries },
      { chart: lttdChart, series: lttdHistogram },
      { chart: mttdChart, series: mttdSeries }
    ];
    chartsRef.current = charts;

    // Map time series data
    const candleData = data.map(p => ({
      time: p.date as Time,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close
    }));
    candlestickSeries.setData(candleData);

    const spanAData = data.map(p => ({
      time: p.date as Time,
      value: p.ichimoku_s_cloud !== undefined ? p.close + (p.ichimoku_s_cloud * 500) : p.close
    }));
    cloudSpanASeries.setData(spanAData);

    const spanBData = data.map(p => ({
      time: p.date as Time,
      value: p.ichimoku_s_future !== undefined ? p.close + (p.ichimoku_s_future * 500) : p.close * 0.98
    }));
    cloudSpanBSeries.setData(spanBData);

    const valData = data.map(p => ({
      time: p.date as Time,
      value: p.valuation_composite
    }));
    valSeries.setData(valData);

    const lttdData = data.map(p => {
      let color = '#10b981'; // BULL
      if (p.lttd_regime === 'BEAR') color = '#ff2a5f';
      if (p.lttd_regime === 'SIDEWAYS') color = '#ffb800';
      return {
        time: p.date as Time,
        value: p.lttd_prob_bull ?? (p.lttd_regime === 'BULL' ? 1.0 : p.lttd_regime === 'BEAR' ? -1.0 : 0.0),
        color
      };
    });
    lttdHistogram.setData(lttdData);

    const mttdData = data.map(p => ({
      time: p.date as Time,
      value: p.mttd_imo
    }));
    mttdSeries.setData(mttdData);

    // Add Buy/Sell Markers on Price Chart
    const markers: SeriesMarker<Time>[] = [];
    data.forEach(p => {
      if (p.valuation_composite <= -1.00 && p.lttd_regime === 'BULL') {
        markers.push({
          time: p.date as Time,
          position: 'belowBar',
          color: '#00f0ff',
          shape: 'arrowUp',
          text: 'BUY'
        });
      } else if (p.valuation_composite >= 1.50 && p.lttd_regime === 'BEAR') {
        markers.push({
          time: p.date as Time,
          position: 'aboveBar',
          color: '#ff2a5f',
          shape: 'arrowDown',
          text: 'SELL'
        });
      }
    });
    createSeriesMarkers(candlestickSeries, markers);

    // Bidirectional Real-Time Vertical Crosshair Synchronization
    charts.forEach((chart, index) => {
      chart.subscribeCrosshairMove((param) => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;

        if (param.time) {
          // Find matching data point for tooltip
          const timeStr = param.time as string;
          const point = data.find(p => p.date === timeStr) || null;
          setHoveredPoint(point);

          chartPanes.forEach(({ chart: c, series: s }, idx) => {
            if (idx !== index) {
              c.setCrosshairPosition(0, param.time as Time, s);
            }
          });
        } else {
          setHoveredPoint(null);
          charts.forEach((c, idx) => {
            if (idx !== index) {
              c.clearCrosshairPosition();
            }
          });
        }

        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      });

      // Synchronize horizontal zoom/scroll visible time range
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (isRangeSyncingRef.current || !range) return;
        isRangeSyncingRef.current = true;

        charts.forEach((c, idx) => {
          if (idx !== index) {
            c.timeScale().setVisibleRange(range);
          }
        });

        requestAnimationFrame(() => {
          isRangeSyncingRef.current = false;
        });
      });
    });

    // Handle Resize
    const handleResize = () => {
      if (priceContainerRef.current && valContainerRef.current && lttdContainerRef.current && mttdContainerRef.current) {
        priceChart.applyOptions({ width: priceContainerRef.current.clientWidth });
        valChart.applyOptions({ width: valContainerRef.current.clientWidth });
        lttdChart.applyOptions({ width: lttdContainerRef.current.clientWidth });
        mttdChart.applyOptions({ width: mttdContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      charts.forEach(c => c.remove());
    };
  }, [data]);

  const displayPoint = hoveredPoint || (data.length > 0 ? data[data.length - 1] : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Synchronized Tooltip Bar */}
      <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ color: 'var(--text-muted)' }}>DATE: <strong style={{ color: 'var(--text-main)' }}>{displayPoint?.date || 'N/A'}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>CLOSE: <strong style={{ color: '#10b981' }}>${displayPoint?.close.toLocaleString() || 'N/A'}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>VAL COMP: <strong style={{ color: (displayPoint?.valuation_composite ?? 0) >= 1.5 ? 'var(--status-danger)' : 'var(--accent-cyan)' }}>{displayPoint?.valuation_composite.toFixed(4) || '0.00'}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ color: 'var(--text-muted)' }}>LTTD: <strong style={{ color: displayPoint?.lttd_regime === 'BULL' ? '#10b981' : displayPoint?.lttd_regime === 'BEAR' ? '#ff2a5f' : '#ffb800' }}>{displayPoint?.lttd_regime || 'SIDEWAYS'}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>MTTD IMO: <strong style={{ color: '#a855f7' }}>{displayPoint?.mttd_imo.toFixed(4) || '0.00'}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>ICHIMOKU: <strong style={{ color: '#0055ff' }}>{displayPoint?.ichimoku_imo.toFixed(4) || '0.00'}</strong></span>
        </div>
      </div>

      {/* Stacked Subplots Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Subplot 1: Price OHLC + Ichimoku Cloud */}
        <div className="glass-card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Subplot 1: MasterOHLCV Price (Log-Scale Capable) + Ichimoku Cloud + Buy/Sell Markers</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>85px Y-Axis Locked</span>
          </div>
          <div ref={priceContainerRef} style={{ width: '100%', height: '280px' }} />
        </div>

        {/* Subplot 2: Valuation Composite */}
        <div className="glass-card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Subplot 2: Master Valuation Composite [-2.0 to +2.0 Scale] (Bubble & Discount Thresholds)</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>85px Y-Axis Locked</span>
          </div>
          <div ref={valContainerRef} style={{ width: '100%', height: '160px' }} />
        </div>

        {/* Subplot 3: LTTD Regime Score */}
        <div className="glass-card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Subplot 3: LTTD Regime Probabilities (BULL=#10b981 / BEAR=#ff2a5f / SIDEWAYS=#ffb800)</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>85px Y-Axis Locked</span>
          </div>
          <div ref={lttdContainerRef} style={{ width: '100%', height: '160px' }} />
        </div>

        {/* Subplot 4: MTTD Integrated Oscillator */}
        <div className="glass-card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Subplot 4: MTTD v2 IMO [-1.0 to +1.0] + Kaufman ER Gate (≥0.20) Overlay</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>85px Y-Axis Locked</span>
          </div>
          <div ref={mttdContainerRef} style={{ width: '100%', height: '160px' }} />
        </div>
      </div>
    </div>
  );
};
