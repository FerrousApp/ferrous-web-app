// src/lib/axios.ts
import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import type { ErrorResponse } from "../types/auth";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (
  error: AxiosError | null,
  token: string | null = null,
) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const parseBackendErrorMessage = (error: AxiosError): string => {
  const payload = error.response?.data as
    | (Partial<ErrorResponse> & {
        message?: string;
        error?: string | { message?: string };
      })
    | undefined;

  if (payload?.error) {
    if (typeof payload.error === "string") return payload.error;
    if (typeof payload.error === "object" && payload.error.message) {
      return payload.error.message;
    }
  }

  if (payload?.message) return payload.message;

  return error.message;
};

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as { success?: boolean };
    if (data && data.success !== undefined) {
      return response.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const errorMessage = parseBackendErrorMessage(error);

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { user, refreshToken, updateTokens, clearSession } =
        useAuthStore.getState();
      const userId = user?.id;

      if (!refreshToken || !userId) {
        processQueue(error, null);
        clearSession();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await axios.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string };
        }>(
          `${apiClient.defaults.baseURL}/auth/refresh-token`,
          { userId, refreshToken },
          { withCredentials: true },
        );

        const { accessToken: newAccess, refreshToken: newRefresh } =
          refreshResponse.data.data;

        updateTokens(newAccess, newRefresh);
        processQueue(null, newAccess);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError: unknown) {
        const axiosRefreshError = refreshError as AxiosError;
        processQueue(axiosRefreshError, null);

        if (
          axiosRefreshError.response?.status === 400 ||
          axiosRefreshError.response?.status === 401
        ) {
          clearSession();
          window.location.href = "/login";
        }
        return Promise.reject(axiosRefreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(new Error(errorMessage));
  },
);
