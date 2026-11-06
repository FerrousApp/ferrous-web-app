// src/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User as BaseUser } from "../types/auth";

// PERMANENT FIX: Explicitly define the optional fields your UI uses.
// This completely eliminates the ESLint warning and provides perfect type safety!
export type User = BaseUser & {
  id: string;
  email?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  name?: string;
  phone_number?: string;
  phoneNumber?: string;
  country_of_origin?: string;
  countryOfOrigin?: string;
  date_of_birth?: string;
  dateOfBirth?: string;
  kyc_status?: string;
  is_verified?: boolean;
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setSession: (user: User, accessToken: string, refreshToken: string) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setSession: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      updateTokens: (accessToken, refreshToken) =>
        set((state) => ({ ...state, accessToken, refreshToken })),

      updateUser: (user) => set((state) => ({ ...state, user })),

      clearSession: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "ferrous-auth-storage",
    },
  ),
);
