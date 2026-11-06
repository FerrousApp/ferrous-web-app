// src/features/transfers/Transfers.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDepositAccount,
  useWithdrawal,
} from "../../services/transfers.service";
import {
  useWalletBalances,
  useTransactions,
} from "../../services/dashboard.service";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import type { GranularStatus, DvaDetails } from "../../types/transfers";

export function Transfers() {
  const navigate = useNavigate();
  const { currency, exchangeRate } = useUIStore();
  const { user } = useAuthStore();
  const { data: dvaData, isLoading: dvaLoading } = useDepositAccount();
  const { data: balances } = useWalletBalances();

  const { data: txData } = useTransactions(10, 0);
  const withdrawalMutation = useWithdrawal();

  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const rawNgnBalance = parseFloat(balances?.NGN || "0");
  const currentRate = exchangeRate > 0 ? exchangeRate : 1600;
  const displayBalance =
    currency === "NGN" ? rawNgnBalance : rawNgnBalance / currentRate;

  const latestTx = txData?.transactions?.[0];
  const granularStatus = latestTx?.granular_status as
    | GranularStatus
    | undefined;

  const step1Active = [
    "PROCESSING_FIAT_RAMP",
    "PENDING_ON_CHAIN",
    "PROCESSING_ON_CHAIN_SWAP",
    "success",
  ].includes(granularStatus || "");
  const step2Active = [
    "PENDING_ON_CHAIN",
    "PROCESSING_ON_CHAIN_SWAP",
    "success",
  ].includes(granularStatus || "");
  const step3Active = ["PROCESSING_ON_CHAIN_SWAP", "success"].includes(
    granularStatus || "",
  );
  const step4Active = granularStatus === "success";

  const profile = user as Record<string, string | boolean | undefined> | null;
  const isVerified =
    profile?.kyc_status === "verified" || profile?.is_verified === true;

  const amountNum = parseFloat(withdrawAmount);
  const isInputValid = !isNaN(amountNum) && amountNum > 0;
  const isButtonActive = isVerified && isInputValid;

  const handleCopyAccountNumber = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber).then(() => {
      setCopiedAccount(accountNumber);
      setTimeout(() => setCopiedAccount(null), 1800);
    });
  };

  const handleWithdrawal = async () => {
    if (!isVerified) return;
    setFeedbackMessage(null);
    try {
      if (!isInputValid) {
        setFeedbackMessage("Please enter a valid withdrawal amount.");
        return;
      }

      await withdrawalMutation.mutateAsync({
        amountInNgn: amountNum,
        savedBankId: "mock-bank-uuid-1234",
      });

      setFeedbackMessage("Withdrawal request submitted successfully.");
      setWithdrawAmount("");
    } catch (err: unknown) {
      const error = err as Error;
      setFeedbackMessage(error.message || "Failed to process withdrawal.");
    }
  };

  // Extract array using the correct DvaDetails type
  const virtualAccounts: DvaDetails[] =
    dvaData?.dvas || (dvaData?.dva ? [dvaData.dva] : []);

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* COLUMN 1: Funding & Deposit Options */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-on-surface tracking-tight">
                Deposit & Top Up
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
                            className="p-2 rounded-xl bg-white border border-stone-200 hover:bg-primary-container hover:text-on-primary-container hover:border-primary-container text-stone-600 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
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
                  verified_user
                </span>
                <p className="text-xs text-stone-500 max-w-[200px]">
                  Complete your KYC verification to unlock your dedicated
                  virtual deposit accounts.
                </p>
                <button
                  onClick={() => navigate("/settings")}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Verify Identity
                </button>
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 2: Withdrawal Hub & Balances */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
                Withdrawal Hub
              </h2>
              <p className="text-xs text-stone-500">
                Liquidity reserves & balances
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1c1b18] via-[#161513] to-[#25231f] text-white rounded-3xl p-5 border border-stone-800 shadow-xl relative overflow-hidden">
            <div className="absolute -right-2 -bottom-4 font-black text-6xl text-stone-800/40 select-none pointer-events-none tracking-tighter">
              FERROUS
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Ferrous Wallet
                </span>
              </div>
              <p className="text-2xl font-extrabold tracking-tight text-white mb-4">
                {currency === "NGN"
                  ? `₦${displayBalance.toLocaleString()}`
                  : `$${displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
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
              className={`bg-surface-container-lowest rounded-3xl p-5 border-2 border-primary/40 shadow-sm space-y-3 transition-all duration-300 ${!isVerified ? "opacity-50 pointer-events-none select-none" : ""}`}
            >
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-stone-600">
                  I would like to withdraw
                </p>
                <span className="text-[10px] text-amber-600 font-semibold">
                  Available: ₦{rawNgnBalance.toLocaleString()}
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
                  className="text-[10px] font-bold uppercase bg-stone-200 hover:bg-stone-300 text-stone-700 px-2 py-1 rounded-lg cursor-pointer"
                >
                  MAX
                </button>
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
              <p className="text-xs text-stone-500">Atomic swap & execution</p>
            </div>
            {step4Active && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-primary text-on-primary-container shadow-sm">
                Complete{" "}
                <span className="material-symbols-outlined text-[14px] ml-1">
                  check
                </span>
              </span>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-3xl p-5 border border-stone-200/90 shadow-sm space-y-4">
            {latestTx ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100">
                  <div className="flex items-center space-x-3">
                    <span className="font-extrabold text-xs text-stone-900 capitalize">
                      {(latestTx.type || "Transaction").replace("_", " ")}
                    </span>
                  </div>
                  <span className="font-extrabold font-mono text-base text-stone-900">
                    {latestTx.amount?.toLocaleString()} {latestTx.currency}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div
                    className={`p-3.5 rounded-2xl border flex items-center justify-between ${step1Active ? "bg-stone-50 border-stone-200/80" : "bg-transparent border-dashed border-stone-200 opacity-50"}`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center">
                        1
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900">
                          Fiat Ramp
                        </h4>
                      </div>
                    </div>
                    {step1Active && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        ✓ Settled
                      </span>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl border flex items-center justify-between ${step2Active ? "bg-stone-50 border-stone-200/80" : "bg-transparent border-dashed border-stone-200 opacity-50"}`}
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
                    className={`p-3.5 rounded-2xl border flex items-center justify-between ${step3Active ? "bg-amber-50/40 border-amber-200/80" : "bg-transparent border-dashed border-stone-200 opacity-50"}`}
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${step3Active && !step4Active ? "bg-amber-400 text-stone-950 animate-pulse" : "bg-stone-200 text-stone-700"}`}
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
                  </div>
                </div>

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
