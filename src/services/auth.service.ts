// src/services/auth.service.ts
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { apiClient } from "../lib/axios";
import type {
  GoogleSignInPayload,
  AuthSession,
  User,
  SuccessResponse,
} from "../types/auth";

// We omit the token from the payload type here since the service generates it
type SignInOptions = Omit<GoogleSignInPayload, "token">;

export const authService = {
  signInWithGoogle: async (options?: SignInOptions): Promise<AuthSession> => {
    // 1. Trigger Firebase Google Popup
    const userCredential = await signInWithPopup(auth, googleProvider);

    // 2. Extract the strict Firebase ID Token
    const idToken = await userCredential.user.getIdToken(true);

    // 3. Post it to our Ferrous Backend
    const payload: GoogleSignInPayload = {
      token: idToken,
      ...options,
    };

    const response = await apiClient.post<
      SuccessResponse<AuthSession>,
      SuccessResponse<AuthSession>,
      GoogleSignInPayload
    >("/auth/signin", payload);

    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User, User>("/users/me");
    return response;
  },

  signOut: async (userId: string): Promise<void> => {
    // Sign out of Firebase locally, then hit our backend to kill the session
    await auth.signOut();
    await apiClient.post<void, void, { userId: string }>("/auth/signout", {
      userId,
    });
  },
};

// Add this to your existing src/services/auth.service.ts

export const onboardPrivyWallet = async (): Promise<{
  message: string;
  privy_did: string;
}> => {
  const res = await apiClient.post<
    unknown,
    { message: string; privy_did: string }
  >("/users/onboard", {});
  return res;
};

// If using React Query for mutations, you can export this hook:
import { useMutation } from "@tanstack/react-query";
export const usePrivyOnboard = () =>
  useMutation({ mutationFn: onboardPrivyWallet });
