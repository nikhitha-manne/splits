import { Link, useLocation } from 'react-router-dom';
import { theme } from '../ui/theme';

export function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/home', label: 'Home', icon: '🏠' },
    { path: '/groups', label: 'Groups', icon: '👥' },
    { path: '/add-expense', label: 'Add', icon: '➕' },
    { path: '/charts', label: 'Charts', icon: '📊' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  // Accent color for active state
  const accentColor = '#2563eb'; // blue-600

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t z-40"
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex justify-around items-center" style={{ height: '56px', minHeight: '56px' }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 h-full touch-manipulation"
              style={{
                minHeight: '44px',
                paddingTop: '6px',
                paddingBottom: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '22px',
                  lineHeight: '1',
                  marginBottom: '4px',
                  color: active ? accentColor : theme.colors.textSecondary,
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: active ? '500' : '400',
                  lineHeight: '1.2',
                  color: active ? '#374151' : theme.colors.textSecondary, // active label slightly darker gray-700, inactive muted
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
