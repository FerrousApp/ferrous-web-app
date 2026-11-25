// src/services/settings.service.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import { useAuthStore } from "../store/authStore";
import type { KycPayload, UpdateProfilePayload } from "../types/settings";
import type { User } from "../types/auth";

interface SubmitKycArgs {
  payload: KycPayload;
  selfieImage: File;
}

export interface OnboardResponse {
  message: string;
  privy_did: string;
}

const settingsApi = {
  getProfile: async (): Promise<User> => {
    const res = await apiClient.get<unknown, unknown>("/users/me");
    const root = res as Record<string, unknown>;
    return (root?.data || root) as User;
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<User> => {
    const res = await apiClient.patch<unknown, unknown>("/users/me", payload);
    const root = res as Record<string, unknown>;
    return (root?.data || root) as User;
  },

  onboardUser: async (): Promise<OnboardResponse> => {
    const res = await apiClient.post<unknown, unknown>("/users/onboard");
    const root = res as Record<string, unknown>;
    const level1 = (root?.data as Record<string, unknown> | undefined) ?? root;
    const level2 =
      (level1?.data as Record<string, unknown> | undefined) ?? level1;

    const privyDid =
      (typeof level2?.privy_did === "string" && level2.privy_did) ||
      (typeof level1?.privy_did === "string" && level1.privy_did) ||
      (typeof root?.privy_did === "string" && root.privy_did) ||
      "";

    const message =
      (typeof level2?.message === "string" && level2.message) ||
      (typeof level1?.message === "string" && level1.message) ||
      "Identity and vault successfully established";

    return {
      message,
      privy_did: privyDid,
    };
  },

  submitKyc: async ({ payload, selfieImage }: SubmitKycArgs) => {
    const formData = new FormData();
    formData.append("selfie_image", selfieImage);
    formData.append("payload", JSON.stringify(payload));

    return await apiClient.post("/kyc/submit", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

export const useProfile = () =>
  useQuery({ queryKey: ["user-profile"], queryFn: settingsApi.getProfile });

export const useUpdateProfile = () =>
  useMutation({ mutationFn: settingsApi.updateProfile });

export const useOnboardUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: settingsApi.onboardUser,
    onSuccess: (data) => {
      const { user, updateUser } = useAuthStore.getState();
      if (user) {
        updateUser({
          ...user,
          privy_did: data.privy_did,
          has_consented_to_terms: true,
        });
      }

      queryClient.setQueryData<User | undefined>(["user-profile"], (prev) =>
        prev
          ? {
              ...prev,
              privy_did: data.privy_did,
              has_consented_to_terms: true,
            }
          : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
};

export const useSubmitKyc = () =>
  useMutation({ mutationFn: settingsApi.submitKyc });
