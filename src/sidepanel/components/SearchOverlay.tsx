import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSubscriptions } from '../../shared/db';
import type { Subscription } from '../../shared/types';

interface SearchOverlayProps {
  onClose: () => void;
}

/** Case-insensitive match against service name, custom name, or notes (Req 13.2) */
function matchesQuery(sub: Subscription, query: string): boolean {
  const q = query.toLowerCase();
  return (
    sub.service.toLowerCase().includes(q) ||
    (sub.customName?.toLowerCase().includes(q) ?? false) ||
    (sub.notes?.toLowerCase().includes(q) ?? false)
  );
}

export function SearchOverlay({ onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [allSubs, setAllSubs] = useState<Subscription[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  // Load subscriptions once on mount
  useEffect(() => {
    getAllSubscriptions()
      .then(setAllSubs)
      .catch((err) => console.error('[SubGuard Search] Failed to load subscriptions:', err));
  }, []);

  // Focus input on open (Req 13.1)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = query.trim()
    ? allSubs.filter((s) => matchesQuery(s, query.trim()))
    : [];

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectResult = useCallback(
    (sub: Subscription) => {
      onClose();
      navigate(`/edit/${sub.id}`);
    },
    [navigate, onClose]
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      selectResult(results[activeIndex]);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-16 bg-black/40"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Search subscriptions"
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className="w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="text-gray-400 shrink-0"
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search subscriptions…"
            aria-label="Search subscriptions"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={
              results[activeIndex] ? `search-result-${results[activeIndex].id}` : undefined
            }
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center text-xs text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        {query.trim() && (
          <>
            {/* Live region announces result count to screen readers */}
            <p
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {results.length === 0
                ? 'No subscriptions found'
                : `${results.length} subscription${results.length !== 1 ? 's' : ''} found`}
            </p>
            <ul
              id="search-results"
              ref={listRef}
              role="listbox"
              aria-label="Search results"
              className="max-h-64 overflow-y-auto py-1"
            >
              {results.length === 0 ? (
                <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No subscriptions found
                </li>
              ) : (
                results.map((sub, i) => (
                  <li
                    key={sub.id}
                    id={`search-result-${sub.id}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => selectResult(sub)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                      i === activeIndex
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="font-medium truncate">
                      {sub.customName ?? sub.service}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 shrink-0 capitalize">
                      {sub.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </>
        )}

        {/* Empty state hint */}
        {!query.trim() && (
          <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">
            Type to search by name or notes
          </p>
        )}
      </div>
    </div>
  );
}
