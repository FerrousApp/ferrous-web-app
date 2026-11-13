// src/features/transactions/Transactions.tsx
import { useState } from "react";
import { useTransactions } from "../../services/dashboard.service";
import { useUIStore } from "../../store/uiStore";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import type { Transaction } from "../../types/dashboard";

const STATUS_MAP: Record<
  string,
  { label: string; style: string; icon: string }
> = {
  success: {
    label: "Settled",
    style: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: "check_circle",
  },
  completed: {
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
  reversed: {
    label: "Reversed",
    style: "bg-red-50 text-red-700 border-red-200",
    icon: "undo",
  },
};

const TYPE_MAP: Record<string, string> = {
  fiat_deposit: "Fiat Deposit",
  fiat_withdrawal: "Fiat Withdrawal",
  bond_investment: "Vault Investment",
  bond_liquidation: "Vault Liquidation",
};

export function Transactions() {
  const { currency, exchangeRate } = useUIStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const { data: txData, isLoading } = useTransactions(50, 0);

  const currentRate = exchangeRate > 0 ? exchangeRate : 1600;

  // Filter Logic
  const filteredTransactions = txData?.transactions?.filter((tx) => {
    const statusMatch = statusFilter === "all" || tx.status === statusFilter;
    const typeMatch = typeFilter === "all" || tx.type === typeFilter;
    return statusMatch && typeMatch;
  });

  const formatMoney = (amount: number, currencyCode: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency:
        currencyCode === "NGN" || currencyCode === "USD" ? currencyCode : "NGN",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
      case "completed":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "failed":
      case "reversed":
        return "text-red-700 bg-red-50 border-red-200";
      default:
        return "text-amber-700 bg-amber-50 border-amber-200";
    }
  };

  // Helper function to extract just the string representation for the UI
  const getPrimaryValue = (tx: Transaction) => {
    const rawAmount = tx.amount || 0;
    let displayAmount = rawAmount;
    let displayCurrency = tx.currency || "NGN";

    // Dynamic UI toggling for standard NGN/USD values
    if (tx.currency === "NGN" && currency === "USD") {
      displayAmount = rawAmount / currentRate;
      displayCurrency = "USD";
    } else if (tx.currency === "USD" && currency === "NGN") {
      displayAmount = rawAmount * currentRate;
      displayCurrency = "NGN";
    }

    if (tx.type === "fiat_deposit")
      return `+${formatMoney(displayAmount, displayCurrency)}`;
    if (tx.type === "fiat_withdrawal")
      return `-${formatMoney(displayAmount, displayCurrency)}`;
    if (tx.type === "bond_investment")
      return `-${formatMoney(displayAmount, displayCurrency)}`;
    if (tx.type === "bond_liquidation" && tx.currency !== "NGN")
      return `-${rawAmount} Bond`;
    if (tx.type === "bond_liquidation" && tx.currency === "NGN")
      return `+${formatMoney(displayAmount, displayCurrency)}`;

    return formatMoney(displayAmount, displayCurrency);
  };

  const getModalHeader = (tx: Transaction) => {
    switch (tx.type) {
      case "fiat_deposit":
        return "Fiat Deposit";
      case "fiat_withdrawal":
        return "Fiat Withdrawal";
      case "bond_investment": {
        const meta = tx.metadata as { assetId?: string } | undefined;
        return `Asset Purchase: ${meta?.assetId || "BOND"}`;
      }
      case "bond_liquidation": {
        const meta = tx.metadata as { assetId?: string } | undefined;
        return `Asset Liquidation: ${meta?.assetId || "BOND"}`;
      }
      default:
        return "Transaction Details";
    }
  };

  const renderModalContent = (tx: Transaction) => {
    switch (tx.type) {
      case "fiat_deposit": {
        const meta = tx.metadata as { busha_fee?: string } | undefined;
        return (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Status</span>
              <span className="font-bold capitalize text-stone-900">
                {tx.status}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Date</span>
              <span className="font-bold text-stone-900">
                {new Date(tx.created_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Transaction ID</span>
              <span className="font-mono text-xs text-stone-900 bg-stone-100 px-2 py-1 rounded">
                {tx.reference}
              </span>
            </div>
            <div className="flex justify-between pb-1">
              <span className="text-stone-500 font-medium">Fee</span>
              <span className="font-bold text-stone-900">
                {meta?.busha_fee ? `₦${meta.busha_fee}` : "₦0.00"}
              </span>
            </div>
          </div>
        );
      }

      case "fiat_withdrawal": {
        const meta = tx.metadata as
          | {
              bank_name?: string;
              account_number?: string;
              account_name?: string;
              failure_reason?: string;
            }
          | undefined;
        return (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Destination</span>
              <div className="text-right">
                <span className="font-bold text-stone-900 block">
                  {meta?.bank_name || "Unknown Bank"}
                </span>
                <span className="text-xs text-stone-500 font-mono">
                  {meta?.account_number || "N/A"}
                </span>
              </div>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Recipient Name</span>
              <span className="font-bold text-stone-900 uppercase">
                {meta?.account_name || "N/A"}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Date</span>
              <span className="font-bold text-stone-900">
                {new Date(tx.created_at).toLocaleString()}
              </span>
            </div>

            {(tx.status === "failed" || tx.status === "reversed") && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-bold mt-2">
                Failure Reason:{" "}
                {meta?.failure_reason ||
                  "Transaction declined by upstream provider."}
              </div>
            )}
          </div>
        );
      }

      case "bond_investment": {
        const meta = tx.metadata as
          | {
              purchased_bond_amount?: string;
              targetNetwork?: string;
              txHash?: string;
            }
          | undefined;
        return (
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Asset Received</span>
              <span className="font-bold text-emerald-600">
                {tx.status === "success" && meta?.purchased_bond_amount
                  ? `+${meta.purchased_bond_amount}`
                  : "Processing..."}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-3">
              <span className="text-stone-500 font-medium">Target Network</span>
              <span className="font-bold text-stone-900 uppercase">
                {meta?.targetNetwork || "SOL"}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-3 items-center">
              <span className="text-stone-500 font-medium">
                Blockchain Proof
              </span>
              {meta?.txHash ? (
                <a
                  href={`https://solscan.io/tx/${meta.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary bg-primary-container/20 px-2 py-1 rounded hover:underline flex items-center gap-1"
                >
                  {meta.txHash.substring(0, 12)}...
                  <span className="material-symbols-outlined text-[12px]">
                    open_in_new
                  </span>
                </a>
              ) : (
                <span className="text-stone-400 italic text-xs">
                  Pending ledger confirmation
                </span>
              )}
            </div>

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 mt-2">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
                Execution Pipeline
              </h4>
              <div className="space-y-2 text-xs font-bold">
                <div className="flex justify-between text-stone-900">
                  <span>1. Fiat Ramp</span>
                  {[
                    "USDC_DELIVERED",
                    "PENDING_ON_CHAIN",
                    "PROCESSING_ON_CHAIN_SWAP",
                    "success",
                  ].includes(tx.granular_status || "") ? (
                    <span className="text-emerald-600">✓ Settled</span>
                  ) : (
                    <span className="text-amber-600 animate-pulse">
                      Processing...
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-stone-900">
                  <span>2. On-Chain Ledger</span>
                  {[
                    "PENDING_ON_CHAIN",
                    "PROCESSING_ON_CHAIN_SWAP",
                    "success",
                  ].includes(tx.granular_status || "") ? (
                    <span className="text-emerald-600">✓ Confirmed</span>
                  ) : (
                    <span className="text-stone-400">Waiting</span>
                  )}
                </div>
                <div className="flex justify-between text-stone-900">
                  <span>3. Protocol Swap</span>
                  {tx.granular_status === "success" ? (
                    <span className="text-emerald-600">✓ Swapped</span>
                  ) : (
                    <span className="text-stone-400">Waiting</span>
                  )}
                </div>
              </div>

              {tx.granular_status === "USDC_DELIVERED" && (
                <button className="w-full mt-4 py-2 bg-primary text-on-primary-container rounded-xl text-xs font-bold shadow-sm">
                  Finalize Execution
                </button>
              )}
            </div>
          </div>
        );
      }

      case "bond_liquidation": {
        const meta = tx.metadata as
          | {
              swap_tx_hash?: string;
              usdc_transfer_hash?: string;
            }
          | undefined;
        return (
          <div className="space-y-4 text-sm">
            {tx.status === "completed" && tx.currency === "NGN" && (
              <div className="flex justify-between border-b border-stone-100 pb-3">
                <span className="text-stone-500 font-medium">
                  Final NGN Payout
                </span>
                <span className="font-extrabold text-emerald-600">
                  +₦{tx.amount?.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex flex-col border-b border-stone-100 pb-3 gap-2">
              <span className="text-stone-500 font-medium">
                Blockchain Proofs (Solscan)
              </span>

              {meta?.swap_tx_hash && (
                <div className="flex justify-between items-center bg-stone-50 p-2 rounded-lg border border-stone-100">
                  <span className="text-xs font-bold text-stone-700">
                    DEX Swap
                  </span>
                  <a
                    href={`https://solscan.io/tx/${meta.swap_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {meta.swap_tx_hash.substring(0, 12)}...
                  </a>
                </div>
              )}

              {meta?.usdc_transfer_hash && (
                <div className="flex justify-between items-center bg-stone-50 p-2 rounded-lg border border-stone-100">
                  <span className="text-xs font-bold text-stone-700">
                    Fiat Off-Ramp Transfer
                  </span>
                  <a
                    href={`https://solscan.io/tx/${meta.usdc_transfer_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {meta.usdc_transfer_hash.substring(0, 12)}...
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="text-sm text-stone-500 italic">
            No detailed metadata available for this transaction type.
          </div>
        );
    }
  };

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
        <div className="bg-white rounded-3xl p-5 md:p-7 border border-stone-200/90 shadow-sm relative overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                progress_activity
              </span>
            </div>
          ) : !filteredTransactions || filteredTransactions.length === 0 ? (
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
              {filteredTransactions.map((tx: Transaction) => {
                const safeStatus = tx.status || "pending";
                const safeType = tx.type || "unknown_transaction";

                const statusInfo = STATUS_MAP[safeStatus] || STATUS_MAP.pending;
                const txTypeLabel =
                  TYPE_MAP[safeType] || safeType.replace("_", " ");
                const isPositive = [
                  "fiat_deposit",
                  "bond_liquidation",
                ].includes(safeType);

                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50 transition-colors -mx-4 px-4 rounded-xl min-w-0 cursor-pointer group"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[18px] font-bold shadow-sm shrink-0 ${
                          isPositive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        <span className="material-symbols-outlined">
                          {isPositive
                            ? "arrow_downward"
                            : safeType.includes("withdraw")
                              ? "arrow_upward"
                              : "swap_horiz"}
                        </span>
                      </div>

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

                    <div className="sm:text-right flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end pl-14 sm:pl-0 shrink-0">
                      <span
                        className={`text-base font-black tracking-tight ${isPositive ? "text-emerald-600" : "text-stone-900"}`}
                      >
                        {getPrimaryValue(tx)}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-stone-400 font-mono truncate max-w-[120px]">
                          ID: {tx.id ? tx.id.split("-")[0] : "..."}
                        </span>
                        <span className="material-symbols-outlined text-stone-300 group-hover:text-primary transition-colors hidden sm:block">
                          chevron_right
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {txData?.pagination?.has_more && (
            <div className="pt-6 mt-2 border-t border-stone-100 flex justify-center">
              <button className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer">
                Load Older Transactions
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- TRANSACTION DETAILS MODAL --- */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-stone-100 flex items-start justify-between bg-stone-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border shrink-0 ${getStatusColor(selectedTx.status)}`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {selectedTx.type.includes("deposit") ||
                    selectedTx.type.includes("liquidation")
                      ? "arrow_downward"
                      : selectedTx.type.includes("withdraw")
                        ? "arrow_upward"
                        : "swap_horiz"}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-stone-900">
                    {getModalHeader(selectedTx)}
                  </h2>
                  <p className="text-xs text-stone-500 font-medium capitalize mt-0.5">
                    {selectedTx.provider || "System"} • {selectedTx.status}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            {/* Big Amount Display */}
            <div className="p-6 text-center border-b border-stone-100">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
                Transaction Value
              </p>
              <h1
                className={`text-3xl font-black tracking-tight ${selectedTx.type.includes("deposit") || selectedTx.type.includes("liquidation") ? "text-emerald-600" : "text-stone-900"}`}
              >
                {getPrimaryValue(selectedTx)}
              </h1>
            </div>

            {/* Dynamic Metadata Render */}
            <div className="p-6 bg-white">{renderModalContent(selectedTx)}</div>

            {/* Close Action */}
            <div className="p-4 bg-stone-50 border-t border-stone-100">
              <button
                onClick={() => setSelectedTx(null)}
                className="w-full py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
