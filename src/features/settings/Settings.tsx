// src/features/settings/Settings.tsx
import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import imageCompression from "browser-image-compression";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import {
  useSubmitKyc,
  useUpdateProfile,
  useProfile,
} from "../../services/settings.service";
import { authService } from "../../services/auth.service";
import { useUIStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import type { KycPayload, UpdateProfilePayload } from "../../types/settings";

type TabId = "profile" | "verification" | "referrals";

const COMMON_OCCUPATIONS = [
  "Accountant",
  "Actor",
  "Architect",
  "Artist",
  "Business Analyst",
  "Business Owner",
  "Carpenter",
  "Chef",
  "Civil Engineer",
  "Consultant",
  "Content Creator",
  "Customer Service",
  "Data Analyst",
  "Data Scientist",
  "Dentist",
  "Designer",
  "Digital Marketer",
  "Doctor",
  "Economist",
  "Electrician",
  "Entrepreneur",
  "Event Planner",
  "Financial Advisor",
  "Financial Analyst",
  "Firefighter",
  "Freelancer",
  "Graphic Designer",
  "Human Resources",
  "Investment Banker",
  "Journalist",
  "Lawyer",
  "Logistics Manager",
  "Marketing Specialist",
  "Mechanic",
  "Mechanical Engineer",
  "Musician",
  "Nurse",
  "Operations Manager",
  "Pharmacist",
  "Photographer",
  "Pilot",
  "Plumber",
  "Police Officer",
  "Product Manager",
  "Project Manager",
  "Psychologist",
  "Real Estate Agent",
  "Researcher",
  "Retail Manager",
  "Sales Representative",
  "Social Media Manager",
  "Software Engineer",
  "Student",
  "Teacher / Educator",
  "Trader",
  "UI/UX Designer",
  "Veterinarian",
  "Videographer",
  "Web Developer",
  "Writer",
];

export function Settings() {
  // FIX: Destructure currency out of the UI store
  const { exchangeRate, currency } = useUIStore();
  const { user } = useAuthStore();
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

  // Extract Name from Auth Store for Placeholders
  const fallbackFirstName =
    user?.first_name ||
    user?.firstName ||
    user?.name?.split(" ")[0] ||
    "Paschal";
  const authNameParts = user?.name?.split(" ") || [];
  const fallbackLastName =
    user?.last_name ||
    user?.lastName ||
    (authNameParts.length > 1 ? authNameParts.slice(1).join(" ") : "Ekemere");

  const extractDate = (val?: string) => (val ? val.split("T")[0] : "");

  const profileForm: UpdateProfilePayload = editedProfile || {
    first_name: profile?.first_name || profile?.firstName || fallbackFirstName,
    last_name: profile?.last_name || profile?.lastName || fallbackLastName,
    phone_number: profile?.phone_number || profile?.phoneNumber || "",
    country_of_origin:
      profile?.country_of_origin || profile?.countryOfOrigin || "",
    date_of_birth:
      extractDate(profile?.date_of_birth) ||
      extractDate(profile?.dateOfBirth) ||
      "",
  };

  // KYC State Machine
  const [kycStep, setKycStep] = useState<1 | 2 | 3>(1);
  const [kycError, setKycError] = useState<string | null>(null);

  const [phoneCode, setPhoneCode] = useState("+234");
  const [kycForm, setKycForm] = useState<KycPayload>({
    type: "individual",
    email: user?.email || "",
    first_name: "",
    last_name: "",
    middle_name: "",
    birth_date: "",
    phone: "+234",
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
      { type: "selfie", country: "NG" },
    ],
    has_accepted_terms: false,
  });

  const [showOccDropdown, setShowOccDropdown] = useState(false);
  const filteredOccupations = COMMON_OCCUPATIONS.filter((occ) =>
    occ.toLowerCase().includes(kycForm.occupation.toLowerCase()),
  );

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitKycMutation = useSubmitKyc();

  const isStep1Valid = Boolean(
    kycForm.first_name.trim() &&
    kycForm.last_name.trim() &&
    kycForm.occupation.trim() &&
    kycForm.birth_date &&
    kycForm.phone.trim().length > 7 &&
    kycForm.bvn.trim().length === 11 &&
    kycForm.address.address_line_1.trim() &&
    kycForm.address.city.trim() &&
    kycForm.address.state.trim(),
  );

  const handleKycNext = () => {
    if (kycStep === 1 && isStep1Valid) setKycStep(2);
    else if (kycStep === 2) setKycStep(3);
  };

  const handleKycSubmit = async () => {
    if (!selfieFile || !termsAgreed) return;
    setKycError(null);
    try {
      await submitKycMutation.mutateAsync({
        payload: {
          ...kycForm,
          has_accepted_terms: termsAgreed,
        },
        selfieImage: selfieFile,
      });

      setKycForm({
        type: "individual",
        email: user?.email || "",
        first_name: "",
        last_name: "",
        middle_name: "",
        birth_date: "",
        phone: "+234",
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
          { type: "selfie", country: "NG" },
        ],
        has_accepted_terms: false,
      });
      setSelfieFile(null);
      setTermsAgreed(false);
      setPhoneCode("+234");
    } catch (error) {
      console.error("KYC Submission failed", error);

      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      const errorMsg =
        err?.response?.data?.message || err?.message || JSON.stringify(error);

      if (
        errorMsg.toLowerCase().includes("duplicate") ||
        errorMsg.toLowerCase().includes("exists in busha")
      ) {
        setKycError(
          "This ID is already registered in the compliance network. Please contact support.",
        );
      } else {
        setKycError(
          errorMsg ||
            "An error occurred during verification submission. Please try again.",
        );
      }
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
      const userId = user?.id || "current-user-id";
      await authService.signOut(userId);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const kycStatus =
    profile?.busha_status || profile?.kyc_status || profile?.kycStatus;
  const kycRejectionReason =
    profile?.busha_rejection_reason ||
    profile?.kyc_rejection_reason ||
    "Your verification was unsuccessful. Please review your details and try again.";

  const isProfileLocked = kycStatus === "verified" || kycStatus === "approved";

  // FIX: Dynamic Transaction Limit formatting based on selected currency
  const currentRate = exchangeRate > 0 ? exchangeRate : 1600;
  const baseLimitUsd = 10000;

  const displayLimit =
    kycStatus === "verified"
      ? currency === "NGN"
        ? `₦${(baseLimitUsd * currentRate).toLocaleString()}`
        : `$${baseLimitUsd.toLocaleString()}`
      : currency === "NGN"
        ? "₦0"
        : "$0";

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

            <div className="flex flex-wrap items-center justify-between px-4 py-3.5 rounded-2xl bg-stone-200/40 text-stone-900 select-none gap-2">
              <div className="flex items-center gap-3 shrink-0">
                <span className="material-symbols-outlined text-[20px] text-stone-900">
                  payments
                </span>
                <span className="font-bold text-sm text-stone-900">
                  Transaction Limit
                </span>
              </div>
              <span className="text-xs font-bold text-stone-500 xl:text-right mt-1 xl:mt-0">
                {/* FIX: Render dynamic limit here */}
                {displayLimit}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between px-4 py-3.5 rounded-2xl bg-stone-200/40 text-stone-900 select-none gap-2">
              <div className="flex items-center gap-3 shrink-0">
                <span className="material-symbols-outlined text-[20px] text-stone-900">
                  currency_exchange
                </span>
                <span className="font-bold text-sm text-stone-900">
                  Global Rate
                </span>
              </div>
              <span className="text-xs font-bold text-stone-500 tracking-tight xl:text-right mt-1 xl:mt-0">
                1 USD = ₦{exchangeRate.toLocaleString()}
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
              {kycStatus === "failed" && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-3xl flex items-start gap-3 shadow-sm">
                  <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                    error
                  </span>
                  <div>
                    <h4 className="font-bold text-sm">Verification Failed</h4>
                    <p className="text-xs mt-1 leading-relaxed">
                      {kycRejectionReason}
                    </p>
                  </div>
                </div>
              )}

              {kycStatus === "verified" || kycStatus === "approved" ? (
                <div className="bg-surface-container-lowest backdrop-blur-md border border-emerald-500/30 rounded-3xl p-8 lg:p-12 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 border-4 border-emerald-50 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[40px]">
                      verified_user
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-stone-900 tracking-tight">
                      Identity Verified
                    </h3>
                    <p className="text-sm text-stone-500 mt-2 max-w-md mx-auto leading-relaxed">
                      Your account has been successfully verified. You now have
                      full access to Ferrous DeFi yields and expanded
                      transaction limits.
                    </p>
                  </div>
                </div>
              ) : (
                <>
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
                              placeholder={fallbackFirstName}
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
                              placeholder={fallbackLastName}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative">
                            <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                              Occupation
                            </label>
                            <input
                              type="text"
                              value={kycForm.occupation}
                              onFocus={() => setShowOccDropdown(true)}
                              onBlur={() =>
                                setTimeout(() => setShowOccDropdown(false), 200)
                              }
                              onChange={(e) =>
                                setKycForm({
                                  ...kycForm,
                                  occupation: e.target.value,
                                })
                              }
                              className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                              placeholder="Select or enter occupation"
                            />

                            {showOccDropdown && (
                              <div className="absolute z-50 w-full mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto py-2">
                                {filteredOccupations.length > 0 ? (
                                  filteredOccupations.map((occ) => (
                                    <div
                                      key={occ}
                                      onClick={() => {
                                        setKycForm({
                                          ...kycForm,
                                          occupation: occ,
                                        });
                                        setShowOccDropdown(false);
                                      }}
                                      className="px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-100 hover:text-primary cursor-pointer transition-colors"
                                    >
                                      {occ}
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-xs font-bold text-stone-500">
                                    Use "{kycForm.occupation}"
                                  </div>
                                )}
                              </div>
                            )}
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
                              Phone Number
                            </label>
                            <div className="flex items-center bg-stone-50 rounded-2xl border border-stone-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden">
                              <select
                                value={phoneCode}
                                onChange={(e) => {
                                  const newCode = e.target.value;
                                  setPhoneCode(newCode);

                                  const localPart = kycForm.phone.startsWith(
                                    phoneCode,
                                  )
                                    ? kycForm.phone.slice(phoneCode.length)
                                    : kycForm.phone.replace(/^\+\d+/, "");

                                  setKycForm({
                                    ...kycForm,
                                    phone: `${newCode}${localPart}`,
                                  });
                                }}
                                className="bg-stone-100 text-stone-600 font-bold text-xs p-3 outline-none border-r border-stone-200 cursor-pointer appearance-none"
                              >
                                <option value="+234">🇳🇬 +234</option>
                                <option value="+1">🇺🇸 +1</option>
                                <option value="+44">🇬🇧 +44</option>
                                <option value="+233">🇬🇭 +233</option>
                                <option value="+254">🇰🇪 +254</option>
                                <option value="+27">🇿🇦 +27</option>
                              </select>
                              <input
                                type="tel"
                                value={
                                  kycForm.phone.startsWith(phoneCode)
                                    ? kycForm.phone.slice(phoneCode.length)
                                    : ""
                                }
                                onChange={(e) => {
                                  const cleanedLocal = e.target.value.replace(
                                    /\D/g,
                                    "",
                                  );
                                  setKycForm({
                                    ...kycForm,
                                    phone: `${phoneCode}${cleanedLocal}`,
                                  });
                                }}
                                className="w-full text-sm font-extrabold text-stone-900 p-3 bg-transparent outline-none"
                                placeholder="801 234 5678"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-stone-200/60 mt-4">
                          <h4 className="text-[11px] font-bold text-stone-500 uppercase mb-3">
                            Residential Address
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                                Street Address
                              </label>
                              <input
                                type="text"
                                value={kycForm.address.address_line_1}
                                onChange={(e) =>
                                  setKycForm({
                                    ...kycForm,
                                    address: {
                                      ...kycForm.address,
                                      address_line_1: e.target.value,
                                    },
                                  })
                                }
                                className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                placeholder="123 Example Street"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                                  City
                                </label>
                                <input
                                  type="text"
                                  value={kycForm.address.city}
                                  onChange={(e) =>
                                    setKycForm({
                                      ...kycForm,
                                      address: {
                                        ...kycForm.address,
                                        city: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                  placeholder="Lagos"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                                  State
                                </label>
                                <input
                                  type="text"
                                  value={kycForm.address.state}
                                  onChange={(e) =>
                                    setKycForm({
                                      ...kycForm,
                                      address: {
                                        ...kycForm.address,
                                        state: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 bg-stone-50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                  placeholder="Lagos"
                                />
                              </div>
                            </div>
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
                            value={
                              kycForm.identifying_information[0].type ===
                              "national-id"
                                ? kycForm.identifying_information[0].number
                                : ""
                            }
                            onChange={(e) => {
                              const newInfo = [
                                ...kycForm.identifying_information,
                              ];
                              const firstItem = newInfo[0];

                              if (firstItem.type === "national-id") {
                                firstItem.number = e.target.value.replace(
                                  /\D/g,
                                  "",
                                );
                              }

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
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              setIsCompressing(true);
                              try {
                                const file = e.target.files[0];
                                const compressedFile = await imageCompression(
                                  file,
                                  {
                                    maxSizeMB: 2.8,
                                    maxWidthOrHeight: 1920,
                                    useWebWorker: true,
                                  },
                                );
                                setSelfieFile(compressedFile);
                              } catch (error) {
                                console.error(
                                  "Image compression failed",
                                  error,
                                );
                                setSelfieFile(e.target.files[0]);
                              } finally {
                                setIsCompressing(false);
                              }
                            }
                          }}
                        />

                        <div
                          onClick={() =>
                            !isCompressing && fileInputRef.current?.click()
                          }
                          className={`p-6 rounded-2xl border-2 border-dashed ${isCompressing ? "border-primary/50 bg-primary/5" : "border-stone-300/80 bg-stone-50/60 hover:bg-stone-100"} text-center space-y-2 cursor-pointer transition-colors`}
                        >
                          {isCompressing ? (
                            <span className="material-symbols-outlined text-[32px] text-primary animate-spin">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[32px] text-stone-400">
                              add_a_photo
                            </span>
                          )}
                          <div className="text-xs font-bold text-stone-800">
                            {isCompressing
                              ? "Compressing Image..."
                              : selfieFile
                                ? selfieFile.name
                                : "Click to Upload Selfie Photo"}
                          </div>
                          <p className="text-[11px] text-stone-500">
                            Will be automatically compressed under 3MB
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
                              isCompressing ||
                              (kycForm.identifying_information[0].type ===
                                "national-id" &&
                                kycForm.identifying_information[0].number
                                  .length !== 11)
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
                            All details have been compiled and encrypted for
                            review by Ferrous Compliance.
                          </p>
                        </div>

                        {kycError && (
                          <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-xs border border-red-200 mt-2 text-center font-semibold">
                            {kycError}
                          </div>
                        )}

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
                            By continuing you agree to have read and understood
                            the{" "}
                            <span className="font-bold text-stone-900 hover:underline">
                              Terms and Conditions
                            </span>{" "}
                            of usage of this app and all it's features.
                          </label>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <button
                            onClick={() => setKycStep(2)}
                            disabled={submitKycMutation.isPending}
                            className="px-5 py-3 bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl shadow-sm hover:bg-stone-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Back
                          </button>

                          <button
                            onClick={handleKycSubmit}
                            disabled={
                              !termsAgreed || submitKycMutation.isPending
                            }
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-container text-on-primary-container font-bold text-sm rounded-2xl shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {submitKycMutation.isPending ? (
                              <>
                                <span className="material-symbols-outlined animate-spin text-[18px]">
                                  progress_activity
                                </span>
                                Submitting...
                              </>
                            ) : submitKycMutation.isSuccess ? (
                              "KYC Submitted Successfully ✓"
                            ) : (
                              "Submit KYC"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* --- PROFILE TAB --- */}
          {activeTab === "profile" && (
            <div className="max-w-2xl bg-surface-container-lowest backdrop-blur-md border border-stone-300/60 rounded-3xl p-6 lg:p-7 shadow-sm space-y-6">
              <div className="pb-3 border-b border-stone-300/70 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-stone-900">
                    Profile Settings
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    {isProfileLocked
                      ? "Your identity is verified. Basic information cannot be changed."
                      : "Update your basic information."}
                  </p>
                </div>
                {isProfileLocked && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-[12px]">
                      lock
                    </span>
                    Verified
                  </span>
                )}
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
                        disabled={isProfileLocked}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            first_name: e.target.value,
                          })
                        }
                        className={`w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ${isProfileLocked ? "bg-stone-100 cursor-not-allowed opacity-70" : "bg-stone-50"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.last_name}
                        disabled={isProfileLocked}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            last_name: e.target.value,
                          })
                        }
                        className={`w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ${isProfileLocked ? "bg-stone-100 cursor-not-allowed opacity-70" : "bg-stone-50"}`}
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
                        disabled={isProfileLocked}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            phone_number: e.target.value,
                          })
                        }
                        className={`w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ${isProfileLocked ? "bg-stone-100 cursor-not-allowed opacity-70" : "bg-stone-50"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={profileForm.country_of_origin}
                        disabled={isProfileLocked}
                        onChange={(e) =>
                          setEditedProfile({
                            ...profileForm,
                            country_of_origin: e.target.value,
                          })
                        }
                        className={`w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ${isProfileLocked ? "bg-stone-100 cursor-not-allowed opacity-70" : "bg-stone-50"}`}
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
                      disabled={isProfileLocked}
                      onChange={(e) =>
                        setEditedProfile({
                          ...profileForm,
                          date_of_birth: e.target.value,
                        })
                      }
                      className={`w-full text-sm font-extrabold text-stone-900 p-3 rounded-2xl border border-stone-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ${isProfileLocked ? "bg-stone-100 cursor-not-allowed opacity-70" : "bg-stone-50"}`}
                    />
                  </div>

                  {profileFeedback && (
                    <p
                      className={`text-xs font-bold ${profileFeedback.includes("success") ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {profileFeedback}
                    </p>
                  )}

                  {!isProfileLocked && (
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
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- REFERRALS TAB --- */}
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
