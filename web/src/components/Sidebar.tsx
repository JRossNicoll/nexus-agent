'use client';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogoClick?: () => void;
}

const navItems = [
  { id: 'chat', label: 'Chat', svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  { id: 'memory', label: 'Memory', svg: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' },
  { id: 'skills', label: 'Skills', svg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { id: 'activity', label: 'Activity', svg: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
];

const settingsItem = {
  id: 'settings', label: 'Settings',
  svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

function NavIcon({ svgPath, size = 15 }: { svgPath: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      dangerouslySetInnerHTML={{ __html: svgPath }} />
  );
}

export default function Sidebar({ activeTab, onTabChange, onLogoClick }: SidebarProps) {
  return (
    <aside style={{
      width: 56,
      background: 'var(--bg-base)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '18px 0 16px',
      gap: 4,
      flexShrink: 0,
    }}>
      {/* Logo — links back to landing page */}
      <div
        style={{ marginBottom: 12, cursor: 'pointer' }}
        onClick={onLogoClick || (() => onTabChange('home'))}
        title="Back to NEXUS home"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 22h20L12 2z" fill="#ff3333" />
          <path d="M12 9l-3 6h6l-3-6z" fill="#0a0a0a" />
        </svg>
      </div>

      {/* Main nav */}
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            title={item.label}
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--r-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive ? 'var(--accent)' : 'var(--text-3)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              position: 'relative',
              border: isActive ? '1px solid rgba(255,51,51,0.15)' : '1px solid transparent',
              background: isActive ? 'var(--accent-low)' : 'transparent',
              padding: 0,
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute',
                left: -1,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 2,
                height: 16,
                background: 'var(--accent)',
                borderRadius: '0 2px 2px 0',
              }} />
            )}
            <NavIcon svgPath={item.svg} />
          </button>
        );
      })}

      {/* Separator */}
      <div style={{
        width: 22,
        height: 1,
        background: 'var(--border)',
        margin: '6px 0',
      }} />

      {/* Settings */}
      <button
        onClick={() => onTabChange('settings')}
        title={settingsItem.label}
        style={{
          width: 38,
          height: 38,
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: activeTab === 'settings' ? 'var(--accent)' : 'var(--text-3)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          position: 'relative',
          border: activeTab === 'settings' ? '1px solid rgba(255,51,51,0.15)' : '1px solid transparent',
          background: activeTab === 'settings' ? 'var(--accent-low)' : 'transparent',
          padding: 0,
        }}
      >
        {activeTab === 'settings' && (
          <span style={{
            position: 'absolute',
            left: -1,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 2,
            height: 16,
            background: 'var(--accent)',
            borderRadius: '0 2px 2px 0',
          }} />
        )}
        <NavIcon svgPath={settingsItem.svg} />
      </button>

      {/* Spacer + Avatar */}
      <div style={{ flex: 1 }} />
      <div style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text-2)',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
      }}>
        R
      </div>
    </aside>
  );
}
