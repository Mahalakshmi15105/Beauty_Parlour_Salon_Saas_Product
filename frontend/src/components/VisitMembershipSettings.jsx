import React, { useState, useEffect } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { Award, Gift, Check, Sparkles, AlertCircle, Save, Coins, Percent, Target, CircleDollarSign } from "lucide-react";

export default function VisitMembershipSettings() {
  const { formatCurrency } = useLanguageCurrency();
  const [membershipMode, setMembershipMode] = useState("paid_plan");
  
  // Type B State
  const [requiredVisits, setRequiredVisits] = useState(6);
  const [qualifyingServiceIds, setQualifyingServiceIds] = useState([]);
  const [freeServiceIds, setFreeServiceIds] = useState([]);
  
  // Type C State (Points-Based Discount Mode)
  const [pointsSpendAmount, setPointsSpendAmount] = useState(100);
  const [pointsPerUnit, setPointsPerUnit] = useState(5);
  const [pointsTarget, setPointsTarget] = useState(100);
  const [pointsDiscountPercentage, setPointsDiscountPercentage] = useState(5);

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
      
      setPointsSpendAmount(data.points_spend_amount || 100);
      setPointsPerUnit(data.points_per_unit || 5);
      setPointsTarget(data.points_target || 100);
      setPointsDiscountPercentage(data.points_discount_percentage || 5);
    } catch (err) {
      console.error("Failed to load membership settings:", err);
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
        points_spend_amount: parseFloat(pointsSpendAmount) || 100,
        points_per_unit: parseFloat(pointsPerUnit) || 5,
        points_target: parseFloat(pointsTarget) || 100,
        points_discount_percentage: parseFloat(pointsDiscountPercentage) || 5,
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

  // Example simulation for Points-Based calculation
  const sampleSpend = 1500;
  const samplePointsEarned = pointsSpendAmount > 0 ? Math.floor(sampleSpend / pointsSpendAmount) * pointsPerUnit : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border-soft pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Award className="w-5 h-5 text-primary shrink-0" />
            <span>Membership & Customer Loyalty System</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how membership rewards and customer discounts operate for your location.
          </p>
        </div>
        <span className="text-[11px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 shrink-0">
          Branch Scoped
        </span>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Step 1: Select Active Membership Method */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            1. Select Active Membership Method for Location
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Paid Discount Plan (Type A)</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Subscription Tiers</p>
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
                Customers purchase a paid membership plan (e.g. ₹1,500/yr) to receive mapped % discounts on services and products during billing checkout.
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
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Visit-Based Free Service (Type B)</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Visit Counter Loyalty</p>
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
                Customers automatically build visit count on each salon appointment. Reaching N completed visits (e.g. 6) unlocks 1 free reward service.
              </p>
            </div>

            {/* Type C: Points-Based Discount Mode */}
            <div
              onClick={() => handleRequestModeChange("points_based")}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                membershipMode === "points_based"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border-soft bg-surface hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Points-Based Discount (Type C)</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Target Points Discount</p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="membership_mode"
                  checked={membershipMode === "points_based"}
                  onChange={() => handleRequestModeChange("points_based")}
                  className="mt-1 text-primary focus:ring-primary"
                />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Spend earns points (e.g. ₹100 = 5 pts). Upon reaching the target points (e.g. 100 pts), customers unlock a flat % discount (e.g. 5%) on billing.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Points-Based Configuration (Type C) */}
        {membershipMode === "points_based" && (
          <div className="p-4 sm:p-6 bg-background border border-border-soft rounded-2xl space-y-6 animate-fade-in">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800 border-b border-border-soft pb-3">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Points-Based Discount Program Configuration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Spend Amount per Unit */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <CircleDollarSign className="w-3.5 h-3.5 text-primary" />
                  <span>Spend Amount (₹) *</span>
                </label>
                <p className="text-[10px] text-slate-500">Amount spent to earn unit points</p>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={pointsSpendAmount}
                  onChange={(e) => setPointsSpendAmount(e.target.value)}
                  className="w-full bg-white border border-border-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                  required
                />
              </div>

              {/* 2. Points Earned per Unit */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>Points Earned (Pts) *</span>
                </label>
                <p className="text-[10px] text-slate-500">Points awarded per spend unit</p>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={pointsPerUnit}
                  onChange={(e) => setPointsPerUnit(e.target.value)}
                  className="w-full bg-white border border-border-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                  required
                />
              </div>

              {/* 3. Target Points Required */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Target Points *</span>
                </label>
                <p className="text-[10px] text-slate-500">Points needed to unlock discount</p>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={pointsTarget}
                  onChange={(e) => setPointsTarget(e.target.value)}
                  className="w-full bg-white border border-border-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                  required
                />
              </div>

              {/* 4. Percentage Discount on Target Reached */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Percent className="w-3.5 h-3.5 text-rose-600" />
                  <span>Discount Percentage (%) *</span>
                </label>
                <p className="text-[10px] text-slate-500">Discount unlocked upon target</p>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={pointsDiscountPercentage}
                  onChange={(e) => setPointsDiscountPercentage(e.target.value)}
                  className="w-full bg-white border border-border-soft px-3 py-2 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                  required
                />
              </div>
            </div>

            {/* Live Example Calculation Card */}
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-xs font-extrabold text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Program Rule Live Preview:</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Every <span className="font-bold">₹{pointsSpendAmount}</span> spent earns <span className="font-bold text-amber-700">{pointsPerUnit} points</span>. Once a customer reaches <span className="font-bold text-emerald-700">{pointsTarget} points</span>, they unlock a <span className="font-bold text-rose-600">{pointsDiscountPercentage}% discount</span> on their bill!
              </p>
              <div className="text-[11px] text-amber-900 bg-white/80 p-2.5 rounded-lg border border-amber-200 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>💡 Example: ₹{sampleSpend} service bill</span>
                <span>→ <strong className="text-amber-700">+{samplePointsEarned} points</strong> earned</span>
                <span>→ Customer reaches {pointsTarget} pts</span>
                <span>→ <strong className="text-rose-600">Use Membership ({pointsDiscountPercentage}% Off)</strong> is enabled on POS!</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Visit-Based Configuration (Type B) */}
        {membershipMode === "visit_based" && (
          <div className="p-4 sm:p-6 bg-background border border-border-soft rounded-2xl space-y-6 animate-fade-in">
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
              <div className="max-h-48 overflow-y-auto border border-border-soft bg-white rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        <div className="pt-3 border-t border-border-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 font-medium italic">
            🛡️ Data Safeguard: Switching modes changes active billing rules only. All existing membership plans, points records, and customer visit counters remain 100% intact in the database.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto justify-center px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md shadow-pink-500/20 transition flex items-center space-x-2 disabled:opacity-50 shrink-0"
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
              Are you sure you want to switch membership methods? This will change how memberships operate for this location.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">✅ Data Safety Confirmation:</p>
              <p>No customer memberships, points, or visit history will be lost. You can switch back at any time without losing any data.</p>
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
