import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { Award, Gift, Check, Sparkles, AlertCircle, Save, Layers } from "lucide-react";

export default function VisitMembershipSettings() {
  const { formatCurrency } = useLanguageCurrency();
  const [membershipMode, setMembershipMode] = useState("paid_plan");
  const [requiredVisits, setRequiredVisits] = useState(6);
  const [qualifyingServiceIds, setQualifyingServiceIds] = useState([]);
  const [freeServiceIds, setFreeServiceIds] = useState([]);
  
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);

  const handleRequestModeChange = (newMode) => {
    if (newMode === membershipMode) return;
    setPendingMode(newMode);
    setShowSwitchModal(true);
  };

  const handleConfirmModeChange = () => {
    if (pendingMode) {
      setMembershipMode(pendingMode);
    }
    setShowSwitchModal(false);
    setPendingMode(null);
  };

  const handleCancelModeChange = () => {
    setShowSwitchModal(false);
    setPendingMode(null);
  };

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const activeBranchId = user.branch_id || null;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    if (typeof setErrorMsg === "function") setErrorMsg(null);

    // Safeguard: 10-second max loading timeout
    const timeoutId = setTimeout(() => {
      setLoading((prevLoading) => {
        if (prevLoading) {
          if (typeof setErrorMsg === "function") {
            setErrorMsg("Couldn't load membership settings in time. Please check backend connection and retry.");
          }
          return false;
        }
        return false;
      });
    }, 10000);

    try {
      const [svcRes, setRes] = await Promise.all([
        API.get("/services").catch((err) => {
          console.warn("Could not fetch services:", err);
          return null;
        }),
        API.get("/visit-membership/settings", {
          params: { branch_id: activeBranchId }
        }).catch((err) => {
          console.warn("Could not fetch visit membership settings:", err);
          return null;
        })
      ]);

      const svcList = svcRes?.data?.items || svcRes?.items || [];
      setServices(svcList);

      const data = setRes?.data || setRes || {};
      setMembershipMode(data.membership_mode || "paid_plan");
      setRequiredVisits(data.required_visits || 6);
      setQualifyingServiceIds(data.qualifying_service_ids || []);
      setFreeServiceIds(data.free_service_ids || []);
    } catch (err) {
      console.error("Failed to load visit membership settings:", err);
      if (typeof setErrorMsg === "function") {
        setErrorMsg(err.message || "Failed to load membership settings.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleToggleQualifyingService = (svcId) => {
    if (qualifyingServiceIds.includes(svcId)) {
      setQualifyingServiceIds(qualifyingServiceIds.filter((id) => id !== svcId));
    } else {
      setQualifyingServiceIds([...qualifyingServiceIds, svcId]);
    }
  };

  const handleToggleFreeService = (svcId) => {
    if (freeServiceIds.includes(svcId)) {
      setFreeServiceIds(freeServiceIds.filter((id) => id !== svcId));
    } else {
      setFreeServiceIds([...freeServiceIds, svcId]);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const payload = {
        branch_id: activeBranchId,
        membership_mode: membershipMode,
        required_visits: parseInt(requiredVisits) || 6,
        qualifying_service_ids: qualifyingServiceIds,
        free_service_ids: freeServiceIds,
      };

      const res = await API.post("/visit-membership/settings", payload);
      setSuccessMsg("Membership system settings saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-slate-500 space-y-2">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading Membership Configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-border-soft pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Award className="w-5 h-5 text-primary" />
            <span>Membership & Customer Loyalty System</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how membership rewards and customer discounts operate for your location.
          </p>
        </div>
        <span className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
          Branch Scoped
        </span>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Step 1: Select Active Membership Method */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            1. Select Active Membership Method for Location
          </label>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Type A: Paid Discount Plan */}
            <div
              onClick={() => handleRequestModeChange("paid_plan")}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                membershipMode === "paid_plan"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border-soft bg-surface hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Paid Discount Plan (Type A)</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Original % Discount Membership</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="membership_mode"
                  checked={membershipMode === "paid_plan"}
                  onChange={() => handleRequestModeChange("paid_plan")}
                  className="mt-1 text-primary focus:ring-primary"
                />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Customers purchase a membership plan (e.g. ₹1,500/year) and receive mapped % discounts on eligible services & products during checkout.
              </p>
            </div>

            {/* Type B: Visit-Based Free Service */}
            <div
              onClick={() => handleRequestModeChange("visit_based")}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                membershipMode === "visit_based"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border-soft bg-surface hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Visit-Based Free Service (Type B)</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Loyalty Visit Counter</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="membership_mode"
                  checked={membershipMode === "visit_based"}
                  onChange={() => handleRequestModeChange("visit_based")}
                  className="mt-1 text-primary focus:ring-primary"
                />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Customers automatically accumulate visit count per visit. After completed N visits (e.g. 6), their next visit gets a 100% FREE eligible service.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Visit-Based Configuration (Only visible when Visit-Based is selected) */}
        {membershipMode === "visit_based" && (
          <div className="p-6 bg-background border border-border-soft rounded-2xl space-y-6 animate-fade-in">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800 border-b border-border-soft pb-3">
              <Gift className="w-4 h-4 text-emerald-600" />
              <span>Visit-Based Free Service Program Configuration</span>
            </div>

            {/* Required Visits Number Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Number of Qualifying Visits Required (N) *
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Example: If set to 6, visits 1 to 6 build count, and the 7th visit qualifies for 1 free reward service.
              </p>
              <input
                type="number"
                min="1"
                max="50"
                value={requiredVisits}
                onChange={(e) => setRequiredVisits(e.target.value)}
                className="w-48 bg-white border border-border-soft px-3.5 py-2 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                required
              />
            </div>



            {/* Free Reward Services Checkboxes */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Select Services Eligible as "FREE Reward" on Qualifying Visit:
              </label>
              <p className="text-[11px] text-slate-500">
                Check which services the customer can claim for 100% FREE on their qualifying visit.
              </p>
              <div className="max-h-48 overflow-y-auto border border-border-soft bg-white rounded-xl p-3 grid grid-cols-2 gap-2">
                {services.map((svc) => {
                  const isChecked = freeServiceIds.includes(svc.id);
                  return (
                    <label
                      key={svc.id}
                      className={`flex items-center space-x-2 text-xs p-2 rounded-lg cursor-pointer transition ${
                        isChecked ? "bg-emerald-50 font-bold text-emerald-900" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFreeService(svc.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{svc.name} ({formatCurrency(svc.price)})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Submit Save Button */}
        <div className="pt-3 border-t border-border-soft flex items-center justify-between">
          <p className="text-[11px] text-slate-500 font-medium italic">
            🛡️ Data Safeguard: Switching modes changes active billing rules only. All existing membership plans and customer visit counters remain 100% intact in the database.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md shadow-pink-500/20 transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Configuration..." : "Save Membership Settings"}</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal Popup when Switching Membership Mode */}
      {showSwitchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Switch Membership Method?</h4>
                <p className="text-xs text-slate-500 font-medium">Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Are you sure you want to switch membership methods? This will change how memberships work for this location.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">✅ Data Safety Confirmation:</p>
              <p>No customer memberships or visit history will be lost. You can switch back at any time without losing any data.</p>
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelModeChange}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModeChange}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md shadow-pink-500/20 transition"
              >
                Yes, switch method
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
