import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Receipt,
  Users,
  UserCheck,
  Scissors,
  Award,
  BarChart3,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  Sparkles,
  Menu,
  ChevronLeft,
  ChevronRight,
  Bell,
  RotateCw,
  CalendarClock,
  UserRoundX,
  Building2,
  Send,
  X,
  Building,
} from "lucide-react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useTheme } from "../context/ThemeContext";
import ThemeSelector from "./ThemeSelector";
import { getFullImageUrl } from "../utils/imageUrl";
import { getShopNameStyle } from "../utils/fontLoader";
import { useSidebarKeyboardNavigation } from "../utils/keyboardNavigation";

const getMenuIcon = (id) => {
  switch (id) {
    case "dashboard":
      return <LayoutDashboard className="w-4 h-4 shrink-0" />;
    case "billing":
      return <Receipt className="w-4 h-4 shrink-0" />;
    case "customers":
      return <Users className="w-4 h-4 shrink-0" />;
    case "employees":
      return <UserCheck className="w-4 h-4 shrink-0" />;
    case "services":
    case "products":
    case "catalog":
      return <Scissors className="w-4 h-4 shrink-0" />;
    case "membership_plans":
    case "customer_memberships":
    case "memberships":
      return <Award className="w-4 h-4 shrink-0" />;
    case "appointments":
      return <CalendarClock className="w-4 h-4 shrink-0" />;
    case "notifications":
      return <Bell className="w-4 h-4 shrink-0" />;
    case "marketing":
    case "whatsapp_campaigns":
      return <Send className="w-4 h-4 shrink-0" />;
    case "reports":
      return <BarChart3 className="w-4 h-4 shrink-0" />;
    case "settings":
      return <SettingsIcon className="w-4 h-4 shrink-0" />;
    case "super_admin":
      return <ShieldCheck className="w-4 h-4 shrink-0" />;
    default:
      return null;
  }
};

function Layout({ children, activeTab, setActiveTab, onLogout, onNavigateHome, user }) {
  const { t } = useLanguageCurrency();
  const sidebarRef = useRef(null);

  // Desktop Collapsed State from localStorage (defaults to true / collapsed on sign in)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  // Mobile Drawer Overlay State
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("sidebar_collapsed", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  };

  // Sidebar keyboard navigation: ArrowUp/Down move between nav items,
  // ArrowLeft/Right toggle collapse — only when a sidebar item is focused.
  useSidebarKeyboardNavigation(sidebarRef, toggleSidebar);

  // Parlour Branding & Logo State
  const [logoUrl, setLogoUrl] = useState("");
  const [parlourName, setParlourName] = useState("");
  const [shopNameTypography, setShopNameTypography] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [branchData, setBranchData] = useState(null);

  const fetchBranding = () => {
    if (user?.role === "BranchAdmin" && user?.branch_id) {
      let bLogo = "";
      API.get(`/branches/${user.branch_id}`)
        .then((res) => {
          const branch = res.data.data || res.data;
          setBranchData(branch);
          setParlourName(branch.name || user.branch_name || "Branch");
          if (branch.logo_url) {
            bLogo = getFullImageUrl(branch.logo_url);
            setLogoUrl(bLogo);
            setImgFailed(false);
          }
          return API.get("/settings");
        })
        .then((res) => {
          const biz = res.data.business_profile || {};
          // Fall back to main parlour logo if branch has no custom logo
          if (!bLogo && biz.logo_url) {
            const fullUrl = getFullImageUrl(biz.logo_url);
            setLogoUrl(fullUrl);
            setImgFailed(false);
          }
          setShopNameTypography(biz.shop_name_typography || null);
        })
        .catch(() => {
          setParlourName(user.branch_name || "Branch");
        });
    } else {
      API.get("/settings")
        .then((res) => {
          const biz = res.data.business_profile || {};
          const fullUrl = getFullImageUrl(biz.logo_url);
          if (fullUrl !== logoUrl) {
            setLogoUrl(fullUrl);
            setImgFailed(false);
          }
          setParlourName(biz.name || user?.parlour_name || "Beauty Parlour");
          setShopNameTypography(biz.shop_name_typography || null);
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    fetchBranding();
    const handleBrandingUpdated = () => fetchBranding();
    window.addEventListener("branding_updated", handleBrandingUpdated);
    return () => window.removeEventListener("branding_updated", handleBrandingUpdated);
  }, []);

  // Notification Dropdown State & Unread Polling
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const notifDropdownRef = React.useRef(null);

  const fetchUnreadNotifications = () => {
    API.get("/notifications?limit=10")
      .then((res) => {
        const data = res.data.data || res.data;
        setUnreadNotifCount(data.unread_count || 0);
        setRecentNotifs(data.items || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 30000); // 30 sec poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutsideNotif = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideNotif);
    return () => document.removeEventListener("mousedown", handleClickOutsideNotif);
  }, []);

  // Close Mobile Drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  const menuItems = [
    { id: "dashboard", labelKey: "dashboard", defaultLabel: "Dashboard" },
    { id: "billing", labelKey: "billing", defaultLabel: "Billing" },
    { id: "customers", labelKey: "customers", defaultLabel: "Customers" },
    { id: "employees", labelKey: "employees", defaultLabel: "Employees" },
    { id: "catalog", labelKey: "services_products", defaultLabel: "Services & Products" },
    { id: "memberships", labelKey: "membership_management", defaultLabel: "Membership Management" },
    { id: "appointments", labelKey: "appointments", defaultLabel: "Appointments" },
    { id: "notifications", labelKey: "notifications", defaultLabel: "Notifications" },
    { id: "marketing", labelKey: "whatsapp_marketing", defaultLabel: "WhatsApp Campaigns" },
    { id: "reports", labelKey: "reports", defaultLabel: "Reports" },
    { id: "settings", labelKey: "settings", defaultLabel: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* MOBILE OVERLAY BACKDROP */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR COMPONENT (DESKTOP + MOBILE DRAWER) */}
      <aside
        ref={sidebarRef}
        className={`bg-surface border-r border-border-soft flex flex-col z-50 transition-all duration-300 ease-in-out glowe-sidebar-gradient glowe-glow-shadow ${
          // Desktop behavior
          `hidden md:flex ${isCollapsed ? "w-20" : "w-64"}`
        }`}
      >
        {/* Sidebar Header / Logo */}
        <div className={`py-3.5 border-b border-border-soft flex items-center ${isCollapsed ? "justify-center px-2" : "px-4 justify-between"}`}>
          {isCollapsed ? (
            <div className="relative group cursor-pointer flex justify-center w-full" onClick={onNavigateHome}>
              <div className="w-12 h-12 rounded-full border-2 border-primary/20 bg-primary-light flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {logoUrl && !imgFailed ? (
                  <img
                    src={logoUrl}
                    alt={parlourName || "Logo"}
                    className="w-full h-full object-cover object-center rounded-full"
                    onError={() => setImgFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-white font-extrabold text-sm rounded-full">
                    {(parlourName || user?.parlour_name || "P").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Hover Tooltip for Collapsed Sidebar */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3.5 py-2 bg-slate-900 text-white rounded-xl shadow-2xl z-50 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs">
                <p className="font-extrabold text-white">{parlourName || user?.parlour_name || (user?.role === "BranchAdmin" ? "Branch" : "Beauty Parlour")}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  {user?.role === "BranchAdmin" 
                    ? user?.parlour_name || "SmartGoNext Beauty Parlour"
                    : "Powered By SmartGoNext"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3 cursor-pointer w-full py-0.5" onClick={onNavigateHome}>
              <div className="w-12 h-12 rounded-full border-2 border-primary/20 bg-primary-light flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {logoUrl && !imgFailed ? (
                  <img
                    src={logoUrl}
                    alt={parlourName || "Logo"}
                    className="w-full h-full object-cover object-center rounded-full"
                    onError={() => setImgFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-white font-extrabold text-sm rounded-full">
                    {(parlourName || user?.parlour_name || "P").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="overflow-hidden leading-tight">
                <span
                  className="font-extrabold text-slate-900 text-sm block truncate transition-all duration-200"
                  style={getShopNameStyle(shopNameTypography)}
                >
                  {parlourName || user?.branch_name || "Branch"}
                </span>
                {user?.role === "BranchAdmin" ? (
                  <>
                    <span className="text-[11px] font-extrabold text-slate-800 block truncate mt-0.5">
                      {user?.parlour_name || "Main Parlour"}
                    </span>
                    <span className="text-[10px] font-bold text-pink-600 block truncate mt-0.5">
                      Powered By SmartGoNext
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] font-bold text-slate-700 block mt-0.5 whitespace-nowrap">
                    Powered By SmartGoNext
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  data-sidebar-nav="true"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center ${
                    isCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-3.5 py-2.5"
                  } rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? "glowe-pill-active text-white shadow-md scale-[1.02]"
                      : "text-slate-800 hover:bg-primary-light hover:text-primary"
                  }`}
                >
                  <span>{getMenuIcon(item.id)}</span>
                  {!isCollapsed && <span>{t(item.labelKey)}</span>}
                </button>

                {/* Collapsed Tooltip */}
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg shadow-xl z-50 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold">
                    {t(item.labelKey)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout Footer Section for Desktop Sidebar */}
        <div className="p-3 border-t border-border-soft shrink-0">
          {!isCollapsed && user && (
            <div className="px-3.5 py-2 mb-2 text-left border-b border-border-soft/40 pb-2.5">
              <p className="text-xs font-black text-slate-900 truncate">
                {user.owner_name || user.email || "Admin"}
              </p>
              <p className="text-[10px] text-slate-700 font-bold truncate">
                {user.role === "BranchAdmin" 
                  ? `Branch Admin: ${branchData?.name || user.branch_name || "Branch"}`
                  : user.role === "ParlourAdmin" 
                    ? "Parlour Owner" 
                    : user.role || ""}
              </p>
            </div>
          )}
          <div className="relative group">
            <button
              onClick={onLogout}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-3.5 py-2.5"
              } rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>{t("logout") || "Logout"}</span>}
            </button>

            {/* Collapsed Tooltip */}
            {isCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg shadow-xl z-50 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold">
                {t("logout") || "Logout"}
              </div>
            )}
          </div>

          {/* Branch Admin indicator for collapsed sidebar */}
          {isCollapsed && user?.role === "BranchAdmin" && (
            <div className="flex justify-center mt-2">
              <div className="h-6 w-6 bg-slate-900 text-white rounded-lg flex items-center justify-center" title="Branch Admin">
                <Building className="w-3.5 h-3.5 text-pink-400" />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-surface border-r border-border-soft z-50 transform transition-transform duration-300 md:hidden flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 px-6 border-b border-border-soft flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onNavigateHome}>
            <div className="w-12 h-12 rounded-full border-2 border-primary/20 bg-primary-light flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {logoUrl && !imgFailed ? (
                <img
                  src={logoUrl}
                  alt={parlourName || "Logo"}
                  className="w-full h-full object-cover object-center rounded-full"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center text-white font-extrabold text-sm rounded-full">
                  {(parlourName || user?.parlour_name || "P").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="overflow-hidden leading-tight">
              <span className="font-extrabold text-slate-900 text-sm block truncate">
                {parlourName || user?.parlour_name || (user?.role === "BranchAdmin" ? "Branch" : "Beauty Parlour")}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 block mt-0.5 whitespace-nowrap">
                {user?.role === "BranchAdmin" 
                  ? user?.parlour_name || "SmartGoNext Beauty Parlour"
                  : "Powered By SmartGoNext"}
              </span>
            </div>
          </div>
          <button onClick={() => setIsMobileOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-md"
                    : "text-text-secondary hover:bg-primary-light hover:text-primary"
                }`}
              >
                <span>{getMenuIcon(item.id)}</span>
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border-soft flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-primary-light text-primary font-bold rounded-full flex items-center justify-center text-xs">
              {(user?.owner_name || user?.email || "O")[0].toUpperCase()}
            </div>
            <div className="max-w-[110px] truncate">
              <p className="text-xs font-extrabold text-text-primary truncate">
                {user?.owner_name || (user?.email ? user.email.split("@")[0] : "Admin")}
              </p>
              <p className="text-[10px] text-text-secondary font-medium truncate">
                {user?.role === "BranchAdmin" 
                  ? `Branch: ${branchData?.name || user.branch_name || "Branch"}`
                  : user?.parlour_name 
                    ? `${user.parlour_name} ${t("salon_owner")}` 
                    : user?.role === "SuperAdmin" 
                      ? "SaaS Admin" 
                      : t("salon_owner")}
              </p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center space-x-1 text-xs text-danger font-semibold hover:underline">
            <LogOut className="w-3.5 h-3.5" />
            <span>{t("logout")}</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE CANVAS */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* HEADER BAR WITH HAMBURGER BUTTON */}
        <header className="h-16 bg-surface border-b border-border-soft px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            {/* Hamburger (☰) Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl text-slate-600 hover:bg-background border border-border-soft transition shadow-2xs flex items-center justify-center"
              title={isCollapsed ? "Expand Sidebar (☰)" : "Collapse Sidebar (☰)"}
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>

            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">
              {t(menuItems.find((x) => x.id === activeTab)?.labelKey || activeTab)}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* BRANCH ADMIN INDICATOR */}
            {user?.role === "BranchAdmin" && (
              <div className="flex items-center space-x-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-xl border border-pink-500/30 shadow-sm">
                <Building className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  Branch: {branchData?.name || user.branch_name || "Branch"}
                </span>
              </div>
            )}

            {/* NOTIFICATION BELL & DROPDOWN */}
            <div ref={notifDropdownRef} className="relative">
              <button
                onClick={() => setNotifDropdownOpen((prev) => !prev)}
                className="p-2 rounded-xl text-slate-600 hover:bg-background border border-border-soft transition shadow-2xs relative flex items-center justify-center"
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-slate-700" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-5 text-center shadow-md animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {notifDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface border border-border-soft rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col text-xs font-sans">
                  <div className="p-3.5 border-b border-border-soft flex justify-between items-center bg-background">
                    <div className="flex items-center space-x-2 font-extrabold text-slate-900">
                      <Bell className="w-4 h-4 text-primary" />
                      <span>Notifications ({unreadNotifCount} unread)</span>
                    </div>
                    {unreadNotifCount > 0 && (
                      <button
                        onClick={() => {
                          API.put("/notifications/read-all").then(() => {
                            setUnreadNotifCount(0);
                            setRecentNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
                          });
                        }}
                        className="text-[11px] text-primary hover:underline font-extrabold"
                      >
                        Mark All as Read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-border-soft">
                    {recentNotifs.length > 0 ? (
                      recentNotifs.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 transition space-y-1.5 ${
                            !n.is_read ? "bg-primary/5 font-semibold" : "bg-surface text-slate-600"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-extrabold text-slate-900 flex items-center space-x-1.5">
                              {n.type === "inactive_customer" ? (
                                <UserRoundX className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              ) : n.type === "membership_expiry" ? (
                                <CalendarClock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              ) : (
                                <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                              <span>{n.title}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {n.data?.days_since_last_visit ? `Inactive • ${n.data.days_since_last_visit}d` : n.data?.expiry_date || ""}
                            </span>
                          </div>
                          <p className="text-[11px] leading-tight text-slate-700">{n.message}</p>

                          {n.type === "inactive_customer" && (
                            <div className="pt-1 flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setNotifDropdownOpen(false);
                                  setActiveTab("notifications");
                                }}
                                className="text-[10px] bg-indigo-600 text-white px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition shadow-2xs"
                              >
                                <span>Re-engage Customer</span>
                              </button>
                            </div>
                          )}

                          {n.type === "membership_expiry" && (
                            <div className="pt-1">
                              <button
                                onClick={() => {
                                  setNotifDropdownOpen(false);
                                  setActiveTab("memberships");
                                }}
                                className="text-[10px] bg-primary text-white px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition shadow-2xs"
                              >
                                <RotateCw className="w-3 h-3" />
                                <span>Renew Membership</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-400 font-bold">
                        No notifications available.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setNotifDropdownOpen(false);
                      setActiveTab("notifications");
                    }}
                    className="p-3 bg-background border-t border-border-soft text-center font-extrabold text-primary hover:bg-primary/10 transition"
                  >
                    View All Notifications →
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
