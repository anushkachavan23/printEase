import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  Printer,
  Search,
} from 'lucide-react';
import {
  formatCurrency,
  ORDER_STATUS_FLOW,
  OrderStatus,
  PrintOrderRecord,
} from '../shared/catalog';
import { enableDeviceNotifications } from '../utils/notifications';
import { QrCodeMatrix } from './QrCodeMatrix';

interface OrderTrackerProps {
  initialPickupCode: string;
  sessionOrders: PrintOrderRecord[];
  authToken: string | null;
  onOrderUpdated: (order: PrintOrderRecord) => void;
}

export const OrderTracker: React.FC<OrderTrackerProps> = ({
  initialPickupCode,
  sessionOrders,
  authToken,
  onOrderUpdated,
}) => {
  const [codeInput, setCodeInput] = useState(
    initialPickupCode || sessionOrders[0]?.pickupCode || ''
  );
  const [trackedOrder, setTrackedOrder] = useState<PrintOrderRecord | null>(
    sessionOrders.find((o) => o.pickupCode === initialPickupCode) ||
      sessionOrders[0] ||
      null
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);

  const lookupCode = async (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/orders/${encodeURIComponent(clean)}`, {
        headers,
      });
      const data = (await res.json()) as { order?: PrintOrderRecord; error?: string };
      if (!res.ok || !data.order) {
        setTrackedOrder(null);
        setErrorMsg(data.error || 'Order not found.');
        return;
      }
      setTrackedOrder(data.order);
      onOrderUpdated(data.order);
    } catch {
      setErrorMsg('Could not look up that pickup code right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPickupCode) {
      setCodeInput(initialPickupCode);
      void lookupCode(initialPickupCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPickupCode]);

  useEffect(() => {
    if (!trackedOrder?.pickupCode) {
      setStreamConnected(false);
      return;
    }

    const params = new URLSearchParams();
    params.set('code', trackedOrder.pickupCode);
    if (authToken) {
      params.set('token', authToken);
    }

    const es = new EventSource(`/api/orders/stream/live?${params.toString()}`);

    es.addEventListener('connected', () => {
      setStreamConnected(true);
    });

    es.addEventListener('order:updated', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          order: PrintOrderRecord;
        };
        if (parsed.order && parsed.order.pickupCode === trackedOrder.pickupCode) {
          setTrackedOrder(parsed.order);
          onOrderUpdated(parsed.order);
        }
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      es.close();
      setStreamConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedOrder?.pickupCode, authToken]);

  const handleEnableNotifs = async () => {
    const res = await enableDeviceNotifications(authToken, trackedOrder?.pickupCode);
    setNotifStatus(res.message);
  };

  const statusStepIndex = trackedOrder
    ? ORDER_STATUS_FLOW.indexOf(trackedOrder.status)
    : -1;

  const stageIcons: Record<OrderStatus, React.ReactNode> = {
    Received: <Clock className="h-4 w-4" aria-hidden="true" />,
    Printing: <Printer className="h-4 w-4" aria-hidden="true" />,
    'Ready for Pickup': <PackageCheck className="h-4 w-4" aria-hidden="true" />,
    Completed: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  };

  return (
    <section id="track-order" className="min-h-[68vh] bg-slate-50 py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500">
              Live Order Tracker
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Track your campus print order
            </h2>
          </div>

          <button
            type="button"
            onClick={handleEnableNotifs}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Bell className="h-3.5 w-3.5 text-blue-800" aria-hidden="true" />
            Enable Ready-for-Pickup Alerts
          </button>
        </div>

        {notifStatus && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-700">
            {notifStatus}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookupCode(codeInput);
          }}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter pickup code (e.g., PRL-4821)"
              aria-label="Enter pickup code"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-4 pl-10 font-mono text-sm text-slate-900 uppercase focus:border-blue-800 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !codeInput.trim()}
            className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Looking up...' : 'Track Order'}
          </button>
        </form>

        {sessionOrders.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-500">Your session orders:</span>
            {sessionOrders.map((o) => (
              <button
                key={o.pickupCode}
                type="button"
                onClick={() => {
                  setCodeInput(o.pickupCode);
                  void lookupCode(o.pickupCode);
                }}
                className={`rounded-md border px-2.5 py-1.5 font-mono font-medium transition-colors ${
                  trackedOrder?.pickupCode === o.pickupCode
                    ? 'border-blue-800 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {o.pickupCode} · {o.status}
              </button>
            ))}
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {trackedOrder ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {trackedOrder.pickupCode}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      trackedOrder.status === 'Ready for Pickup'
                        ? 'text-emerald-700'
                        : trackedOrder.status === 'Completed'
                        ? 'text-slate-700'
                        : 'text-blue-800'
                    }`}
                  >
                    {stageIcons[trackedOrder.status]}
                    {trackedOrder.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 font-mono">
                  {streamConnected
                    ? 'Live updates connected · Notifies automatically when Ready for Pickup'
                    : 'Synced with Print Shop SSPU'}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-500">UPI Payment</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-700 tabular-nums">
                  {trackedOrder.paymentStatus} · {formatCurrency(trackedOrder.total)}
                </p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ORDER_STATUS_FLOW.map((stage, idx) => {
                const reached = idx <= statusStepIndex;
                const isCurrent = idx === statusStepIndex;

                return (
                  <div
                    key={stage}
                    className={`rounded-lg border p-3.5 transition-colors ${
                      isCurrent
                        ? 'border-blue-800 bg-blue-50/50'
                        : reached
                        ? 'border-slate-300 bg-slate-50'
                        : 'border-slate-200 bg-white opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-slate-500">
                        0{idx + 1}
                      </span>
                      <span className={reached ? 'text-blue-800' : 'text-slate-400'}>
                        {stageIcons[stage]}
                      </span>
                    </div>
                    <p className="mt-2 font-display text-sm font-semibold text-slate-900">
                      {stage}
                    </p>
                  </div>
                );
              })}
            </div>

            {trackedOrder.status === 'Ready for Pickup' && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950">
                <p className="font-display font-semibold">
                  Your prints are ready at {trackedOrder.counterName}
                </p>
                <p className="mt-1 text-xs text-emerald-900">
                  Head to {trackedOrder.counterLocation} and present pickup code{' '}
                  <strong className="font-mono">{trackedOrder.pickupCode}</strong>.
                </p>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="md:col-span-7 space-y-6">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Campus Pickup Counter
                  </h3>
                  <div className="mt-2.5 flex items-start gap-2.5 text-sm text-slate-700">
                    <MapPin className="mt-0.5 h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-slate-900">{trackedOrder.counterName}</p>
                      <p className="text-xs text-slate-600">{trackedOrder.counterLocation}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        UPI Ref: {trackedOrder.paymentReference}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Status Timeline
                  </h3>
                  <ol className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    {trackedOrder.statusHistory.map((ev, index) => (
                      <li
                        key={`${ev.status}-${index}`}
                        className="flex items-start justify-between gap-4 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{ev.status}</span>
                          <p className="mt-0.5 text-slate-600">{ev.note}</p>
                        </div>
                        <time className="font-mono text-slate-500 tabular-nums shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Order Items ({trackedOrder.items.length})
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-200 border-t border-b border-slate-200 text-xs">
                    {trackedOrder.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3 py-2.5">
                        <span className="truncate font-medium text-slate-800">
                          {item.fileName} ({item.paperSize},{' '}
                          {item.colorMode === 'color' ? 'Color' : 'B&W'}, {item.copies}×)
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(item.lineSubtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                    Total Paid: {formatCurrency(trackedOrder.total)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-start rounded-xl border border-slate-200 bg-slate-50 p-5 md:col-span-5 h-fit">
                <p className="text-xs font-medium text-slate-500">Express Pickup Pass</p>
                <div className="mt-3">
                  <QrCodeMatrix value={trackedOrder.pickupCode} size={144} />
                </div>
                <p className="mt-3 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {trackedOrder.pickupCode}
                </p>
                <p className="mt-1 text-center text-xs text-slate-500">
                  Show this code at {trackedOrder.counterLocation}
                </p>
              </div>
            </div>
          </div>
        ) : (
          !errorMsg && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center">
              <p className="font-display text-base font-semibold text-slate-900">
                Enter your pickup code above to track live print status
              </p>
              <p className="mt-1.5 text-sm text-slate-500">
                Your order updates live as campus staff prints your files and notifies you
                when Ready for Pickup.
              </p>
            </div>
          )
        )}
      </div>
    </section>
  );
};
