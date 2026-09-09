import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Users,
  Image as ImageIcon,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  History,
  Eye,
  Tag,
  Calendar,
  Sparkles,
  Upload,
  RefreshCw,
  Search, 
  Filter,
  Check,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useModalFocusTrap } from "../utils/keyboardNavigation";
import { getFullImageUrl } from "../utils/imageUrl";

export default function WhatsAppCampaigns() {
  const { showSuccess, showError } = useToast();
  const { t } = useLanguageCurrency();
  const detailModalRef = useRef(null);
  const [activeTab, setActiveTab] = useState("create"); // create, progress, history
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [templateType, setTemplateType] = useState("TEXT_ONLY"); // TEXT_ONLY, IMAGE_WITH_CAPTION
  const [offerMessage, setOfferMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [audienceType, setAudienceType] = useState("ALL");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [campaignTemplateName, setCampaignTemplateName] = useState("");
  const [campaignTemplateParams, setCampaignTemplateParams] = useState([""]);
  const [campaignParamCount, setCampaignParamCount] = useState(1);

  // Audience Preview State
  const [previewData, setPreviewData] = useState({
    total_target_customers: 0,
    valid_whatsapp_count: 0,
    skipped_count: 0,
    reasons: {},
    sample_recipients: [],
  });
  const [fetchingPreview, setFetchingPreview] = useState(false);

  // Active Sending Progress State
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [progressData, setProgressData] = useState({
    status: "SENDING",
    processed: 0,
    sent_count: 0,
    failed_count: 0,
    remaining: 0,
  });

  // History State
  const [campaignsList, setCampaignsList] = useState([]);
  const [selectedHistoryCampaign, setSelectedHistoryCampaign] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });

  // Fetch Audience Preview when audienceType changes
  useEffect(() => {
    setFetchingPreview(true);
    API.post("/whatsapp/campaigns/preview", { audience_type: audienceType })
      .then((res) => {
        setPreviewData(res.data || {});
        setFetchingPreview(false);
      })
      .catch(() => setFetchingPreview(false));
  }, [audienceType]);

  // Fetch Campaign History
  const fetchHistory = () => {
    setLoading(true);
    API.get("/whatsapp/campaigns?limit=50")
      .then((res) => {
        setCampaignsList(res.data?.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  // Handle Image Asset Upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setUploadingImage(true);
    API.post("/whatsapp/campaigns/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
      .then((res) => {
        setImageUrl(res.data.image_url);
        setUploadingImage(false);
      })
      .catch((err) => {
        showError(err.response?.data?.message || "Failed to upload image.");
        setUploadingImage(false);
      });
  };

  // Launch Campaign Dispatch
  const handleLaunchCampaign = () => {
    if (!title.trim()) {
      showError("Please enter a campaign title.");
      return;
    }
    if (!offerMessage.trim()) {
      showError("Please enter the campaign offer message.");
      return;
    }
    if (templateType === "IMAGE_WITH_CAPTION" && !imageUrl) {
      showError("Please upload an image for the Image + Caption campaign template.");
      return;
    }

    setLoading(true);
    const payload = {
      title,
      template_type: templateType,
      offer_message: offerMessage,
      image_url: imageUrl,
      coupon_code: couponCode,
      valid_until: validUntil && validUntil !== "dd-mm-yyyy" ? validUntil : null,
      audience_type: audienceType,
    };
    if (campaignTemplateName.trim()) {
      payload.template_name = campaignTemplateName.trim();
      payload.template_params = campaignTemplateParams.filter((p) => p.trim() !== "");
    }

    API.post("/whatsapp/campaigns/send", payload)
      .then((res) => {
        setLoading(false);
        setActiveCampaign(res.data.campaign);
        setProgressData(res.data.batch || {});
        setActiveTab("progress");
      })
      .catch((err) => {
        setLoading(false);
        showError(err.response?.data?.message || err.response?.data?.detail || "Failed to launch campaign dispatch.");
      });
  };

  // Batch Processing Loop for Progress Tab
  useEffect(() => {
    let interval = null;
    if (activeTab === "progress" && activeCampaign && progressData.status !== "COMPLETED") {
      interval = setInterval(() => {
        API.post(`/whatsapp/campaigns/${activeCampaign.id}/process`)
          .then((res) => {
            setActiveCampaign(res.data.campaign);
            setProgressData(res.data.batch || {});
            if (res.data.campaign?.status === "COMPLETED") {
              clearInterval(interval);
            }
          })
          .catch(() => {});
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, activeCampaign, progressData.status]);

  // View Campaign Audit Detail
  const handleViewDetail = (campId) => {
    API.get(`/whatsapp/campaigns/${campId}`)
      .then((res) => {
        setSelectedHistoryCampaign(res.data || {});
        setShowDetailModal(true);
      })
      .catch((err) => showError(err.response?.data?.message || "Failed to load details."));
  };

  // Modal focus trap for the campaign detail modal.
  useModalFocusTrap(showDetailModal, detailModalRef, () => setShowDetailModal(false));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Marketing Automation</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            WhatsApp Marketing Campaigns
          </h1>
          <p className="text-emerald-100 text-xs md:text-sm mt-1 max-w-xl font-medium leading-relaxed">
            Dispatch high-conversion promotional offers, coupons, and customer retention campaigns directly via Meta WhatsApp Cloud API with strict tenant data isolation.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 flex space-x-1 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
              activeTab === "create" ? "bg-white text-emerald-800 shadow-md" : "text-white hover:bg-white/10"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Create Campaign</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
              activeTab === "history" ? "bg-white text-emerald-800 shadow-md" : "text-white hover:bg-white/10"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Campaign History</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CREATE CAMPAIGN */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Campaign Config */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-surface border border-border-soft rounded-3xl p-6 shadow-xs space-y-5">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>1. Campaign Details & Content</span>
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekend Festive Special 20% OFF"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-background border border-border-soft rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Template Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTemplateType("TEXT_ONLY")}
                    className={`p-3 rounded-2xl border text-xs font-extrabold flex items-center space-x-2 transition ${
                      templateType === "TEXT_ONLY"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-background border-border-soft text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Plain Text Message</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplateType("IMAGE_WITH_CAPTION")}
                    className={`p-3 rounded-2xl border text-xs font-extrabold flex items-center space-x-2 transition ${
                      templateType === "IMAGE_WITH_CAPTION"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-background border-border-soft text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Image + Caption</span>
                  </button>
                </div>
              </div>

              {templateType === "IMAGE_WITH_CAPTION" && (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Campaign Offer Image Asset *
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="cursor-pointer bg-white border border-slate-300 hover:border-emerald-500 px-4 py-2 rounded-xl text-xs font-extrabold text-slate-700 shadow-xs transition flex items-center space-x-2">
                      <Upload className="w-4 h-4 text-emerald-600" />
                      <span>{uploadingImage ? "Uploading..." : "Upload Image"}</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>

                    {imageUrl && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center space-x-1 truncate max-w-[200px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Uploaded Asset</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Offer Message / Caption *
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. Hi {{name}}, enjoy 20% OFF on Hair Spa & Facial treatments this weekend at ZL Beauty Parlour!"
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  className="w-full bg-background border border-border-soft rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Coupon Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FESTIVE20"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="w-full bg-background border border-border-soft rounded-xl px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Valid Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-background border border-border-soft rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Audience Selector */}
            <div className="bg-surface border border-border-soft rounded-3xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>2. Audience Target Selection</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { id: "ALL", label: "All Active Customers", desc: "Every client in database" },
                  { id: "MEMBERSHIP", label: "Membership Members", desc: "Active package subscribers" },
                  { id: "RECENT_30D", label: "Visited in Last 30 Days", desc: "Recent salon clients" },
                  { id: "INACTIVE", label: "Inactive Customers (>60 days)", desc: "Re-engagement list" },
                  { id: "BIRTHDAY_TODAY", label: "Birthday Today", desc: "Special birthday offers" },
                ].map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setAudienceType(aud.id)}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      audienceType === aud.id
                        ? "bg-emerald-50 border-emerald-500 shadow-xs"
                        : "bg-background border-border-soft hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-extrabold text-slate-900">{aud.label}</div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">{aud.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Phone Mockup Preview & Audience Breakdown */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live WhatsApp Phone Preview Mockup */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                    WhatsApp Message Preview
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">Meta Cloud API</span>
              </div>

              {/* Chat Bubble Container */}
              <div className="bg-[#0b141a] rounded-2xl p-4 min-h-[220px] flex flex-col justify-end space-y-2 border border-slate-800/60">
                <div className="bg-[#005c4b] text-slate-100 rounded-2xl rounded-tr-none p-3.5 text-xs max-w-[90%] self-end shadow-md leading-relaxed space-y-2.5">
                  {templateType === "IMAGE_WITH_CAPTION" && imageUrl && (
                    <div className="rounded-xl overflow-hidden max-h-48 border border-emerald-700/50">
                      <img
                        src={getFullImageUrl(imageUrl)}
                        alt="Offer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <p className="whitespace-pre-line font-medium text-slate-50">
                    {offerMessage || "Your promotional offer message caption will render here."}
                  </p>

                  {couponCode && (
                    <div className="bg-emerald-950/60 border border-emerald-400/30 p-2 rounded-xl text-[11px] font-extrabold text-emerald-200 text-center uppercase tracking-wider">
                      🎁 Code: {couponCode}
                    </div>
                  )}

                  {validUntil && (
                    <div className="text-[10px] text-emerald-200/80 font-bold text-right">
                      ⏰ Valid Until: {validUntil}
                    </div>
                  )}
                  <div className="text-[9px] text-emerald-300/60 font-bold text-right pt-0.5">
                    10:45 AM ✓✓
                  </div>
                </div>
              </div>
            </div>

            {/* Audience Preview Stats Card */}
            <div className="bg-surface border border-border-soft rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span>Audience Target Analysis</span>
                {fetchingPreview && <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />}
              </h3>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
                  <div className="text-base font-black text-slate-900">
                    {previewData.total_target_customers}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Target Clients
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3">
                  <div className="text-base font-black text-emerald-700">
                    {previewData.valid_whatsapp_count}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">
                    Valid Numbers
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3">
                  <div className="text-base font-black text-amber-700">
                    {previewData.skipped_count}
                  </div>
                  <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">
                    Skipped
                  </div>
                </div>
              </div>

              {previewData.skipped_count > 0 && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-2xl text-[11px] text-amber-900 space-y-1">
                  <div className="font-extrabold text-amber-800">Skipped Reason Breakdown:</div>
                  {Object.entries(previewData.reasons || {}).map(
                    ([reason, count]) =>
                      count > 0 && (
                        <div key={reason} className="flex justify-between font-semibold">
                          <span>{reason}:</span>
                          <span className="font-extrabold">{count}</span>
                        </div>
                      )
                  )}
                </div>
              )}

              <button
                onClick={handleLaunchCampaign}
                disabled={loading || previewData.valid_whatsapp_count === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl text-xs font-extrabold shadow-lg shadow-emerald-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Enqueuing Campaign...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Campaign Now ({previewData.valid_whatsapp_count} Clients)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE PROGRESS SCREEN */}
      {activeTab === "progress" && activeCampaign && (
        <div className="bg-surface border border-border-soft rounded-3xl p-6 md:p-8 shadow-xs max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <Send className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-slate-900">{activeCampaign.title}</h2>
            <p className="text-xs font-semibold text-slate-500">
              Batch Queue Dispatch via Meta Cloud API
            </p>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-black text-slate-700">
              <span>Sending Progress</span>
              <span>
                {progressData.sent_count + progressData.failed_count} / {activeCampaign.valid_whatsapp_count} Completed
              </span>
            </div>

            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{
                  width: `${
                    activeCampaign.valid_whatsapp_count > 0
                      ? Math.min(
                          100,
                          Math.round(
                            ((progressData.sent_count + progressData.failed_count) /
                              activeCampaign.valid_whatsapp_count) *
                              100
                          )
                        )
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>

          {/* Live Progress Stats Grid */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="text-xl font-black text-emerald-700">{progressData.sent_count}</div>
              <div className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mt-0.5">
                Sent Successfully
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
              <div className="text-xl font-black text-rose-700">{progressData.failed_count}</div>
              <div className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider mt-0.5">
                Failed
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="text-xl font-black text-amber-700">{activeCampaign.skipped_count}</div>
              <div className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider mt-0.5">
                Skipped
              </div>
            </div>
          </div>

          {activeCampaign.status === "COMPLETED" ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="inline-flex items-center space-x-2 text-emerald-800 font-extrabold text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Campaign Queue Fully Executed & Saved to Audit Log!</span>
              </div>
              <div>
                <button
                  onClick={() => setActiveTab("history")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition"
                >
                  View Full Audit History
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center space-y-2">
              <div className="inline-flex items-center space-x-2 text-slate-500 text-xs font-extrabold">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Dispatching background batches... Keep window open or check History anytime.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CAMPAIGN HISTORY */}
      {activeTab === "history" && (
        <div className="bg-surface border border-border-soft rounded-3xl shadow-xs overflow-hidden">
          <div className="p-6 border-b border-border-soft flex justify-between items-center">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Campaign Audit History</span>
            </h2>
            <button onClick={fetchHistory} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">Loading campaign records...</div>
          ) : campaignsList.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">No campaigns launched yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-border-soft text-slate-700">
                    <th className="py-3 px-4 font-extrabold">Campaign Name</th>
                    <th className="py-3 px-4 font-extrabold">Date</th>
                    <th className="py-3 px-4 font-extrabold">Audience</th>
                    <th className="py-3 px-4 font-extrabold text-center">Target</th>
                    <th className="py-3 px-4 font-extrabold text-center">Sent</th>
                    <th className="py-3 px-4 font-extrabold text-center">Failed</th>
                    <th className="py-3 px-4 font-extrabold text-center">Status</th>
                    <th className="py-3 px-4 font-extrabold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft font-semibold text-slate-800">
                  {campaignsList.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">{c.title}</td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{c.audience_type}</td>
                      <td className="py-3.5 px-4 text-center font-bold">{c.total_target_customers}</td>
                      <td className="py-3.5 px-4 text-center font-black text-emerald-600">{c.sent_count}</td>
                      <td className="py-3.5 px-4 text-center font-black text-rose-600">{c.failed_count}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            c.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.status === "SENDING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleViewDetail(c.id)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Logs</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recipient Audit Log Modal */}
      {showDetailModal && selectedHistoryCampaign && (
        <div ref={detailModalRef} className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border-soft rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-border-soft flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {selectedHistoryCampaign.title}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Recipient Dispatch Log Audit Trail
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="font-bold text-slate-400 hover:text-slate-600 p-2"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-100 rounded-2xl">
                  <div className="text-sm font-black text-slate-900">{selectedHistoryCampaign.total_target_customers}</div>
                  <div className="text-[10px] font-bold text-slate-500">Target</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl">
                  <div className="text-sm font-black text-emerald-700">{selectedHistoryCampaign.sent_count}</div>
                  <div className="text-[10px] font-bold text-emerald-700">Sent</div>
                </div>
                <div className="p-3 bg-rose-50 rounded-2xl">
                  <div className="text-sm font-black text-rose-700">{selectedHistoryCampaign.failed_count}</div>
                  <div className="text-[10px] font-bold text-rose-700">Failed</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl">
                  <div className="text-sm font-black text-amber-700">{selectedHistoryCampaign.skipped_count}</div>
                  <div className="text-[10px] font-bold text-amber-700">Skipped</div>
                </div>
              </div>

              <div className="border border-border-soft rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-border-soft text-slate-700">
                      <th className="py-2.5 px-3 font-bold">Customer Name</th>
                      <th className="py-2.5 px-3 font-bold">WhatsApp Number</th>
                      <th className="py-2.5 px-3 font-bold text-center">Status</th>
                      <th className="py-2.5 px-3 font-bold">Meta Message ID / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft font-medium">
                    {(selectedHistoryCampaign.recipients || []).map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.customer_name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{r.whatsapp_number}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              r.status === "SENT"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.status === "FAILED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[250px]">
                          {r.meta_message_id || r.failure_reason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
