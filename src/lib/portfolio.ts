// src/lib/portfolio.ts
import type { Asset } from "../types/dashboard";

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  provider: string;
  apyPercent: string | null;
  tokenBalance: number;
  usdValue: number;
  ngnValue: number;
  hasValuation: boolean;
  asset: Asset | null;
}

export interface PortfolioSummary {
  ngnBalance: number;
  holdings: PortfolioHolding[];
  assetsNgnTotal: number;
  assetsUsdTotal: number;
  totalNgnValue: number;
  totalUsdValue: number;
  effectiveSellRate: number;
}

const USD_PEGGED_FALLBACK_KEYS = new Set(["USDC", "USDT", "USD"]);

export const formatTokenQuantity = (amount: number): string =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

export const buildPortfolioSummary = (
  balances: Record<string, number> | undefined,
  marketAssets: Asset[] | undefined,
  sellRate: number,
  globalRate: number,
): PortfolioSummary => {
  const effectiveSellRate =
    sellRate > 0 ? sellRate : globalRate > 0 ? globalRate : 1600;

  const ngnBalance = parseFloat(String(balances?.NGN ?? "0")) || 0;

  const assetMap = new Map<string, Asset>();
  if (Array.isArray(marketAssets)) {
    for (const asset of marketAssets) {
      assetMap.set(asset.id, asset);
    }
  }

  const holdings: PortfolioHolding[] = [];

  if (balances) {
    for (const [key, rawValue] of Object.entries(balances)) {
      if (key === "NGN") continue;

      const tokenBalance = parseFloat(String(rawValue ?? "0")) || 0;
      if (tokenBalance <= 0) continue;

      const matchedAsset = assetMap.get(key) ?? null;

      if (matchedAsset) {
        const unitPriceUsd =
          parseFloat(String(matchedAsset.live_pricing?.cost_in_usd ?? "0")) ||
          0;
        const usdValue = tokenBalance * unitPriceUsd;
        const ngnValue = usdValue * effectiveSellRate;
        const apyPercent = matchedAsset.live_pricing
          ? (matchedAsset.live_pricing.annualized_yield_bps / 100).toFixed(2)
          : null;

        holdings.push({
          id: key,
          symbol: matchedAsset.symbol || key,
          name: matchedAsset.name || key,
          provider: matchedAsset.provider || "Protocol",
          apyPercent,
          tokenBalance,
          usdValue,
          ngnValue,
          hasValuation: unitPriceUsd > 0,
          asset: matchedAsset,
        });
      } else {
        const upperKey = key.toUpperCase();
        const isUsdPegged = USD_PEGGED_FALLBACK_KEYS.has(upperKey);
        const usdValue = isUsdPegged ? tokenBalance : 0;
        const ngnValue = isUsdPegged ? tokenBalance * effectiveSellRate : 0;

        holdings.push({
          id: key,
          symbol: upperKey,
          name: upperKey,
          provider: "Wallet Asset",
          apyPercent: null,
          tokenBalance,
          usdValue,
          ngnValue,
          hasValuation: isUsdPegged,
          asset: null,
        });
      }
    }
  }

  const assetsNgnTotal = holdings.reduce((sum, h) => sum + h.ngnValue, 0);
  const assetsUsdTotal = holdings.reduce((sum, h) => sum + h.usdValue, 0);
  const totalNgnValue = ngnBalance + assetsNgnTotal;
  const totalUsdValue = ngnBalance / effectiveSellRate + assetsUsdTotal;

  return {
    ngnBalance,
    holdings,
    assetsNgnTotal,
    assetsUsdTotal,
    totalNgnValue,
    totalUsdValue,
    effectiveSellRate,
  };
};
