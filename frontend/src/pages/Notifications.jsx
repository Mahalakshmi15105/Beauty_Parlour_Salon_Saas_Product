import React, { useState, useEffect } from "react";
import API from "../services/api";
import {
  Bell,
  CalendarClock,
  TriangleAlert,
  BadgeCheck,
  Receipt,
  MonitorCog,
  Eye,
  RotateCw,
  Check,
  CheckCheck,
  RefreshCw,
  Clock,
  Filter,
  User,
  UserRoundX,
  MessageSquare,
  Phone,
  PhoneCall,
  Calendar,
  IndianRupee,
} from "lucide-react";

function Notifications({ setActiveTab, setCustomerMembershipsCustomerFilter, setSelectedCustomerForBilling, setViewCustomerHistoryId }) {
  const [activeFilterTab, setActiveFilterTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = () => {
    setLoading(true);
    const unreadOnly = activeFilterTab === "unread" ? "true" : "false";
    const type = activeFilterTab !== "all" && activeFilterTab !== "unread" ? activeFilterTab : "all";

    // Auto-trigger scan first to make sure expiries & inactive customer alerts are generated
    API.post("/notifications/check-expiries")
      .catch(() => {})
      .finally(() => {
        API.get(`/notifications?unread_only=${unreadOnly}&type=${type}&limit=50`)
          .then((res) => {
            const data = res.data.data || res.data;
            setNotifications(data.items || []);
            setUnreadCount(data.unread_count || 0);
            setTotalCount(data.total_count || 0);
            setLoading(false);
          })
          .catch((err) => {
            setError(err.response?.data?.message || err.message || "Failed to load notifications.");
            setLoading(false);
          });
      });
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeFilterTab]);

  const handleMarkAsRead = (id) => {
    API.put(`/notifications/${id}/read`)
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      })
      .catch((err) => console.error("Error marking notification as read:", err));
  };

  const handleMarkAllAsRead = () => {
    API.put("/notifications/read-all")
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      })
      .catch((err) => console.error("Error marking all as read:", err));
  };

  const handleRenewMembership = (item) => {
    if (item.id && !item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (setCustomerMembershipsCustomerFilter && item.data?.customer_id) {
      setCustomerMembershipsCustomerFilter(item.data.customer_id);
    }
    if (setActiveTab) {
      setActiveTab("memberships");
    }
  };

  const handleCreateBillForCustomer = (item) => {
    if (item.id && !item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (setSelectedCustomerForBilling && item.data?.customer_id) {
      setSelectedCustomerForBilling(item.data.customer_id);
    }
    if (setActiveTab) {
      setActiveTab("billing");
    }
  };

  const handleViewCustomer = (item) => {
    if (item.id && !item.is_read) {
      handleMarkAsRead(item.id);
    }
    if (setViewCustomerHistoryId && item.data?.customer_id) {
      setViewCustomerHistoryId(item.data.customer_id);
    } else if (setActiveTab) {
      setActiveTab("customers");
    }
  };

  const getTypeIcon = (type, stage) => {
    if (type === "inactive_customer") {
      return <UserRoundX className="w-5 h-5 text-indigo-600" />;
    } else if (type === "membership_expiry") {
      if (stage === "expired" || stage === "0d") {
        return <TriangleAlert className="w-5 h-5 text-rose-600" />;
      }
      return <CalendarClock className="w-5 h-5 text-amber-600" />;
    } else if (type === "billing") {
      return <Receipt className="w-5 h-5 text-blue-600" />;
    } else if (type === "system") {
      return <MonitorCog className="w-5 h-5 text-purple-600" />;
    }
    return <Bell className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans text-slate-800">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-3xl border border-border-soft shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Notification Center</span>
                {unreadCount > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Automated alerts for membership expiries, inactive customers & salon activity
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchNotifications}
            className="px-3.5 py-2 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
            title="Refresh notifications"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-xs transition"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex border-b border-border-soft overflow-x-auto space-x-2 scrollbar-none text-xs font-extrabold">
        {[
          { id: "all", label: "All Notifications", count: totalCount },
          { id: "unread", label: "Unread", count: unreadCount },
          { id: "membership_expiry", label: "Membership Expiry" },
          { id: "inactive_customer", label: "Inactive Customers" },
          { id: "billing", label: "Billing" },
          { id: "system", label: "System" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilterTab(tab.id)}
            className={`px-4 py-2.5 border-b-2 transition whitespace-nowrap flex items-center space-x-2 ${
              activeFilterTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeFilterTab === tab.id ? "bg-primary/10 text-primary" : "bg-background text-slate-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications Body List */}
      {loading ? (
        <div className="py-16 text-center text-xs font-bold text-slate-500 flex flex-col items-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span>Scanning for Membership Expiries, Inactive Clients & Alerts...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center bg-surface border border-border-soft rounded-3xl space-y-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <BadgeCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">No Notifications Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            You're all caught up! There are no active alerts for this view.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition flex flex-col md:flex-row md:items-start justify-between gap-4 ${
                !item.is_read
                  ? "bg-surface border-primary/30 shadow-xs ring-1 ring-primary/10"
                  : "bg-surface/60 border-border-soft opacity-85"
              }`}
            >
              <div className="flex items-start space-x-4 flex-1">
                <div className={`p-3 rounded-2xl shrink-0 mt-0.5 ${
                  item.type === "inactive_customer"
                    ? "bg-indigo-100"
                    : item.stage === "expired" || item.stage === "0d"
                    ? "bg-rose-100"
                    : "bg-amber-100"
                }`}>
                  {getTypeIcon(item.type, item.stage)}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                    <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                    {!item.is_read && (
                      <span className="bg-primary text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        New
                      </span>
                    )}
                    {item.type === "inactive_customer" && item.data?.days_since_last_visit && (
                      <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                        <UserRoundX className="w-3 h-3 text-indigo-600" />
                        <span>Inactive • {item.data.days_since_last_visit} Days</span>
                      </span>
                    )}
                    {item.type === "membership_expiry" && item.data?.remaining_days !== undefined && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        item.data.remaining_days === "Expired" || item.stage === "expired"
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}>
                        {typeof item.data.remaining_days === "number"
                          ? `Remaining: ${item.data.remaining_days} Days`
                          : "Status: Expired"}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                    {item.message}
                  </p>

                  {/* Comprehensive Client Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                    {item.data?.customer_name && (
                      <div className="flex items-center space-x-1 font-extrabold text-slate-800">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{item.data.customer_name}</span>
                      </div>
                    )}
                    {item.data?.phone && (
                      <div className="flex items-center space-x-1 font-semibold text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{item.data.phone}</span>
                      </div>
                    )}
                    {item.data?.last_visit_date && (
                      <div className="flex items-center space-x-1 font-semibold text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Last Visit: {item.data.last_visit_date}</span>
                      </div>
                    )}
                    {item.data?.last_service && (
                      <div className="flex items-center space-x-1 font-semibold text-slate-600">
                        <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">Service: {item.data.last_service}</span>
                      </div>
                    )}
                    {item.data?.last_stylist && (
                      <div className="flex items-center space-x-1 font-semibold text-slate-600">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">Stylist: {item.data.last_stylist}</span>
                      </div>
                    )}
                    {item.data?.membership_status && (
                      <div className="flex items-center space-x-1 font-semibold text-slate-600">
                        <BadgeCheck className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Plan: {item.data.membership_status}</span>
                      </div>
                    )}
                    {item.data?.total_visits !== undefined && (
                      <div className="flex items-center space-x-1 font-semibold text-slate-600">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Visits: {item.data.total_visits}</span>
                      </div>
                    )}
                    {item.data?.total_spent !== undefined && (
                      <div className="flex items-center space-x-1 font-extrabold text-emerald-700">
                        <IndianRupee className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Total Spent: ₹{item.data.total_spent}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Client Re-engagement Quick Actions */}
              <div className="flex flex-wrap md:flex-col items-stretch gap-1.5 shrink-0 border-t md:border-t-0 md:border-l border-border-soft pt-3 md:pt-0 md:pl-4 min-w-[150px]">
                {item.type === "inactive_customer" && (
                  <>
                    <a
                      href={`https://wa.me/91${item.data?.phone || ""}?text=${encodeURIComponent(
                        `Hello ${item.data?.customer_name || "Customer"}, we miss you at ${item.data?.salon_name || "our salon"}! Special offers are waiting for your next visit.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center space-x-1.5 shadow-2xs transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Send WhatsApp</span>
                    </a>

                    <a
                      href={`sms:${item.data?.phone || ""}?body=${encodeURIComponent(
                        `Hello ${item.data?.customer_name || "Customer"}, we miss you at ${item.data?.salon_name || "our salon"}! Book your visit today.`
                      )}`}
                      className="px-3 py-1.5 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-[11px] font-extrabold flex items-center justify-center space-x-1.5 transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Send SMS</span>
                    </a>

                    <a
                      href={`tel:${item.data?.phone || ""}`}
                      className="px-3 py-1.5 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-[11px] font-extrabold flex items-center justify-center space-x-1.5 transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
                      <span>Call Customer</span>
                    </a>

                    <button
                      onClick={() => handleCreateBillForCustomer(item)}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center space-x-1.5 transition shadow-2xs"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Create New Bill</span>
                    </button>

                    <button
                      onClick={() => handleViewCustomer(item)}
                      className="px-3 py-1.5 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-[11px] font-extrabold flex items-center justify-center space-x-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Customer</span>
                    </button>
                  </>
                )}

                {item.type === "membership_expiry" && (
                  <button
                    onClick={() => handleRenewMembership(item)}
                    className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 shadow-2xs transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Renew Membership</span>
                  </button>
                )}

                {!item.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(item.id)}
                    className="px-3 py-1.5 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition"
                    title="Mark as read"
                  >
                    <Check className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mark Read</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Notifications;
