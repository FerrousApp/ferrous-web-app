// src/features/transfers/Transfers.tsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDepositAccount,
  useWithdrawal,
  useSavedBanks,
} from "../../services/transfers.service";
import {
  useWalletBalances,
  useMarketAssets,
  useTransactions,
} from "../../services/dashboard.service";
import { useProfile } from "../../services/settings.service";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import {
  buildPortfolioSummary,
  formatTokenQuantity,
  type PortfolioHolding,
} from "../../lib/portfolio";
import {
  getEffectiveStatus,
  getTransactionStatusMeta,
  isTransactionActionable,
  isTransactionFailed,
  isTransactionSuccess,
} from "../../lib/transactionStatus";
import type { DvaDetails, SavedBank } from "../../types/transfers";

const formatFiat = (amount: number, currency: "NGN" | "USD") =>
  currency === "NGN"
    ? `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Transfers() {
  const navigate = useNavigate();
  const { currency, exchangeRate, sellRate } = useUIStore();
  const { user } = useAuthStore();

  const { data: userProfile } = useProfile();
  const {
    data: dvaData,
    isLoading: dvaLoading,
    isError: dvaError,
  } = useDepositAccount();
  const { data: balances } = useWalletBalances();
  const { data: marketAssets } = useMarketAssets();

  const { data: savedBanksData, isLoading: isBanksLoading } = useSavedBanks();
  const savedBanks = useMemo<SavedBank[]>(
    () => (Array.isArray(savedBanksData) ? savedBanksData : []),
    [savedBanksData],
  );

  const { data: txData } = useTransactions(10, 0);
  const withdrawalMutation = useWithdrawal();

  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const effectiveSelectedBankId =
    selectedBankId || (savedBanks.length > 0 ? savedBanks[0].id : "");

  const portfolio = useMemo(
    () => buildPortfolioSummary(balances, marketAssets, sellRate, exchangeRate),
    [balances, marketAssets, sellRate, exchangeRate],
  );

  const rawNgnBalance = portfolio.ngnBalance;
  const displayWalletTotal =
    currency === "NGN" ? portfolio.totalNgnValue : portfolio.totalUsdValue;
  const displayNgnCash =
    currency === "NGN"
      ? portfolio.ngnBalance
      : portfolio.ngnBalance / portfolio.effectiveSellRate;

  const latestTx = txData?.transactions?.[0];
  const effectiveStatus = getEffectiveStatus(latestTx);
  const latestStatusMeta = getTransactionStatusMeta(effectiveStatus);
  const txType = latestTx?.type;

  const storeProfile = user as unknown as Record<
    string,
    string | boolean | undefined
  > | null;
  const liveProfile = userProfile as unknown as Record<
    string,
    string | boolean | undefined
  > | null;

  const isVerified =
    liveProfile?.busha_status === "verified" ||
    storeProfile?.busha_status === "verified" ||
    liveProfile?.kyc_status === "verified" ||
    storeProfile?.kyc_status === "verified" ||
    liveProfile?.is_verified === true ||
    storeProfile?.is_verified === true;

  const amountNum = parseFloat(withdrawAmount);
  const isInputValid = !isNaN(amountNum) && amountNum > 0;
  const hasBankSelected = effectiveSelectedBankId.length > 0;
  const isButtonActive = isVerified && isInputValid && hasBankSelected;

  const handleCopyAccountNumber = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber).then(() => {
      setCopiedAccount(accountNumber);
      setTimeout(() => setCopiedAccount(null), 1800);
    });
  };

  const handleWithdrawal = async () => {
    if (!isVerified || !hasBankSelected) return;
    setFeedbackMessage(null);
    try {
      if (!isInputValid) {
        setFeedbackMessage("Please enter a valid withdrawal amount.");
        return;
      }

      await withdrawalMutation.mutateAsync({
        amountInNgn: amountNum,
        savedBankId: effectiveSelectedBankId,
      });

      setFeedbackMessage("Withdrawal request submitted successfully.");
      setWithdrawAmount("");
    } catch (err: unknown) {
      const error = err as Error;
      setFeedbackMessage(error.message || "Failed to process withdrawal.");
    }
  };

  const virtualAccounts: DvaDetails[] =
    dvaData?.dvas || (dvaData?.dva ? [dvaData.dva] : []);

  const renderPipelineSteps = () => {
    if (!latestTx) {
      return (
        <div className="py-8 text-center text-stone-500 text-xs">
          No active pipeline operations.
        </div>
      );
    }

    const settled = isTransactionSuccess(effectiveStatus);
    const failed = isTransactionFailed(effectiveStatus);

    if (txType === "fiat_deposit") {
      return (
        <div className="space-y-2.5">
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between ${
              settled
                ? "bg-stone-50 border-stone-200/80"
                : failed
                  ? "bg-red-50/50 border-red-200/80"
                  : "bg-amber-50/40 border-amber-200/80"
            }`}
          >
            <div className="flex items-center space-x-3">
              <span
                className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                  settled
                    ? "bg-stone-200 text-stone-700"
                    : failed
                      ? "bg-red-200 text-red-800"
                      : "bg-amber-400 text-stone-950 animate-pulse"
                }`}
              >
                1
              </span>
              <div>
                <h4 className="text-xs font-bold text-stone-900">
                  Bank Transfer Received
                </h4>
              </div>
            </div>
            {settled ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                ✓ Settled
              </span>
            ) : failed ? (
              <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                {latestStatusMeta.label}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                {latestStatusMeta.label}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (txType === "fiat_withdrawal" || txType === "bond_liquidation") {
      const isLiquidation = txType === "bond_liquidation";
      const payoutStepLabel = isLiquidation ? "Fiat Payout" : "Bank Payout";

      return (
        <div className="space-y-2.5">
          <div className="p-3.5 rounded-2xl border bg-stone-50 border-stone-200/80 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <h4 className="text-xs font-bold text-stone-900">
                  {isLiquidation
                    ? "Liquidation Initiated"
                    : "Withdrawal Initiated"}
                </h4>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              ✓ Complete
            </span>
          </div>

          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between ${
              settled
                ? "bg-stone-50 border-stone-200/80"
                : failed
                  ? "bg-red-50/50 border-red-200/80"
                  : "bg-amber-50/40 border-amber-200/80"
            }`}
          >
            <div className="flex items-center space-x-3">
              <span
                className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                  settled
                    ? "bg-stone-200 text-stone-700"
                    : failed
                      ? "bg-red-200 text-red-800"
                      : "bg-amber-400 text-stone-950 animate-pulse"
                }`}
              >
                2
              </span>
              <div>
                <h4 className="text-xs font-bold text-stone-900">
                  {payoutStepLabel}
                </h4>
                {latestTx.metadata?.bank_name && (
                  <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                    {latestTx.metadata.bank_name} •{" "}
                    {latestTx.metadata.account_number}
                  </span>
                )}
                {failed && txType === "fiat_withdrawal" && (
                  <span className="text-[10px] text-red-600 font-semibold block mt-0.5">
                    NGN balance automatically refunded
                  </span>
                )}
              </div>
            </div>
            {settled ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                ✓ Settled
              </span>
            ) : failed ? (
              <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                {latestStatusMeta.label}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                {latestStatusMeta.label}
              </span>
            )}
          </div>
        </div>
      );
    }

    const step1Active = [
      "USDC_DELIVERED",
      "AWAITING_ON_CHAIN_RETRY",
      "PENDING_ON_CHAIN",
      "PROCESSING_ON_CHAIN_SWAP",
      "failed_usdc_retained",
      "success",
      "completed",
    ].includes(effectiveStatus);
    const step2Active = [
      "PENDING_ON_CHAIN",
      "PROCESSING_ON_CHAIN_SWAP",
      "success",
      "completed",
    ].includes(effectiveStatus);
    const step3Active = [
      "PROCESSING_ON_CHAIN_SWAP",
      "success",
      "completed",
    ].includes(effectiveStatus);
    const step4Active = settled;
    const isActionable = isTransactionActionable(effectiveStatus);

    return (
      <div className="space-y-2.5">
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            step1Active
              ? "bg-stone-50 border-stone-200/80"
              : failed
                ? "bg-red-50/40 border-red-200/80"
                : "bg-amber-50/40 border-amber-200/80"
          }`}
        >
          <div className="flex items-center space-x-3">
            <span
              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                step1Active
                  ? "bg-stone-200 text-stone-700"
                  : failed
                    ? "bg-red-200 text-red-800"
                    : "bg-amber-400 text-stone-950 animate-pulse"
              }`}
            >
              1
            </span>
            <div>
              <h4 className="text-xs font-bold text-stone-900">Fiat Ramp</h4>
            </div>
          </div>
          {step1Active ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              ✓ Settled
            </span>
          ) : failed ? (
            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
              {latestStatusMeta.label}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
              {latestStatusMeta.label}
            </span>
          )}
        </div>

        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            step2Active
              ? "bg-stone-50 border-stone-200/80"
              : "bg-transparent border-dashed border-stone-200 opacity-50"
          }`}
        >
          <div className="flex items-center space-x-3">
            <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center">
              2
            </span>
            <div>
              <h4 className="text-xs font-bold text-stone-900">
                On-Chain Ledger
              </h4>
            </div>
          </div>
          {step2Active && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              ✓ Confirmed
            </span>
          )}
        </div>

        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            step3Active
              ? "bg-amber-50/40 border-amber-200/80"
              : effectiveStatus === "failed_usdc_retained"
                ? "bg-red-50/50 border-red-200/80"
                : "bg-transparent border-dashed border-stone-200 opacity-50"
          }`}
        >
          <div className="flex items-center space-x-3">
            <span
              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                step3Active && !step4Active
                  ? "bg-amber-400 text-stone-950 animate-pulse"
                  : effectiveStatus === "failed_usdc_retained"
                    ? "bg-red-200 text-red-800"
                    : "bg-stone-200 text-stone-700"
              }`}
            >
              3
            </span>
            <div>
              <h4 className="text-xs font-bold text-stone-900">
                Protocol Swap
              </h4>
            </div>
          </div>
          {step3Active && !step4Active && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
              Processing
            </span>
          )}
          {step4Active && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              ✓ Swapped
            </span>
          )}
          {effectiveStatus === "failed_usdc_retained" && (
            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
              USDC Retained
            </span>
          )}
        </div>

        {isActionable && (
          <button
            onClick={() => navigate("/transactions")}
            className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Open in Transactions</span>
            <span className="material-symbols-outlined text-[15px]">
              arrow_forward
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* COLUMN 1: Funding & Deposit Options */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-on-surface tracking-tight">
                Deposit &amp; Top Up
              </h2>
              <p className="text-xs text-on-surface-variant">
                Instant fiat bank rails
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100/70 text-emerald-800 text-[10px] font-bold">
              0% Fee Rail
            </span>
          </div>

          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-stone-200/90 shadow-sm relative overflow-hidden flex flex-col max-h-[600px]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Pay With Transfer
            </div>
            <h3 className="text-stone-900 font-extrabold text-sm leading-snug mb-4 shrink-0">
              Make A Transfer To Your Dedicated Account
            </h3>

            {dvaLoading ? (
              <div className="py-8 flex justify-center shrink-0">
                <span className="material-symbols-outlined animate-spin text-primary">
                  progress_activity
                </span>
              </div>
            ) : !isVerified ? (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 border-t border-dashed border-stone-200 mt-2 shrink-0">
                <span className="material-symbols-outlined text-[32px] text-stone-300">
                  verified_user
                </span>
                <p className="text-xs text-stone-500 max-w-[200px]">
                  Complete your KYC verification to unlock your dedicated
                  virtual deposit accounts.
                </p>
                <button
                  onClick={() => navigate("/settings?tab=verification")}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Verify Identity
                </button>
              </div>
            ) : virtualAccounts.length > 0 ? (
              <div className="border-t border-dashed border-stone-200 pt-3.5 space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                {virtualAccounts.map((account, index) => (
                  <div
                    key={index}
                    className="bg-stone-50 rounded-2xl p-4 border border-stone-100 shadow-sm"
                  >
                    <div className="flex items-center space-x-2 mb-3 pb-3 border-b border-stone-200/60">
                      <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white font-black text-[12px]">
                        {account.bank_name.charAt(0)}
                      </div>
                      <p className="text-sm font-bold text-stone-900">
                        {account.bank_name}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                          Account Name
                        </p>
                        <p className="text-sm font-bold text-stone-800 mt-0.5">
                          {account.account_name}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                          Account Number
                        </p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-lg font-black font-mono tracking-wider text-stone-900">
                            {account.account_number}
                          </span>
                          <button
                            onClick={() =>
                              handleCopyAccountNumber(account.account_number)
                            }
                            className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-primary-container text-stone-600 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {copiedAccount === account.account_number
                                ? "check"
                                : "content_copy"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {account.instructions && (
                        <div className="mt-2 pt-2 border-t border-stone-200/50 text-[10px] text-stone-500 leading-relaxed font-medium">
                          {account.instructions}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 border-t border-dashed border-stone-200 mt-2 shrink-0">
                <span className="material-symbols-outlined text-[32px] text-stone-300">
                  account_balance_wallet
                </span>
                <p className="text-xs text-stone-500 max-w-[220px]">
                  {dvaError
                    ? "We encountered an issue fetching your virtual accounts at this moment."
                    : "Your dedicated virtual deposit account is currently being provisioned."}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 mt-1"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    refresh
                  </span>
                  Refresh Status
                </button>
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 2: Withdrawal Hub & Multi-Asset Ferrous Wallet */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
                Withdrawal Hub
              </h2>
              <p className="text-xs text-stone-500">
                Liquidity reserves &amp; balances
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1c1b18] via-[#161513] to-[#25231f] text-white rounded-3xl p-5 border border-stone-800 shadow-xl relative overflow-hidden">
            <div className="absolute -right-2 -bottom-4 font-black text-6xl text-stone-800/40 select-none pointer-events-none tracking-tighter">
              FERROUS
            </div>
            <div className="relative z-10 space-y-4">
              <div>
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Ferrous Wallet
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 bg-white/10 px-2 py-0.5 rounded-full">
                    {portfolio.holdings.length + 1}{" "}
                    {portfolio.holdings.length === 0 ? "Asset" : "Assets"}
                  </span>
                </div>
                <p className="text-2xl font-extrabold tracking-tight text-white">
                  {formatFiat(displayWalletTotal, currency)}
                </p>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <div className="min-w-0">
                    <p className="font-bold text-white">NGN Cash</p>
                    <p className="text-[10px] text-stone-400 font-mono">
                      {formatTokenQuantity(portfolio.ngnBalance)} NGN
                    </p>
                  </div>
                  <span className="font-extrabold text-white shrink-0 pl-2">
                    {formatFiat(displayNgnCash, currency)}
                  </span>
                </div>

                {portfolio.holdings.map((holding: PortfolioHolding) => {
                  const holdingFiat =
                    currency === "NGN" ? holding.ngnValue : holding.usdValue;

                  return (
                    <div
                      key={holding.id}
                      className="flex items-center justify-between gap-2 text-xs bg-white/5 rounded-xl px-3 py-2 border border-white/5"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">
                          {holding.name}
                        </p>
                        <p className="text-[10px] text-stone-400 font-mono">
                          {formatTokenQuantity(holding.tokenBalance)}{" "}
                          {holding.symbol}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 pl-2">
                        <span className="font-extrabold text-amber-200">
                          {holding.hasValuation
                            ? formatFiat(holdingFiat, currency)
                            : `${formatTokenQuantity(holding.tokenBalance)} ${holding.symbol}`}
                        </span>
                        {holding.asset && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/earn?tab=sell&asset=${encodeURIComponent(holding.id)}`,
                                {
                                  state: { tab: "sell", assetId: holding.id },
                                },
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/30 text-[10px] font-bold text-amber-200 transition-colors cursor-pointer"
                          >
                            Redeem / Sell
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative">
            {!isVerified && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] rounded-3xl border border-stone-200">
                <div className="bg-white px-5 py-3 rounded-2xl shadow-lg border border-red-100 flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-red-500 text-2xl">
                    lock
                  </span>
                  <p className="text-sm font-bold text-stone-900">
                    Withdrawals Locked
                  </p>
                  <p className="text-xs text-stone-500">
                    Complete KYC to unlock.
                  </p>
                </div>
              </div>
            )}

            <div
              className={`bg-surface-container-lowest rounded-3xl p-5 border-2 border-primary/40 shadow-sm space-y-4 transition-all duration-300 ${!isVerified ? "opacity-50 pointer-events-none select-none" : ""}`}
            >
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs font-bold text-stone-600">
                    Withdraw to Bank
                  </p>
                  <button
                    onClick={() => navigate("/settings?tab=payouts")}
                    className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                  >
                    Add Account
                  </button>
                </div>
                {isBanksLoading ? (
                  <div className="w-full bg-stone-50 rounded-2xl border border-stone-200 p-3 text-sm text-stone-500 animate-pulse">
                    Loading saved banks...
                  </div>
                ) : savedBanks.length > 0 ? (
                  <select
                    value={effectiveSelectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full bg-stone-50 rounded-2xl border border-stone-200 p-3 text-sm font-bold text-stone-900 outline-none focus:border-primary cursor-pointer"
                  >
                    {savedBanks.map((bank: SavedBank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.bank_name} • {bank.account_number}{" "}
                        {bank.alias ? `(${bank.alias})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-red-50 rounded-2xl border border-red-100 p-3 text-xs text-red-700 font-semibold flex items-center justify-between">
                    No linked accounts found.
                    <button
                      onClick={() => navigate("/settings?tab=payouts")}
                      className="bg-red-100 hover:bg-red-200 px-2 py-1 rounded text-red-800 cursor-pointer transition-colors"
                    >
                      Add One
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs font-bold text-stone-600">Amount</p>
                  <span className="text-[10px] text-amber-600 font-semibold">
                    Available: ₦
                    {rawNgnBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center bg-stone-50 rounded-2xl border border-stone-200 px-3.5 py-2.5 focus-within:border-primary">
                  <span className="text-sm font-bold text-stone-400 mr-1.5">
                    ₦
                  </span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-transparent font-extrabold text-xl text-stone-900 outline-none"
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => setWithdrawAmount(rawNgnBalance.toString())}
                    className="text-[10px] font-bold uppercase bg-stone-200 hover:bg-stone-300 text-stone-700 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {feedbackMessage && (
                <p
                  className={`text-xs font-medium ${feedbackMessage.includes("successfully") ? "text-emerald-600" : "text-error"}`}
                >
                  {feedbackMessage}
                </p>
              )}

              <button
                onClick={handleWithdrawal}
                disabled={!isButtonActive || withdrawalMutation.isPending}
                className={`w-full py-3 px-4 rounded-2xl font-extrabold text-xs tracking-wide shadow-sm transition-all flex items-center justify-center space-x-2 
                  ${
                    isButtonActive
                      ? "bg-primary hover:bg-primary-container text-on-primary-container cursor-pointer active:scale-[0.99]"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed shadow-none"
                  }
                `}
              >
                {withdrawalMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed with withdrawal</span>
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* COLUMN 3: Automated Payment Pipeline */}
        <section className="space-y-5 md:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
                Processing Pipeline
              </h2>
              <p className="text-xs text-stone-500">
                Activity status &amp; execution
              </p>
            </div>
            {latestTx && isTransactionSuccess(effectiveStatus) && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-primary text-on-primary-container shadow-sm">
                Complete{" "}
                <span className="material-symbols-outlined text-[14px] ml-1">
                  check
                </span>
              </span>
            )}
            {latestTx && isTransactionFailed(effectiveStatus) && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-700 shadow-sm">
                {latestStatusMeta.label}
              </span>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-stone-200/90 shadow-sm space-y-4">
            {latestTx ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100">
                  <div className="flex items-center space-x-3">
                    <span className="font-extrabold text-xs text-stone-900 capitalize">
                      {(txType || "Transaction").replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="font-extrabold font-mono text-base text-stone-900">
                    {Number(latestTx.amount || 0).toLocaleString()}{" "}
                    {latestTx.currency}
                  </span>
                </div>

                {renderPipelineSteps()}

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px]">
                  <span className="text-stone-400 font-mono">
                    ID: {latestTx.id.split("-")[0]}...
                  </span>
                  <span className="text-stone-500 font-medium">
                    {new Date(latestTx.created_at).toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-stone-500 text-xs">
                No active pipeline operations.
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
