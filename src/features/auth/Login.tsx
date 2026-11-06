// src/features/auth/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/auth.service";
import { useAuthStore } from "../../store/authStore";
import { AuthLayout } from "../../layouts/AuthLayout";
import type { User } from "../../types/auth";

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const payload = await authService.signInWithGoogle();

      // FIX: Double-cast through 'unknown' to safely bypass the strict overlap check
      const typedPayload = payload as unknown as {
        accessToken: string;
        refreshToken: string;
      } & Record<string, unknown>;
      const { accessToken, refreshToken, ...userData } = typedPayload;

      setSession(userData as unknown as User, accessToken, refreshToken);

      navigate("/", { replace: true });
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Authentication Error:", error);
      setError(error.message || "Failed to securely authenticate with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="relative w-full flex-1 flex flex-col justify-center items-center px-4 py-6 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[340px] h-[240px] bg-gradient-to-b from-primary-container/20 via-primary-fixed/10 to-transparent blur-3xl pointer-events-none rounded-full" />

        <div className="relative z-10 w-full max-w-sm bg-surface-container-lowest rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
          <div className="relative mb-4 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center shadow-sm">
              <img
                alt="Ferrous Vault"
                className="h-8 w-8 object-contain"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVC-rBsga6tqoUqcA9YKdT5Kg-sdPtgKRb0keu_gmW8bCdkjBskytXl2bhYZYHCku7X3d8Q7u3AAMy74_qmYsgheYx2vb1AsNWhoNTjU9wxEaIzU95UWY177nptQYfoAd2WIqSGcfcBQBnqmAxpuPCxezHLHyoQir4XYFSycBg5_yis9GACST12SrkqhVlNXiGNa0b8MeTA8Z3lK41Xp9BMnjOGyyM6UTUR0UAbTQf"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-container flex items-center justify-center shadow-sm">
              <span
                className="material-symbols-outlined text-[12px] text-on-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bolt
              </span>
            </div>
          </div>

          <h1 className="font-headline-lg text-[24px] text-on-surface tracking-tight font-bold">
            Ferrous
          </h1>
          <p className="font-body-sm text-[13px] text-on-surface-variant max-w-[280px] mt-1 mb-6 leading-relaxed">
            Access institutional DeFi yield & auto-cleared dual currency vaults.
          </p>

          {error && (
            <div className="w-full mb-4 px-3 py-2 bg-error-container text-on-error-container rounded-lg text-[12px] font-medium text-left">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className={`w-full min-h-[52px] bg-surface-container-low hover:bg-surface-container active:scale-[0.99] transition-all rounded-full py-3 px-4 flex items-center justify-between shadow-sm group text-left ${isLoading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center flex-shrink-0 shadow-sm">
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[16px] text-primary">
                    progress_activity
                  </span>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.28-2.09 3.66-5.17 3.66-9.14z"
                      fill="#4285F4"
                    ></path>
                    <path
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.36 7.33 24 12 24z"
                      fill="#34A853"
                    ></path>
                    <path
                      d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.24C.45 8.16 0 9.94 0 12s.45 3.84 1.24 5.41l4.04-3.13z"
                      fill="#FBBC05"
                    ></path>
                    <path
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.13c.95-2.83 3.6-4.97 6.72-4.97z"
                      fill="#EA4335"
                    ></path>
                  </svg>
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-label-md text-[14px] text-on-surface font-semibold truncate">
                  {isLoading ? "Authenticating..." : "Continue with Google"}
                </span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface shadow-sm group-hover:bg-primary-container group-hover:text-on-primary-container transition-all flex-shrink-0">
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </div>
          </button>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 mt-5 max-w-sm">
          <div className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-full shadow-sm">
            <div className="flex items-center -space-x-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-700 text-white font-label-sm text-[9px] flex items-center justify-center font-bold">
                ₦
              </span>
              <span className="w-4 h-4 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[9px] flex items-center justify-center font-bold shadow-sm">
                $
              </span>
            </div>
            <span className="font-label-sm text-[11px] text-on-surface font-medium">
              Dual Wallet (NGN/USD)
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-full shadow-sm">
            <span className="material-symbols-outlined text-[14px] text-primary">
              hub
            </span>
            <span className="font-label-sm text-[11px] text-on-surface font-medium">
              Multi-Chain Protocol
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-3 px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-[11px] flex items-center gap-2 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>
            APY:{" "}
            <strong className="text-emerald-700 font-semibold">+14.8%</strong>
          </span>
          <span className="text-outline-variant">•</span>
          <span>
            TVL:{" "}
            <strong className="text-on-surface font-semibold">$12.4M</strong>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
}
