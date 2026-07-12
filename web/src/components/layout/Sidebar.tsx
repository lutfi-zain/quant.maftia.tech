import React from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Layers, 
  Radio 
} from 'lucide-react';
import { useTerminal } from '../../context/TerminalContext';

export type ActiveTab = 'dashboard' | 'valuation' | 'lttd' | 'mttd' | 'ichimoku';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  wsStatus: 'Connected' | 'Reconnecting' | 'Disconnected';
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, wsStatus }) => {
  const { dailyData, syncGap } = useTerminal();

  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'valuation', label: 'Valuation Studio', icon: BarChart3 },
    { id: 'lttd', label: 'LTTD Lab (HMM)', icon: TrendingUp },
    { id: 'mttd', label: 'MTTD Console', icon: Activity },
    { id: 'ichimoku', label: 'Ichimoku Terminal', icon: Layers },
  ] as const;

  const getStatusColor = () => {
    switch (wsStatus) {
      case 'Connected': return 'var(--signal-bull)';
      case 'Reconnecting': return 'var(--signal-neutral)';
      default: return 'var(--signal-bear)';
    }
  };

  // Compute data range from loaded daily data
  const earliestDate = dailyData.length > 0 ? dailyData[0].date : null;
  const latestDate = dailyData.length > 0 ? dailyData[dailyData.length - 1].date : null;
  const totalDays = dailyData.length;

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      backgroundColor: 'var(--bg-card)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 50
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '30px',
          height: '30px',
          borderRadius: '4px',
          background: 'linear-gradient(135deg, #00f0ff, #0284c7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          fontWeight: 700,
          fontFamily: 'JetBrains Mono',
          fontSize: '14px',
          boxShadow: '0 0 16px rgba(0, 240, 255, 0.25)'
        }}>
          MQ
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', fontFamily: 'Geist, sans-serif' }}>
            MAFTIA <span style={{ color: 'var(--accent)' }}>QUANT</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
            v2.0 UNIFIED TERMINAL
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '8px', flex: 1 }}>
        <div style={{ 
          fontSize: '10px', 
          fontWeight: 600, 
          color: 'var(--text-dim)', 
          textTransform: 'uppercase', 
          letterSpacing: '1px',
          padding: '0 8px 6px'
        }}>
          Multi-Layer Defense
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(245,158,11,0.08)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    boxShadow: isActive ? 'inset 2px 0 0 var(--accent)' : 'none',
                    fontFamily: 'Geist, sans-serif'
                  }}
                >
                  <Icon size={16} style={{ color: isActive ? 'var(--accent)' : 'var(--text-dim)', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px' }}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Data Range Section */}
      {earliestDate && latestDate && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(0,0,0,0.15)'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
            Data Range
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div>{earliestDate} →</div>
            <div>{latestDate}</div>
            <div style={{ marginTop: '4px', color: syncGap.gapDays > 0 ? 'var(--status-warning)' : 'var(--signal-bull)', fontWeight: 600 }}>
              {totalDays.toLocaleString()} trading days
              {syncGap.gapDays > 0 && ` · ⚠ ${syncGap.gapDays}d gap`}
            </div>
          </div>
        </div>
      )}

      {/* Live Gateway Status Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Radio size={13} style={{ color: getStatusColor() }} />
            <span>API Gateway</span>
          </div>
          <span style={{
            fontSize: '10px',
            fontFamily: 'JetBrains Mono',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            color: getStatusColor()
          }}>
            {wsStatus}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
          <span>PORT :8765</span>
          <span>CausalFilter t−1</span>
        </div>
      </div>
    </aside>
  );
};
