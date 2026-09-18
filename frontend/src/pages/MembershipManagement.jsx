import React, { useState, useEffect } from "react";
import API from "../services/api";
import MembershipPlans from "./MembershipPlans";
import CustomerMemberships from "./CustomerMemberships";
import VisitMembershipRecords from "../components/VisitMembershipRecords";
import { Award, CreditCard } from "lucide-react";

function MembershipManagement() {
  const [membershipMode, setMembershipMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("plans"); // "plans" or "customer_memberships"

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const activeBranchId = user.branch_id || null;

  useEffect(() => {
    fetchMembershipSettings();
  }, []);

  const fetchMembershipSettings = async () => {
    setLoading(true);
    try {
      const res = await API.get("/visit-membership/settings", {
        params: { branch_id: activeBranchId }
      });
      const data = res.data || res || {};
      setMembershipMode(data.membership_mode || "paid_plan");
    } catch (err) {
      console.error("Failed to fetch membership settings:", err);
      setMembershipMode("paid_plan");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-bold text-slate-500 space-y-2">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading Membership System...</p>
      </div>
    );
  }

  // Type B: Visit-Based Free Service Loyalty View
  if (membershipMode === "visit_based") {
    return <VisitMembershipRecords />;
  }

  // Type A (Default): Paid Discount Plan & Subscription Packages View
  return (
    <div className="space-y-6">
      {/* Top Segmented Tab Switcher */}
      <div className="flex space-x-2 bg-surface border border-border-soft p-3 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab("plans")}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            activeTab === "plans"
              ? "bg-primary text-white shadow-md"
              : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Membership Tiers & Plans</span>
        </button>

        <button
          onClick={() => setActiveTab("customer_memberships")}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            activeTab === "customer_memberships"
              ? "bg-primary text-white shadow-md"
              : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Customer Subscriptions & Packages</span>
        </button>
      </div>

      {/* Render Component View */}
      <div>
        {activeTab === "plans" ? <MembershipPlans /> : <CustomerMemberships />}
      </div>
    </div>
  );
}

export default MembershipManagement;
