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
  reject: (reason?: unknown) => void; // Fixed: changed any to unknown
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

// Request Interceptor
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

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Safely check for success property without implicit any
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

    // Fixed: Cast the backend error strictly to our ErrorResponse type instead of any
    const backendError = error.response?.data as ErrorResponse;
    const errorMessage = backendError?.error?.message || error.message;

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
        // Explicitly defining the expected response types for the refresh call
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
        // Fixed: Catch as unknown, then cast to AxiosError
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
