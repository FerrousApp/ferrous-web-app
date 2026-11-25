// src/features/earn/Earn.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useEarnAssets,
  useExecuteInvestment,
} from "../../services/earn.service";
import { useProfile, useOnboardUser } from "../../services/settings.service";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import type { EarnAsset, InvestmentExecutePayload } from "../../types/earn";
import { DashboardLayout } from "../../layouts/DashboardLayout";

export function Earn() {
  const navigate = useNavigate();
  const { data: assets, isLoading: isAssetsLoading } = useEarnAssets();
  const { data: userProfile, isLoading: isProfileLoading } = useProfile();
  const executeInvestmentMutation = useExecuteInvestment();
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

  const submitInvestment = async (payload: InvestmentExecutePayload) => {
    setErrorMessage(null);
    try {
      await executeInvestmentMutation.mutateAsync(payload);
      navigate("/", { replace: true });
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

    await submitInvestment(payload);
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
        await submitInvestment(payloadToRun);
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
                    onboardMutation.isPending
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
                      <span>Routing Order...</span>
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
                className="flex-1 py-3 bg-primary hover:bg-primary-container text-on-primary-container font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
