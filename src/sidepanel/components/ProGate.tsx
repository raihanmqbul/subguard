import { useNavigate } from 'react-router-dom';
import { useProLicense } from '../hooks/useProLicense';

interface ProGateProps {
  /** Content to render when a Pro license is active */
  children: React.ReactNode;
  /**
   * Optional custom upgrade prompt. When omitted a default inline prompt
   * with a link to the Upgrade page is shown.
   */
  fallback?: React.ReactNode;
  /** Feature name shown in the default upgrade prompt */
  featureName?: string;
}

/**
 * Wraps Pro-gated UI sections.
 * - Renders `children` when a valid Pro license is detected.
 * - Renders `fallback` (or a default upgrade prompt) otherwise.
 * - Shows nothing while the license status is loading.
 */
export function ProGate({ children, fallback, featureName }: ProGateProps) {
  const { isPro, loading } = useProLicense();
  const navigate = useNavigate();

  if (loading) return null;

  if (isPro) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-5 text-center">
      <div
        className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center"
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-indigo-600 dark:text-indigo-400">
          <path
            d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 14.27l-4.77 2.44.91-5.32L2.27 7.62l5.34-.78L10 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          {featureName ? `${featureName} is a Pro feature` : 'Pro feature'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Upgrade to SubGuard Pro to unlock this and more.
        </p>
      </div>
      <button
        onClick={() => navigate('/upgrade')}
        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        View pricing
      </button>
    </div>
  );
}
