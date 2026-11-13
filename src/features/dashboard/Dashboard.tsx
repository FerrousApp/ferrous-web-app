// src/features/dashboard/Dashboard.tsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  useWalletBalances,
  useMarketAssets,
  useTrendingAssets,
  useTransactions,
} from "../../services/dashboard.service";
import { useUIStore } from "../../store/uiStore";
import type { Asset, Transaction } from "../../types/dashboard";

const formatMoney = (amount: number, currency: "NGN" | "USD") => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

const TX_STATUS_MAP: Record<
  Transaction["status"],
  { icon: string; color: string; bg: string }
> = {
  success: {
    icon: "check_circle",
    color: "text-[#1E7E34]",
    bg: "bg-[#EBF9EB]",
  },
  completed: {
    // FIX: Added mapping for bond liquidations
    icon: "check_circle",
    color: "text-[#1E7E34]",
    bg: "bg-[#EBF9EB]",
  },
  pending: { icon: "sync", color: "text-tertiary", bg: "bg-tertiary-fixed" },
  failed: { icon: "cancel", color: "text-error", bg: "bg-error-container" },
  reversed: {
    // FIX: Added mapping for reversed fiat withdrawals
    icon: "undo",
    color: "text-error",
    bg: "bg-error-container",
  },
};

const TRENDING_GRADIENTS = [
  "from-[#8C3A27] via-[#752E1D] to-[#5C2314]",
  "from-[#A0004B] via-[#85003E] to-[#670030]",
  "from-[#004B4B] via-[#003E3E] to-[#002828]",
];

export function Dashboard() {
  const { currency, setExchangeRate, exchangeRate } = useUIStore();

  const { data: balances } = useWalletBalances();
  const { data: allAssets } = useMarketAssets();
  const { data: trendingAssets } = useTrendingAssets();
  const { data: txData } = useTransactions();

  useEffect(() => {
    const livePricing = allAssets?.[0]?.live_pricing as unknown as
      | Record<string, unknown>
      | undefined;
    const rate = livePricing?.fiat_exchange_rate_with_usd;

    if (typeof rate === "number") {
      setExchangeRate(rate);
    }
  }, [allAssets, setExchangeRate]);

  // FIX: Properly extract the root NGN balance since it's correctly parsed as a number in the service now.
  const rawNgnBalance =
    (balances as Record<string, number> | undefined)?.NGN || 0;

  const displayBalance =
    currency === "NGN"
      ? rawNgnBalance
      : rawNgnBalance / (exchangeRate > 0 ? exchangeRate : 1600); // Used 1600 fallback

  const activePortfolio =
    allAssets?.filter(
      (asset: Asset) => balances && (balances[asset.id] || 0) > 0,
    ) || [];

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-space-lg xl:gap-space-xl">
      <div className="lg:col-span-7 xl:col-span-7 flex flex-col space-y-space-lg">
        <div className="relative bg-surface-container-lowest p-space-md sm:p-space-lg rounded-lg shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-container via-primary-fixed to-primary-container/40" />
          <div className="flex flex-col space-y-space-md">
            <div className="flex items-center justify-between">
              <span className="font-label-lg text-label-lg text-on-surface-variant">
                Total Balance
              </span>
            </div>
            <div className="flex items-baseline gap-1 py-1">
              <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-extrabold">
                {formatMoney(displayBalance, currency)}
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-space-sm sm:gap-space-md pt-space-xs">
              <Link
                to="/transfers"
                className="group flex items-center justify-center gap-2 py-3 px-space-md rounded-full bg-primary-container text-on-primary-container font-label-lg text-label-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] transition-transform duration-200 group-hover:scale-110">
                  account_balance_wallet
                </span>
                <span>Add funds</span>
              </Link>
              <Link
                to="/transfers"
                className="group flex items-center justify-center gap-2 py-3 px-space-md rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high font-label-lg text-label-lg transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform duration-200 group-hover:scale-110">
                  payments
                </span>
                <span>Withdraw</span>
              </Link>
            </div>
          </div>
        </div>

        {activePortfolio.length > 0 && (
          <div className="flex flex-col space-y-space-sm">
            {activePortfolio.map((asset: Asset) => {
              const userAssetBalance = balances?.[asset.id] || 0;
              const yieldPercentage = asset.live_pricing
                ? (asset.live_pricing.annualized_yield_bps / 100).toFixed(2)
                : "0.00";

              return (
                <div
                  key={asset.id}
                  className="bg-surface-container-lowest hover:bg-surface-container-low transition-all duration-200 p-space-md sm:px-space-lg sm:py-space-md rounded-lg shadow-sm flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-space-md">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center shrink-0 text-primary font-bold uppercase">
                      {(asset.symbol || "A").charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface tracking-tight group-hover:text-primary transition-colors">
                        {asset.name}
                      </h3>
                      <span className="font-body-sm text-body-sm text-on-surface-variant capitalize">
                        {asset.provider || "Protocol"} Vault
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-label-lg text-label-lg text-[#1E7E34] block">
                      +{yieldPercentage}% APY
                    </span>
                    <span className="font-body-md text-body-md text-on-surface-variant font-medium">
                      {userAssetBalance} {asset.symbol}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col space-y-space-md pt-space-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                history
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Transactions
              </h2>
            </div>
            <Link
              to="/transactions"
              className="px-4 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high font-label-md text-label-md transition-colors cursor-pointer"
            >
              See all
            </Link>
          </div>
          <div className="flex flex-col space-y-space-sm">
            {txData?.transactions?.map((tx: Transaction) => {
              const status = TX_STATUS_MAP[tx.status] || TX_STATUS_MAP.pending;

              return (
                <div
                  key={tx.id}
                  className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm flex items-center justify-between hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-space-md">
                    <div
                      className={`w-10 h-10 rounded-2xl ${status.bg} ${status.color} flex items-center justify-center shrink-0`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {status.icon}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-label-lg text-label-lg text-on-surface block capitalize">
                        {(tx.type || "Transaction").replace("_", " ")}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate capitalize">
                        {tx.provider || "System"} •{" "}
                        {new Date(tx.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-label-lg text-label-lg text-on-surface">
                      {formatMoney(
                        tx.amount || 0,
                        tx.currency as "NGN" | "USD",
                      )}
                    </span>
                    <span
                      className={`font-body-sm text-body-sm ${status.color} block capitalize`}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-container/20 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">
                local_fire_department
              </span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Trending
            </h2>
          </div>
        </div>

        <div className="flex flex-col space-y-space-md">
          {trendingAssets?.map((asset: Asset, index: number) => {
            const gradient =
              TRENDING_GRADIENTS[index % TRENDING_GRADIENTS.length];

            const isHot =
              asset.tags?.includes("hot") || asset.tags?.includes("trending");

            const yieldPercentage = asset.live_pricing
              ? (asset.live_pricing.annualized_yield_bps / 100).toFixed(2)
              : "0.00";

            return (
              <Link
                key={asset.id}
                to="/earn"
                className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${gradient} text-white p-space-md sm:p-space-lg shadow-sm hover:shadow-md transition-all duration-300 min-h-[220px] flex flex-col justify-between group cursor-pointer`}
              >
                <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-primary-container/20 blur-2xl pointer-events-none" />

                <div className="relative z-10 flex items-start justify-between">
                  <div
                    className={`w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-center shadow-sm ${isHot ? "text-[#EA580C]" : "text-primary"}`}
                  >
                    {isHot ? (
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        local_fire_department
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">
                        trending_up
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-label-sm text-label-sm uppercase tracking-widest text-white/70 block">
                      Platform
                    </span>
                    <span className="font-headline-sm text-headline-sm text-white font-bold capitalize">
                      {asset.provider || "DeFi Protocol"}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 grid grid-cols-12 items-end pt-space-md">
                  <div className="col-span-5 relative font-headline-xl text-white/40 font-black">
                    {asset.symbol}
                  </div>
                  <div className="col-span-7 flex flex-col space-y-1 text-right">
                    <span className="font-label-sm text-label-sm text-white/75">
                      Projected Yield
                    </span>
                    <div className="font-headline-lg text-headline-lg font-extrabold text-white tracking-tight leading-none">
                      +{yieldPercentage}%
                    </div>
                    <div className="pt-2">
                      <span className="font-label-sm text-label-sm text-white/70 block">
                        Min deposit
                      </span>
                      <span className="font-headline-sm text-headline-sm text-white font-bold tracking-tight">
                        ${(asset.minimum_deposit_usd || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
