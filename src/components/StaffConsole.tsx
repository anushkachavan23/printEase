import React, { useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  KeyRound,
  LogOut,
  Printer,
  RefreshCw,
} from 'lucide-react';
import {
  formatCurrency,
  ORDER_STATUS_FLOW,
  OrderStatus,
  PrintOrderRecord,
} from '../shared/catalog';

interface StaffConsoleProps {
  staffToken: string | null;
  onStaffAuth: (token: string) => void;
  onStaffLogout: () => void;
  onOrderUpdated: (order: PrintOrderRecord) => void;
}

export const StaffConsole: React.FC<StaffConsoleProps> = ({
  staffToken,
  onStaffAuth,
  onStaffLogout,
  onOrderUpdated,
}) => {
  const [staffStatus, setStaffStatus] = useState<{
    envConfigured: boolean;
    claimed: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [orders, setOrders] = useState<PrintOrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);
  const [staffNotice, setStaffNotice] = useState<string | null>(null);

  const loadStaffStatus = async () => {
    try {
      const res = await fetch('/api/staff/status');
      if (res.ok) {
        setStaffStatus((await res.json()) as { envConfigured: boolean; claimed: boolean });
      }
    } catch {
      // ignore
    }
  };

  const loadOrders = async (token: string) => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/staff/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        onStaffLogout();
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { orders: PrintOrderRecord[] };
        setOrders(data.orders || []);
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    void loadStaffStatus();
  }, []);

  useEffect(() => {
    if (!staffToken) return;
    void loadOrders(staffToken);

    const es = new EventSource(
      `/api/orders/stream/live?token=${encodeURIComponent(staffToken)}`
    );

    es.addEventListener('order:created', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          order: PrintOrderRecord;
        };
        if (parsed.order) {
          setOrders((prev) => {
            if (prev.some((o) => o.pickupCode === parsed.order.pickupCode)) {
              return prev;
            }
            return [parsed.order, ...prev];
          });
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener('order:updated', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          order: PrintOrderRecord;
        };
        if (parsed.order) {
          setOrders((prev) =>
            prev.map((o) =>
              o.pickupCode === parsed.order.pickupCode ? parsed.order : o
            )
          );
        }
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffToken]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);

    try {
      const isClaimFlow = staffStatus && !staffStatus.claimed;
      const endpoint = isClaimFlow ? '/api/staff/claim' : '/api/staff/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }

      setPasscode('');
      onStaffAuth(data.token);
      await loadStaffStatus();
    } catch {
      setAuthError('Network error signing into Staff Console.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateStatus = async (pickupCode: string, nextStatus: OrderStatus) => {
    if (!staffToken) return;
    setUpdatingCode(pickupCode);
    setStaffNotice(null);

    try {
      const res = await fetch(
        `/api/staff/orders/${encodeURIComponent(pickupCode)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffToken}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      const data = (await res.json()) as {
        order?: PrintOrderRecord;
        pushNotification?: unknown;
        error?: string;
      };
      if (!res.ok || !data.order) {
        setStaffNotice(data.error || 'Failed to update status.');
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.pickupCode === data.order!.pickupCode ? data.order! : o))
      );
      onOrderUpdated(data.order);

      if (nextStatus === 'Ready for Pickup') {
        setStaffNotice(
          `Order ${pickupCode} marked Ready for Pickup — push notification dispatched to student's device.`
        );
      } else {
        setStaffNotice(`Order ${pickupCode} updated to ${nextStatus}.`);
      }
    } finally {
      setUpdatingCode(null);
    }
  };

  if (!staffToken) {
    const needsFirstClaim = staffStatus && !staffStatus.claimed;
    return (
      <section className="min-h-[68vh] bg-slate-50 py-14">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2.5 text-slate-900">
              <KeyRound className="h-5 w-5 text-blue-800" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold">
                {needsFirstClaim ? 'Set Staff Console Passcode' : 'Campus Print Staff Sign In'}
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {needsFirstClaim
                ? 'No staff passcode has been configured yet. Choose a 6+ character operator passcode to claim and lock the Campus Staff Console.'
                : 'Enter the campus operator passcode to manage incoming print jobs and notify students when orders are Ready for Pickup.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="staff-passcode"
                  className="block text-xs font-medium text-slate-700"
                >
                  {needsFirstClaim ? 'Create Staff Passcode (min. 6 chars)' : 'Staff Passcode'}
                </label>
                <input
                  id="staff-passcode"
                  type="password"
                  required
                  minLength={6}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter operator passcode"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-800 focus:outline-none"
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
                  ? 'Verifying...'
                  : needsFirstClaim
                  ? 'Claim Staff Passcode & Open Queue'
                  : 'Open Staff Console'}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    return true;
  });

  return (
    <section className="min-h-[68vh] bg-slate-50 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-medium text-slate-500">Campus Print Operations</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
              Live Print Queue &amp; Status Console
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadOrders(staffToken)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh Queue
            </button>
            <button
              type="button"
              onClick={onStaffLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Lock Console
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-200/70 p-1">
            {['all', ...ORDER_STATUS_FLOW].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'all' ? 'All Orders' : status}
              </button>
            ))}
          </div>
        </div>

        {staffNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
            <BellRing className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>{staffNotice}</span>
          </div>
        )}

        {loadingOrders ? (
          <p className="mt-8 text-sm text-slate-500">Loading active print queue...</p>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center">
            <Printer className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-3 font-display text-base font-semibold text-slate-900">
              No matching print jobs in queue
            </p>
            <p className="mt-1 text-xs text-slate-500">
              New student orders submitted in the Print Studio appear here immediately.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.pickupCode}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                        {order.pickupCode}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {order.customerName}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          order.status === 'Ready for Pickup'
                            ? 'text-emerald-700'
                            : order.status === 'Completed'
                            ? 'text-slate-500'
                            : 'text-blue-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      UPI Paid ({order.paymentReference}) ·{' '}
                      <span className="font-mono tabular-nums">
                        {order.totalSheets} sheets · {formatCurrency(order.total)}
                      </span>
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                      {order.items.map((item) => (
                        <span key={item.id}>
                          {item.fileName} ({item.paperSize},{' '}
                          {item.colorMode === 'color' ? 'Color' : 'B&W'},{' '}
                          {item.sides === 'double' ? 'Duplex' : 'Single'}, {item.copies}×)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status Progression Controls */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ORDER_STATUS_FLOW.map((statusOption) => {
                      const active = order.status === statusOption;
                      return (
                        <button
                          key={statusOption}
                          type="button"
                          disabled={active || updatingCode === order.pickupCode}
                          onClick={() =>
                            void handleUpdateStatus(order.pickupCode, statusOption)
                          }
                          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                            active
                              ? 'border-blue-800 bg-blue-800 text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50'
                          }`}
                        >
                          {active && (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {statusOption}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
