import React, { useState, useEffect } from "react";
import Layout from "./components/Layout";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { applyDefaultGloweTheme, applyTheme } from "./themes/theme";
import { ToastProvider } from "./context/ToastContext";
import Customers from "./pages/Customers";
import Employees from "./pages/Employees";
import Services from "./pages/Services";
import Products from "./pages/Products";
import Billing from "./pages/Billing";
import MembershipPlans from "./pages/MembershipPlans";
import CustomerMemberships from "./pages/CustomerMemberships";
import Appointments from "./pages/Appointments";
import ServicesAndProducts from "./pages/ServicesAndProducts";
import MembershipManagement from "./pages/MembershipManagement";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import WhatsAppIntegration from "./pages/WhatsAppIntegration";
import WhatsAppCampaigns from "./pages/WhatsAppCampaigns";
import SuperAdmin from "./pages/SuperAdmin";
import LandingPage from "./pages/LandingPage";
import Register from "./pages/Register";
import PublicBookingPage from "./pages/PublicBookingPage";
import CheckInPage from "./pages/CheckInPage";
import Attendance from "./pages/Attendance";
import API from "./services/api";
import smartGoNextLogo from "./assets/smartgonext-logo.png";
import { LogOut, Sparkles, ShieldCheck, Eye, EyeOff } from "lucide-react";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  // Detect Public Booking Portal route e.g. /book/zeros-lan-3, /book/branch/www2-0-3, /book/branch/3
  const getPublicBookingRouteInfo = () => {
    const path = window.location.pathname;
    if (path.startsWith("/book/branch/")) {
      const parts = path.split("/book/branch/");
      if (parts[1]) {
        const identifier = parts[1].split("?")[0].split("#")[0].trim();
        return { identifier: identifier || "1", isBranch: true };
      }
    } else if (path.startsWith("/book/")) {
      const parts = path.split("/book/");
      if (parts[1]) {
        const identifier = parts[1].split("?")[0].split("#")[0].trim();
        return { identifier: identifier || "1", isBranch: false };
      }
    }
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("book_branch_id")) {
      return { identifier: searchParams.get("book_branch_id").trim(), isBranch: true };
    }
    if (searchParams.get("book_tenant_id")) {
      return { identifier: searchParams.get("book_tenant_id").trim(), isBranch: false };
    }
    return null;
  };

  const bookingRouteInfo = getPublicBookingRouteInfo();

  // Detect Meta OAuth callback redirect (?code=...) and route to WhatsApp integration page
  const initialActiveTab = new URLSearchParams(window.location.search).get("code")
    ? "whatsapp_integration"
    : (user?.role === "Employee" ? "attendance" : "dashboard");

  const [currentView, setCurrentView] = useState(() => {
    if (window.location.pathname.startsWith("/attendance/checkin")) return "attendance_checkin";
    if (bookingRouteInfo !== null) return "public_booking";
    return localStorage.getItem("token") ? "app" : "landing";
  });

  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setLoginError(null);

    API.post("/auth/login", { email, password })
      .then((res) => {
        const payload = res?.data || res;
        const token = payload?.token || res?.token;
        const userObj = payload?.user || res?.user;
        if (!token) {
          setLoginError("Invalid server response format.");
          setLoading(false);
          return;
        }
        localStorage.setItem("token", token);
        if (userObj) localStorage.setItem("user", JSON.stringify(userObj));
        setToken(token);
        setUser(userObj);
        setLoading(false);
        setCurrentView("app");
        if (userObj?.role === "Employee") {
          setActiveTab("attendance");
        } else {
          setActiveTab("dashboard");
        }
      })
      .catch((err) => {
        setLoginError(err.message || err.error || "Invalid email or password.");
        setLoading(false);
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setCurrentView("landing");
  };

  // Fetch current user details if token exists but user state is missing
  useEffect(() => {
    if (token && !user) {
      API.get("/auth/me")
        .then((res) => {
          const userObj = res?.data || res;
          setUser(userObj);
          localStorage.setItem("user", JSON.stringify(userObj));
        })
        .catch(() => handleLogout());
    }
  }, [token]);

  // Handle Hash/Deep Links from Landing Page
  useEffect(() => {
    if (window.location.pathname === "/login") {
      setCurrentView("login");
    }
  }, []);

  const { currentTheme, accentColor } = useTheme();

  // Enforce Glowe Pink Theme for Public Pages (Landing, Login, Register)
  useEffect(() => {
    if (currentView === "landing" || currentView === "login" || currentView === "register") {
      applyDefaultGloweTheme();
    } else if (currentView === "app") {
      applyTheme(currentTheme, accentColor);
    }
  }, [currentView, currentTheme, accentColor]);

  // 0. EMPLOYEE QR ATTENDANCE CHECKIN VIEW
  if (currentView === "attendance_checkin" || window.location.pathname.startsWith("/attendance/checkin")) {
    return (
      <CheckInPage
        onNavigateHome={() => {
          window.history.pushState({}, "", "/");
          setCurrentView(localStorage.getItem("token") ? "app" : "landing");
        }}
      />
    );
  }

  // 0.1 PUBLIC BOOKING PORTAL VIEW
  if (currentView === "public_booking" || bookingRouteInfo !== null) {
    return (
      <PublicBookingPage
        tenantId={bookingRouteInfo?.identifier || "1"}
        tenantIdentifier={bookingRouteInfo?.identifier || "1"}
        isBranch={bookingRouteInfo?.isBranch || false}
        onNavigateHome={() => {
          window.history.pushState({}, "", "/");
          setCurrentView(localStorage.getItem("token") ? "app" : "landing");
        }}
      />
    );
  }

  // 1. LANDING PAGE VIEW
  if (currentView === "landing") {
    return (
      <LandingPage
        isLoggedIn={!!token}
        onNavigateLogin={() => setCurrentView("login")}
        onNavigateRegister={() => setCurrentView("register")}
        onNavigateDashboard={() => {
          setCurrentView("app");
          setActiveTab("dashboard");
        }}
        onLogout={handleLogout}
      />
    );
  }

  // 2. SELF-SERVICE REGISTRATION VIEW
  if (currentView === "register") {
    return (
      <Register
        onRegisterSuccess={(newToken, newUser) => {
          setToken(newToken);
          setUser(newUser);
          setCurrentView("app");
          setActiveTab("dashboard");
        }}
        onNavigateLogin={() => setCurrentView("login")}
        onNavigateHome={() => setCurrentView("landing")}
      />
    );
  }

  // 3. LOGIN PAGE VIEW
  if (currentView === "login" || (!token && currentView === "app")) {
    return (
      <div className="min-h-screen glowe-bg-gradient flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full glowe-glass-card p-8 rounded-3xl glowe-glow-shadow space-y-6">
          <div className="text-center space-y-2">
            <button
              onClick={() => setCurrentView("landing")}
              className="text-xs text-pink-600 font-bold hover:underline mb-2 block mx-auto"
            >
              Back to Home
            </button>
            <img
              src={smartGoNextLogo}
              alt="SmartGoNext Logo"
              className="w-14 h-14 object-contain rounded-2xl mx-auto mb-2 shadow-lg shadow-slate-900/10"
            />
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in to your account</h1>
            <p className="text-xs text-slate-500 font-medium">Enter your credentials to access your parlour dashboard.</p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-xs font-semibold text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (e.target.checkValidity && !e.target.checkValidity()) {
                      e.target.reportValidity();
                      return;
                    }
                    const passInput = document.getElementById("login-password-input");
                    if (passInput) passInput.focus();
                  }
                }}
                placeholder="admin@smartgonext.com"
                className="w-full bg-white/80 border border-pink-100 px-4 py-3 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-pink-500 focus:bg-white transition font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  id="login-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (e.target.checkValidity && !e.target.checkValidity()) {
                        e.target.reportValidity();
                        return;
                      }
                      handleLogin(e);
                    }
                  }}
                  placeholder="••••••••"
                  className="w-full bg-white/80 border border-pink-100 px-4 py-3 pr-10 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-pink-500 focus:bg-white transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full glowe-pink-gradient text-white py-3.5 rounded-full text-xs font-extrabold shadow-lg transition disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in to Admin Portal"}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-pink-100/60">
            <p className="text-xs text-slate-500 font-medium">
              Don't have a salon account?{" "}
              <button onClick={() => setCurrentView("register")} className="text-pink-600 font-bold hover:underline">
                Register Your Parlour
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. SUPER ADMIN PORTAL ROUTE
  if (user?.role === "SuperAdmin") {
    return (
      <div className="min-h-screen bg-background font-sans text-slate-800">
        <header className="h-16 bg-surface border-b border-border-soft px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm">
              <ShieldCheck className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-sm block">SmartGoNext SaaS Platform</span>
              <span className="text-[10px] text-pink-600 font-bold uppercase tracking-wider block -mt-1">Super Admin Console</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs bg-slate-900 text-white font-bold px-3 py-1 rounded-full border border-pink-500/30">
              Super Admin Privilege
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-xs text-danger font-semibold hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="p-8 max-w-7xl mx-auto">
          <SuperAdmin />
        </main>
      </div>
    );
  }



  // 5. SALON OWNER / PARLOUR ADMIN & BRANCH ADMIN PORTAL
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "billing":
        return <Billing />;
      case "customers":
        return <Customers />;
      case "employees":
        return <Employees />;
      case "attendance":
        return <Attendance />;
      case "catalog":
      case "services":
      case "products":
        return <ServicesAndProducts />;
      case "memberships":
      case "membership_plans":
      case "customer_memberships":
        return <MembershipManagement />;
      case "appointments":
        return <Appointments />;
      case "marketing":
      case "whatsapp_campaigns":
        return <WhatsAppCampaigns />;
      case "whatsapp_integration":
        return <WhatsAppIntegration />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      case "notifications":
        return <Notifications setActiveTab={setActiveTab} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <Layout
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          onNavigateHome={() => setCurrentView("landing")}
          user={user}
        >
          {renderContent()}
        </Layout>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
