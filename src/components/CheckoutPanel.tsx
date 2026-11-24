import React, { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  MapPin,
  QrCode,
} from 'lucide-react';
import {
  calculateItemPricing,
  calculateOrderPricing,
  CAMPUS_COUNTER,
  formatCurrency,
  PaymentMethod,
  PrintOrderRecord,
  PublicUserAccount,
} from '../shared/catalog';
import { enableDeviceNotifications } from '../utils/notifications';
import { QueuedPrintFile } from './PrintStudio';
import { QrCodeMatrix } from './QrCodeMatrix';

interface CheckoutPanelProps {
  files: QueuedPrintFile[];
  authToken: string | null;
  currentUser: PublicUserAccount | null;
  confirmedOrder: PrintOrderRecord | null;
  onBackToStudio: () => void;
  onOrderCreated: (order: PrintOrderRecord) => void;
  onTrackOrder: (pickupCode: string) => void;
  onStartNewOrder: () => void;
}

export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({
  files,
  authToken,
  currentUser,
  confirmedOrder,
  onBackToStudio,
  onOrderCreated,
  onTrackOrder,
  onStartNewOrder,
}) => {
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'payment'>('details');
  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [transactionId, setTransactionId] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [enablePushOnSubmit, setEnablePushOnSubmit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const totals = calculateOrderPricing(files);
  const staticUpiQrPayload = `upi://pay?pa=${encodeURIComponent(
    CAMPUS_COUNTER.upiId
  )}&pn=${encodeURIComponent(CAMPUS_COUNTER.merchantName)}&cu=INR`;

  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (customerName.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 7) {
      setErrorMsg('Please enter a valid mobile number.');
      return;
    }
    setCheckoutStep('payment');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTxId = transactionId.trim();
    if (!/^[a-zA-Z0-9\-_]{6,40}$/.test(cleanTxId)) {
      setErrorMsg(
        'Please enter a valid UPI Transaction ID (6–40 letters or digits) to confirm payment.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          paymentMethod: 'upi_qr' as PaymentMethod,
          paymentReference: cleanTxId,
          items: files.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
            pages: f.pages,
            colorMode: f.colorMode,
            sides: f.sides,
            paperSize: f.paperSize,
            copies: f.copies,
          })),
        }),
      });

      const data = (await res.json()) as { order?: PrintOrderRecord; error?: string };
      if (!res.ok || !data.order) {
        setErrorMsg(data.error || 'Could not submit print order.');
        return;
      }

      if (enablePushOnSubmit) {
        const pushRes = await enableDeviceNotifications(
          authToken,
          data.order.pickupCode
        );
        setPushMessage(pushRes.message);
      }

      onOrderCreated(data.order);
    } catch {
      setErrorMsg('Network error submitting your order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Order Confirmed · Paid via UPI
                </span>
                <h2 className="mt-1.5 font-display text-2xl font-bold text-slate-900">
                  Queued at {confirmedOrder.counterName}
                </h2>
              </div>
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrency(confirmedOrder.total)}
              </span>
            </div>

            {/* Pickup Code & QR Visual */}
            <div className="mt-6 grid grid-cols-1 gap-6 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-7">
                <p className="text-xs font-medium text-slate-500">Unique Pickup Code</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="font-mono text-3xl font-bold tracking-wider text-slate-900 tabular-nums">
                    {confirmedOrder.pickupCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(confirmedOrder.pickupCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-slate-700">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
                    <span>
                      <strong className="font-semibold text-slate-900">
                        {confirmedOrder.counterName}
                      </strong>
                      <br />
                      {confirmedOrder.counterLocation}
                    </span>
                  </p>
                  <p className="pt-1 text-xs text-slate-600">
                    You will receive a notification as soon as staff updates your order to{' '}
                    <strong className="font-semibold text-slate-900">Ready for Pickup</strong>.
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    Payment Ref: {confirmedOrder.paymentReference}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center sm:col-span-5">
                <QrCodeMatrix value={confirmedOrder.pickupCode} size={140} />
                <p className="mt-2 text-xs text-slate-500">
                  Show QR pass at campus counter
                </p>
              </div>
            </div>

            {pushMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700">
                <Bell className="h-4 w-4 text-blue-800 shrink-0" aria-hidden="true" />
                <span>{pushMessage}</span>
              </div>
            )}

            {/* Itemized Receipt */}
            <div className="mt-6">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Printed Documents ({confirmedOrder.items.length})
              </h3>
              <ul className="mt-3 divide-y divide-slate-200 border-t border-b border-slate-200">
                {confirmedOrder.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{item.fileName}</p>
                      <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                        {item.colorMode === 'color' ? 'Full Color' : 'B&W'} ·{' '}
                        {item.sides === 'double' ? 'Double-Sided' : 'Single-Sided'} ·{' '}
                        {item.paperSize} · {item.pages} pg × {item.copies}{' '}
                        {item.copies === 1 ? 'copy' : 'copies'}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(item.lineSubtotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onStartNewOrder}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Print Another Order
              </button>
              <button
                type="button"
                onClick={() => onTrackOrder(confirmedOrder.pickupCode)}
                className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
              >
                Track Live Order Status
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <button
          type="button"
          onClick={onBackToStudio}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Print Studio
        </button>

        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Checkout &amp; UPI Payment
        </h2>

        <div className="mt-6 flex items-center gap-3 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setCheckoutStep('details');
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
              checkoutStep === 'details'
                ? 'border-blue-800 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="font-mono">01</span>
            <span>Contact Details</span>
          </button>
          <span aria-hidden="true" className="text-slate-300">
            /
          </span>
          <button
            type="button"
            onClick={() => {
              if (customerName.trim().length >= 2 && customerEmail.includes('@')) {
                setErrorMsg(null);
                setCheckoutStep('payment');
              }
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
              checkoutStep === 'payment'
                ? 'border-blue-800 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="font-mono">02</span>
            <span>Payment Method</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: Step 1 Contact Details or Step 2 Payment Method */}
          {checkoutStep === 'details' ? (
            <form
              onSubmit={handleContinueToPayment}
              className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7"
            >
              <h3 className="font-display text-base font-semibold text-slate-900">
                01. Student Contact for Ready Alert
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                We notify you as soon as your prints are ready at {CAMPUS_COUNTER.location}.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="checkout-name"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Full Name
                  </label>
                  <input
                    id="checkout-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Anushka Chavan"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="checkout-email"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Campus / Personal Email
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="student@campus.edu"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="checkout-phone"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Mobile Number
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="9876543210"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enablePushOnSubmit}
                    onChange={(e) => setEnablePushOnSubmit(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800"
                  />
                  <span className="text-xs text-slate-700">
                    <strong className="font-semibold text-slate-900">
                      Notify my device when prints are Ready for Pickup
                    </strong>
                    <br />
                    Receive an instant push alert as soon as staff marks your order ready.
                  </span>
                </label>
              </div>

              {errorMsg && (
                <p role="alert" className="mt-4 text-sm font-medium text-red-700">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={files.length === 0}
                className="mt-6 w-full rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-50"
              >
                Continue to Payment Method ({formatCurrency(totals.total)})
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-blue-800" aria-hidden="true" />
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    02. Payment Method — Static UPI QR
                  </h3>
                </div>
                <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  {formatCurrency(totals.total)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Scan the {CAMPUS_COUNTER.name} UPI QR code below using GPay, PhonePe, Paytm, or
                BHIM, pay <strong className="font-mono text-slate-800">{formatCurrency(totals.total)}</strong>, and enter your Transaction ID to confirm.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-12 sm:items-center">
                <div className="flex flex-col items-center justify-center sm:col-span-5">
                  <QrCodeMatrix value={staticUpiQrPayload} size={156} />
                  <span className="mt-2 font-mono text-[11px] font-medium text-slate-600">
                    {CAMPUS_COUNTER.merchantName}
                  </span>
                </div>

                <div className="space-y-4 sm:col-span-7">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Merchant UPI ID</p>
                    <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                      <span className="font-mono font-semibold text-slate-900">
                        {CAMPUS_COUNTER.upiId}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(CAMPUS_COUNTER.upiId);
                          setCopiedUpi(true);
                          setTimeout(() => setCopiedUpi(false), 1800);
                        }}
                        className="font-semibold text-blue-800 hover:underline whitespace-nowrap"
                      >
                        {copiedUpi ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-xs text-slate-500">Amount to Pay (Rupees)</p>
                    <p className="mt-0.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
                      {formatCurrency(totals.total)}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="upi-transaction-id"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      UPI Transaction ID / UTR Number
                    </label>
                    <input
                      id="upi-transaction-id"
                      type="text"
                      required
                      minLength={6}
                      maxLength={40}
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g. 432819045112"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Enter the 12-digit UTR or Transaction ID shown in your UPI app.
                    </p>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <p role="alert" className="mt-4 text-sm font-medium text-red-700">
                  {errorMsg}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setCheckoutStep('details');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit Contact Details
                </button>
                <button
                  type="submit"
                  disabled={submitting || files.length === 0}
                  className="flex-1 rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-50"
                >
                  {submitting
                    ? 'Verifying Payment...'
                    : `Confirm Payment (${formatCurrency(totals.total)}) & Get Pickup Code`}
                </button>
              </div>
            </form>
          )}

          {/* Right: Order Summary */}
          <aside className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 h-fit">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Order Summary
            </h3>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <p className="font-semibold text-slate-900">{CAMPUS_COUNTER.name}</p>
              <p className="mt-0.5 text-slate-600">{CAMPUS_COUNTER.location}</p>
              <p className="mt-1.5 text-slate-500">
                Notified immediately when ready for pickup
              </p>
            </div>

            <ul className="mt-4 divide-y divide-slate-200 border-t border-b border-slate-200">
              {files.map((item) => {
                const calc = calculateItemPricing(item);
                return (
                  <li key={item.id} className="flex justify-between gap-3 py-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{item.fileName}</p>
                      <p className="mt-0.5 text-slate-500 font-mono">
                        {item.colorMode === 'color' ? 'Color' : 'B&W'} ·{' '}
                        {item.sides === 'double' ? 'Double-sided' : 'Single-sided'} ·{' '}
                        {item.paperSize} · {item.pages} pg × {item.copies}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(calc.lineSubtotal)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal ({totals.totalSheets} sheets)</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(totals.subtotal)}</dd>
              </div>
              {totals.totalDuplexSavings > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs">
                  <dt>Double-sided paper savings</dt>
                  <dd className="font-mono tabular-nums">
                    −{formatCurrency(totals.totalDuplexSavings)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 font-display text-base font-bold text-slate-900">
                <dt>Total Payable</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(totals.total)}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
};
