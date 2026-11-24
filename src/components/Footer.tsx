import React from 'react';
import { Printer } from 'lucide-react';
import { CAMPUS_COUNTER } from '../shared/catalog';
import { AppSection } from './Navbar';

interface FooterProps {
  onNavigate: (section: AppSection, anchorId?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Printer className="h-4 w-4 text-blue-800" aria-hidden="true" />
              <span className="font-display">printEase</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              Campus express document printing and pickup. Upload files, configure print
              options in Rupees, pay via UPI, and collect when notified.
            </p>
          </div>

          <div className="md:col-span-3">
            <h4 className="font-display text-xs font-semibold text-slate-900">Quick Links</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('studio', 'how-it-works')}
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('studio', 'print-studio')}
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Print Studio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('tracker')}
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Track Order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('account')}
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Account &amp; Defaults
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('staff')}
                  className="hover:text-slate-900 hover:underline underline-offset-4"
                >
                  Campus Staff Console
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="font-display text-xs font-semibold text-slate-900">
              Campus Counter &amp; Contact
            </h4>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>{CAMPUS_COUNTER.name}</p>
              <p>{CAMPUS_COUNTER.location}</p>
              <p>{CAMPUS_COUNTER.hoursLabel}</p>
              <p>Support: support@printease.edu</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} printEase · {CAMPUS_COUNTER.name}.</p>
          <p>Live status &amp; Ready-for-Pickup notifications.</p>
        </div>
      </div>
    </footer>
  );
};
