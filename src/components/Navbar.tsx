import React, { useState } from 'react';
import { Menu, Printer, X } from 'lucide-react';

export type AppSection = 'studio' | 'tracker' | 'account' | 'staff';

interface NavbarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection, anchorId?: string) => void;
  userSignedIn: boolean;
  userName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  onNavigate,
  userSignedIn,
  userName,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (section: AppSection, anchorId?: string) => {
    setMobileOpen(false);
    onNavigate(section, anchorId);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('studio', 'top')}
          className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-800"
        >
          <Printer className="h-5 w-5 text-blue-800 shrink-0" aria-hidden="true" />
          <span className="font-display">printEase</span>
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => handleLinkClick('studio', 'how-it-works')}
            className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('studio', 'print-studio')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4 ${
              activeSection === 'studio' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Print Studio
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('tracker')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4 ${
              activeSection === 'tracker' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Track Order
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('account')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4 ${
              activeSection === 'account' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            {userSignedIn && userName ? userName.split(' ')[0] : 'Account'}
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('staff')}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 hover:underline underline-offset-4 ${
              activeSection === 'staff' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Staff Console
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('studio', 'print-studio')}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
          >
            Start Print Order
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden hover:bg-slate-50"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => handleLinkClick('studio', 'how-it-works')}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('studio', 'print-studio')}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Print Studio
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('tracker')}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Track Order
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('account')}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {userSignedIn ? `Account (${userName})` : 'Account'}
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('staff')}
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Staff Console
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('studio', 'print-studio')}
              className="mt-2 rounded-lg bg-blue-800 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-900"
            >
              Start Print Order
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
