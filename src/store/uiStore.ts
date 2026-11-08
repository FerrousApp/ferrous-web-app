// src/store/uiStore.ts
import { create } from "zustand";

interface UIState {
  currency: "NGN" | "USD";
  exchangeRate: number; // Storing the global NGN-to-USD rate
  setCurrency: (currency: "NGN" | "USD") => void;
  toggleCurrency: (currency: "NGN" | "USD") => void; // Added for DashboardLayout
  setExchangeRate: (rate: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currency: "NGN",
  exchangeRate: 0, // Safe default fallback
  setCurrency: (currency) => set({ currency }),
  toggleCurrency: (currency) => set({ currency }), // Mirrors setCurrency logic
  setExchangeRate: (exchangeRate) => set({ exchangeRate }),
}));
