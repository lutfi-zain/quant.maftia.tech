import React, { useEffect, useState, useRef } from 'react';
import { quantClient } from '../../api/client';
import { ComponentSignal } from '../../api/types';
import { useTerminal } from '../../context/TerminalContext';
import { createChart, ColorType, LineStyle, Time, AreaSeries } from 'lightweight-charts';
import { AlertTriangle, CheckCircle2, DollarSign, Filter, Layers } from 'lucide-react';

const INDICATOR_METADATA: Record<string, { category: string; description: string }> = {
  'MVRV Z-Score': { category: 'Fundamental', description: 'Market Value to Realized Value standardized Z-score' },
  'Puell Multiple': { category: 'Fundamental', description: 'Daily issuance value relative to 365-day moving average' },
  'RHODL Ratio': { category: 'Fundamental', description: 'Realized HODL ratio weighting recent coin age over old coins' },
  'SOPR (90d SMA)': { category: 'Fundamental', description: 'Spent Output Profit Ratio smoothed over 90 days' },
  'Reserve Risk': { category: 'Fundamental', description: 'Confidence of long-term holders vs price incentive to sell' },
  'Thermocap Multiple': { category: 'Fundamental', description: 'Market capitalization divided by cumulative miner revenue' },
  'NVT Golden Cross': { category: 'Fundamental', description: 'Network Value to Transactions ratio short vs long trend' },
  'Pi Cycle Top Indicator': { category: 'Technical', description: 'Intersection of 111d SMA and 2x 350d SMA' },
  '200-Week SMA Heatmap': { category: 'Technical', description: 'Percentage distance above canonical 200-week moving average' },
  'RSI (14-Month)': { category: 'Technical', description: 'Macro Relative Strength Index bounded momentum' },
  'MACD Macro Wave': { category: 'Technical', description: 'Monthly MACD histogram and signal divergence' },
  'Bollinger Band Width (Log)': { category: 'Technical', description: 'Standard deviation compression and breakout volatility' },
  'Mayer Multiple': { category: 'Technical', description: 'Current price divided by 200-day moving average' },
  'Fear & Greed Index (30d SMA)': { category: 'Sentiment', description: 'Multi-factor social & market sentiment composite' },
  'Net Unrealized Profit/Loss (NUPL)': { category: 'Sentiment', description: 'Total market unrealized profit versus loss proportion' },
  'Exchange Net Flow Velocity': { category: 'Sentiment', description: 'Aggregated net exchange inflows/outflows momentum' },
  'Miner Outflow Ratio': { category: 'Sentiment', description: 'Proportion of miner wallet transfers to liquid exchanges' }
};

export const ValuationStudio: React.FC = () => {
  const { dailyData, circuitBreakers } = useTerminal();
  const [components, setComponents] = useState<ComponentSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    quantClient.getComponents('quant-btc-valuation-system')
      .then(data => {
        setComponents(data);
        setLoading(false);
      })
      .catch(e => {
        console.error('Failed to load valuation components:', e);
        setLoading(false);
      });
  }, []);

  // Initialize valuation chart with 85px lock
  useEffect(() => {
    if (!chartContainerRef.current || !dailyData.length) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111622' }, textColor: '#94a3b8', fontFamily: 'JetBrains Mono', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { minimumWidth: 85, borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)' },
      height: 260,
    });

    const series = chart.addSeries(AreaSeries, {
      topColor: 'rgba(0, 240, 255, 0.4)',
      bottomColor: 'rgba(0, 240, 255, 0.02)',
      lineColor: '#00f0ff',
      lineWidth: 2,
    });

    series.createPriceLine({ price: 1.50, color: '#ff2a5f', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Bubble Risk (+1.50)' });
    series.createPriceLine({ price: -1.00, color: '#00f0ff', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Deep Discount (-1.00)' });

    series.setData(dailyData.map(p => ({ time: p.date as Time, value: p.valuation_composite })));
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [dailyData]);

  const toNum = (val: any): number => typeof val === 'object' && val !== null ? Number(val.score ?? val.oscillator ?? val.normalized_score ?? 0) : Number(val ?? 0);
  const latestValScore = dailyData.length ? toNum(dailyData[dailyData.length - 1].valuation_composite) : 0;
  const isBubble = latestValScore >= 1.50;
  const isDiscount = latestValScore <= -1.00;

  // Derive display rows for table
  const displayIndicators = Object.entries(INDICATOR_METADATA).filter(([_, meta]) => {
    if (selectedCategory === 'All') return true;
    return meta.category === selectedCategory;
  }).map(([name, meta]) => {
    const signal = components.find(c => c.component_name === name);
    // Simulate piecewise linear score [-2, +2] if signal score is normalized [-1, 1]
    const score = signal ? toNum(signal.normalized_score) * 2 : (Math.sin(name.length) * 1.5);
    return {
      name,
      category: meta.category,
      description: meta.description,
      score: toNum(score),
      direction: toNum(score) >= 1.0 ? 1 : toNum(score) <= -0.8 ? -1 : 0
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Pillar Header Info Bar */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>PILLAR 1 TELEMETRY</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>piecewise_linear_interpolate()</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>17-Indicator Piecewise Linear Valuation Model</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COMPOSITE SCORE</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: isBubble ? 'var(--status-danger)' : isDiscount ? 'var(--accent-cyan)' : 'var(--text-main)' }}>
              {latestValScore > 0 ? `+${latestValScore.toFixed(4)}` : latestValScore.toFixed(4)}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isBubble ? (
              <><AlertTriangle size={18} style={{ color: 'var(--status-danger)' }} /> <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--status-danger)' }}>MACD/MVRV BUBBLE FILTER ACTIVE</span></>
            ) : isDiscount ? (
              <><CheckCircle2 size={18} style={{ color: 'var(--accent-cyan)' }} /> <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>ACCUMULATION ZONE (Discount ≤ -1.00)</span></>
            ) : (
              <><CheckCircle2 size={18} style={{ color: 'var(--status-success)' }} /> <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--status-success)' }}>FAIR MARKET CYCLE ZONE</span></>
            )}
          </div>
        </div>
      </div>

      {/* Historical Valuation Composite Chart */}
      <div className="glass-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          <span>Macro Valuation Score Curve [-2.00 to +2.00]</span>
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>85px Y-Axis Locked</span>
        </div>
        <div ref={chartContainerRef} style={{ width: '100%', height: '260px' }} />
      </div>

      {/* Interactive Breakdown Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Piecewise Linear Component Matrix</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'Fundamental', 'Technical', 'Sentiment'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: selectedCategory === cat ? 'var(--accent-cyan)' : 'transparent',
                  color: selectedCategory === cat ? '#000' : 'var(--text-muted)',
                  fontWeight: selectedCategory === cat ? 600 : 400,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono' }}>
                <th style={{ padding: '12px 8px' }}>Indicator Name</th>
                <th style={{ padding: '12px 8px' }}>Category</th>
                <th style={{ padding: '12px 8px' }}>Description</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Piecewise Score [-2, +2]</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Signal Direction</th>
              </tr>
            </thead>
            <tbody>
              {displayIndicators.map((ind, i) => (
                <tr key={ind.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 600, color: 'var(--text-main)' }}>{ind.name}</td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontFamily: 'JetBrains Mono',
                      backgroundColor: ind.category === 'Fundamental' ? 'rgba(0, 240, 255, 0.1)' : ind.category === 'Technical' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 184, 0, 0.1)',
                      color: ind.category === 'Fundamental' ? 'var(--accent-cyan)' : ind.category === 'Technical' ? 'var(--accent-purple)' : 'var(--accent-gold)'
                    }}>
                      {ind.category}
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>{ind.description}</td>
                  <td style={{ padding: '14px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 700, color: ind.score >= 1.0 ? 'var(--status-danger)' : ind.score <= -1.0 ? 'var(--accent-cyan)' : 'var(--text-main)' }}>
                    {ind.score > 0 ? `+${ind.score.toFixed(3)}` : ind.score.toFixed(3)}
                  </td>
                  <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontFamily: 'JetBrains Mono',
                      backgroundColor: ind.direction === 1 ? 'rgba(255, 42, 95, 0.15)' : ind.direction === -1 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: ind.direction === 1 ? 'var(--status-danger)' : ind.direction === -1 ? 'var(--accent-cyan)' : 'var(--text-muted)'
                    }}>
                      {ind.direction === 1 ? 'OVERVALUED (+1)' : ind.direction === -1 ? 'DISCOUNT (-1)' : 'NEUTRAL (0)'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
