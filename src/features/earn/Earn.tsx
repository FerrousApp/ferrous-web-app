// src/features/earn/Earn.tsx
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEarnAssets,
  useExecuteInvestment,
  useExecuteSwap,
  useLiquidationQuote,
  useExecuteLiquidation,
} from "../../services/earn.service";
import {
  fetchTransactions,
  useWalletBalances,
} from "../../services/dashboard.service";
import { useProfile, useOnboardUser } from "../../services/settings.service";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { formatTokenQuantity } from "../../lib/portfolio";
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

type TradeMode = "buy" | "sell";

interface EarnLocationState {
  tab?: TradeMode;
  assetId?: string;
}

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

type LiquidationModalPhase =
  | "swapping"
  | "offramping"
  | "complete"
  | "timeout"
  | "failed"
  | "usdc_retained";

interface LiquidationModalState {
  open: boolean;
  phase: LiquidationModalPhase;
  assetName: string;
  assetSymbol: string;
  amountInAsset: number;
  estimatedNgnPayout: string;
  transactionId: string | null;
  finalNgnPayout: number | null;
  swapTxHash: string;
  usdcTransferHash: string;
  error: string | null;
}

const INITIAL_LIQUIDATION_MODAL: LiquidationModalState = {
  open: false,
  phase: "swapping",
  assetName: "",
  assetSymbol: "",
  amountInAsset: 0,
  estimatedNgnPayout: "",
  transactionId: null,
  finalNgnPayout: null,
  swapTxHash: "",
  usdcTransferHash: "",
  error: null,
};

const POLL_INTERVAL_MS = 3500;
const POLL_TIMEOUT_MS = 150000;

const SELL_PERCENT_CHIPS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "Max", value: 1 },
] as const;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export function Earn() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const routeState = (location.state as EarnLocationState | null) ?? null;
  const searchParams = new URLSearchParams(location.search);
  const initialTabParam = searchParams.get("tab");
  const initialAssetParam = searchParams.get("asset");

  const { data: assets, isLoading: isAssetsLoading } = useEarnAssets();
  const { data: balances } = useWalletBalances();
  const { data: userProfile, isLoading: isProfileLoading } = useProfile();
  const executeInvestmentMutation = useExecuteInvestment();
  const executeSwapMutation = useExecuteSwap();
  const executeLiquidationMutation = useExecuteLiquidation();
  const onboardMutation = useOnboardUser();
  const { currency, exchangeRate, buyRate, sellRate } = useUIStore();
  const { user } = useAuthStore();

  const [tradeMode, setTradeMode] = useState<TradeMode>(() =>
    initialTabParam === "sell" || routeState?.tab === "sell" ? "sell" : "buy",
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    () => initialAssetParam || routeState?.assetId || null,
  );

  // Buy state
  const [investmentAmount, setInvestmentAmount] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sell / Liquidation state
  const [sellAmount, setSellAmount] = useState<string>("");
  const [sellErrorMessage, setSellErrorMessage] = useState<string | null>(null);

  // Vault Activation & Terms Dialog State
  const [showVaultModal, setShowVaultModal] = useState<boolean>(false);
  const [termsConsentChecked, setTermsConsentChecked] =
    useState<boolean>(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [pendingInvestment, setPendingInvestment] =
    useState<InvestmentExecutePayload | null>(null);

  // Buy Execution Progress Modal State
  const [execModal, setExecModal] = useState<ExecutionModalState>(
    INITIAL_EXECUTION_MODAL,
  );

  // Sell / Liquidation Progress Modal State
  const [liqModal, setLiqModal] = useState<LiquidationModalState>(
    INITIAL_LIQUIDATION_MODAL,
  );

  const pollSessionRef = useRef<number>(0);
  const liqPollSessionRef = useRef<number>(0);
  const stage2TriggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      pollSessionRef.current += 1;
      liqPollSessionRef.current += 1;
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
  const effectiveSellRate = sellRate > 0 ? sellRate : effectiveBuyRate;

  const getMinDepositNgn = (asset: EarnAsset): number =>
    asset.minimum_deposit_ngn ??
    Math.ceil((asset.minimum_deposit_usd || 0) * effectiveBuyRate);

  const formatMinDeposit = (asset: EarnAsset): string => {
    if (currency === "NGN") {
      return `₦${getMinDepositNgn(asset).toLocaleString()}`;
    }
    return `$${(asset.minimum_deposit_usd || 0).toLocaleString()}`;
  };

  // Buy validation
  const amountNum = parseFloat(investmentAmount);
  const isInputValid = !isNaN(amountNum) && amountNum > 0;
  const isBuyButtonActive = isVerified && isInputValid;

  // Sell validation & debounced live quote
  const availableAssetBalance = activeAsset
    ? parseFloat(String(balances?.[activeAsset.id] ?? "0")) || 0
    : 0;
  const sellAmountNum = parseFloat(sellAmount);
  const isSellInputPositive =
    Number.isFinite(sellAmountNum) && sellAmountNum > 0;
  const exceedsAvailableBalance =
    isSellInputPositive && sellAmountNum > availableAssetBalance;
  const shouldFetchLiquidationQuote =
    tradeMode === "sell" &&
    isVerified &&
    Boolean(activeAsset?.id) &&
    isSellInputPositive &&
    !exceedsAvailableBalance;

  const {
    data: liquidationQuote,
    isFetching: isQuoteFetching,
    isDebouncing: isQuoteDebouncing,
    error: liquidationQuoteError,
  } = useLiquidationQuote(
    activeAsset?.id,
    shouldFetchLiquidationQuote ? sellAmountNum : 0,
    shouldFetchLiquidationQuote,
    500,
  );

  const isSellButtonActive =
    isVerified &&
    isSellInputPositive &&
    !exceedsAvailableBalance &&
    !isQuoteDebouncing &&
    !isQuoteFetching &&
    !liquidationQuoteError &&
    Boolean(liquidationQuote?.quote) &&
    !executeLiquidationMutation.isPending &&
    !liqModal.open;

  const handleSelectSellPercent = (pct: number) => {
    setSellErrorMessage(null);
    if (availableAssetBalance <= 0) return;

    if (pct >= 1) {
      setSellAmount(String(availableAssetBalance));
      return;
    }

    const decimals = Math.min(activeAsset?.decimals || 6, 6);
    const computed = parseFloat(
      (availableAssetBalance * pct).toFixed(decimals),
    );
    const clamped = Math.min(computed, availableAssetBalance);
    setSellAmount(clamped > 0 ? String(clamped) : "");
  };

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

  const pollLiquidationStatus = async (
    transactionId: string,
    sessionId: number,
  ) => {
    const startedAt = Date.now();

    while (liqPollSessionRef.current === sessionId) {
      try {
        const txResponse = await fetchTransactions(25, 0);
        if (liqPollSessionRef.current !== sessionId) return;

        const tx = txResponse.transactions.find(
          (item) => item.id === transactionId,
        );

        if (tx) {
          const effStatus = getEffectiveStatus(tx);
          const meta = tx.metadata as
            | {
                swap_tx_hash?: string;
                usdc_transfer_hash?: string;
                failure_reason?: string;
              }
            | undefined;

          if (effStatus === "PROCESSING_ON_CHAIN_SWAP") {
            setLiqModal((prev) => ({
              ...prev,
              phase: "swapping",
              swapTxHash: meta?.swap_tx_hash || prev.swapTxHash,
            }));
          } else if (
            effStatus === "AWAITING_BUSHA_DEPOSIT" ||
            effStatus === "PROCESSING_FIAT_PAYOUT"
          ) {
            setLiqModal((prev) => ({
              ...prev,
              phase: "offramping",
              swapTxHash: meta?.swap_tx_hash || prev.swapTxHash,
              usdcTransferHash:
                meta?.usdc_transfer_hash || prev.usdcTransferHash,
            }));
          } else if (isTransactionSuccess(effStatus)) {
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
            if (liqPollSessionRef.current !== sessionId) return;

            const creditedNgn =
              tx.currency === "NGN" ? Number(tx.amount || 0) : null;

            setLiqModal((prev) => ({
              ...prev,
              phase: "complete",
              finalNgnPayout: creditedNgn,
              swapTxHash: meta?.swap_tx_hash || prev.swapTxHash,
              usdcTransferHash:
                meta?.usdc_transfer_hash || prev.usdcTransferHash,
              error: null,
            }));
            setSellAmount("");
            return;
          } else if (effStatus === "failed_usdc_retained") {
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
            if (liqPollSessionRef.current !== sessionId) return;

            setLiqModal((prev) => ({
              ...prev,
              phase: "usdc_retained",
              swapTxHash: meta?.swap_tx_hash || prev.swapTxHash,
              usdcTransferHash:
                meta?.usdc_transfer_hash || prev.usdcTransferHash,
              error:
                meta?.failure_reason ||
                "Your bond was swapped to USDC, but the NGN off-ramp failed. Your USDC is safely retained in your Ferrous Wallet.",
            }));
            setSellAmount("");
            return;
          } else if (isTransactionFailed(effStatus)) {
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
            if (liqPollSessionRef.current !== sessionId) return;

            setLiqModal((prev) => ({
              ...prev,
              phase: "failed",
              error:
                meta?.failure_reason ||
                "On-chain swap failed before completion. Your bond balance has been automatically restored.",
            }));
            return;
          }
        }
      } catch {
        // Ignore transient poll errors and retry on next interval
      }

      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        if (liqPollSessionRef.current !== sessionId) return;
        setLiqModal((prev) => ({
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

  const handleConfirmLiquidation = async () => {
    if (!activeAsset || !isSellButtonActive) return;
    setSellErrorMessage(null);

    try {
      const res = await executeLiquidationMutation.mutateAsync({
        assetId: activeAsset.id,
        amountInAsset: sellAmountNum,
      });

      const sessionId = liqPollSessionRef.current + 1;
      liqPollSessionRef.current = sessionId;

      setLiqModal({
        open: true,
        phase:
          res.status === "AWAITING_BUSHA_DEPOSIT" ? "offramping" : "swapping",
        assetName: activeAsset.name,
        assetSymbol: activeAsset.symbol || activeAsset.name,
        amountInAsset: sellAmountNum,
        estimatedNgnPayout: liquidationQuote?.quote.net_ngn_payout || "",
        transactionId: res.id,
        finalNgnPayout: null,
        swapTxHash: "",
        usdcTransferHash: "",
        error: null,
      });

      void pollLiquidationStatus(res.id, sessionId);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to initiate liquidation.";
      setSellErrorMessage(errorMsg);
    }
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

  const handleCloseLiqModal = () => {
    liqPollSessionRef.current += 1;
    setLiqModal(INITIAL_LIQUIDATION_MODAL);
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

  // Buy modal derived steps
  const step1Done =
    execModal.phase === "securing" ||
    execModal.phase === "complete" ||
    (execModal.phase === "failed" && execModal.canRetrySwap);
  const step2Active = execModal.phase === "securing";
  const step2Done = execModal.phase === "complete";
  const isModalInFlight =
    execModal.phase === "converting" || execModal.phase === "securing";

  // Sell / Liquidation modal derived steps
  const liqStep1Done =
    liqModal.phase === "offramping" ||
    liqModal.phase === "complete" ||
    liqModal.phase === "usdc_retained";
  const liqStep2Active = liqModal.phase === "offramping";
  const liqStep2Done = liqModal.phase === "complete";
  const isLiqInFlight =
    liqModal.phase === "swapping" || liqModal.phase === "offramping";

  const activeTokenPriceRate =
    tradeMode === "sell" ? effectiveSellRate : effectiveBuyRate;

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
              const heldBalance =
                parseFloat(String(balances?.[asset.id] ?? "0")) || 0;

              return (
                <div
                  key={asset.id}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setErrorMessage(null);
                    setSellErrorMessage(null);
                    setSellAmount("");
                  }}
                  className={`rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950 border ${isSelected ? "ring-2 ring-primary" : "border-amber-600/30"}`}
                >
                  <div className="relative z-10 flex flex-col justify-between h-full min-h-[160px]">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-amber-300 font-bold uppercase">
                          {(asset.symbol || "A").charAt(0)}
                        </div>
                        {heldBalance > 0 && (
                          <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold text-amber-100 font-mono">
                            Held: {formatTokenQuantity(heldBalance)}{" "}
                            {asset.symbol}
                          </span>
                        )}
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
                    ? `₦${(Number(activeAsset.live_pricing?.cost_in_usd || 1) * activeTokenPriceRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
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
                {/* Buy | Sell Toggle */}
                <div className="grid grid-cols-2 bg-stone-100 p-1 rounded-2xl border border-stone-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setTradeMode("buy");
                      setSellErrorMessage(null);
                    }}
                    className={`py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      tradeMode === "buy"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTradeMode("sell");
                      setErrorMessage(null);
                    }}
                    className={`py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      tradeMode === "sell"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Sell / Redeem
                  </button>
                </div>

                {tradeMode === "buy" ? (
                  <>
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
                              activeAsset.live_pricing.annualized_yield_bps /
                              100
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
                        !isBuyButtonActive ||
                        executeInvestmentMutation.isPending ||
                        onboardMutation.isPending ||
                        execModal.open
                      }
                      className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2
                        ${
                          isBuyButtonActive
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
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between min-w-0">
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-stone-900 leading-tight truncate">
                          Redeem {activeAsset.symbol}
                        </h4>
                        <p className="text-[11px] font-medium text-stone-500 truncate">
                          Credits your Ferrous NGN wallet directly
                        </p>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <span className="text-[10px] font-bold uppercase text-stone-400 block">
                          Available
                        </span>
                        <span className="text-xs font-extrabold font-mono text-stone-900">
                          {formatTokenQuantity(availableAssetBalance)}{" "}
                          {activeAsset.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="bg-stone-50 rounded-2xl p-3 border border-stone-100 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-full">
                          <span className="text-[10px] text-stone-400 font-bold uppercase block tracking-wider">
                            Amount ({activeAsset.symbol})
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={sellAmount}
                            onChange={(e) => {
                              setSellErrorMessage(null);
                              setSellAmount(e.target.value);
                            }}
                            disabled={availableAssetBalance <= 0}
                            className="w-full bg-transparent text-xl font-extrabold text-stone-900 outline-none disabled:opacity-50"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {SELL_PERCENT_CHIPS.map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            disabled={availableAssetBalance <= 0}
                            onClick={() => handleSelectSellPercent(chip.value)}
                            className="py-1.5 rounded-xl bg-white hover:bg-stone-200/80 border border-stone-200 text-[11px] font-bold text-stone-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {availableAssetBalance <= 0 && (
                      <div className="p-3 rounded-2xl bg-stone-50 border border-dashed border-stone-200 text-xs text-stone-500 font-medium text-center">
                        You do not currently hold any {activeAsset.symbol} to
                        redeem.
                      </div>
                    )}

                    {exceedsAvailableBalance && (
                      <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold">
                        Amount exceeds your available balance of{" "}
                        {formatTokenQuantity(availableAssetBalance)}{" "}
                        {activeAsset.symbol}.
                      </div>
                    )}

                    {/* Live Liquidation Quote Card */}
                    {shouldFetchLiquidationQuote &&
                      (isQuoteDebouncing || isQuoteFetching) && (
                        <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center gap-2 text-xs font-semibold text-stone-600">
                          <span className="material-symbols-outlined animate-spin text-[16px] text-primary">
                            progress_activity
                          </span>
                          <span>Fetching live liquidation quote...</span>
                        </div>
                      )}

                    {shouldFetchLiquidationQuote &&
                      !isQuoteDebouncing &&
                      !isQuoteFetching &&
                      liquidationQuoteError && (
                        <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold">
                          {liquidationQuoteError instanceof Error
                            ? liquidationQuoteError.message
                            : "Unable to quote liquidation for this amount."}
                        </div>
                      )}

                    {shouldFetchLiquidationQuote &&
                      !isQuoteDebouncing &&
                      !isQuoteFetching &&
                      !liquidationQuoteError &&
                      liquidationQuote?.quote && (
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-stone-500 font-medium">
                              Estimated USDC Recovered
                            </span>
                            <span className="font-bold font-mono text-stone-900">
                              $
                              {Number(
                                liquidationQuote.quote.estimated_usdc_recovered,
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}{" "}
                              USDC
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-stone-500 font-medium">
                              Applied Sell Rate
                            </span>
                            <span className="font-bold font-mono text-stone-900">
                              ₦
                              {Number(
                                liquidationQuote.quote.applied_exchange_rate,
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              / USD
                            </span>
                          </div>

                          <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                            <span className="font-bold text-stone-700">
                              Estimated NGN Payout
                            </span>
                            <span className="text-sm font-black text-emerald-700 font-mono">
                              ₦
                              {Number(
                                liquidationQuote.quote.net_ngn_payout,
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>

                          {liquidationQuote.disclaimer && (
                            <p className="text-[10px] text-stone-400 leading-relaxed pt-1">
                              {liquidationQuote.disclaimer}
                            </p>
                          )}
                        </div>
                      )}

                    {sellErrorMessage && (
                      <div className="text-xs text-error font-medium px-2">
                        {sellErrorMessage}
                      </div>
                    )}

                    <button
                      onClick={handleConfirmLiquidation}
                      disabled={!isSellButtonActive}
                      className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2
                        ${
                          isSellButtonActive
                            ? "bg-stone-900 hover:bg-black text-white active:scale-[0.99] cursor-pointer"
                            : "bg-stone-200 text-stone-400 cursor-not-allowed shadow-none"
                        }
                      `}
                    >
                      {executeLiquidationMutation.isPending ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[18px]">
                            progress_activity
                          </span>
                          <span>Submitting Liquidation...</span>
                        </>
                      ) : (
                        <>
                          <span>Redeem to NGN Wallet</span>
                          <span className="material-symbols-outlined text-[18px]">
                            arrow_forward
                          </span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LIVE SINGLE-CLICK INVESTMENT PROGRESS MODAL (BUY) */}
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

      {/* LIVE LIQUIDATION PROGRESS MODAL (SELL / REDEEM) */}
      {liqModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-stone-100 flex items-start justify-between bg-stone-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    liqModal.phase === "complete"
                      ? "bg-emerald-100 text-emerald-700"
                      : liqModal.phase === "failed" ||
                          liqModal.phase === "usdc_retained"
                        ? "bg-red-100 text-red-700"
                        : "bg-primary/15 text-primary"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] ${isLiqInFlight ? "animate-spin" : ""}`}
                  >
                    {liqModal.phase === "complete"
                      ? "check_circle"
                      : liqModal.phase === "failed"
                        ? "error"
                        : liqModal.phase === "usdc_retained"
                          ? "warning"
                          : liqModal.phase === "timeout"
                            ? "schedule"
                            : "progress_activity"}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">
                    {liqModal.phase === "complete"
                      ? "Liquidation Complete"
                      : liqModal.phase === "usdc_retained"
                        ? "USDC Retained in Wallet"
                        : liqModal.phase === "failed"
                          ? "Liquidation Failed"
                          : liqModal.phase === "timeout"
                            ? "Still Processing"
                            : `Redeeming ${liqModal.assetSymbol}`}
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {formatTokenQuantity(liqModal.amountInAsset)}{" "}
                    {liqModal.assetSymbol} → Ferrous NGN Wallet
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseLiqModal}
                className="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {liqModal.phase === "complete" ? (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Credited to Ferrous NGN Wallet
                    </p>
                    <p className="text-2xl font-black text-emerald-900 font-mono">
                      +₦
                      {(
                        liqModal.finalNgnPayout ??
                        (Number(liqModal.estimatedNgnPayout) || 0)
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>

                  {(liqModal.swapTxHash || liqModal.usdcTransferHash) && (
                    <div className="space-y-2">
                      {liqModal.swapTxHash && (
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                          <span className="font-bold text-stone-500">
                            DEX Swap Proof
                          </span>
                          <a
                            href={`https://solscan.io/tx/${liqModal.swapTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            {liqModal.swapTxHash.substring(0, 12)}...
                            <span className="material-symbols-outlined text-[14px]">
                              open_in_new
                            </span>
                          </a>
                        </div>
                      )}
                      {liqModal.usdcTransferHash && (
                        <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                          <span className="font-bold text-stone-500">
                            USDC Off-Ramp Proof
                          </span>
                          <a
                            href={`https://solscan.io/tx/${liqModal.usdcTransferHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            {liqModal.usdcTransferHash.substring(0, 12)}...
                            <span className="material-symbols-outlined text-[14px]">
                              open_in_new
                            </span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Step 1: PROCESSING_ON_CHAIN_SWAP */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      liqStep1Done
                        ? "bg-emerald-50/60 border-emerald-200"
                        : liqModal.phase === "failed"
                          ? "bg-red-50/50 border-red-200"
                          : "bg-amber-50/60 border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                          liqStep1Done
                            ? "bg-emerald-600 text-white"
                            : liqModal.phase === "failed"
                              ? "bg-red-200 text-red-800"
                              : "bg-amber-400 text-stone-950 animate-pulse"
                        }`}
                      >
                        {liqStep1Done ? "✓" : "1"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-stone-900">
                          Swapping {liqModal.assetSymbol} to USDC on Solana
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {liqStep1Done
                            ? "On-chain swap confirmed"
                            : "Executing DEX liquidity swap"}
                        </p>
                      </div>
                    </div>
                    {liqModal.phase === "swapping" && (
                      <span className="material-symbols-outlined animate-spin text-[18px] text-amber-600 shrink-0">
                        progress_activity
                      </span>
                    )}
                  </div>

                  {/* Step 2: AWAITING_BUSHA_DEPOSIT */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      liqStep2Done
                        ? "bg-emerald-50/60 border-emerald-200"
                        : liqStep2Active
                          ? "bg-amber-50/60 border-amber-200"
                          : liqModal.phase === "usdc_retained"
                            ? "bg-red-50/50 border-red-200"
                            : "bg-stone-50 border-dashed border-stone-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                          liqStep2Done
                            ? "bg-emerald-600 text-white"
                            : liqStep2Active
                              ? "bg-amber-400 text-stone-950 animate-pulse"
                              : liqModal.phase === "usdc_retained"
                                ? "bg-red-200 text-red-800"
                                : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {liqStep2Done ? "✓" : "2"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-stone-900">
                          Converting USDC to NGN
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {liqStep2Active
                            ? "Crediting your Ferrous NGN wallet"
                            : liqModal.phase === "usdc_retained"
                              ? "Off-ramp failed — USDC retained safely"
                              : "Waiting for Solana swap"}
                        </p>
                      </div>
                    </div>
                    {liqStep2Active && (
                      <span className="material-symbols-outlined animate-spin text-[18px] text-amber-600 shrink-0">
                        progress_activity
                      </span>
                    )}
                  </div>

                  {isLiqInFlight && (
                    <p className="text-[11px] text-stone-500 text-center pt-1">
                      Usually settles in ~10–15 seconds. You can safely close
                      this modal—settlement continues automatically in the
                      background.
                    </p>
                  )}

                  {liqModal.phase === "timeout" && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 leading-relaxed">
                      Settlement is taking slightly longer than usual—you can
                      safely close this window and track progress in your
                      Transactions tab.
                    </div>
                  )}

                  {(liqModal.phase === "failed" ||
                    liqModal.phase === "usdc_retained") &&
                    liqModal.error && (
                      <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 leading-relaxed">
                        {liqModal.error}
                      </div>
                    )}
                </div>
              )}
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center gap-3">
              {liqModal.phase === "complete" ||
              liqModal.phase === "usdc_retained" ? (
                <>
                  <button
                    onClick={handleCloseLiqModal}
                    className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Stay Here
                  </button>
                  <button
                    onClick={() => {
                      handleCloseLiqModal();
                      navigate("/transfers");
                    }}
                    className="flex-1 py-3 bg-primary hover:bg-primary-container text-[#FFFFFF] font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer"
                  >
                    View Ferrous Wallet
                  </button>
                </>
              ) : liqModal.phase === "timeout" ? (
                <>
                  <button
                    onClick={handleCloseLiqModal}
                    className="px-4 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleCloseLiqModal();
                      navigate("/transactions");
                    }}
                    className="flex-1 py-3 bg-stone-900 hover:bg-black text-[#FFFFFF] font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    Go to Transactions
                  </button>
                </>
              ) : liqModal.phase === "failed" ? (
                <button
                  onClick={handleCloseLiqModal}
                  className="w-full py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <button
                  onClick={handleCloseLiqModal}
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
