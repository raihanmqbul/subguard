import {
  useEffect,
  useCallback,
  useState,
} from 'react';
import {
  MemoryRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import SubscriptionForm from './pages/SubscriptionForm';
import CancelHelper from './pages/CancelHelper';
import Settings from './pages/Settings';
import Upgrade from './pages/Upgrade';
import { ToastContainer } from './components/ToastContainer';
import { ToastProvider } from './context/ToastContext';
import { SearchOverlay } from './components/SearchOverlay';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { OnlineContext } from './context/OnlineContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useToastContext } from './context/ToastContext';
import { consumeStorageQuotaWarning } from '../shared/storage';
import { getSettings } from '../shared/storage';
import browser from '../shared/browser';

// ─── Theme applier ────────────────────────────────────────────────────────────

function applyTheme(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Apply theme on initial load and whenever storage changes
async function initTheme() {
  const settings = await getSettings();
  applyTheme(settings.theme);
}

void initTheme();

// Watch for theme changes from Settings page
browser.storage.local.onChanged.addListener((changes) => {
  const newSettings = changes.settings?.newValue as { theme?: 'light' | 'dark' } | undefined;
  if (newSettings?.theme) {
    applyTheme(newSettings.theme);
  }
});

// ─── Nav Icons ───────────────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 2v4M14 2v4M2 8h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUpgrade() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3l7 7H3l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 17h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 10v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/', icon: <IconDashboard />, label: 'Dashboard' },
  { to: '/calendar', icon: <IconCalendar />, label: 'Calendar' },
  { to: '/add', icon: <IconPlus />, label: 'Add Subscription' },
  { to: '/settings', icon: <IconSettings />, label: 'Settings' },
  { to: '/upgrade', icon: <IconUpgrade />, label: 'Upgrade' },
] as const;

function Sidebar() {
  return (
    <nav
      className="flex flex-col items-center gap-1 py-3 w-12 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      aria-label="Main navigation"
    >
      {/* Logo mark */}
      <div
        className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center mb-2 shrink-0"
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2L13 5V11L8 14L3 11V5L8 2Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 5.5L10.5 7V10L8 11.5L5.5 10V7L8 5.5Z" fill="white" fillOpacity="0.8" />
        </svg>
      </div>

      {NAV_ITEMS.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          aria-label={label}
          title={label}
          className={({ isActive }) =>
            `w-9 h-9 flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isActive
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
            }`
          }
        >
          {icon}
        </NavLink>
      ))}
    </nav>
  );
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

interface ShortcutHandlerProps {
  onOpenSearch: () => void;
  onCloseOverlays: () => void;
}

function KeyboardShortcutHandler({ onOpenSearch, onCloseOverlays }: ShortcutHandlerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        (e.target as HTMLElement).isContentEditable;

      // Cmd/Ctrl+K — open search overlay (Req 13.1, 13.5)
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // Escape — close any open modal/overlay (Req 13.4)
      if (e.key === 'Escape') {
        onCloseOverlays();
        return;
      }

      // N — open Add Subscription form when not in an input (Req 13.3)
      if (e.key === 'n' && !isEditable && !isMeta) {
        // Only navigate if not already on /add
        if (location.pathname !== '/add') {
          navigate('/add');
        }
      }
    },
    [navigate, location.pathname, onOpenSearch, onCloseOverlays]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return null;
}

// ─── Offline Banner ───────────────────────────────────────────────────────────

function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      You're offline. Email scanning and license validation are unavailable.
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { show } = useToastContext();
  const navigate = useNavigate();

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Handle pending navigation set by popup (e.g. "Add" button)
  useEffect(() => {
    import('../shared/browser').then(({ default: browser }) => {
      browser.storage.local.get('pendingNavigation').then((result) => {
        const pending = result.pendingNavigation as string | undefined;
        if (pending) {
          browser.storage.local.remove('pendingNavigation');
          navigate(pending);
        }
      }).catch(() => {});
    });
  }, [navigate]);

  // Check for storage quota warning set by the service worker (Req 16.8)
  useEffect(() => {
    consumeStorageQuotaWarning().then((warned) => {
      if (warned) {
        show('Storage is over 80% full. Consider exporting and deleting old data.', 'warning');
      }
    }).catch(() => { /* non-critical */ });
  }, [show]);

  return (
    <OnlineContext.Provider value={isOnline}>
      <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50">
        {/* Offline banner (Req 17.1, 17.3, 17.5) */}
        {!isOnline && <OfflineBanner />}

        <div className="flex flex-1 overflow-hidden">
          <KeyboardShortcutHandler
            onOpenSearch={openSearch}
            onCloseOverlays={closeSearch}
          />

          <Sidebar />

          <main className="flex-1 overflow-y-auto min-w-0" aria-label="Main content">
            <Routes>
              <Route path="/" element={<ErrorBoundary label="Dashboard"><Dashboard /></ErrorBoundary>} />
              <Route path="/calendar" element={<ErrorBoundary label="Calendar"><Calendar /></ErrorBoundary>} />
              <Route path="/add" element={<ErrorBoundary label="Add Subscription"><SubscriptionForm /></ErrorBoundary>} />
              <Route path="/edit/:id" element={<ErrorBoundary label="Edit Subscription"><SubscriptionForm /></ErrorBoundary>} />
              <Route path="/cancel/:id" element={<ErrorBoundary label="Cancel Helper"><CancelHelper /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary label="Settings"><Settings /></ErrorBoundary>} />
              <Route path="/upgrade" element={<ErrorBoundary label="Upgrade"><Upgrade /></ErrorBoundary>} />
            </Routes>
          </main>
        </div>

        {/* Toast container — ARIA live region (Req 22.7) */}
        <ToastContainer />

        {/* Search overlay (Req 13.1) */}
        {searchOpen && <SearchOverlay onClose={closeSearch} />}
      </div>
    </OnlineContext.Provider>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <MemoryRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </MemoryRouter>
  );
}
