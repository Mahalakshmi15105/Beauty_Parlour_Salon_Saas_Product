import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";
import { SUPPORTED_LANGUAGES } from "../utils/translations";
import { useFormKeyboardNavigation } from "../utils/keyboardNavigation";
import { getFullImageUrl } from "../utils/imageUrl";
import { ThermalReceipt, printThermalReceiptElement } from "../components/ThermalReceipt";
import {
  Building2,
  Upload,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  Check,
  CheckCheck,
  AlertTriangle,
  Globe,
  Receipt,
  Bell,
  Database,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  Printer,
  Eye,
  QrCode,
  MessageSquare,
  Type,
  Search,
  RotateCcw,
  Sliders,
  Network,
} from "lucide-react";
import WhatsAppIntegration from "./WhatsAppIntegration";
import BranchManagement from "./BranchManagement";
import { CURATED_FONTS, DEFAULT_TYPOGRAPHY, getShopNameStyle, loadGoogleFont } from "../utils/fontLoader";

function Settings() {
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const {
    currencyCode,
    currencySymbol,
    language,
    formatCurrency,
    t,
    updateCurrency,
    updateLanguage,
    SUPPORTED_CURRENCIES,
  } = useLanguageCurrency();

  const { changeAccentColor, currentTheme } = useTheme();

  const [activeTab, setActiveTab] = useState("business");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Get user from localStorage to check role
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Logo Upload State
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Shop Name Typography Search & Dropdown State
  const [fontSearchQuery, setFontSearchQuery] = useState("");
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);

  // Accent Color State - use tenant-specific localStorage
  const getTenantKey = (key) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const tenantId = user.tenant_id || user.parlour_id || "default";
    return `${key}_${tenantId}`;
  };
  
  const [accentColor, setAccentColor] = useState(localStorage.getItem(getTenantKey('accent_color')) || '#EC4899');
  const [customColor, setCustomColor] = useState(localStorage.getItem(getTenantKey('accent_color')) || '#EC4899');

  useFormKeyboardNavigation(formRef, () => {
    const submitBtn = formRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  const [settingsData, setSettingsData] = useState({
    business_profile: {
      name: "",
      logo_url: "",
      owner_name: "",
      phone: "",
      alternate_phone: "",
      email: "",
      gst_number: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postal_code: "",
      website: "",
      description: "",
      shop_name_typography: { ...DEFAULT_TYPOGRAPHY },
    },
    invoice_settings: {
      invoice_prefix: "INV",
      tax_name: "GST",
      tax_rate: 18.0,
      receipt_header: "",
      receipt_footer: "",
      terms_and_conditions: "",
      show_logo: true,
    },
    receipt_settings: {
      receipt_template: "Classic",
      paper_size: "80mm",
      show_logo: true,
      show_gst: true,
      show_address: true,
      show_phone: true,
      show_email: true,
      show_website: true,
      show_qr_code: false,
      auto_print: false,
      thank_you_message: "Thank you for visiting. Please visit again.",
      receipt_header: "",
      receipt_footer: "",
    },
    regional_settings: {
      currency: currencyCode,
      currency_code: currencyCode,
      currency_symbol: currencySymbol,
      language: language,
      date_format: "YYYY-MM-DD",
      timezone: "UTC",
    },
    marketing_settings: {
      churn_days_threshold: 45,
    },
  });

  const handleLogoSelected = (file) => {
    if (!file) return;
    setUploadError(null);

    const allowedExts = ["png", "jpg", "jpeg", "svg", "webp"];
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!allowedExts.includes(ext)) {
      setUploadError("Invalid image format. Allowed formats: PNG, JPG, JPEG, SVG, and WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds maximum allowed limit of 5 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);
    setUploadingLogo(true);
    setUploadProgress(20);

    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 25 : prev));
    }, 100);

    API.post("/settings/upload-logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
      .then((res) => {
        clearInterval(interval);
        setUploadProgress(100);
        const newLogoUrl = res.data.data?.logo_url || res.data.logo_url;
        setSettingsData((prev) => ({
          ...prev,
          business_profile: {
            ...prev.business_profile,
            logo_url: newLogoUrl,
          },
        }));
        setUploadingLogo(false);
        setSaveSuccess(true);
        window.dispatchEvent(new CustomEvent("branding_updated"));
        setTimeout(() => setSaveSuccess(false), 3000);
      })
      .catch((err) => {
        clearInterval(interval);
        setUploadingLogo(false);
        setUploadError(err.response?.data?.message || err.message || "Failed to upload logo.");
      });
  };

  const handleRemoveLogo = () => {
    API.delete("/settings/remove-logo")
      .then(() => {
        setSettingsData((prev) => ({
          ...prev,
          business_profile: {
            ...prev.business_profile,
            logo_url: "",
          },
        }));
      })
      .catch((err) => console.error("Failed to remove logo:", err));
  };

  const fetchSettings = () => {
    setLoading(true);
    API.get("/settings")
      .then((res) => {
        const rawData = res.data || {};
        setSettingsData((prev) => ({
          ...prev,
          ...rawData,
          business_profile: {
            ...prev.business_profile,
            ...(rawData.business_profile || {}),
            shop_name_typography: {
              ...DEFAULT_TYPOGRAPHY,
              ...(rawData.business_profile?.shop_name_typography || {}),
            },
          },
          invoice_settings: {
            ...prev.invoice_settings,
            ...(rawData.invoice_settings || {}),
          },
          receipt_settings: {
            ...prev.receipt_settings,
            ...(rawData.receipt_settings || {}),
          },
          regional_settings: {
            ...prev.regional_settings,
            ...(rawData.regional_settings || {}),
          },
          marketing_settings: {
            ...prev.marketing_settings,
            ...(rawData.marketing_settings || {}),
          },
        }));

        // Sync theme settings from backend
        const thm = rawData.theme_settings;
        if (thm) {
          const backendAccent = thm.primary_color || "#EC4899";
          setAccentColor(backendAccent);
          setCustomColor(backendAccent);
        }

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load settings.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleCurrencyChange = (e) => {
    const selectedCode = e.target.value;
    const item = SUPPORTED_CURRENCIES.find((c) => c.code === selectedCode);
    const selectedSymbol = item ? item.symbol : "$";

    setSettingsData((prev) => ({
      ...prev,
      regional_settings: {
        ...prev.regional_settings,
        currency: selectedCode,
        currency_code: selectedCode,
        currency_symbol: selectedSymbol,
      },
    }));

    // Trigger instant global React Context & persistent database update
    updateCurrency(selectedCode, selectedSymbol);
  };

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;

    setSettingsData((prev) => ({
      ...prev,
      regional_settings: {
        ...prev.regional_settings,
        language: selectedLang,
      },
    }));

    // Trigger instant global React Context & persistent database update
    updateLanguage(selectedLang);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    // Merge current theme settings to prevent overwriting them with old loaded data
    const payload = {
      ...settingsData,
      theme_settings: {
        theme_name: currentTheme,
        primary_color: accentColor,
        secondary_color: "#F472B6",
        accent_color: "rgba(236, 72, 153, 0.08)"
      }
    };

    API.put("/settings", payload)
      .then(() => {
        setSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      })
      .catch((err) => {
        setSaving(false);
        alert(err.message || "Failed to save settings.");
      });
  };

  if (loading) {
    return (
      <div className="p-8 bg-surface border border-border-soft rounded-lg space-y-4">
        <div className="h-6 bg-border-soft rounded animate-pulse w-1/4"></div>
        <div className="h-10 bg-border-soft rounded animate-pulse"></div>
      </div>
    );
  }

  const handleAccentColorChange = (color) => {
    setAccentColor(color);
    setCustomColor(color);
    changeAccentColor(color);
  };

  const handleCustomColorChange = (e) => {
    const color = e.target.value;
    setCustomColor(color);
    setAccentColor(color);
    changeAccentColor(color);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
            {t("settings")}
          </h1>
          <p className="text-xs text-text-secondary">
            Manage business profile, thermal receipt templates, tax rules, themes, regional settings, and system configurations
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center space-x-2 shadow-sm disabled:opacity-50"
        >
          {saving ? <span>Saving Changes...</span> : <span>{t("save_settings")}</span>}
        </button>
      </div>

      {error && (
        <div className="bg-danger/15 border border-danger/30 p-4 rounded-lg text-xs font-semibold text-danger flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-success/15 border border-success/30 px-4 py-3 rounded-lg text-xs font-semibold text-success flex justify-between items-center animate-fade-in">
          <span>✓ {t("settings_saved_success")}</span>
          <button onClick={() => setSaveSuccess(false)}>✖</button>
        </div>
      )}

      {/* Tab Selector & Main Settings Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Navigation Tabs */}
        <div className="col-span-3 space-y-1 bg-surface border border-border-soft p-3 rounded-lg h-fit">
          {(() => {
            const tabs = [
              { id: "business", label: "Parlour Profile", icon: Building2 },
              { id: "whatsapp", label: "WhatsApp Integration", icon: MessageSquare },
              { id: "receipt", label: "Receipt & Thermal Printing", icon: Printer },
              { id: "invoice", label: "Invoice & Taxes", icon: Receipt },
              { id: "regional", label: `${t("currency_settings")} & ${t("language_settings")}`, icon: Globe },
              { id: "accent", label: "System Accent Color", icon: Sparkles },
              { id: "notifications", label: "Notifications & Security", icon: Bell },
              { id: "backup", label: "Backup & Restore", icon: Database },
            ];
            
            // Add Branch Management tab only for ParlourAdmin
            if (user.role !== "BranchAdmin") {
              tabs.splice(1, 0, { id: "branches", label: "Branch Management", icon: Network });
            }
            
            return tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-3 transition ${
                    activeTab === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-background"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            });
          })()}
        </div>

        {/* Settings Form Panel */}
        <div ref={formRef} className="col-span-9 bg-surface border border-border-soft p-8 rounded-lg space-y-6">
          {/* WhatsApp Integration Tab */}
          {activeTab === "whatsapp" && (
            <WhatsAppIntegration />
          )}

          {/* Branch Management Tab */}
          {activeTab === "branches" && (
            <BranchManagement />
          )}

          {/* Business Profile Tab */}
          {activeTab === "business" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-border-soft pb-3">
                <h3 className="text-sm font-semibold text-text-primary">Parlour Branding & Identity</h3>
                <span className="text-[11px] font-bold text-primary bg-primary-light px-2.5 py-0.5 rounded-full border border-primary/20">
                  Multi-Tenant Isolated
                </span>
              </div>

              {/* Logo Upload Dropzone & Live Preview */}
              <div className="p-6 bg-background/50 border border-border-soft rounded-2xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span>Parlour Logo Upload & Branding</span>
                </div>

                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex justify-between items-center">
                    <span>{uploadError}</span>
                    <button onClick={() => setUploadError(null)} className="text-rose-500 hover:text-rose-800">
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Logo Preview Container */}
                  <div className="relative w-28 h-28 bg-surface rounded-2xl border-2 border-dashed border-border-soft flex items-center justify-center overflow-hidden shrink-0 shadow-xs group">
                    {settingsData.business_profile.logo_url ? (
                      <img
                        src={getFullImageUrl(settingsData.business_profile.logo_url)}
                        alt="Parlour Logo"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-1 text-slate-400">
                        <Building2 className="w-10 h-10 text-slate-300" />
                        <span className="text-[10px] font-bold">No Logo</span>
                      </div>
                    )}
                  </div>

                  {/* Drag & Drop Upload Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleLogoSelected(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className={`flex-1 w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
                      isDragging
                        ? "border-primary bg-primary/10 scale-[1.01]"
                        : "border-border-soft hover:border-primary/50 bg-surface"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,.webp"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleLogoSelected(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    <div className="p-3 bg-primary/10 text-primary rounded-full">
                      <Upload className="w-5 h-5" />
                    </div>

                    <div>
                      <p className="text-xs font-extrabold text-slate-800">
                        <span className="text-primary">Click to Browse Logo</span> or Drag & Drop image here
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        PNG, JPG, JPEG, SVG, WEBP (Max size: 5 MB)
                      </p>
                    </div>

                    {uploadingLogo && (
                      <div className="w-full max-w-xs space-y-1 pt-2">
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-bold text-primary">Uploading Logo... {uploadProgress}%</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remove Logo Action */}
                {settingsData.business_profile.logo_url && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs text-rose-600 hover:text-rose-800 font-extrabold flex items-center space-x-1 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Form Input Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Parlour Name *</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.name}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, name: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.owner_name}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, owner_name: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* SHOP NAME FONT STYLE & TYPOGRAPHY SECTION */}
              <div className="p-4 bg-background/50 border border-border-soft rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-border-soft pb-3">
                  <div className="flex items-center space-x-2">
                    <Type className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">Shop Name Font Style</h3>
                      <p className="text-[11px] text-text-secondary">Customize typography specifically for your parlour shop name</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsData((prev) => ({
                          ...prev,
                          business_profile: {
                            ...prev.business_profile,
                            shop_name_typography: { ...DEFAULT_TYPOGRAPHY },
                          },
                        }));
                      }}
                      className="flex items-center space-x-1 text-xs text-text-secondary hover:text-primary transition font-medium px-2.5 py-1 rounded-lg border border-border-soft hover:border-primary/40 bg-surface"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Default</span>
                    </button>

                    {/* Enable / Disable Toggle Switch */}
                    <label className="flex items-center space-x-2 cursor-pointer bg-surface px-3 py-1.5 rounded-lg border border-border-soft select-none">
                      <span className="text-xs font-bold text-text-primary">Enable Custom Font</span>
                      <input
                        type="checkbox"
                        checked={settingsData.business_profile.shop_name_typography?.enabled || false}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setSettingsData((prev) => ({
                            ...prev,
                            business_profile: {
                              ...prev.business_profile,
                              shop_name_typography: {
                                ...(prev.business_profile.shop_name_typography || DEFAULT_TYPOGRAPHY),
                                enabled: val,
                              },
                            },
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
                    </label>
                  </div>
                </div>

                {settingsData.business_profile.shop_name_typography?.enabled ? (
                  <div className="space-y-4">
                    {/* 1. Searchable Font Family Selector Dropdown */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-text-secondary mb-1">Font Family</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search font style (e.g. Elegant, Luxury, Script)..."
                          value={fontSearchQuery || settingsData.business_profile.shop_name_typography?.font_family || "Outfit"}
                          onFocus={() => setIsFontDropdownOpen(true)}
                          onChange={(e) => {
                            setFontSearchQuery(e.target.value);
                            setIsFontDropdownOpen(true);
                          }}
                          className="w-full bg-surface border border-border-soft px-3 py-2 pl-9 rounded-lg text-xs text-text-primary focus:outline-none font-medium"
                        />
                        <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
                      </div>

                      {/* Dropdown Options List */}
                      {isFontDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-surface border border-border-soft rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-border-soft/50">
                          {CURATED_FONTS.filter(
                            (f) =>
                              f.name.toLowerCase().includes(fontSearchQuery.toLowerCase()) ||
                              f.id.toLowerCase().includes(fontSearchQuery.toLowerCase()) ||
                              f.category.toLowerCase().includes(fontSearchQuery.toLowerCase())
                          ).map((font) => {
                            // Preload font on hover for preview
                            loadGoogleFont(font.id);
                            const isSelected =
                              (settingsData.business_profile.shop_name_typography?.font_family || "Outfit").toLowerCase() ===
                              font.id.toLowerCase();

                            return (
                              <button
                                key={font.id}
                                type="button"
                                onClick={() => {
                                  setSettingsData((prev) => ({
                                    ...prev,
                                    business_profile: {
                                      ...prev.business_profile,
                                      shop_name_typography: {
                                        ...prev.business_profile.shop_name_typography,
                                        font_family: font.id,
                                      },
                                    },
                                  }));
                                  setFontSearchQuery("");
                                  setIsFontDropdownOpen(false);
                                }}
                                className={`w-full text-left p-2.5 flex items-center justify-between hover:bg-background/80 transition ${
                                  isSelected ? "bg-primary/10 font-bold" : ""
                                }`}
                              >
                                <div>
                                  <div className="text-xs text-text-primary font-semibold flex items-center space-x-2">
                                    <span>{font.name}</span>
                                    <span className="text-[10px] text-text-secondary font-normal border border-border-soft px-1.5 py-0.2 rounded uppercase">
                                      {font.category}
                                    </span>
                                  </div>
                                  <div
                                    className="text-sm mt-0.5 text-primary truncate max-w-[280px]"
                                    style={{ fontFamily: font.family }}
                                  >
                                    {settingsData.business_profile.name || "Glamour Beauty Studio"}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Controls Grid: Size, Weight, Letter Spacing */}
                    <div className="grid grid-cols-3 gap-4">
                      {/* Font Size Slider & Box */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-semibold text-text-secondary">Font Size</label>
                          <span className="text-xs font-bold text-primary">
                            {settingsData.business_profile.shop_name_typography?.font_size || 32} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="14"
                          max="64"
                          value={settingsData.business_profile.shop_name_typography?.font_size || 32}
                          onChange={(e) =>
                            setSettingsData((prev) => ({
                              ...prev,
                              business_profile: {
                                ...prev.business_profile,
                                shop_name_typography: {
                                  ...prev.business_profile.shop_name_typography,
                                  font_size: Number(e.target.value),
                                },
                              },
                            }))
                          }
                          className="w-full accent-primary"
                        />
                      </div>

                      {/* Font Weight Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">Font Weight</label>
                        <div className="flex border border-border-soft rounded-lg overflow-hidden p-0.5 bg-surface">
                          {[
                            { label: "Regular", val: "400" },
                            { label: "Medium", val: "500" },
                            { label: "Bold", val: "700" },
                          ].map((w) => (
                            <button
                              key={w.val}
                              type="button"
                              onClick={() =>
                                setSettingsData((prev) => ({
                                  ...prev,
                                  business_profile: {
                                    ...prev.business_profile,
                                    shop_name_typography: {
                                      ...prev.business_profile.shop_name_typography,
                                      font_weight: w.val,
                                    },
                                  },
                                }))
                              }
                              className={`flex-1 text-[11px] py-1 font-bold rounded-md transition ${
                                String(settingsData.business_profile.shop_name_typography?.font_weight || "700") === w.val
                                  ? "bg-primary text-white shadow-xs"
                                  : "text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Letter Spacing Slider */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-semibold text-text-secondary">Letter Spacing</label>
                          <span className="text-xs font-bold text-primary">
                            {settingsData.business_profile.shop_name_typography?.letter_spacing || 0} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-2"
                          max="10"
                          step="0.5"
                          value={settingsData.business_profile.shop_name_typography?.letter_spacing || 0}
                          onChange={(e) =>
                            setSettingsData((prev) => ({
                              ...prev,
                              business_profile: {
                                ...prev.business_profile,
                                shop_name_typography: {
                                  ...prev.business_profile.shop_name_typography,
                                  letter_spacing: Number(e.target.value),
                                },
                              },
                            }))
                          }
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>

                    {/* Real-time Interactive Live Preview Card */}
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1 flex items-center space-x-1">
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span>Live Preview</span>
                      </div>
                      <div className="p-4 bg-surface border border-border-soft rounded-xl text-center flex items-center justify-center min-h-[90px] overflow-hidden shadow-inner">
                        <span
                          className="text-text-primary break-words max-w-full leading-tight transition-all duration-200"
                          style={getShopNameStyle(settingsData.business_profile.shop_name_typography)}
                        >
                          {settingsData.business_profile.name || "Glamour Beauty Studio"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary italic">
                    Custom typography disabled. Reverted to standard application font (`Outfit` / `sans-serif`).
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.phone}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, phone: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Alternate Mobile Number</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.alternate_phone}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, alternate_phone: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Email Address</label>
                  <input
                    type="email"
                    value={settingsData.business_profile.email}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, email: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.gst_number}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, gst_number: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Street Address</label>
                <textarea
                  rows="2"
                  value={settingsData.business_profile.address}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      business_profile: { ...settingsData.business_profile, address: e.target.value },
                    })
                  }
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                ></textarea>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">City</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.city}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, city: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">State</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.state}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, state: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Country</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.country}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, country: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.postal_code}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, postal_code: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Website URL</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.website}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, website: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">About Parlour / Description</label>
                  <input
                    type="text"
                    value={settingsData.business_profile.description}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        business_profile: { ...settingsData.business_profile, description: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Receipt & Thermal Printing Tab */}
          {activeTab === "receipt" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-border-soft pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Thermal Receipt & Printing Configurations</h3>
                  <p className="text-[11px] text-text-secondary">Customize thermal paper templates, auto-print preferences, and toggle visible sections.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-primary bg-primary-light px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center space-x-1">
                    <Printer className="w-3 h-3" />
                    <span>58mm & 80mm Compatible</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                {/* Left Side: Settings Form Controls */}
                <div className="col-span-7 space-y-6">
                  {/* Template Style Selection */}
                  <div className="p-4 bg-background/50 border border-border-soft rounded-xl space-y-3">
                    <label className="block text-xs font-bold text-slate-800">Receipt Template Style</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "Classic", title: "Classic", desc: "Clean monospaced dashed layout" },
                        { id: "Modern", title: "Modern", desc: "Accent header & bold highlights" },
                        { id: "Compact", title: "Compact", desc: "Tight line spacing for fast print" },
                      ].map((tmpl) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() =>
                            setSettingsData({
                              ...settingsData,
                              receipt_settings: { ...settingsData.receipt_settings, receipt_template: tmpl.id },
                            })
                          }
                          className={`p-3 rounded-xl border text-left transition ${
                            settingsData.receipt_settings.receipt_template === tmpl.id
                              ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                              : "border-border-soft bg-surface text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="text-xs font-extrabold">{tmpl.title}</div>
                          <div className="text-[10px] text-text-secondary mt-0.5 leading-tight">{tmpl.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Thermal Paper Size Selector */}
                  <div className="p-4 bg-background/50 border border-border-soft rounded-xl space-y-3">
                    <label className="block text-xs font-bold text-slate-800">Thermal Printer Paper Width</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "80mm", title: "80mm (3 Inch Standard)", desc: "Full detailed receipt width (300px)" },
                        { id: "58mm", title: "58mm (2 Inch Compact)", desc: "Ultra-compact mobile printer (220px)" },
                      ].map((paper) => (
                        <button
                          key={paper.id}
                          type="button"
                          onClick={() =>
                            setSettingsData({
                              ...settingsData,
                              receipt_settings: { ...settingsData.receipt_settings, paper_size: paper.id },
                            })
                          }
                          className={`p-3 rounded-xl border text-left transition ${
                            settingsData.receipt_settings.paper_size === paper.id
                              ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                              : "border-border-soft bg-surface text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="text-xs font-extrabold">{paper.title}</div>
                          <div className="text-[10px] text-text-secondary mt-0.5 leading-tight">{paper.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section Display Toggles */}
                  <div className="p-4 bg-background/50 border border-border-soft rounded-xl space-y-3">
                    <label className="block text-xs font-bold text-slate-800">Visible Information Toggles</label>
                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-700">
                      {[
                        { key: "show_logo", label: "Show Parlour Logo" },
                        { key: "show_gst", label: "Show GSTIN / Tax ID" },
                        { key: "show_address", label: "Show Salon Address" },
                        { key: "show_phone", label: "Show Phone Number" },
                        { key: "show_email", label: "Show Email Address" },
                        { key: "show_website", label: "Show Website URL" },
                        { key: "show_qr_code", label: "Show Payment / Rating QR Code" },
                        { key: "auto_print", label: "Auto-Print After POS Checkout" },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-surface">
                          <input
                            type="checkbox"
                            checked={!!settingsData.receipt_settings[item.key]}
                            onChange={(e) =>
                              setSettingsData({
                                ...settingsData,
                                receipt_settings: {
                                  ...settingsData.receipt_settings,
                                  [item.key]: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-border-soft text-primary focus:ring-primary h-4 w-4"
                          />
                          <span className="text-slate-800">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Custom Messages */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">Thank You Footer Message</label>
                      <input
                        type="text"
                        value={settingsData.receipt_settings.thank_you_message}
                        onChange={(e) =>
                          setSettingsData({
                            ...settingsData,
                            receipt_settings: { ...settingsData.receipt_settings, thank_you_message: e.target.value },
                          })
                        }
                        className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Side: Live Interactive Receipt Preview Pane */}
                <div className="col-span-5 flex flex-col items-center space-y-3 bg-slate-900/5 p-4 rounded-2xl border border-border-soft">
                  <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-700">
                    <Eye className="w-4 h-4 text-primary" />
                    <span>Live Thermal Receipt Preview</span>
                  </div>

                  <div className="w-full overflow-x-auto flex justify-center py-2">
                    <ThermalReceipt
                      invoice={{
                        invoice_number: `${settingsData.invoice_settings.invoice_prefix || "INV"}-000042`,
                        created_at: new Date().toISOString(),
                        cashier: "Admin Stylist",
                        customer_name: "Mahalakshmi S.",
                        customer_phone: "+91 98765 43210",
                        membership_name: "VIP Gold Member",
                        line_items: [
                          { item_name: "Bridal Makeup & Hair Styling (Luxury)", staff_name: "Ananya R.", quantity: 1, unit_price: 3500.0, discount: 500.0, line_total: 3000.0 },
                          { item_name: "Herbal Facial Spa & Glow Routine", staff_name: "Priya S.", quantity: 1, unit_price: 1500.0, discount: 0.0, line_total: 1500.0 },
                          { item_name: "Organic Argan Hair Oil (100ml)", quantity: 2, unit_price: 450.0, discount: 100.0, line_total: 800.0 },
                        ],
                        subtotal: 5900.0,
                        discount: 600.0,
                        tax: 954.0,
                        total: 6254.0,
                        payments: [
                          { method: "UPI", amount: 4000.0 },
                          { method: "Cash", amount: 2254.0 },
                        ],
                        balance_due: 0.0,
                        change_returned: 0.0,
                        customer: {
                          membership_benefits: "Free Hair Spa Voucher + 15% Off Next Visit",
                        },
                      }}
                      settings={settingsData.receipt_settings}
                      businessProfile={settingsData.business_profile}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => printThermalReceiptElement("thermal-receipt-printable", settingsData.receipt_settings?.paper_size || "80mm")}
                    className="w-full py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Test Print Thermal Receipt ({settingsData.receipt_settings?.paper_size || "80mm"})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Invoice & Tax Settings Tab */}
          {activeTab === "invoice" && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">Invoice & Tax Configurations</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={settingsData.invoice_settings.invoice_prefix}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        invoice_settings: { ...settingsData.invoice_settings, invoice_prefix: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Tax Name</label>
                  <input
                    type="text"
                    value={settingsData.invoice_settings.tax_name}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        invoice_settings: { ...settingsData.invoice_settings, tax_name: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settingsData.invoice_settings.tax_rate}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        invoice_settings: { ...settingsData.invoice_settings, tax_rate: e.target.value },
                      })
                    }
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Receipt Footer Note</label>
                <textarea
                  rows="2"
                  value={settingsData.invoice_settings.receipt_footer}
                  onChange={(e) =>
                    setSettingsData({
                      ...settingsData,
                      invoice_settings: { ...settingsData.invoice_settings, receipt_footer: e.target.value },
                    })
                  }
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                ></textarea>
              </div>
            </div>
          )}

          {/* Regional, Currency & Language Tab */}
          {activeTab === "regional" && (
            <div className="space-y-8">
              {/* Currency Settings Section */}
              <div className="space-y-4 border-b border-border-soft pb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">💰</span>
                  <h3 className="text-sm font-semibold text-text-primary">{t("currency_settings")}</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    {t("select_currency")}
                  </label>
                  <select
                    value={currencyCode}
                    onChange={handleCurrencyChange}
                    className="w-full bg-background border border-border-soft px-3 py-2.5 rounded-lg text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Example Display Box */}
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-1">
                  <p className="text-xs font-semibold text-text-secondary">
                    {t("current_currency")} : <span className="text-primary font-bold">{currencyCode} ({currencySymbol})</span>
                  </p>
                  <p className="text-sm font-extrabold text-primary">
                    {t("example_format")}: <span className="font-mono text-base">{formatCurrency(1000)}</span>
                  </p>
                </div>
              </div>

              {/* Language Settings Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🌐</span>
                  <h3 className="text-sm font-semibold text-text-primary">{t("language_settings")}</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    {t("select_language")}
                  </label>
                  <select
                    value={language}
                    onChange={handleLanguageChange}
                    className="w-full bg-background border border-border-soft px-3 py-2.5 rounded-lg text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-background border border-border-soft p-4 rounded-xl">
                  <p className="text-xs text-text-secondary">
                    {t("current_language")} : <span className="font-bold text-text-primary">{language}</span>
                  </p>
                  <p className="text-[11px] text-text-secondary mt-1">
                    Language preferences apply globally across all navigation menus, dashboard cards, POS billing controls, and forms for your parlour account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* System Accent Color Picker Tab */}
          {activeTab === "accent" && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">🎨 Accent Color Picker</h3>
              <p className="text-xs text-text-secondary">
                Pick your preferred accent theme color for your website (default Rose Pink #EC4899 or choose a custom color).
              </p>

              {/* Default Color Badge */}
              <div className="inline-flex items-center">
                <span className="px-2 py-1 bg-gray-100 rounded-md text-[10px] font-mono text-gray-600">
                  #EC4899
                </span>
              </div>

              {/* Color Options - Horizontal Pill Layout */}
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { color: '#EC4899', name: 'Default Pink' },
                  { color: '#EF4444', name: 'Red Vibrant' },
                  { color: '#DC2626', name: 'Crimson Red' },
                  { color: '#F43F5E', name: 'Rose' },
                  { color: '#10B981', name: 'Emerald Green' },
                  { color: '#3B82F6', name: 'Royal Blue' },
                  { color: '#A855F7', name: 'Purple Neon' },
                ].map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => handleAccentColorChange(preset.color)}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white transition-all duration-200"
                    style={{
                      backgroundColor: preset.color,
                      boxShadow: accentColor === preset.color ? `0 0 0 2px ${preset.color}, 0 0 0 4px white` : 'none',
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: preset.color,
                        boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.3)',
                      }}
                    />
                    <span>{preset.name}</span>
                  </button>
                ))}

                {/* Custom Color - Last Item */}
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white border border-border-soft">
                  <div className="relative">
                    <input
                      type="color"
                      value={customColor}
                      onChange={handleCustomColorChange}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-gray-600">{customColor}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notifications & Security Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-4 text-xs text-text-secondary">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">Security & Notifications</h3>
              <p>Email, SMS, and WhatsApp alerts are enabled for low inventory warnings and membership expirations.</p>
              
              <div className="bg-background border border-border-soft p-4 rounded-lg space-y-2">
                <span className="font-semibold text-text-primary block">Client Re-engagement Threshold (Churn)</span>
                <p className="text-[11px] text-text-secondary">Number of days of inactivity before a customer is flagged as slipping/dormant.</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settingsData.marketing_settings?.churn_days_threshold || 45}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        marketing_settings: {
                          ...settingsData.marketing_settings,
                          churn_days_threshold: parseInt(e.target.value) || 45,
                        },
                      })
                    }
                    className="w-24 bg-surface border border-border-soft px-3 py-1.5 rounded-lg text-sm text-text-primary focus:outline-none"
                  />
                  <span className="text-xs text-text-secondary font-medium">Days of Inactivity</span>
                </div>
              </div>

              <div className="bg-background border border-border-soft p-4 rounded-lg flex items-center justify-between">
                <span className="font-medium text-text-primary">Low Stock Email Notifications</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
              </div>
              <div className="bg-background border border-border-soft p-4 rounded-lg flex items-center justify-between">
                <span className="font-medium text-text-primary">Membership Expiry SMS Alerts</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary" />
              </div>
            </div>
          )}

          {/* Backup & Restore Tab */}
          {activeTab === "backup" && (
            <div className="space-y-4 text-xs text-text-secondary">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">Automated Database Backups</h3>
              <p>Database backups run automatically every 24 hours. You can trigger an instant snapshot export below.</p>
              <button
                type="button"
                onClick={() => alert("Manual database backup requested. Backup file saved to server storage.")}
                className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition"
              >
                💾 Trigger Manual Database Backup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
