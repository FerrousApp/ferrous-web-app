// src/layouts/AuthLayout.tsx
import React from "react";
import ferrousIcon from "../assets/ferrous-icon.svg"; // FIX: Imported local asset

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased min-h-screen flex flex-col justify-between">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(110,95,70,0.05)]">
        <div className="w-full px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <img
              alt="Ferrous Logo"
              className="h-7 w-auto object-contain"
              src={ferrousIcon} // FIX: Used local asset instead of expired URL
            />
            <span className="font-headline-sm text-[18px] text-on-surface tracking-tight font-bold">
              Ferrous
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.02)] cursor-pointer">
            <span className="w-4 h-4 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[9px] flex items-center justify-center font-bold">
              ₦
            </span>
            <span className="font-label-md text-[11px] text-on-surface font-semibold">
              NGN / USD
            </span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
              expand_more
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA - flex-1 pushes footer down */}
      <main className="w-full flex-1 pt-16 bg-surface flex flex-col">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-surface-container-low shadow-[0_-1px_6px_rgba(110,95,70,0.03)] py-space-lg mt-auto">
        <div className="w-full px-4 py-4 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center gap-3 text-on-surface-variant font-label-sm text-[11px] flex-wrap">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">
                verified_user
              </span>
              <span>256-Bit Vault</span>
            </div>
            <span className="text-outline-variant">•</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">
                shield
              </span>
              <span>SOC2 Type II</span>
            </div>
            <span className="text-outline-variant">•</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">
                account_balance
              </span>
              <span>Institutional Custody</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 text-on-surface-variant font-body-sm text-[11px]">
            <a className="hover:text-on-surface transition-colors" href="#">
              Privacy Policy
            </a>
            <a className="hover:text-on-surface transition-colors" href="#">
              Terms of Service
            </a>
            <span className="text-on-surface-variant/80">
              © 2025 Ferrous Labs
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
