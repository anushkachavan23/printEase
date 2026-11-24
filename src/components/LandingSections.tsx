import React, { useState } from 'react';
import { ArrowRight, Printer } from 'lucide-react';
import { CAMPUS_COUNTER } from '../shared/catalog';

interface HeroSectionProps {
  onStartOrder: () => void;
  onGoToTracker: () => void;
  activeSessionOrderCount: number;
  onViewSessionOrders: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onStartOrder,
  onGoToTracker,
  activeSessionOrderCount,
  onViewSessionOrders,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);

  return (
    <section id="top" className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 lg:pt-14 lg:pb-16">
        {activeSessionOrderCount > 0 && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="text-slate-700">
              You have{' '}
              <strong className="font-semibold text-slate-900 tabular-nums">
                {activeSessionOrderCount}
              </strong>{' '}
              active print {activeSessionOrderCount === 1 ? 'order' : 'orders'} in this session.
            </span>
            <button
              type="button"
              onClick={onViewSessionOrders}
              className="inline-flex items-center gap-1.5 font-medium text-blue-800 hover:text-blue-900 hover:underline underline-offset-4 whitespace-nowrap"
            >
              View pickup code &amp; live status
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-10">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-medium tracking-wide text-slate-500">
              {CAMPUS_COUNTER.name} · {CAMPUS_COUNTER.location}
            </p>
            <h1
              className="mt-3 font-display font-bold tracking-tight text-slate-900"
              style={{
                fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                lineHeight: 1.08,
                textWrap: 'balance',
              }}
            >
              Upload campus documents. Pick up when notified.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              Send your PDFs or images directly to the campus print counter, choose color,
              paper size, and double-sided options with instant Rupee pricing, pay via UPI
              QR or UPI ID, and get notified the moment your prints are ready—no counter
              queue.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onStartOrder}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-900 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
              >
                Upload &amp; Configure Prints
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onGoToTracker}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap"
              >
                Track Existing Order
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {!heroImgError ? (
                <img
                  src="/src/assets/images/hero_print_atelier_1795338415715.jpg"
                  alt="Campus print counter with neatly packaged student orders awaiting pickup"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="h-full w-full object-cover lg:h-full"
                />
              ) : (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-8 text-center">
                  <Printer className="h-10 w-10 text-slate-500" aria-hidden="true" />
                  <p className="mt-3 font-display text-base font-semibold text-slate-800">
                    {CAMPUS_COUNTER.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {CAMPUS_COUNTER.location}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full-width 4-column campus studio benchmark strip */}
        <div className="mt-10 grid grid-cols-2 gap-6 border-t border-slate-200 pt-8 md:grid-cols-4">
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              ₹2 B&amp;W · ₹10 Color
            </p>
            <p className="mt-1 text-sm text-slate-600">Per-page campus student rates</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              A4 · A3 · Letter
            </p>
            <p className="mt-1 text-sm text-slate-600">Calibrated paper &amp; 10% duplex off</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              UPI QR &amp; ID
            </p>
            <p className="mt-1 text-sm text-slate-600">Instant in-app checkout</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              Live Alerts
            </p>
            <p className="mt-1 text-sm text-slate-600">Notified when Ready for Pickup</p>
          </div>
        </div>
      </div>
    </section>
  );
};

interface HowItWorksSectionProps {
  onStartOrder: () => void;
}

export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ onStartOrder }) => {
  const [samplesError, setSamplesError] = useState(false);
  const [pickupError, setPickupError] = useState(false);

  const steps = [
    {
      num: '01.',
      title: 'Upload your documents',
      description:
        'Drag and drop lecture PDFs, lab manuals, or image posters into the Print Studio. Page counts are detected automatically and multiple files can be combined into one order.',
    },
    {
      num: '02.',
      title: 'Customize options & pay via UPI',
      description:
        'Choose black-and-white or full color, single or double-sided layout, paper size (A4, A3, or Letter), and copy quantity. See live pricing in Rupees (₹) and pay with UPI QR or UPI ID.',
    },
    {
      num: '03.',
      title: 'Get notified & pick up',
      description:
        'Receive your unique pickup code right away. Follow live press updates and receive a Ready-for-Pickup notification on your device as soon as your prints are ready at the counter.',
    },
  ];

  return (
    <section id="how-it-works" className="border-b border-slate-200 bg-slate-50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium tracking-wide text-slate-500">
              How Campus Printing Works
            </p>
            <h2
              className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900"
              style={{ textWrap: 'balance' }}
            >
              Three steps from laptop file to campus pickup
            </h2>

            <div className="mt-8 divide-y divide-slate-200 border-t border-b border-slate-200">
              {steps.map((step) => (
                <div key={step.num} className="py-6">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-sm font-semibold text-blue-800 tabular-nums">
                      {step.num}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-slate-900">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7">
              <button
                type="button"
                onClick={onStartOrder}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-900 hover:underline underline-offset-4"
              >
                Open the Print Studio
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-6">
            <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] bg-slate-100">
                {!samplesError ? (
                  <img
                    src="/src/assets/images/print_paper_samples_1795338416886.jpg"
                    alt="Calibrated A4 and A3 paper stock and color proof sheets"
                    referrerPolicy="no-referrer"
                    onError={() => setSamplesError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
                    A4, A3 &amp; Letter archival paper stock
                  </div>
                )}
              </div>
              <figcaption className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
                A4, A3, and Letter stock: ₹2/pg B&amp;W, ₹10/pg color, 10% duplex off.
              </figcaption>
            </figure>

            <figure className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] bg-slate-100">
                {!pickupError ? (
                  <img
                    src="/src/assets/images/pickup_counter_orders_1795338416206.jpg"
                    alt="Numbered campus pickup cubbies with completed print packages"
                    referrerPolicy="no-referrer"
                    onError={() => setPickupError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
                    Numbered campus pickup shelves
                  </div>
                )}
              </div>
              <figcaption className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
                Completed prints are placed on the {CAMPUS_COUNTER.name} pickup shelf.
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
};
