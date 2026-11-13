// src/features/transactions/Transactions.tsx
import { useState } from "react";
import { useTransactions } from "../../services/dashboard.service";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import type { Transaction } from "../../types/dashboard";

export function Transactions() {
  const { data: txData, isLoading } = useTransactions(50, 0);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const formatMoney = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency === "NGN" || currency === "USD" ? currency : "NGN",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
      case "completed":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "failed":
        return "text-red-700 bg-red-50 border-red-200";
      default:
        return "text-amber-700 bg-amber-50 border-amber-200";
    }
  };

  const renderModalContent = (tx: Transaction) => {
    switch (tx.type) {
      case "fiat_deposit": {
        // FIX: Cast metadata specifically for Fiat Deposits
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
        // FIX: Cast metadata specifically for Fiat Withdrawals
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
        // FIX: Cast metadata specifically for Bond Investments
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
        // FIX: Cast metadata specifically for Bond Liquidations
        const meta = tx.metadata as
          | {
              swap_tx_hash?: string;
              usdc_transfer_hash?: string;
            }
          | undefined;
        return (
          <div className="space-y-4 text-sm">
            {tx.status === "success" && tx.currency === "NGN" && (
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

  const getPrimaryValue = (tx: Transaction) => {
    if (tx.type === "fiat_deposit") return `+${formatMoney(tx.amount, "NGN")}`;
    if (tx.type === "fiat_withdrawal")
      return `-${formatMoney(tx.amount, "NGN")}`;
    if (tx.type === "bond_investment")
      return `-${formatMoney(tx.amount, "NGN")}`;
    if (tx.type === "bond_liquidation" && tx.currency !== "NGN")
      return `-${tx.amount} Bond`;
    if (tx.type === "bond_liquidation" && tx.currency === "NGN")
      return `+${formatMoney(tx.amount, "NGN")}`;
    return formatMoney(tx.amount, tx.currency);
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-4xl mx-auto space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">
              Transaction History
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Review all your deposits, withdrawals, and protocol executions.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            {txData?.transactions?.length ? (
              <div className="divide-y divide-stone-100">
                {txData.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="p-4 sm:p-5 flex items-center justify-between hover:bg-stone-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border shrink-0 ${getStatusColor(tx.status)}`}
                      >
                        <span className="material-symbols-outlined text-[24px]">
                          {tx.type.includes("deposit")
                            ? "arrow_downward"
                            : tx.type.includes("withdraw")
                              ? "arrow_upward"
                              : "swap_horiz"}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-stone-900 capitalize text-sm sm:text-base">
                          {tx.type.replace("_", " ")}
                        </h3>
                        <p className="text-xs text-stone-500 font-medium mt-0.5">
                          {new Date(tx.created_at).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}{" "}
                          •{" "}
                          {new Date(tx.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p
                          className={`font-black text-sm sm:text-base tracking-tight ${tx.type.includes("deposit") ? "text-emerald-600" : "text-stone-900"}`}
                        >
                          {getPrimaryValue(tx)}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded block w-fit ml-auto mt-1 ${getStatusColor(tx.status)}`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-stone-300 group-hover:text-primary transition-colors hidden sm:block">
                        chevron_right
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-stone-500">
                No transactions found.
              </div>
            )}
          </div>
        )}
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
                    {selectedTx.type.includes("deposit")
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
                className={`text-3xl font-black tracking-tight ${selectedTx.type.includes("deposit") ? "text-emerald-600" : "text-stone-900"}`}
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
