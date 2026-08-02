import React, { useState, useEffect } from "react";
import Layout from "./components/Layout";
import { ThemeProvider } from "./context/ThemeContext";
import Customers from "./pages/Customers";
import Employees from "./pages/Employees";
import Services from "./pages/Services";
import Products from "./pages/Products";
import Billing from "./pages/Billing";
import MembershipPlans from "./pages/MembershipPlans";
import CustomerMemberships from "./pages/CustomerMemberships";
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
import API from "./services/api";
import { LogOut, ShieldCheck, Sparkles, UserCheck } from "lucide-react";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  // Detect Meta OAuth callback redirect (?code=...) and route to WhatsApp integration page
  const initialActiveTab = new URLSearchParams(window.location.search).get("code")
    ? "whatsapp_integration"
    : "dashboard";

  const [currentView, setCurrentView] = useState(localStorage.getItem("token") ? "app" : "landing");
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  // Login Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setLoginError(null);

    API.post("/auth/login", { email, password })
      .then((res) => {
        const { token, user: userObj } = res.data;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userObj));
        setToken(token);
        setUser(userObj);
        setLoading(false);
        setCurrentView("app");
        setActiveTab("dashboard");
      })
      .catch((err) => {
        setLoginError(err.message || "Invalid email or password.");
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
          setUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
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
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-pink-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-pink-100 rounded-3xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <button
              onClick={() => setCurrentView("landing")}
              className="text-xs text-pink-600 font-bold hover:underline mb-2 block mx-auto"
            >
              Back to Home
            </button>
            <div className="inline-flex h-14 w-14 bg-gradient-to-tr from-pink-600 to-rose-400 text-white items-center justify-center rounded-2xl font-bold text-lg mb-2 shadow-lg shadow-pink-500/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
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
                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-pink-500 focus:bg-white transition font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input
                id="login-password-input"
                type="password"
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
                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-pink-500 focus:bg-white transition font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white py-3.5 rounded-xl text-xs font-extrabold shadow-lg shadow-pink-500/25 transition disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in to Admin Portal"}
            </button>
          </form>

          {/* Quick Login Presets for Easy Demo Testing */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Demo Quick Login</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@smartgonext.com");
                  setPassword("ParlourAdmin123!");
                }}
                className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Salon Owner</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("superadmin@smartgonext.com");
                  setPassword("SuperAdmin123!");
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-pink-600" />
                <span>Super Admin</span>
              </button>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-slate-100">
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

  // 5. SALON OWNER / PARLOUR ADMIN PORTAL
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
      case "catalog":
      case "services":
      case "products":
        return <ServicesAndProducts />;
      case "memberships":
      case "membership_plans":
      case "customer_memberships":
        return <MembershipManagement />;
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
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onNavigateHome={() => setCurrentView("landing")}
        user={user}
      >
        {renderContent()}
      </Layout>
    </ThemeProvider>
  );
}

export default App;
