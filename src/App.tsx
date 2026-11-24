import React, { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { AccountPanel } from './components/AccountPanel';
import { CheckoutPanel } from './components/CheckoutPanel';
import { Footer } from './components/Footer';
import { HeroSection, HowItWorksSection } from './components/LandingSections';
import { AppSection, Navbar } from './components/Navbar';
import { OrderTracker } from './components/OrderTracker';
import { PrintStudio, QueuedPrintFile } from './components/PrintStudio';
import { StaffConsole } from './components/StaffConsole';
import {
  PrintOrderRecord,
  PublicUserAccount,
  ReadyPushNotification,
} from './shared/catalog';
import {
  registerNotificationServiceWorker,
  triggerBrowserReadyNotification,
} from './utils/notifications';

const SESSION_ORDERS_KEY = 'printease_session_orders_v1';

function readSessionOrders(): PrintOrderRecord[] {
  try {
    const raw = sessionStorage.getItem(SESSION_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrintOrderRecord[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('studio');
  const [checkoutMode, setCheckoutMode] = useState(false);

  const [files, setFiles] = useState<QueuedPrintFile[]>([]);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<PublicUserAccount | null>(null);
  const [staffToken, setStaffToken] = useState<string | null>(null);

  const [sessionOrders, setSessionOrders] = useState<PrintOrderRecord[]>(readSessionOrders);
  const [confirmedOrder, setConfirmedOrder] = useState<PrintOrderRecord | null>(null);
  const [trackerCode, setTrackerCode] = useState<string>('');
  const [readyAlert, setReadyAlert] = useState<ReadyPushNotification | null>(null);

  useEffect(() => {
    void registerNotificationServiceWorker();
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_ORDERS_KEY, JSON.stringify(sessionOrders));
    } catch {
      // ignore
    }
  }, [sessionOrders]);

  const upsertSessionOrder = (order: PrintOrderRecord) => {
    setSessionOrders((prev) => {
      const exists = prev.some((o) => o.pickupCode === order.pickupCode);
      if (exists) {
        return prev.map((o) => (o.pickupCode === order.pickupCode ? order : o));
      }
      return [order, ...prev];
    });
  };

  const latestSessionCode = sessionOrders[0]?.pickupCode || '';
  useEffect(() => {
    if (!authToken && !latestSessionCode) return;

    const params = new URLSearchParams();
    if (authToken) {
      params.set('token', authToken);
    } else if (latestSessionCode) {
      params.set('code', latestSessionCode);
    }

    const es = new EventSource(`/api/orders/stream/live?${params.toString()}`);

    es.addEventListener('order:updated', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          order: PrintOrderRecord;
        };
        if (parsed.order) {
          upsertSessionOrder(parsed.order);
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener('order:ready', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          notification: ReadyPushNotification;
        };
        if (parsed.notification) {
          setReadyAlert(parsed.notification);
          void triggerBrowserReadyNotification(parsed.notification);
        }
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
    };
  }, [authToken, latestSessionCode]);

  const handleNavigate = (section: AppSection, anchorId?: string) => {
    setActiveSection(section);
    if (section === 'studio') {
      setCheckoutMode(false);
      setConfirmedOrder(null);
      if (anchorId) {
        requestAnimationFrame(() => {
          const el = document.getElementById(anchorId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTrackOrder = (pickupCode: string) => {
    setTrackerCode(pickupCode);
    setActiveSection('tracker');
    setCheckoutMode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (token: string, user: PublicUserAccount) => {
    setAuthToken(token);
    setCurrentUser(user);
  };

  const handleUserUpdated = (user: PublicUserAccount) => {
    setCurrentUser(user);
  };

  const handleOrderCreated = (order: PrintOrderRecord) => {
    setConfirmedOrder(order);
    upsertSessionOrder(order);
  };

  const handleStartNewOrder = () => {
    for (const f of files) {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    }
    setFiles([]);
    setConfirmedOrder(null);
    setCheckoutMode(false);
    setActiveSection('studio');
    requestAnimationFrame(() => {
      document
        .getElementById('print-studio')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleReprintOrder = (order: PrintOrderRecord) => {
    for (const f of files) {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    }
    const requeued: QueuedPrintFile[] = order.items.map((item, index) => ({
      id: `${Date.now()}-reprint-${index}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      pages: item.pages,
      colorMode: item.colorMode,
      sides: item.sides,
      paperSize: item.paperSize,
      copies: item.copies,
      previewUrl: null,
    }));
    setFiles(requeued);
    setConfirmedOrder(null);
    setCheckoutMode(false);
    setActiveSection('studio');
    requestAnimationFrame(() => {
      document
        .getElementById('print-studio')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        userSignedIn={Boolean(authToken && currentUser)}
        userName={currentUser?.name}
      />

      {readyAlert && (
        <div
          role="status"
          className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BellRing className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-mono font-bold">{readyAlert.pickupCode}</strong> is{' '}
                <strong>Ready for Pickup</strong> at {readyAlert.counterName} (
                {readyAlert.counterLocation})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleTrackOrder(readyAlert.pickupCode);
                  setReadyAlert(null);
                }}
                className="rounded-md bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900 whitespace-nowrap"
              >
                View Pickup Pass
              </button>
              <button
                type="button"
                onClick={() => setReadyAlert(null)}
                aria-label="Dismiss pickup notification"
                className="rounded p-1 text-emerald-800 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeSection === 'studio' && !checkoutMode && (
          <>
            <HeroSection
              onStartOrder={() => handleNavigate('studio', 'print-studio')}
              onGoToTracker={() => handleNavigate('tracker')}
              activeSessionOrderCount={sessionOrders.length}
              onViewSessionOrders={() => {
                if (sessionOrders[0]) {
                  handleTrackOrder(sessionOrders[0].pickupCode);
                } else {
                  handleNavigate('tracker');
                }
              }}
            />
            <HowItWorksSection
              onStartOrder={() => handleNavigate('studio', 'print-studio')}
            />
            <PrintStudio
              files={files}
              onFilesChange={setFiles}
              savedDefaults={currentUser?.defaultSettings || null}
              onProceedToCheckout={() => {
                setConfirmedOrder(null);
                setCheckoutMode(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              isSignedIn={Boolean(authToken && currentUser)}
              onOpenAccount={() => handleNavigate('account')}
            />
          </>
        )}

        {activeSection === 'studio' && checkoutMode && (
          <CheckoutPanel
            files={files}
            authToken={authToken}
            currentUser={currentUser}
            confirmedOrder={confirmedOrder}
            onBackToStudio={() => setCheckoutMode(false)}
            onOrderCreated={handleOrderCreated}
            onTrackOrder={handleTrackOrder}
            onStartNewOrder={handleStartNewOrder}
          />
        )}

        {activeSection === 'tracker' && (
          <OrderTracker
            initialPickupCode={trackerCode}
            sessionOrders={sessionOrders}
            authToken={authToken}
            onOrderUpdated={upsertSessionOrder}
          />
        )}

        {activeSection === 'account' && (
          <AccountPanel
            authToken={authToken}
            currentUser={currentUser}
            onAuthSuccess={handleAuthSuccess}
            onUserUpdated={handleUserUpdated}
            onLogout={() => {
              setAuthToken(null);
              setCurrentUser(null);
            }}
            onTrackOrder={handleTrackOrder}
            onReprintOrder={handleReprintOrder}
          />
        )}

        {activeSection === 'staff' && (
          <StaffConsole
            staffToken={staffToken}
            onStaffAuth={(token) => setStaffToken(token)}
            onStaffLogout={() => setStaffToken(null)}
            onOrderUpdated={upsertSessionOrder}
          />
        )}
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
