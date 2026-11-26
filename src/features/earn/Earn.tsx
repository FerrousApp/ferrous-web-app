// src/features/earn/Earn.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEarnAssets,
  useExecuteInvestment,
  useExecuteSwap,
} from "../../services/earn.service";
import { fetchTransactions } from "../../services/dashboard.service";
import { useProfile, useOnboardUser } from "../../services/settings.service";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import {
  getEffectiveStatus,
  isTransactionFailed,
  isTransactionSuccess,
} from "../../lib/transactionStatus";
import type {
  EarnAsset,
  ExecuteSwapResponse,
  InvestmentExecutePayload,
} from "../../types/earn";
import { DashboardLayout } from "../../layouts/DashboardLayout";

type ExecutionModalPhase =
  | "converting"
  | "securing"
  | "complete"
  | "timeout"
  | "failed";

interface ExecutionModalState {
  open: boolean;
  phase: ExecutionModalPhase;
  assetName: string;
  assetSymbol: string;
  amountInNgn: number;
  transactionId: string | null;
  liveStatus: string;
  result: ExecuteSwapResponse | null;
  error: string | null;
  canRetrySwap: boolean;
}

const INITIAL_EXECUTION_MODAL: ExecutionModalState = {
  open: false,
  phase: "converting",
  assetName: "",
  assetSymbol: "",
  amountInNgn: 0,
  transactionId: null,
  liveStatus: "PROCESSING_FIAT_RAMP",
  result: null,
  error: null,
  canRetrySwap: false,
};

const POLL_INTERVAL_MS = 3500;
const POLL_TIMEOUT_MS = 150000; // 2.5 minutes

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export function Earn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: assets, isLoading: isAssetsLoading } = useEarnAssets();
  const { data: userProfile, isLoading: isProfileLoading } = useProfile();
  const executeInvestmentMutation = useExecuteInvestment();
  const executeSwapMutation = useExecuteSwap();
  const onboardMutation = useOnboardUser();
  const { currency, exchangeRate, buyRate } = useUIStore();
  const { user } = useAuthStore();

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Vault Activation & Terms Dialog State
  const [showVaultModal, setShowVaultModal] = useState<boolean>(false);
  const [termsConsentChecked, setTermsConsentChecked] =
    useState<boolean>(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [pendingInvestment, setPendingInvestment] =
    useState<InvestmentExecutePayload | null>(null);

  // Single-Click Execution Progress Modal State
  const [execModal, setExecModal] = useState<ExecutionModalState>(
    INITIAL_EXECUTION_MODAL,
  );

  // Refs to guarantee polling cleanup and prevent Stage 2 double-firing
  const pollSessionRef = useRef<number>(0);
  const stage2TriggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      pollSessionRef.current += 1;
    };
  }, []);

  const activeAsset: EarnAsset | undefined =
    assets?.find((a) => a.id === selectedAssetId) || assets?.[0];

  const storeProfile = user as unknown as Record<
    string,
    string | boolean | null | undefined
  > | null;
  const liveProfile = userProfile as unknown as Record<
    string,
    string | boolean | null | undefined
  > | null;

  const isVerified =
    liveProfile?.busha_status === "verified" ||
    storeProfile?.busha_status === "verified" ||
    liveProfile?.kyc_status === "verified" ||
    storeProfile?.kyc_status === "verified" ||
    liveProfile?.is_verified === true ||
    storeProfile?.is_verified === true;

  const hasPrivyDid = Boolean(
    (typeof liveProfile?.privy_did === "string" &&
      liveProfile.privy_did.trim()) ||
    (typeof storeProfile?.privy_did === "string" &&
      storeProfile.privy_did.trim()),
  );

  const effectiveBuyRate =
    buyRate > 0 ? buyRate : exchangeRate > 0 ? exchangeRate : 1600;

  const getMinDepositNgn = (asset: EarnAsset): number =>
    asset.minimum_deposit_ngn ??
    Math.ceil((asset.minimum_deposit_usd || 0) * effectiveBuyRate);

  const formatMinDeposit = (asset: EarnAsset): string => {
    if (currency === "NGN") {
      return `₦${getMinDepositNgn(asset).toLocaleString()}`;
    }
    return `$${(asset.minimum_deposit_usd || 0).toLocaleString()}`;
  };

  const amountNum = parseFloat(investmentAmount);
  const isInputValid = !isNaN(amountNum) && amountNum > 0;
  const isButtonActive = isVerified && isInputValid;

  const openVaultModal = (payload: InvestmentExecutePayload) => {
    setPendingInvestment(payload);
    setTermsConsentChecked(false);
    setOnboardError(null);
    setShowVaultModal(true);
  };

  const runStage2Swap = async (transactionId: string, sessionId: number) => {
    setExecModal((prev) => ({
      ...prev,
      phase: "securing",
      liveStatus: "PENDING_ON_CHAIN",
      error: null,
      canRetrySwap: false,
    }));

    try {
      const swapResult = await executeSwapMutation.mutateAsync(transactionId);
      if (pollSessionRef.current !== sessionId) return;

      setExecModal((prev) => ({
        ...prev,
        phase: "complete",
        liveStatus: "success",
        result: swapResult,
        error: null,
        canRetrySwap: false,
      }));
      setInvestmentAmount("");
    } catch (err: unknown) {
      if (pollSessionRef.current !== sessionId) return;
      const errMsg =
        err instanceof Error
          ? err.message
          : "On-chain swap failed. You can retry now or finalize from Transactions.";
      setExecModal((prev) => ({
        ...prev,
        phase: "failed",
        error: errMsg,
        canRetrySwap: true,
      }));
    }
  };

  const pollAndAutoFinalize = async (
    transactionId: string,
    sessionId: number,
  ) => {
    const startedAt = Date.now();

    while (pollSessionRef.current === sessionId) {
      try {
        const txResponse = await fetchTransactions(25, 0);
        if (pollSessionRef.current !== sessionId) return;

        const tx = txResponse.transactions.find(
          (item) => item.id === transactionId,
        );

        if (tx) {
          const effStatus = getEffectiveStatus(tx);

          if (effStatus === "USDC_DELIVERED") {
            if (!stage2TriggeredRef.current.has(transactionId)) {
              stage2TriggeredRef.current.add(transactionId);
              await runStage2Swap(transactionId, sessionId);
            }
            return;
          }

          if (
            effStatus === "PENDING_ON_CHAIN" ||
            effStatus === "PROCESSING_ON_CHAIN_SWAP"
          ) {
            setExecModal((prev) => ({
              ...prev,
              phase: "securing",
              liveStatus: effStatus,
            }));
          }

          if (isTransactionSuccess(effStatus)) {
            const meta = tx.metadata as
              | { purchased_bond_amount?: string; txHash?: string }
              | undefined;
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["balances"],
                refetchType: "all",
              }),
              queryClient.invalidateQueries({
                queryKey: ["transactions"],
                refetchType: "all",
              }),
            ]);
            if (pollSessionRef.current !== sessionId) return;

            setExecModal((prev) => ({
              ...prev,
              phase: "complete",
              liveStatus: "success",
              result: {
                status: "SUCCESS",
                txHash: meta?.txHash || "",
                bondOutputTokens: meta?.purchased_bond_amount || "",
                message: "Bond asset purchased and secured in your wallet.",
              },
              error: null,
              canRetrySwap: false,
            }));
            setInvestmentAmount("");
            return;
          }

          if (effStatus === "AWAITING_ON_CHAIN_RETRY") {
            setExecModal((prev) => ({
              ...prev,
              phase: "failed",
              liveStatus: effStatus,
              error:
                "On-chain execution needs a retry. Click Retry Swap below or finalize from Transactions.",
              canRetrySwap: true,
            }));
            return;
          }

          if (isTransactionFailed(effStatus)) {
            const meta = tx.metadata as { failure_reason?: string } | undefined;
            setExecModal((prev) => ({
              ...prev,
              phase: "failed",
              liveStatus: effStatus,
              error:
                meta?.failure_reason ||
                "Investment failed during processing. Please check your Transactions tab.",
              canRetrySwap: false,
            }));
            return;
          }
        }
      } catch {
        // Ignore transient poll errors and retry on next interval
      }

      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        if (pollSessionRef.current !== sessionId) return;
        setExecModal((prev) => ({
          ...prev,
          phase: "timeout",
        }));
        return;
      }

      await sleep(POLL_INTERVAL_MS);
    }
  };

  const submitInvestment = async (
    payload: InvestmentExecutePayload,
    asset: EarnAsset,
  ) => {
    setErrorMessage(null);

    try {
      const executeRes = await executeInvestmentMutation.mutateAsync(payload);
      const transactionId = executeRes.transaction.id;
      const initialStatus =
        executeRes.transaction.status || "PROCESSING_FIAT_RAMP";

      const sessionId = pollSessionRef.current + 1;
      pollSessionRef.current = sessionId;

      setExecModal({
        open: true,
        phase:
          initialStatus === "USDC_DELIVERED" ||
          initialStatus === "PENDING_ON_CHAIN"
            ? "securing"
            : "converting",
        assetName: asset.name,
        assetSymbol: asset.symbol || asset.name,
        amountInNgn: payload.amountInNgn,
        transactionId,
        liveStatus: initialStatus,
        result: null,
        error: null,
        canRetrySwap: false,
      });

      if (
        initialStatus === "USDC_DELIVERED" &&
        !stage2TriggeredRef.current.has(transactionId)
      ) {
        stage2TriggeredRef.current.add(transactionId);
        void runStage2Swap(transactionId, sessionId);
        return;
      }

      void pollAndAutoFinalize(transactionId, sessionId);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to execute investment.";

      if (errorMsg.toLowerCase().includes("privy did")) {
        openVaultModal(payload);
        return;
      }

      setErrorMessage(errorMsg);
    }
  };

  const handleSupplyToPool = async () => {
    if (!activeAsset || !isVerified) return;
    setErrorMessage(null);

    if (!isInputValid) {
      setErrorMessage("Please enter a valid investment amount.");
      return;
    }

    const minDepositUsd = activeAsset.minimum_deposit_usd || 0;
    const minDepositNgn = getMinDepositNgn(activeAsset);

    if (currency === "USD" && amountNum < minDepositUsd) {
      setErrorMessage(`Minimum deposit is $${minDepositUsd.toLocaleString()}`);
      return;
    }

    if (currency === "NGN" && amountNum < minDepositNgn) {
      setErrorMessage(`Minimum deposit is ₦${minDepositNgn.toLocaleString()}`);
      return;
    }

    const finalAmountInNgn =
      currency === "USD" ? Math.ceil(amountNum * effectiveBuyRate) : amountNum;

    const payload: InvestmentExecutePayload = {
      assetId: activeAsset.id,
      amountInNgn: finalAmountInNgn,
    };

    if (!hasPrivyDid) {
      openVaultModal(payload);
      return;
    }

    await submitInvestment(payload, activeAsset);
  };

  const handleActivateVault = async () => {
    if (!termsConsentChecked || onboardMutation.isPending) return;
    setOnboardError(null);

    try {
      await onboardMutation.mutateAsync();
      setShowVaultModal(false);

      const payloadToRun = pendingInvestment;
      setPendingInvestment(null);

      if (payloadToRun) {
        const targetAsset =
          assets?.find((a) => a.id === payloadToRun.assetId) || activeAsset;
        if (targetAsset) {
          await submitInvestment(payloadToRun, targetAsset);
        }
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Failed to activate investment vault. Please retry.";
      setOnboardError(errorMsg);
    }
  };

  const handleCloseVaultModal = () => {
    if (onboardMutation.isPending) return;
    setShowVaultModal(false);
    setPendingInvestment(null);
    setOnboardError(null);
  };

  const handleCloseExecModal = () => {
    pollSessionRef.current += 1;
    setExecModal(INITIAL_EXECUTION_MODAL);
  };

  const handleRetrySwapFromModal = async () => {
    if (!execModal.transactionId || executeSwapMutation.isPending) return;
    const sessionId = pollSessionRef.current + 1;
    pollSessionRef.current = sessionId;
    await runStage2Swap(execModal.transactionId, sessionId);
  };

  if (isAssetsLoading || isProfileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      </DashboardLayout>
    );
  }

  const formatMoney = (usdValue: number) => {
    const finalValue =
      currency === "NGN" ? usdValue * effectiveBuyRate : usdValue;
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(finalValue);
  };

  const formatCompactMoney = (usdValue: number) => {
    const finalValue =
      currency === "NGN" ? usdValue * effectiveBuyRate : usdValue;
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(finalValue);
  };

  const step1Done =
    execModal.phase === "securing" ||
    execModal.phase === "complete" ||
    (execModal.phase === "failed" && execModal.canRetrySwap);
  const step2Active = execModal.phase === "securing";
  const step2Done = execModal.phase === "complete";
  const isModalInFlight =
    execModal.phase === "converting" || execModal.phase === "securing";

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Yield Marketplace */}
        <div className="xl:col-span-7 flex flex-col gap-5">
          <div className="bg-surface-container-low rounded-3xl p-5 border border-stone-200/50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-on-surface tracking-tight">
                Money makers
              </h2>
              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Top APY
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {assets?.map((asset: EarnAsset) => {
              const yieldPercent = asset.live_pricing
                ? (asset.live_pricing.annualized_yield_bps / 100).toFixed(2)
                : "0.00";
              const isSelected = activeAsset?.id === asset.id;

              return (
                <div
                  key={asset.id}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setErrorMessage(null);
                  }}
                  className={`rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950 border ${isSelected ? "ring-2 ring-primary" : "border-amber-600/30"}`}
                >
                  <div className="relative z-10 flex flex-col justify-between h-full min-h-[160px]">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-amber-300 font-bold uppercase">
                        {(asset.symbol || "A").charAt(0)}
                      </div>
                      <div className="text-right">
                        <span className="text-xs uppercase tracking-wider text-amber-200/90 font-semibold block">
                          APY Yield
                        </span>
                        <span className="text-3xl font-extrabold text-white tracking-tight">
                          +{yieldPercent}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between mt-6 pt-4 border-t border-white/10">
                      <div className="min-w-0 pr-4">
                        <span className="text-xs text-amber-200/80 font-medium block capitalize truncate">
                          {asset.provider || "Protocol"}
                        </span>
                        <h3 className="text-2xl font-bold tracking-tight truncate">
                          {asset.name}
                        </h3>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-amber-200/80 font-medium block">
                          Min amount
                        </span>
                        <p className="text-xl font-bold tracking-tight text-white">
                          {formatMinDeposit(asset)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Protocol Inspector */}
        {activeAsset && (
          <div className="xl:col-span-5 flex flex-col gap-5 sticky top-24">
            <div className="bg-surface-container-low rounded-3xl p-4 border border-stone-200/50 shadow-sm flex items-center justify-between min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm font-bold uppercase shrink-0">
                  {(activeAsset.symbol || "A").charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-on-surface text-lg leading-tight truncate">
                    {activeAsset.name}
                  </h3>
                  <span className="text-xs text-stone-500 font-medium uppercase truncate block">
                    {activeAsset.chain || "Network"} •{" "}
                    {activeAsset.provider || "Protocol"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-amber-300 shadow-sm min-w-0">
                <span className="text-[11px] font-semibold text-stone-500 block mb-1 truncate">
                  TVL
                </span>
                <p
                  className="text-base sm:text-lg font-black text-stone-900 tracking-tight truncate"
                  title={formatMoney(
                    activeAsset.protocol_details?.tvl_usd || 0,
                  )}
                >
                  {formatCompactMoney(
                    activeAsset.protocol_details?.tvl_usd || 0,
                  )}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-amber-300 shadow-sm min-w-0">
                <span className="text-[11px] font-semibold text-stone-500 block mb-1 truncate">
                  Token Price ({currency})
                </span>
                <p className="text-base sm:text-lg font-black text-stone-900 tracking-tight truncate text-primary">
                  ~
                  {currency === "NGN"
                    ? `₦${(Number(activeAsset.live_pricing?.cost_in_usd || 1) * effectiveBuyRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                    : `$${Number(activeAsset.live_pricing?.cost_in_usd || 1).toFixed(3)}`}
                </p>
              </div>

              <div className="col-span-2 bg-white rounded-2xl p-4 border border-amber-300 shadow-sm min-w-0">
                <span className="text-[11px] font-semibold text-stone-500 block mb-1 truncate">
                  Protocol Fees
                </span>
                <p className="text-base sm:text-lg font-black text-stone-900 tracking-tight truncate">
                  {activeAsset.protocol_details?.fee_bps
                    ? `${activeAsset.protocol_details.fee_bps / 100}%`
                    : "0.5%"}
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low rounded-3xl p-5 border border-stone-200/50 shadow-sm flex flex-col gap-3">
              <p className="text-xs text-stone-600 leading-relaxed">
                {activeAsset.protocol_details?.description ||
                  "Institutional-grade decentralized yield vault optimized for maximum risk-adjusted returns."}
              </p>
            </div>

            <div className="relative">
              {!isVerified && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] rounded-3xl border border-stone-200">
                  <div className="bg-white px-5 py-3 rounded-2xl shadow-lg border border-red-100 flex flex-col items-center gap-1">
                    <span className="material-symbols-outlined text-red-500 text-2xl">
                      verified_user
                    </span>
                    <p className="text-sm font-bold text-stone-900">
                      Verification Required
                    </p>
                    <p className="text-xs text-stone-500">
                      Complete KYC to unlock investing.
                    </p>
                  </div>
                </div>
              )}

              <div
                className={`bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm flex flex-col gap-4 transition-all duration-300 ${!isVerified ? "opacity-50 pointer-events-none select-none" : ""}`}
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-stone-900 leading-tight truncate">
                        {activeAsset.name}
                      </h4>
                      <p className="text-[11px] font-medium text-stone-400 truncate">
                        Min deposit: {formatMinDeposit(activeAsset)}
                      </p>
                    </div>
                  </div>
                  <div className="text-2xl font-black text-stone-900 tracking-tight shrink-0 pl-2">
                    +
                    {activeAsset.live_pricing
                      ? (
                          activeAsset.live_pricing.annualized_yield_bps / 100
                        ).toFixed(2)
                      : "0"}
                    %
                  </div>
                </div>

                <div className="bg-stone-50 rounded-2xl p-3 border border-stone-100 flex items-center justify-between">
                  <div className="w-full">
                    <span className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">
                      Amount ({currency})
                    </span>
                    <input
                      type="number"
                      value={investmentAmount}
                      onChange={(e) => {
                        setErrorMessage(null);
                        setInvestmentAmount(e.target.value);
                      }}
                      className="w-full bg-transparent text-xl font-extrabold text-stone-900 outline-none"
                      placeholder={
                        currency === "NGN"
                          ? String(getMinDepositNgn(activeAsset))
                          : String(activeAsset.minimum_deposit_usd || 10)
                      }
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="text-xs text-error font-medium px-2">
                    {errorMessage}
                  </div>
                )}

                <button
                  onClick={handleSupplyToPool}
                  disabled={
                    !isButtonActive ||
                    executeInvestmentMutation.isPending ||
                    onboardMutation.isPending ||
                    execModal.open
                  }
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2
                    ${
                      isButtonActive
                        ? "bg-primary hover:bg-primary-container text-on-primary-container active:scale-[0.99] cursor-pointer shadow-amber-500/20"
                        : "bg-stone-200 text-stone-400 cursor-not-allowed shadow-none"
                    }
                  `}
                >
                  {executeInvestmentMutation.isPending ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">
                        progress_activity
                      </span>
                      <span>Initiating Order...</span>
                    </>
                  ) : (
                    <>
                      <span>Supply to Pool</span>
                      <span className="material-symbols-outlined text-[18px]">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LIVE SINGLE-CLICK INVESTMENT PROGRESS MODAL */}
      {execModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-stone-100 flex items-start justify-between bg-stone-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    execModal.phase === "complete"
                      ? "bg-emerald-100 text-emerald-700"
                      : execModal.phase === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-primary/15 text-primary"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${isModalInFlight ? "animate-spin" : ""}`}
                  >
                    {execModal.phase === "complete"
                      ? "check_circle"
                      : execModal.phase === "failed"
                        ? "error"
                        : execModal.phase === "timeout"
                          ? "schedule"
                          : "progress_activity"}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">
                    {execModal.phase === "complete"
                      ? "Investment Complete"
                      : execModal.phase === "failed"
                        ? "Execution Interrupted"
                        : execModal.phase === "timeout"
                          ? "Still Converting"
                          : `Investing in ${execModal.assetSymbol}`}
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    ₦{execModal.amountInNgn.toLocaleString()} →{" "}
                    {execModal.assetName}
                  </p>
                </div>
              </div>
              {!isModalInFlight && (
                <button
                  onClick={handleCloseExecModal}
                  className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {execModal.phase === "complete" ? (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Secured in Your Wallet
                    </p>
                    <p className="text-2xl font-black text-emerald-900 font-mono">
                      {execModal.result?.bondOutputTokens
                        ? `${Number(execModal.result.bondOutputTokens).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${execModal.assetSymbol}`
                        : execModal.assetName}
                    </p>
                    {execModal.result?.message && (
                      <p className="text-xs text-emerald-700 pt-1">
                        {execModal.result.message}
                      </p>
                    )}
                  </div>

                  {execModal.result?.txHash && (
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                      <span className="font-bold text-stone-500">
                        Transaction Hash
                      </span>
                      <a
                        href={`https://solscan.io/tx/${execModal.result.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        {execModal.result.txHash.substring(0, 12)}...
                        <span className="material-symbols-outlined text-[14px]">
                          open_in_new
                        </span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Step 1 */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      step1Done
                        ? "bg-emerald-50/60 border-emerald-200"
                        : execModal.phase === "failed"
                          ? "bg-red-50/50 border-red-200"
                          : "bg-amber-50/60 border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                          step1Done
                            ? "bg-emerald-600 text-white"
                            : execModal.phase === "failed"
                              ? "bg-red-200 text-red-800"
                              : "bg-amber-400 text-stone-950 animate-pulse"
                        }`}
                      >
                        {step1Done ? "✓" : "1"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-stone-900">
                          Converting NGN to USDC...
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {step1Done
                            ? "USDC delivered to your vault"
                            : "Processing fiat-to-USDC ramp"}
                        </p>
                      </div>
                    </div>
                    {!step1Done && isModalInFlight && (
                      <span className="material-symbols-outlined animate-spin text-[18px] text-amber-600 shrink-0">
                        progress_activity
                      </span>
                    )}
                  </div>

                  {/* Step 2 */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      step2Done
                        ? "bg-emerald-50/60 border-emerald-200"
                        : step2Active
                          ? "bg-amber-50/60 border-amber-200"
                          : execModal.phase === "failed" &&
                              execModal.canRetrySwap
                            ? "bg-red-50/50 border-red-200"
                            : "bg-stone-50 border-dashed border-stone-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                          step2Done
                            ? "bg-emerald-600 text-white"
                            : step2Active
                              ? "bg-amber-400 text-stone-950 animate-pulse"
                              : execModal.phase === "failed" &&
                                  execModal.canRetrySwap
                                ? "bg-red-200 text-red-800"
                                : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {step2Done ? "✓" : "2"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-stone-900">
                          Securing {execModal.assetSymbol} Bond on-chain...
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {step2Active
                            ? "Authorizing and executing Solana swap"
                            : "Waiting for USDC delivery"}
                        </p>
                      </div>
                    </div>
                    {step2Active && (
                      <span className="material-symbols-outlined animate-spin text-[18px] text-amber-600 shrink-0">
                        progress_activity
                      </span>
                    )}
                  </div>

                  {isModalInFlight && (
                    <p className="text-[11px] text-stone-500 text-center pt-1">
                      Please keep this window open while we complete both steps
                      automatically.
                    </p>
                  )}

                  {execModal.phase === "timeout" && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 leading-relaxed">
                      Conversion is taking a bit longer than usual—you can
                      safely close this window and finalize from your
                      Transactions tab once ready.
                    </div>
                  )}

                  {execModal.phase === "failed" && execModal.error && (
                    <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 leading-relaxed">
                      {execModal.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center gap-3">
              {execModal.phase === "complete" ? (
                <>
                  <button
                    onClick={handleCloseExecModal}
                    className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Stay Here
                  </button>
                  <button
                    onClick={() => {
                      handleCloseExecModal();
                      navigate("/", { replace: true });
                    }}
                    className="flex-1 py-3 bg-primary hover:bg-primary-container text-[#FFFFFF] font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer"
                  >
                    View Portfolio
                  </button>
                </>
              ) : execModal.phase === "timeout" ? (
                <>
                  <button
                    onClick={handleCloseExecModal}
                    className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleCloseExecModal();
                      navigate("/transactions");
                    }}
                    className="flex-1 py-3 bg-stone-900 hover:bg-black text-[#FFFFFF] font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    Go to Transactions
                  </button>
                </>
              ) : execModal.phase === "failed" ? (
                <>
                  <button
                    onClick={handleCloseExecModal}
                    className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  {execModal.canRetrySwap && (
                    <button
                      onClick={handleRetrySwapFromModal}
                      disabled={executeSwapMutation.isPending}
                      className="flex-1 py-3 bg-primary hover:bg-primary-container text-[#FFFFFF] font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      Retry Swap
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={handleCloseExecModal}
                  className="w-full py-2.5 text-stone-500 hover:text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Run in Background
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVATE INVESTMENT VAULT & TERMS DIALOG */}
      {showVaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-stone-100 flex items-start justify-between bg-stone-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    account_balance_wallet
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">
                    Activate Investment Vault &amp; Terms
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    One-time secure on-chain vault setup
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseVaultModal}
                disabled={onboardMutation.isPending}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                Before routing your first investment, Ferrous will provision
                your dedicated embedded on-chain vault to custody tokenized
                yield positions securely in your name.
              </p>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsConsentChecked}
                  disabled={onboardMutation.isPending}
                  onChange={(e) => setTermsConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-primary rounded border-stone-400 focus:ring-primary cursor-pointer"
                />
                <span className="text-xs text-stone-700 leading-relaxed">
                  I agree to the{" "}
                  <span className="font-bold text-stone-900">
                    Terms of Service
                  </span>{" "}
                  and authorize Ferrous to establish my embedded investment
                  vault and execute on-chain allocations on my behalf.
                </span>
              </label>

              {onboardError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
                  {onboardError}
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center gap-3">
              <button
                onClick={handleCloseVaultModal}
                disabled={onboardMutation.isPending}
                className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleActivateVault}
                disabled={!termsConsentChecked || onboardMutation.isPending}
                className="flex-1 py-3 bg-primary hover:bg-primary-container text-[#FFFFFF] font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {onboardMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">
                      progress_activity
                    </span>
                    <span>Activating Vault...</span>
                  </>
                ) : onboardError ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">
                      refresh
                    </span>
                    <span>Retry Activation</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">
                      verified_user
                    </span>
                    <span>Agree &amp; Activate Vault</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
