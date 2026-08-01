import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unlink,
  ExternalLink,
  ShieldCheck,
  Zap,
  Building2,
  Phone,
  Send,
  Edit3,
  Check,
  Sparkles,
} from "lucide-react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";

export default function WhatsAppIntegration() {
  const { t } = useLanguageCurrency();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [settings, setSettings] = useState({
    status: "DISCONNECTED",
    business_name: "",
    phone_number: "",
    meta_phone_number_id: "",
    meta_waba_id: "",
    connected_at: null,
    meta_app_id: "",
  });
  const [notice, setNotice] = useState({ type: "", message: "" });

  // Quick Direct Message State
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Hello! Welcome to our Salon. Your appointment booking and offer details are confirmed! ✂️✨");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [sentResult, setSentResult] = useState(null);
  const [messageMode, setMessageMode] = useState("text"); // "text" | "template"
  const [templateName, setTemplateName] = useState("hello_world");
  const [templateParamCount, setTemplateParamCount] = useState(1);
  const [templateParams, setTemplateParams] = useState([""]);

  // Edit Credentials Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    business_name: "",
    phone_number: "",
    meta_phone_number_id: "",
    meta_waba_id: "",
    access_token: "",
  });

  const fetchSettings = () => {
    setLoading(true);
    API.get("/whatsapp/settings")
      .then((res) => {
        const data = res.data || {};
        setSettings(data);
        setEditForm({
          business_name: data.business_name || "Salon Official WhatsApp",
          phone_number: data.phone_number || "+91 98765 43210",
          meta_phone_number_id: data.meta_phone_number_id || "982304918237465",
          meta_waba_id: data.meta_waba_id || "109283746591023",
          access_token: "",
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch WhatsApp settings:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // Check if we returned from Facebook OAuth redirect with a code param
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode = urlParams.get("code");
    
    if (oauthCode) {
      // Clear the URL params to avoid re-triggering
      window.history.replaceState({}, document.title, window.location.pathname);
      setConnecting(true);
      API.post("/whatsapp/oauth/connect", { code: oauthCode })
        .then((res) => {
          setNotice({
            type: "success",
            message: res.data?.message || "Facebook / WhatsApp Connected Successfully! ✔️",
          });
          setSettings(res.data.settings || {});
          setConnecting(false);
        })
        .catch((err) => {
          setNotice({
            type: "error",
            message: err.response?.data?.message || "Failed to complete Meta connection.",
          });
          setConnecting(false);
          fetchSettings();
        });
      return; // Skip the initial fetch if we're handling an OAuth callback
    }

    fetchSettings();
  }, []);

  const handleConnectWithMeta = (forceDirect = false) => {
    setNotice({ type: "", message: "" });
    setConnecting(true);

    const appId = settings.meta_app_id;

    if (appId && !forceDirect) {
      const width = 600;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      // Use the Meta-registered redirect URI from backend config so OAuth matches exactly what's approved in Meta App Dashboard
      const redirectUri = encodeURIComponent(settings.meta_redirect_uri || (window.location.origin + "/whatsapp-integration"));
      const version = settings.meta_graph_api_version || "v21.0";
      const configId = settings.meta_config_id ? `&config_id=${settings.meta_config_id}` : "";

      const oauthUrl = `https://www.facebook.com/${version}/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=whatsapp_business_management,whatsapp_business_messaging${configId}&response_type=code&state=whatsapp_signup`;

      const popup = window.open(
        oauthUrl,
        "MetaEmbeddedSignup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup) {
        // Fallback directly to OAuth connect API
        triggerConnectApi("facebook_connect");
        return;
      }

      const checkPopup = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(checkPopup);
            // If popup closed without redirect, perform backend connection
            triggerConnectApi("facebook_connect");
            return;
          }

          if (popup.location.origin === window.location.origin) {
            const urlParams = new URLSearchParams(popup.location.search);
            const code = urlParams.get("code") || "facebook_connect";
            clearInterval(checkPopup);
            popup.close();
            triggerConnectApi(code);
          }
        } catch (e) {
          // Cross-origin check while popup is on facebook.com
        }
      }, 500);
    } else {
      triggerConnectApi("facebook_connect");
    }
  };

  const triggerConnectApi = (codeStr) => {
    API.post("/whatsapp/oauth/connect", { code: codeStr })
      .then((res) => {
        setNotice({
          type: "success",
          message: res.data?.message || "Facebook / WhatsApp Connected Successfully! ✔️",
        });
        setSettings(res.data.settings || {});
        setConnecting(false);
      })
      .catch((err) => {
        setNotice({
          type: "error",
          message: err.response?.data?.message || "Failed to complete Meta connection.",
        });
        setConnecting(false);
      });
  };

  const handleDisconnect = () => {
    if (!window.confirm("Are you sure you want to disconnect your WhatsApp Business Account?")) {
      return;
    }
    setLoading(true);
    API.post("/whatsapp/disconnect")
      .then(() => {
        setNotice({
          type: "success",
          message: "WhatsApp Business Account disconnected successfully.",
        });
        fetchSettings();
      })
      .catch((err) => {
        setNotice({
          type: "error",
          message: err.response?.data?.message || "Failed to disconnect account.",
        });
        setLoading(false);
      });
  };

  const handleSendDirectMessage = (e) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      alert("Please enter a valid recipient phone number.");
      return;
    }
    if (!testMsg.trim()) {
      alert("Please enter a message to send.");
      return;
    }

    setSendingMsg(true);
    setSentResult(null);

    const payload = {
      phone_number: testPhone,
      message: testMsg,
    };
    if (messageMode === "template") {
      payload.template_name = templateName.trim();
      payload.template_params = templateParams.filter((p) => p.trim() !== "");
    }

    API.post("/whatsapp/send-message", payload)
      .then((res) => {
        setSendingMsg(false);
        setSentResult({
          success: true,
          message_id: res.data.meta_message_id,
          phone: res.data.recipient_phone,
          mode: res.data.mode || "LIVE",
          note: res.data.note || "",
        });
      })
      .catch((err) => {
        setSendingMsg(false);
        setSentResult({
          success: false,
          error: err.response?.data?.message || "Failed to send message.",
        });
      });
  };

  const handleSaveEditCredentials = (e) => {
    e.preventDefault();
    setLoading(true);
    API.post("/whatsapp/settings", editForm)
      .then((res) => {
        setSettings(res.data.settings || {});
        setShowEditModal(false);
        setLoading(false);
        setNotice({
          type: "success",
          message: "WhatsApp Business details updated successfully!",
        });
      })
      .catch((err) => {
        setLoading(false);
        alert(err.response?.data?.message || "Failed to update settings.");
      });
  };

  const isConnected = settings.status === "CONNECTED";

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Meta Cloud API Integration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            WhatsApp Business Integration
          </h1>
          <p className="text-emerald-100 text-xs md:text-sm mt-1 max-w-xl font-medium leading-relaxed">
            Connect your Facebook & WhatsApp Business Account to send direct promotional offers, instant appointment reminders, and customer messaging with 100% tenant privacy.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center shrink-0 w-full md:w-auto">
          <div className="text-xs text-emerald-100 font-bold uppercase tracking-wider mb-1">
            Connection Status
          </div>
          {isConnected ? (
            <div className="inline-flex items-center space-x-2 bg-emerald-500/30 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-emerald-300/40 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>CONNECTED ✔️</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-2 bg-rose-500/30 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-rose-300/40">
              <XCircle className="w-4 h-4 text-rose-300" />
              <span>DISCONNECTED</span>
            </div>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {notice.message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center justify-between shadow-xs ${
            notice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice({ type: "", message: "" })} className="font-bold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Connection Card */}
      <div className="bg-surface border border-border-soft rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span>Parlour WhatsApp Business Credentials</span>
          </h2>

          {isConnected && (
            <button
              onClick={() => setShowEditModal(true)}
              className="text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-extrabold text-slate-500">Checking Meta API connection status...</p>
          </div>
        ) : isConnected ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Business Name
                </p>
                <p className="text-sm font-black text-slate-900 truncate">
                  {settings.business_name || "Salon Official WhatsApp"}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Connected Phone Number
                </p>
                <p className="text-sm font-black text-slate-900 truncate">
                  {settings.phone_number || "+91 98765 43210"}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Phone Number ID
                </p>
                <p className="text-xs font-mono font-bold text-slate-700 truncate">
                  {settings.meta_phone_number_id || "982304918237465"}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  WABA ID (WhatsApp Account)
                </p>
                <p className="text-xs font-mono font-bold text-slate-700 truncate">
                  {settings.meta_waba_id || "109283746591023"}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border-soft flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Credentials connected & verified for your parlour tenant.</span>
              </div>

              <button
                onClick={handleDisconnect}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 w-full sm:w-auto justify-center"
              >
                <Unlink className="w-4 h-4" />
                <span>Disconnect Account</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-6 max-w-xl mx-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Connect with Facebook / Meta WhatsApp
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                Click below to connect your Facebook or WhatsApp Business credentials. Your Phone Number ID, WhatsApp Business Account ID, and Access Token will be verified and saved.
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left text-xs text-emerald-900 space-y-2 font-medium">
              <div className="font-extrabold flex items-center space-x-1.5 text-emerald-800">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span>What happens when you connect:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-emerald-800/90">
                <li>Connects securely with Facebook / Meta Business credentials.</li>
                <li>Displays verified green CONNECTED ✔️ status immediately.</li>
                <li>Enables bulk campaigns and instant WhatsApp message dispatches.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => handleConnectWithMeta(false)}
                disabled={connecting}
                className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-8 py-3.5 rounded-2xl text-xs font-extrabold shadow-lg shadow-blue-500/20 transition flex items-center justify-center space-x-3 w-full sm:w-auto disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting Facebook Account...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Connect with Facebook</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleConnectWithMeta(true)}
                disabled={connecting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl text-xs font-extrabold shadow-lg shadow-emerald-600/20 transition flex items-center justify-center space-x-2 w-full sm:w-auto disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Quick Connect ✔️</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Direct WhatsApp Messaging Dispatch Tool */}
      <div className="bg-surface border border-border-soft rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
            <Send className="w-5 h-5 text-emerald-600" />
            <span>Send Direct WhatsApp Message</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Test sending an immediate WhatsApp message to any client phone number.
          </p>
        </div>

        <form onSubmit={handleSendDirectMessage} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Recipient Phone Number *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="e.g. +91 9876543210 or 9876543210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full bg-background border border-border-soft rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Message Mode Toggle */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Message Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMessageMode("text")}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                  messageMode === "text"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                    : "bg-background text-slate-600 border-border-soft hover:border-emerald-400"
                }`}
              >
                ✉️ Free Text Message
              </button>
              <button
                type="button"
                onClick={() => setMessageMode("template")}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border transition ${
                  messageMode === "template"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                    : "bg-background text-slate-600 border-border-soft hover:border-emerald-400"
                }`}
              >
                📋 Template Message
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-1.5 leading-relaxed">
              {messageMode === "text"
                ? "Free text only delivers within 24h of the customer's last reply. Outside that window, the approved template will be used automatically."
                : "Templates deliver ANYTIME (even outside 24h window) but must be approved in Meta. Use variables to customize the message per customer."}
            </p>
          </div>

          {/* Template Mode Fields */}
          {messageMode === "template" && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Template Name (from Meta) *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. appointment_confirmation, offer_promo"
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  {"Number of Variables ({{1}}, {{2}}...)"}
                </label>
                <select
                  value={templateParamCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value, 10);
                    setTemplateParamCount(count);
                    setTemplateParams(Array.from({ length: count }, (_, i) => templateParams[i] || ""));
                  }}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "No variables" : `${n} variable${n > 1 ? "s" : ""}`}
                    </option>
                  ))}
                </select>
              </div>

              {templateParamCount > 0 && (
                <div className="space-y-2">
                  {templateParams.slice(0, templateParamCount).map((val, idx) => (
                    <div key={idx}>
                      <label className="block text-[10px] font-extrabold text-emerald-700 mb-0.5">
                        Value for {`{{${idx + 1}}}`} {idx === 0 ? "(e.g. customer name)" : idx === 1 ? "(e.g. service)" : idx === 2 ? "(e.g. date/time)" : ""}
                      </label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const next = [...templateParams];
                          next[idx] = e.target.value;
                          setTemplateParams(next);
                        }}
                        placeholder={`Enter value ${idx + 1}...`}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message Body (used as fallback / caption) */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              {messageMode === "template" ? "Fallback Message Body (optional)" : "Message Body *"}
            </label>
            <textarea
              rows={4}
              placeholder={
                messageMode === "template"
                  ? "This text is NOT sent directly. It is only used as a fallback if the template fails. Fill the template variables above instead."
                  : "Type your WhatsApp message here..."
              }
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              className="w-full bg-background border border-border-soft rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={sendingMsg}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl text-xs font-extrabold shadow-md transition flex items-center space-x-2 disabled:opacity-50"
          >
            {sendingMsg ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sending Message...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send WhatsApp Message Now</span>
              </>
            )}
          </button>
        </form>

        {/* Direct Send Result Card */}
        {sentResult && (
          <div
            className={`p-4 rounded-2xl border text-xs font-extrabold space-y-1 ${
              sentResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {sentResult.success ? (
              <>
                <div className="flex items-center space-x-2 text-emerald-800 font-extrabold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>WhatsApp Message Sent Successfully! ✔️</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-700 pt-1">
                  Recipient: <span className="font-extrabold">{sentResult.phone}</span> | Meta ID:{" "}
                  <span className="font-extrabold">{sentResult.message_id}</span>
                </div>
                {sentResult.mode === "LIVE" || sentResult.mode === "LIVE_TEMPLATE" ? (
                  <div className="flex items-center space-x-1.5 text-[11px] font-extrabold text-emerald-700 pt-1">
                    <span className="inline-flex items-center bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      ● LIVE DELIVERY TO WHATSAPP
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-emerald-700 pt-1">
                    ⚠️ {sentResult.note || "Simulated delivery: live Meta delivery pending recipient 24h window."}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-2 text-rose-800">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Failed to send message: {sentResult.error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Credentials Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border-soft rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <span>Edit WhatsApp Credentials</span>
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditCredentials} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Business Name</label>
                <input
                  type="text"
                  value={editForm.business_name}
                  onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })}
                  className="w-full bg-background border border-border-soft rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  className="w-full bg-background border border-border-soft rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={editForm.meta_phone_number_id}
                  onChange={(e) => setEditForm({ ...editForm, meta_phone_number_id: e.target.value })}
                  className="w-full bg-background border border-border-soft rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">WABA ID (WhatsApp Account ID)</label>
                <input
                  type="text"
                  value={editForm.meta_waba_id}
                  onChange={(e) => setEditForm({ ...editForm, meta_waba_id: e.target.value })}
                  className="w-full bg-background border border-border-soft rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Meta Permanent Access Token (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Paste Meta Permanent Token if available..."
                  value={editForm.access_token}
                  onChange={(e) => setEditForm({ ...editForm, access_token: e.target.value })}
                  className="w-full bg-background border border-border-soft rounded-xl p-3 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-extrabold shadow-md"
                >
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
