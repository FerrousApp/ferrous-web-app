// src/features/transactions/Transactions.tsx
import { useState } from "react";
import { useLedgerTransactions } from "../../services/transactions.service";
import { useUIStore } from "../../store/uiStore";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import type { LedgerTransaction } from "../../types/transactions";

const formatMoney = (
  amount: number | string | undefined,
  currency: string | undefined,
) => {
  const val = typeof amount === "string" ? parseFloat(amount) : amount || 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
};

const STATUS_MAP: Record<
  string,
  { label: string; style: string; icon: string }
> = {
  success: {
    label: "Settled",
    style: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: "check_circle",
  },
  pending: {
    label: "Processing",
    style: "bg-amber-50 text-amber-700 border-amber-200",
    icon: "sync",
  },
  failed: {
    label: "Failed",
    style: "bg-red-50 text-red-700 border-red-200",
    icon: "cancel",
  },
};

const TYPE_MAP: Record<string, string> = {
  fiat_deposit: "Fiat Deposit",
  fiat_withdrawal: "Fiat Withdrawal",
  bond_investment: "Vault Investment",
  bond_liquidation: "Vault Liquidation",
};

export function Transactions() {
  // FIX: Destructure exchangeRate from the store for dynamic calculations
  const { currency, exchangeRate } = useUIStore();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: txData, isLoading } = useLedgerTransactions(
    50,
    0,
    statusFilter,
    typeFilter,
  );

  const currentRate = exchangeRate > 0 ? exchangeRate : 1600;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">
              Transaction Ledger
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Review your atomic swaps, yields, and transfers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Pills */}
            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/60 shadow-inner">
              {["all", "success", "pending", "failed"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    statusFilter === s
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Type Filter Select */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-stone-200/80 text-stone-700 text-xs font-bold rounded-xl px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="fiat_deposit">Deposits</option>
              <option value="fiat_withdrawal">Withdrawals</option>
              <option value="bond_investment">Investments</option>
              <option value="bond_liquidation">Liquidations</option>
            </select>
          </div>
        </div>

        {/* Ledger List */}
        <div className="bg-white rounded-3xl p-5 md:p-7 border border-stone-200/90 shadow-sm relative overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                progress_activity
              </span>
            </div>
          ) : !txData?.transactions || txData.transactions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-stone-300">
                  receipt_long
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-stone-900">
                No transactions found
              </h3>
              <p className="text-xs text-stone-500 max-w-[250px]">
                Adjust your filters to see historical activity.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {txData.transactions.map((tx: LedgerTransaction) => {
                const safeStatus = tx.status || "pending";
                const safeType = tx.type || "unknown_transaction";

                const statusInfo = STATUS_MAP[safeStatus] || STATUS_MAP.pending;
                const txTypeLabel =
                  TYPE_MAP[safeType] || safeType.replace("_", " ");
                const isPositive = [
                  "fiat_deposit",
                  "bond_liquidation",
                ].includes(safeType);

                // FIX: Dynamic amount formatting based on global UI store toggle & live rate
                const rawAmount = tx.amount || 0;
                let displayAmount = rawAmount;
                let displayCurrency = tx.currency || "NGN";

                if (tx.currency === "NGN" && currency === "USD") {
                  displayAmount = rawAmount / currentRate;
                  displayCurrency = "USD";
                } else if (tx.currency === "USD" && currency === "NGN") {
                  displayAmount = rawAmount * currentRate;
                  displayCurrency = "NGN";
                }

                return (
                  <div
                    key={tx.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50 transition-colors -mx-4 px-4 rounded-xl min-w-0"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[18px] font-bold shadow-sm shrink-0 ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        <span className="material-symbols-outlined">
                          {isPositive ? "arrow_downward" : "arrow_upward"}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-extrabold text-stone-900 capitalize truncate">
                            {txTypeLabel}
                          </p>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border shrink-0 ${statusInfo.style}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5 truncate">
                          {tx.provider || "Ferrous"} •{" "}
                          {tx.created_at
                            ? new Date(tx.created_at).toLocaleString()
                            : "Recent"}
                        </p>
                      </div>
                    </div>

                    {/* Amount & ID */}
                    <div className="sm:text-right flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end pl-14 sm:pl-0 shrink-0">
                      <span
                        className={`text-base font-black tracking-tight ${isPositive ? "text-emerald-600" : "text-stone-900"}`}
                      >
                        {isPositive ? "+" : "-"}
                        {formatMoney(displayAmount, displayCurrency)}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono mt-0.5 truncate max-w-[120px]">
                        ID: {tx.id ? tx.id.split("-")[0] : "..."}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination (If has_more is true) */}
          {txData?.pagination?.has_more && (
            <div className="pt-6 mt-2 border-t border-stone-100 flex justify-center">
              <button className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer">
                Load Older Transactions
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
