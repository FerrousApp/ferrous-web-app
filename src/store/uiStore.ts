// src/store/uiStore.ts
import { create } from "zustand";

interface ExchangeRatesUpdate {
  global?: number;
  buy?: number;
  sell?: number;
}

interface UIState {
  currency: "NGN" | "USD";
  exchangeRate: number; // global_usd_ngn_rate (matches buy rate)
  buyRate: number; // global_usd_ngn_buy_rate (for buy/investment estimates)
  sellRate: number; // global_usd_ngn_sell_rate (for sell/liquidation estimates)
  setCurrency: (currency: "NGN" | "USD") => void;
  toggleCurrency: (currency: "NGN" | "USD") => void;
  setExchangeRate: (rate: number) => void;
  setExchangeRates: (rates: ExchangeRatesUpdate) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currency: "NGN",
  exchangeRate: 0,
  buyRate: 0,
  sellRate: 0,
  setCurrency: (currency) => set({ currency }),
  toggleCurrency: (currency) => set({ currency }),
  setExchangeRate: (exchangeRate) =>
    set((state) => ({
      exchangeRate,
      buyRate: state.buyRate > 0 ? state.buyRate : exchangeRate,
    })),
  setExchangeRates: ({ global, buy, sell }) =>
    set((state) => {
      const nextBuy =
        typeof buy === "number" && buy > 0
          ? buy
          : typeof global === "number" && global > 0
            ? global
            : state.buyRate;
      const nextGlobal =
        typeof global === "number" && global > 0
          ? global
          : nextBuy > 0
            ? nextBuy
            : state.exchangeRate;
      const nextSell =
        typeof sell === "number" && sell > 0 ? sell : state.sellRate;

      return {
        exchangeRate: nextGlobal,
        buyRate: nextBuy,
        sellRate: nextSell,
      };
    }),
}));
