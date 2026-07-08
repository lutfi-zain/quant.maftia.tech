import React from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Layers, 
  ShieldAlert, 
  Radio 
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'valuation' | 'lttd' | 'mttd' | 'ichimoku';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  wsStatus: 'Connected' | 'Reconnecting' | 'Disconnected';
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, wsStatus }) => {
  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'valuation', label: 'Valuation Studio', icon: BarChart3 },
    { id: 'lttd', label: 'LTTD Lab (HMM)', icon: TrendingUp },
    { id: 'mttd', label: 'MTTD Console', icon: Activity },
    { id: 'ichimoku', label: 'Ichimoku Terminal', icon: Layers },
  ] as const;

  const getStatusColor = () => {
    switch (wsStatus) {
      case 'Connected':
        return '#10b981'; // green
      case 'Reconnecting':
        return '#f59e0b'; // amber
      default:
        return '#ff2a5f'; // red
    }
  };

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      backgroundColor: 'var(--bg-secondary)',
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
        padding: '24px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--accent-cyan), #0055ff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          fontWeight: 700,
          fontFamily: 'JetBrains Mono',
          fontSize: '18px',
          boxShadow: '0 0 16px var(--accent-cyan-glow)'
        }}>
          MQ
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.5px' }}>
            MAFTIA <span style={{ color: 'var(--accent-cyan)' }}>QUANT</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
            v2.0 TERMINAL
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ 
          fontSize: '11px', 
          fontWeight: 600, 
          color: 'var(--text-dim)', 
          textTransform: 'uppercase', 
          letterSpacing: '1px',
          padding: '0 12px 12px'
        }}>
          Multi-Layer Defense
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? 'var(--surface-card-hover)' : 'transparent',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    boxShadow: isActive ? 'inset 3px 0 0 var(--accent-cyan)' : 'none'
                  }}
                >
                  <Icon size={18} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-dim)' }} />
                  <span style={{ fontSize: '14px' }}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Live Gateway & System Status Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Radio size={14} style={{ color: getStatusColor() }} />
            <span>API Gateway</span>
          </div>
          <span style={{
            fontSize: '11px',
            fontFamily: 'JetBrains Mono',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: getStatusColor()
          }}>
            {wsStatus}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
          <span>PORT :8765</span>
          <span>CausalFilter $t-1$</span>
        </div>
      </div>
    </aside>
  );
};
