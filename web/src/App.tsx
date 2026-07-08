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
  const { dailyData, circuitBreakers, wsStatus, isLoading, error } = useTerminal();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px' }}>INITIALIZING QUANTITATIVE TERMINAL...</div>
          <div style={{ fontSize: '12px' }}>Establishing CausalFilter $t-1$ & SQLite WAL Connection (:8765)</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--status-danger)', fontFamily: 'JetBrains Mono' }}>
        <div className="glass-card glow-danger" style={{ padding: '32px', maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>TELEMETRY SYNCHRONIZATION ERROR</div>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '16px' }}>{error}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ensure API Gateway is running on port :8765 (`http://0.0.0.0:8765`)</div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout wsStatus={wsStatus}>
      {(activeTab) => {
        switch (activeTab) {
          case 'dashboard':
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <BentoSummary 
                  latestPoint={dailyData[dailyData.length - 1]} 
                  circuitBreakers={circuitBreakers} 
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
