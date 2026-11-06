// src/layouts/DashboardLayout.tsx
import type { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import ferrousIcon from "../assets/ferrous-icon.svg";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/", icon: "grid_view" },
  { name: "Earn", path: "/earn", icon: "trending_up" },
  { name: "Transfers & Funding", path: "/transfers", icon: "swap_horiz" },
  { name: "Transactions", path: "/transactions", icon: "receipt_long" },
  { name: "Settings", path: "/settings", icon: "settings" },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const { currency, toggleCurrency } = useUIStore();

  const firstName = user?.first_name || user?.firstName || user?.name || "User";
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <div className="bg-background font-body-md text-on-surface min-h-screen relative selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed top-4 bottom-4 left-4 z-40 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_4px_20px_-2px_rgba(110,95,70,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] rounded-lg md:w-16 xl:w-64 transition-all duration-300">
        <div className="h-20 flex items-center px-4 xl:px-space-lg gap-3 shrink-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-primary-container rounded-xl flex items-center justify-center shadow-sm overflow-hidden p-1">
              <img
                src={ferrousIcon}
                alt="Ferrous Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden xl:flex flex-col overflow-hidden">
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-bold">
                Ferrous
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">
                DeFi Capital
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-space-sm xl:px-space-md py-space-sm space-y-space-xs">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-full transition-all justify-center xl:justify-start group ${
                  isActive
                    ? "bg-primary-container text-on-primary-container shadow-[0_8px_16px_-4px_rgba(248,176,24,0.35)]"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                }`
              }
            >
              <span className="material-symbols-outlined text-[22px] shrink-0">
                {item.icon}
              </span>
              <span className="hidden xl:inline font-label-lg text-label-lg">
                {item.name}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-24 xl:pl-72 flex flex-col min-h-screen relative">
        {/* Top Header */}
        <header className="sticky top-0 z-30 w-full px-gutter-mobile md:px-gutter py-space-sm md:py-space-md">
          <div className="h-16 w-full max-w-7xl mx-auto bg-surface-container-lowest/90 backdrop-blur-xl rounded-full shadow-[0_4px_20px_-2px_rgba(110,95,70,0.05)] px-space-md md:px-space-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 md:hidden">
              <div className="w-8 h-8 bg-primary-container rounded-xl flex items-center justify-center shadow-sm overflow-hidden p-1">
                <img
                  src={ferrousIcon}
                  alt="Ferrous Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Ferrous
              </span>
            </div>

            <div className="hidden md:block"></div>
            <div className="flex items-center gap-space-sm md:gap-space-md ml-auto">
              {/* Currency Toggle */}
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-full">
                <button
                  onClick={() => toggleCurrency("NGN")}
                  className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-bold transition-all ${currency === "NGN" ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  NGN
                </button>
                <button
                  onClick={() => toggleCurrency("USD")}
                  className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-bold transition-all ${currency === "USD" ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  USD
                </button>
              </div>

              {/* User Profile Pill */}
              <Link
                to="/settings?tab=profile"
                className="flex items-center gap-3 pl-2 py-1 pr-1.5 rounded-full bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
              >
                <div className="hidden sm:flex flex-col text-right leading-none">
                  <span className="font-label-md text-label-md text-on-surface capitalize">
                    {firstName}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {user?.email}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-primary-container/40">
                  {initial}
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="w-full max-w-7xl mx-auto px-gutter-mobile md:px-gutter flex-1 relative z-10 pb-24">
          {children}
        </main>

        <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-40 opacity-40 mix-blend-multiply overflow-hidden z-0">
          <svg
            className="w-full h-full"
            fill="none"
            viewBox="0 0 1440 240"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 240L180 180L360 210L540 160L720 200L900 150L1080 190L1260 165L1440 215V240H0Z"
              fill="#F8B018"
              fillOpacity="0.15"
            ></path>
            <path
              d="M0 240L140 205L320 230L500 195L760 225L1020 185L1220 210L1440 190V240H0Z"
              fill="#FFBA38"
              fillOpacity="0.2"
            ></path>
            <polygon
              fill="#FFDEAC"
              fillOpacity="0.3"
              points="180,180 360,210 260,240"
            ></polygon>
            <polygon
              fill="#F8B018"
              fillOpacity="0.25"
              points="540,160 720,200 640,240"
            ></polygon>
            <polygon
              fill="#FFBA38"
              fillOpacity="0.25"
              points="900,150 1080,190 980,240"
            ></polygon>
            <polygon
              fill="#FFDEAC"
              fillOpacity="0.35"
              points="1260,165 1440,215 1360,240"
            ></polygon>
          </svg>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-3 left-4 right-4 z-40 bg-surface-container-lowest/95 backdrop-blur-xl rounded-full shadow-[0_8px_32px_rgba(110,95,70,0.15)] px-space-md py-space-sm flex items-center justify-around">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 ${isActive ? "text-primary-container" : "text-on-surface-variant hover:text-on-surface"}`
            }
          >
            <span className="material-symbols-outlined text-[22px]">
              {item.icon}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
