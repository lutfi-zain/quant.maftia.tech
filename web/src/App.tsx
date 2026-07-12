import React from 'react';
import { TerminalProvider, useTerminal } from './context/TerminalContext';
import { AppLayout } from './components/layout/AppLayout';
import { BentoSummary } from './components/dashboard/BentoSummary';
import { MultiPaneChart } from './components/charts/MultiPaneChart';
import { ValuationStudio } from './components/studios/ValuationStudio';
import { LttdLab } from './components/studios/LttdLab';
import { MttdConsole } from './components/studios/MttdConsole';
import { IchimokuTerminal } from './components/studios/IchimokuTerminal';

const TerminalContent: React.FC = () => {
  const { dailyData, circuitBreakers, wsStatus, isLoading, error, refreshData } = useTerminal();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-root)', color: 'var(--text-muted)', fontFamily: 'Geist Mono, JetBrains Mono, monospace', position: 'relative', overflow: 'hidden' }}>
        <div className="terminal-scanline" />
        <div className="glass-card" style={{ padding: '36px', maxWidth: '480px', width: '90%', border: '1px solid var(--border-panel)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', color: 'var(--text-dim)' }}>MAFTIA QUANT v2.0 · TELEMETRY BOOTSTRAP</span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', fontFamily: 'Geist, sans-serif' }}>
            INITIALIZING QUANTITATIVE DEFENSE...
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: 'var(--text-dim)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>CausalFilter $t-1$ Verification:</span>
              <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>STRICT CAUSAL LOCK</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>SQLite WAL Concurrency (:8765):</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>OPENING SOCKET...</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>MasterOHLCV & Indicator Engine:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>SYNCHRONIZING</span>
            </div>
          </div>
          <div style={{ width: '100%', height: '3px', backgroundColor: 'var(--bg-root)', borderRadius: '2px', overflow: 'hidden', marginTop: '22px' }}>
            <div style={{ width: '45%', height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-root)', color: 'var(--status-danger)', fontFamily: 'Geist Mono, JetBrains Mono, monospace', position: 'relative', overflow: 'hidden' }}>
        <div className="terminal-scanline" />
        <div className="glass-card glow-danger" style={{ padding: '36px', maxWidth: '520px', width: '90%', border: '1px solid rgba(239, 68, 68, 0.4)', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <span style={{ fontSize: '14px', fontWeight: 800 }}>⚠ TERMINAL CONNECTION EXCEPTION</span>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '18px', lineHeight: '1.6', fontFamily: 'Geist, sans-serif' }}>
            {error}
          </div>
          <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.5' }}>
            Ensure the Unified API Gateway (`src/api/index.ts`) is running on port `:8765` (`http://0.0.0.0:8765`) and SQLite WAL file locks are released.
          </div>
          <button
            onClick={refreshData}
            className="tactile-btn tactile-btn-primary"
            style={{ width: '100%' }}
          >
            <span>RETRY GATEWAY CONNECTION</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout wsStatus={wsStatus}>
      {(activeTab, onSelectStudio) => {
        switch (activeTab) {
          case 'dashboard':
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <BentoSummary 
                  latestPoint={dailyData[dailyData.length - 1]} 
                  circuitBreakers={circuitBreakers} 
                  onSelectStudio={onSelectStudio as any}
                />
                <MultiPaneChart data={dailyData} />
              </div>
            );
          case 'valuation':
            return <ValuationStudio />;
          case 'lttd':
            return <LttdLab />;
          case 'mttd':
            return <MttdConsole />;
          case 'ichimoku':
            return <IchimokuTerminal />;
          default:
            return null;
        }
      }}
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <TerminalProvider>
      <TerminalContent />
    </TerminalProvider>
  );
};

export default App;
