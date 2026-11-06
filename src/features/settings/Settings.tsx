// src/features/settings/Settings.tsx
import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import {
  useSubmitKyc,
  useUpdateProfile,
  useProfile,
} from "../../services/settings.service";
import { authService } from "../../services/auth.service";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore"; // FIX: Added useAuthStore import
import type { KycPayload, UpdateProfilePayload } from "../../types/settings";

type TabId = "profile" | "verification" | "referrals";

export function Settings() {
  const { exchangeRate } = useUIStore();
  const { user } = useAuthStore(); // FIX: Extracted user from auth store
  const location = useLocation();

  const getInitialTab = (): TabId => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (
      tabParam === "profile" ||
      tabParam === "verification" ||
      tabParam === "referrals"
    ) {
      return tabParam as TabId;
    }
    return "verification";
  };

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab());

  // Profile State
  const { data: userProfile, isLoading: isProfileLoading } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  const [editedProfile, setEditedProfile] =
    useState<UpdateProfilePayload | null>(null);

  const profile = userProfile as unknown as
    | Record<string, string | undefined>
    | undefined;

  const profileForm: UpdateProfilePayload = editedProfile || {
    first_name: profile?.first_name || profile?.firstName || "",
    last_name: profile?.last_name || profile?.lastName || "",
    phone_number: profile?.phone_number || profile?.phoneNumber || "",
    country_of_origin:
      profile?.country_of_origin || profile?.countryOfOrigin || "",
    date_of_birth: profile?.date_of_birth || profile?.dateOfBirth || "",
  };

  // KYC State Machine
  const [kycStep, setKycStep] = useState<1 | 2 | 3>(1);
  const [kycForm, setKycForm] = useState<KycPayload>({
    first_name: "",
    last_name: "",
    middle_name: "",
    birth_date: "",
    phone: "",
    occupation: "",
    country_id: "NG",
    address: {
      address_line_1: "",
      city: "",
      state: "",
      postal_code: "",
      country_id: "NG",
    },
    bvn: "",
    identifying_information: [
      { type: "national-id", number: "", country: "NG" },
    ],
  });

  // File Upload State
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitKycMutation = useSubmitKyc();

  const isStep1Valid = Boolean(
    kycForm.first_name.trim() &&
    kycForm.last_name.trim() &&
    kycForm.occupation.trim() &&
    kycForm.birth_date &&
    kycForm.phone.trim() &&
    kycForm.bvn.trim().length === 11,
  );

  const handleKycNext = () => {
    if (kycStep === 1 && isStep1Valid) setKycStep(2);
    else if (kycStep === 2) setKycStep(3);
  };

  const handleKycSubmit = async () => {
    if (!selfieFile || !termsAgreed) return;
    try {
      await submitKycMutation.mutateAsync({
        payload: kycForm,
        selfieImage: selfieFile,
      });
    } catch (error) {
      console.error("KYC Submission failed", error);
    }
  };

  const handleProfileUpdate = async () => {
    setProfileFeedback(null);
    try {
      await updateProfileMutation.mutateAsync(profileForm);
      setProfileFeedback("Profile updated successfully.");
    } catch (error) {
      setProfileFeedback("Failed to update profile.");
      console.error("Profile update failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      // FIX: Safely grab the real user ID instead of "current-user-id" without using 'any'
      const userId = user?.id || "current-user-id";

      await authService.signOut(userId);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-start pb-20">
        <section className="md:col-span-4 xl:col-span-3 bg-white/60 backdrop-blur-sm border border-black/5 rounded-3xl p-3 sm:p-4 flex flex-col justify-between shadow-sm min-h-[600px]">
          <div className="space-y-3">
            {[
              { id: "profile" as TabId, label: "Profile", icon: "person" },
              {
                id: "verification" as TabId,
                label: "Account Verification",
                icon: "verified_user",
              },
              {
                id: "referrals" as TabId,
                label: "Referrals",
                icon: "group_add",
                disabled: true,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold text-sm transition group ${
                  tab.disabled
                    ? "opacity-40 blur-[1px] cursor-not-allowed select-none"
                    : "cursor-pointer"
                } ${
                  activeTab === tab.id
                    ? "bg-primary text-on-primary-container shadow-sm"
                    : "bg-stone-200/60 hover:bg-stone-200 text-stone-900"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 ${activeTab === tab.id ? "text-on-primary-container" : "text-stone-900"}`}
                  >
                    {tab.icon}
                  </span>
                  <span className="truncate">{tab.label}</span>
                </div>
                {!tab.disabled && (
                  <span
                    className={`material-symbols-outlined text-[16px] shrink-0 ml-2 ${activeTab === tab.id ? "text-on-primary-container" : "text-stone-900"}`}
                  >
                    chevron_right
                  </span>
                )}
              </button>
            ))}

            <div className="flex flex-col xl:flex-row xl:items-center justify-between px-4 py-3.5 rounded-2xl bg-stone-200/40 text-stone-900 select-none gap-1 xl:gap-3">
              <div className="flex items-center gap-3 shrink-0">
                <span className="material-symbols-outlined text-[20px] text-stone-900">
                  payments
                </span>
                <span className="font-bold text-sm text-stone-900">
                  Transaction Limit
                </span>
              </div>
              <span className="text-xs font-bold text-stone-500 xl:text-right">
                10,000 USD
              </span>
            </div>

            <div className="flex flex-col xl:flex-row xl:items-center justify-between px-4 py-3.5 rounded-2xl bg-stone-200/40 text-stone-900 select-none gap-1 xl:gap-3">
              <div className="flex items-center gap-3 shrink-0">
                <span className="material-symbols-outlined text-[20px] text-stone-900">
                  currency_exchange
                </span>
                <span className="font-bold text-sm text-stone-900">
                  Global Rate
                </span>
              </div>
              <span className="text-xs font-bold text-stone-500 tracking-tight xl:text-right">
                1USD - {exchangeRate.toLocaleString()}N
              </span>
            </div>
          </div>

          <div className="pt-8 mt-auto">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-stone-200/60 hover:bg-stone-200 hover:text-red-600 text-stone-900 font-bold text-sm transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                logout
              </span>
              <span>Log out</span>
            </button>
          </div>
        </section>

        <section className="md:col-span-8 xl:col-span-9 space-y-4">
          {/* --- VERIFICATION TAB (KYC FLOW) --- */}
          {activeTab === "verification" && (
            <div className="max-w-2xl space-y-4">
              <div className="bg-white/80 backdrop-blur-sm border border-black/5 rounded-3xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className="flex items-center gap-2">
                        <div
                          className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${
                            kycStep === step
                              ? "border-2 border-primary bg-amber-50 text-primary shadow-sm"
                              : kycStep > step
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "border border-stone-200 bg-stone-50 text-stone-400"
                          }`}
                        >
                          {kycStep > step ? "✓" : step}
                        </div>
                        {step !== 3 && (
                          <div className="w-4 h-0.5 bg-stone-200"></div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                      Step {kycStep} of 3
                    </span>
                    <p className="text-xs font-semibold text-primary">
                      {kycStep === 1
                        ? "Personal Details"
                        : kycStep === 2
                          ? "Identity Document"
                          : "Confirmation"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container-lowest backdrop-blur-md border border-stone-300/60 rounded-3xl p-6 lg:p-7 shadow-sm space-y-5">
                {kycStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={kycForm.first_name}
                          onChange={(e) =>
                            setKycForm({
                              ...kycForm,
                              first_name: e.target.value,
                            })
                          }
                          className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          placeholder="Joshua"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={kycForm.last_name}
                          onChange={(e) =>
                            setKycForm({
                              ...kycForm,
                              last_name: e.target.value,
                            })
                          }
                          className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          placeholder="JohnJunior"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          Occupation
                        </label>
                        <input
                          type="text"
                          value={kycForm.occupation}
                          onChange={(e) =>
                            setKycForm({
                              ...kycForm,
                              occupation: e.target.value,
                            })
                          }
                          className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          placeholder="Software Engineer"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          BVN (11 Digits)
                        </label>
                        <input
                          type="text"
                          value={kycForm.bvn}
                          maxLength={11}
                          onChange={(e) =>
                            setKycForm({
                              ...kycForm,
                              bvn: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          placeholder="12345678901"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={kycForm.birth_date}
                          onChange={(e) =>
                            setKycForm({
                              ...kycForm,
                              birth_date: e.target.value,
                            })
                          }
                          className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                          Phone
                        </label>
                        <input
                          type="text"
                          value={kycForm.phone}
                          onChange={(e) =>
                            setKycForm({ ...kycForm, phone: e.target.value })
                          }
                          className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          placeholder="+234..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleKycNext}
                      disabled={!isStep1Valid}
                      className="w-full py-3 mt-4 bg-primary hover:bg-primary-container text-on-primary-container font-bold text-sm rounded-2xl shadow-sm transition transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next Step
                    </button>
                  </div>
                )}

                {kycStep === 2 && (
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-stone-300/70">
                      <h3 className="text-base font-extrabold text-stone-900">
                        Identity Verification
                      </h3>
                      <p className="text-xs text-stone-500 mt-1">
                        Provide your NIN and upload a clear selfie photo for
                        biometric matching. No document uploads required.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        NIN Number
                      </label>
                      <input
                        type="text"
                        maxLength={11}
                        value={kycForm.identifying_information[0].number}
                        onChange={(e) => {
                          const newInfo = [...kycForm.identifying_information];
                          newInfo[0].number = e.target.value.replace(/\D/g, "");
                          setKycForm({
                            ...kycForm,
                            identifying_information: newInfo,
                          });
                        }}
                        className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-primary outline-none"
                        placeholder="12345678901"
                      />
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0])
                          setSelfieFile(e.target.files[0]);
                      }}
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 rounded-2xl border-2 border-dashed border-stone-300/80 bg-stone-50/60 text-center space-y-2 cursor-pointer hover:bg-stone-100 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[32px] text-stone-400">
                        add_a_photo
                      </span>
                      <div className="text-xs font-bold text-stone-800">
                        {selfieFile
                          ? selfieFile.name
                          : "Click to Upload Selfie Photo"}
                      </div>
                      <p className="text-[11px] text-stone-500">
                        JPG, PNG or WebP (max 10MB)
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setKycStep(1)}
                        className="px-5 py-3 bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl shadow-sm hover:bg-stone-300 cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleKycNext}
                        disabled={
                          !selfieFile ||
                          kycForm.identifying_information[0].number.length !==
                            11
                        }
                        className="flex-1 py-3 bg-primary hover:bg-primary-container text-on-primary-container font-bold text-sm rounded-2xl shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next Step
                      </button>
                    </div>
                  </div>
                )}

                {kycStep === 3 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-amber-50/80 border border-primary/40 text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined">
                          check_circle
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-stone-900">
                        Ready to Submit Verification
                      </h4>
                      <p className="text-xs text-stone-600">
                        All details have been compiled and encrypted for review
                        by Ferrous Compliance.
                      </p>
                    </div>

                    <div className="pt-2 flex items-start gap-3">
                      <input
                        checked={termsAgreed}
                        onChange={(e) => setTermsAgreed(e.target.checked)}
                        className="mt-1 w-4 h-4 text-primary rounded border-stone-400 focus:ring-primary cursor-pointer"
                        type="checkbox"
                      />
                      <label
                        className="text-xs text-stone-600 leading-relaxed cursor-pointer"
                        onClick={() => setTermsAgreed(!termsAgreed)}
                      >
                        By continuing you agree to have read and understood the{" "}
                        <span className="font-bold text-stone-900 hover:underline">
                          Terms and Conditions
                        </span>{" "}
                        of usage of this app and all it's features.
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setKycStep(2)}
                        className="px-5 py-3 bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl shadow-sm hover:bg-stone-300 cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleKycSubmit}
                        disabled={!termsAgreed || submitKycMutation.isPending}
                        className="flex-1 py-3 bg-primary hover:bg-primary-container text-on-primary-container font-bold text-sm rounded-2xl shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {submitKycMutation.isPending
                          ? "Submitting..."
                          : submitKycMutation.isSuccess
                            ? "KYC Submitted Successfully ✓"
                            : "Submit KYC"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- PROFILE TAB --- */}
          {activeTab === "profile" && (
            <div className="max-w-2xl bg-surface-container-lowest backdrop-blur-md border border-stone-300/60 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
              <div className="pb-3 border-b border-stone-300/70">
                <h3 className="text-lg font-extrabold text-stone-900">
                  Profile Settings
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  Update your basic information.
                </p>
              </div>

              {isProfileLoading ? (
                <div className="py-12 flex justify-center">
                  <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                    progress_activity
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.first_name}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            first_name: e.target.value,
                          })
                        }
                        className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.last_name}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            last_name: e.target.value,
                          })
                        }
                        className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={profileForm.phone_number}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            phone_number: e.target.value,
                          })
                        }
                        className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={profileForm.country_of_origin}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            country_of_origin: e.target.value,
                          })
                        }
                        className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={profileForm.date_of_birth}
                      onChange={(e) =>
                        setEditedProfile({
                          ...profileForm,
                          date_of_birth: e.target.value,
                        })
                      }
                      className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>

                  {profileFeedback && (
                    <p
                      className={`text-xs font-bold ${profileFeedback.includes("success") ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {profileFeedback}
                    </p>
                  )}

                  <div className="pt-2 border-t border-stone-100 flex justify-end">
                    <button
                      onClick={handleProfileUpdate}
                      disabled={updateProfileMutation.isPending}
                      className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-2xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                      {updateProfileMutation.isPending
                        ? "Saving..."
                        : "Save Profile Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- REFERRALS TAB (Blurred Out Shell per instructions) --- */}
          {activeTab === "referrals" && (
            <div className="max-w-2xl bg-white/50 rounded-3xl p-8 border border-stone-200 text-center opacity-40 blur-[2px] select-none pointer-events-none">
              <span className="material-symbols-outlined text-4xl text-stone-400">
                group_add
              </span>
              <h3 className="font-extrabold text-stone-900 mt-2">
                Referrals Coming Soon
              </h3>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
