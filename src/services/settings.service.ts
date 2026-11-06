// src/services/settings.service.ts
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import type { KycPayload, UpdateProfilePayload } from "../types/settings";
import type { User } from "../types/auth";

interface SubmitKycArgs {
  payload: KycPayload;
  selfieImage: File;
}

const settingsApi = {
  // NEW: Add the GET request to fetch the user's current profile
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

  submitKyc: async ({ payload, selfieImage }: SubmitKycArgs) => {
    const formData = new FormData();
    formData.append("selfie_image", selfieImage);
    formData.append("payload", JSON.stringify(payload));

    return await apiClient.post("/kyc/submit", formData);
  },
};

// NEW: Export the hook to read the profile
export const useProfile = () =>
  useQuery({ queryKey: ["user-profile"], queryFn: settingsApi.getProfile });

export const useUpdateProfile = () =>
  useMutation({ mutationFn: settingsApi.updateProfile });

export const useSubmitKyc = () =>
  useMutation({ mutationFn: settingsApi.submitKyc });
