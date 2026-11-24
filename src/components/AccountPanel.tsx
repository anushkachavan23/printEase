import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, LogOut, RotateCcw, Sliders, User } from 'lucide-react';
import {
  ColorMode,
  formatCurrency,
  PaperSize,
  PrintOrderRecord,
  PrintSettings,
  PublicUserAccount,
  SidesMode,
} from '../shared/catalog';
import { enableDeviceNotifications } from '../utils/notifications';

interface AccountPanelProps {
  authToken: string | null;
  currentUser: PublicUserAccount | null;
  onAuthSuccess: (token: string, user: PublicUserAccount) => void;
  onUserUpdated: (user: PublicUserAccount) => void;
  onLogout: () => void;
  onTrackOrder: (pickupCode: string) => void;
  onReprintOrder: (order: PrintOrderRecord) => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  authToken,
  currentUser,
  onAuthSuccess,
  onUserUpdated,
  onLogout,
  onTrackOrder,
  onReprintOrder,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [prefs, setPrefs] = useState<PrintSettings>(
    currentUser?.defaultSettings || {
      colorMode: 'bw',
      sides: 'double',
      paperSize: 'A4',
      copies: 1,
    }
  );
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<PrintOrderRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setPrefs(currentUser.defaultSettings);
      setProfilePhone(currentUser.phone);
    }
  }, [currentUser]);

  const fetchOrderHistory = async (token: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/account/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { orders: PrintOrderRecord[] };
        setOrderHistory(data.orders || []);
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      void fetchOrderHistory(authToken);
    } else {
      setOrderHistory([]);
    }
  }, [authToken]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);

    try {
      const endpoint =
        authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        authMode === 'register'
          ? { name, email, phone, password }
          : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        token?: string;
        user?: PublicUserAccount;
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }

      onAuthSuccess(data.token, data.user);
      setPassword('');
    } catch {
      setAuthError('Network error during authentication.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setSavingPrefs(true);
    setPrefsMessage(null);

    try {
      const res = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          defaultSettings: prefs,
          phone: profilePhone,
        }),
      });
      const data = (await res.json()) as { user?: PublicUserAccount; error?: string };
      if (!res.ok || !data.user) {
        setPrefsMessage(data.error || 'Could not save preferences.');
        return;
      }
      onUserUpdated(data.user);
      setPrefsMessage('Default print settings saved.');
    } catch {
      setPrefsMessage('Network error saving preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleEnableDeviceAlerts = async () => {
    const res = await enableDeviceNotifications(authToken);
    if (authToken) {
      const prefRes = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ deviceNotificationsEnabled: true }),
      });
      if (prefRes.ok) {
        const data = (await prefRes.json()) as { user: PublicUserAccount };
        onUserUpdated(data.user);
      }
    }
    setPrefsMessage(res.message);
  };

  if (!currentUser || !authToken) {
    return (
      <section className="min-h-[68vh] bg-slate-50 py-14">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2.5 text-slate-900">
              <User className="h-5 w-5 text-blue-800" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold">
                {authMode === 'login' ? 'Sign in to printEase' : 'Create Campus Account'}
              </h2>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Save your default print settings and view your campus print order history.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError(null);
                }}
                className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                  authMode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError(null);
                }}
                className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                  authMode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
              {authMode === 'register' && (
                <div>
                  <label htmlFor="acc-name" className="block text-xs font-medium text-slate-700">
                    Full Name
                  </label>
                  <input
                    id="acc-name"
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Anushka Chavan"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label htmlFor="acc-email" className="block text-xs font-medium text-slate-700">
                  Email Address
                </label>
                <input
                  id="acc-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@campus.edu"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <label htmlFor="acc-phone" className="block text-xs font-medium text-slate-700">
                    Mobile Number (for ready alerts)
                  </label>
                  <input
                    id="acc-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="acc-password"
                  className="block text-xs font-medium text-slate-700"
                >
                  Password {authMode === 'register' ? '(min. 8 characters)' : ''}
                </label>
                <input
                  id="acc-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                />
              </div>

              {authError && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
              >
                {authBusy
                  ? 'Submitting...'
                  : authMode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[68vh] bg-slate-50 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-medium text-slate-500">Campus Student Account</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
              {currentUser.name}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">{currentUser.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign Out
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Saved Print Defaults */}
          <form
            onSubmit={handleSavePreferences}
            className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 h-fit"
          >
            <div className="flex items-center gap-2 text-slate-900">
              <Sliders className="h-4 w-4 text-blue-800" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold">
                Saved Default Print Settings
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Applied automatically whenever you upload documents in the Print Studio.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700">
                  Default Color Mode
                </span>
                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  {(['bw', 'color'] as ColorMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, colorMode: mode }))}
                      className={`rounded-md py-1.5 text-xs font-medium ${
                        prefs.colorMode === mode
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {mode === 'bw' ? 'B&W (₹2/pg)' : 'Color (₹10/pg)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700">
                  Default Sidedness
                </span>
                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  {(['single', 'double'] as SidesMode[]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, sides: side }))}
                      className={`rounded-md py-1.5 text-xs font-medium ${
                        prefs.sides === side
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {side === 'single' ? 'Single-Sided' : 'Double-Sided'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-medium text-slate-700">
                    Default Paper Size
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                    {(['A4', 'A3', 'Letter'] as PaperSize[]).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPrefs((p) => ({ ...p, paperSize: sz }))}
                        className={`rounded-md py-1.5 text-xs font-medium ${
                          prefs.paperSize === sz
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="pref-copies"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Default Copies
                  </label>
                  <input
                    id="pref-copies"
                    type="number"
                    min={1}
                    max={500}
                    value={prefs.copies}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        copies: Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)),
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums focus:border-blue-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pref-phone"
                  className="block text-xs font-medium text-slate-700"
                >
                  Mobile Number
                </label>
                <input
                  id="pref-phone"
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="9876543210"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleEnableDeviceAlerts}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <span className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-800" aria-hidden="true" />
                  Device Push Notifications
                </span>
                <span
                  className={
                    currentUser.deviceNotificationsEnabled
                      ? 'text-emerald-700 font-semibold'
                      : 'text-blue-800 font-semibold'
                  }
                >
                  {currentUser.deviceNotificationsEnabled ? 'Registered' : 'Enable'}
                </span>
              </button>
            </div>

            {prefsMessage && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {prefsMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPrefs}
              className="mt-5 w-full rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
            >
              {savingPrefs ? 'Saving...' : 'Save Default Settings'}
            </button>
          </form>

          {/* Order History */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Order History
              </h3>
              <button
                type="button"
                onClick={() => void fetchOrderHistory(authToken)}
                className="text-xs font-medium text-blue-800 hover:underline underline-offset-4"
              >
                Refresh
              </button>
            </div>

            {loadingHistory ? (
              <p className="mt-6 text-sm text-slate-500">Loading your order history...</p>
            ) : orderHistory.length === 0 ? (
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  You have not placed any print orders yet.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Orders placed while signed in appear here with pickup codes and live status.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
                {orderHistory.map((order) => (
                  <div
                    key={order.pickupCode}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {order.pickupCode}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            order.status === 'Ready for Pickup'
                              ? 'text-emerald-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {order.items.length}{' '}
                        {order.items.length === 1 ? 'file' : 'files'} ·{' '}
                        {order.items.map((item) => item.fileName).join(', ')}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        UPI {order.paymentReference} ·{' '}
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="mr-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(order.total)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onReprintOrder(order)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-900 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Re-print
                      </button>
                      <button
                        type="button"
                        onClick={() => onTrackOrder(order.pickupCode)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        Track / Code
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
