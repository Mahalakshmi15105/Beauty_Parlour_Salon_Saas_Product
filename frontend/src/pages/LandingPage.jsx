import React, { useState } from "react";
import {
  Sparkles,
  Scissors,
  CreditCard,
  Award,
  Package,
  BarChart3,
  Download,
  Check,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

function LandingPage({ isLoggedIn, onNavigateLogin, onNavigateRegister, onNavigateDashboard, onLogout }) {
  const [billingCycle, setBillingCycle] = useState("monthly"); // monthly or yearly

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* SaaS Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-pink-100 px-6 lg:px-12 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-400 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-pink-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-pink-600 to-rose-500 bg-clip-text text-transparent">
              SmartGoNext
            </span>
            <span className="text-[10px] text-pink-600 font-bold block -mt-1 uppercase tracking-widest">
              Beauty Parlour
            </span>
          </div>
        </div>

        <nav className="hidden md:flex space-x-8 text-xs font-bold text-slate-600">
          <a href="#features" className="hover:text-pink-600 transition">Features</a>
          <a href="#pricing" className="hover:text-pink-600 transition">Pricing</a>
          <a href="#about" className="hover:text-pink-600 transition">About</a>
          <a href="#contact" className="hover:text-pink-600 transition">Contact</a>
        </nav>

        <div className="flex items-center space-x-4">
          {isLoggedIn ? (
            <>
              <button
                onClick={onNavigateDashboard}
                className="flex items-center space-x-1.5 text-xs font-bold border-2 border-pink-500 text-pink-600 hover:bg-pink-50 px-5 py-2 rounded-xl transition duration-200"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-pink-500/25 transition transform hover:-translate-y-0.5 duration-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onNavigateLogin}
                className="text-xs font-bold border-2 border-pink-500 text-pink-600 hover:bg-pink-50 px-5 py-2 rounded-xl transition duration-200"
              >
                Login
              </button>
              <button
                onClick={onNavigateRegister}
                className="bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-pink-500/25 transition transform hover:-translate-y-0.5 duration-200"
              >
                Start Free Trial
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 lg:px-12 pt-16 pb-24 max-w-6xl mx-auto text-center space-y-8 bg-gradient-to-b from-pink-50/80 via-white to-pink-50/30 w-full rounded-3xl mt-4 border border-pink-100/60 shadow-sm overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-pink-300/30 to-rose-200/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative inline-flex items-center space-x-2 bg-pink-100/80 border border-pink-200 px-4 py-1.5 rounded-full text-xs font-bold text-pink-700 shadow-sm">
          <Sparkles className="w-4 h-4 text-pink-600" />
          <span>Premium Beauty Parlour & Salon Management Platform</span>
        </div>

        <h1 className="relative text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-tight max-w-4xl mx-auto">
          Elevate Your Salon Business with{" "}
          <span className="bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 bg-clip-text text-transparent">
            SmartGoNext Beauty Parlour
          </span>
        </h1>

        <p className="text-base md:text-lg font-bold text-pink-600 tracking-wide uppercase">
          Complete Salon Management SaaS Platform
        </p>

        <p className="max-w-2xl mx-auto text-sm text-slate-600 leading-relaxed font-medium">
          Transform your beauty salon operations with our intuitive all-in-one software.
          Effortlessly handle client appointments, POS checkout billing, stylist commissions, inventory reordering, membership packages, and real-time revenue analytics.
        </p>

        <div className="relative flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          {isLoggedIn ? (
            <>
              <button
                onClick={onNavigateDashboard}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white px-9 py-4 rounded-xl text-sm font-bold shadow-xl shadow-pink-500/30 transition transform hover:-translate-y-0.5 duration-200"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Your Dashboard</span>
              </button>
              <button
                onClick={onLogout}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white border-2 border-pink-500 text-pink-600 hover:bg-pink-50 px-9 py-4 rounded-xl text-sm font-bold shadow-sm transition duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onNavigateRegister}
                className="w-full sm:w-auto bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white px-9 py-4 rounded-xl text-sm font-bold shadow-xl shadow-pink-500/30 transition transform hover:-translate-y-0.5 duration-200"
              >
                Start 14-Day Free Trial
              </button>
              <button
                onClick={onNavigateLogin}
                className="w-full sm:w-auto bg-white border-2 border-pink-500 text-pink-600 hover:bg-pink-50 px-9 py-4 rounded-xl text-sm font-bold shadow-sm transition duration-200"
              >
                Login to Admin Portal
              </button>
            </>
          )}
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 text-xs font-bold text-slate-700 max-w-3xl mx-auto">
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2">
            <Scissors className="w-4 h-4 text-pink-600" />
            <span>Stylist Commissions</span>
          </div>
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2">
            <CreditCard className="w-4 h-4 text-pink-600" />
            <span>POS & Thermal Receipts</span>
          </div>
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2">
            <Award className="w-4 h-4 text-pink-600" />
            <span>Client Memberships</span>
          </div>
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2">
            <BarChart3 className="w-4 h-4 text-pink-600" />
            <span>Live Sales Analytics</span>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="features" className="px-6 lg:px-12 py-20 bg-gradient-to-b from-white to-pink-50/40">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-pink-600">Designed For Salon Excellence</h2>
            <p className="text-3xl font-extrabold text-slate-900">Powerful Tools Built to Grow Your Salon Revenue</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-white to-pink-50/50 border border-pink-100 p-8 rounded-2xl space-y-4 hover:-translate-y-1 hover:shadow-xl hover:border-pink-300 transition duration-300">
              <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-xl shadow-sm">
                <CreditCard className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">POS Checkout & Split Payments</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Seamless checkout supporting Cash, Card, and UPI split allocations. Applies discounts, membership perks, and generates thermal receipts.
              </p>
            </div>

            <div className="bg-gradient-to-br from-white to-pink-50/50 border border-pink-100 p-8 rounded-2xl space-y-4 hover:-translate-y-1 hover:shadow-xl hover:border-pink-300 transition duration-300">
              <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-xl shadow-sm">
                <Award className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">VIP Membership Packages</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Automated customer membership tracking, free service benefit redemptions, renewal reminders, and tier upgrades.
              </p>
            </div>

            <div className="bg-gradient-to-br from-white to-pink-50/50 border border-pink-100 p-8 rounded-2xl space-y-4 hover:-translate-y-1 hover:shadow-xl hover:border-pink-300 transition duration-300">
              <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-xl shadow-sm">
                <Scissors className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Stylist Commission Tracking</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Assign stylists to treatment line items during checkout and automatically compute accurate commission payouts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section id="pricing" className="px-6 lg:px-12 py-20 max-w-6xl mx-auto w-full space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-xs uppercase font-extrabold tracking-widest text-pink-600">Transparent Pricing</h2>
          <p className="text-3xl font-extrabold text-slate-900">Choose the Perfect Plan for Your Parlour</p>
          <div className="flex justify-center items-center space-x-3 pt-2">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                billingCycle === "monthly" ? "bg-pink-600 text-white" : "bg-pink-50 text-slate-600"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                billingCycle === "yearly" ? "bg-pink-600 text-white" : "bg-pink-50 text-slate-600"
              }`}
            >
              Yearly Billing (Save 20%)
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white border border-pink-100 p-8 rounded-3xl space-y-6 shadow-sm flex flex-col justify-between hover:border-pink-300 transition duration-300">
            <div className="space-y-4">
              <span className="text-xs font-bold text-pink-600 uppercase tracking-wide bg-pink-50 px-3 py-1 rounded-full">Starter Salon</span>
              <h3 className="text-2xl font-extrabold text-slate-900">
                INR {billingCycle === "monthly" ? "999" : "799"} <span className="text-xs font-normal text-slate-500">/ mo</span>
              </h3>
              <p className="text-xs text-slate-600">Essential POS checkout and appointment management for growing boutique salons.</p>
              <ul className="text-xs text-slate-600 space-y-3 pt-4 border-t border-pink-100 font-medium">
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-bold" /><span>Up to 2 Stylists</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-bold" /><span>POS Billing & Receipts</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-bold" /><span>Basic Sales Analytics</span></li>
              </ul>
            </div>
            <button
              onClick={onNavigateRegister}
              className="w-full bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-600 py-3 rounded-xl text-xs font-bold transition duration-200"
            >
              Get Started
            </button>
          </div>

          <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8 rounded-3xl space-y-6 shadow-2xl relative flex flex-col justify-between transform md:-translate-y-2 border-2 border-pink-500">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-600 text-white px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
              Most Popular
            </div>
            <div className="space-y-4">
              <span className="text-xs font-bold text-pink-400 uppercase tracking-wide bg-slate-800 px-3 py-1 rounded-full border border-slate-700">Pro Parlour</span>
              <h3 className="text-2xl font-extrabold text-white">
                INR {billingCycle === "monthly" ? "1,999" : "1,599"} <span className="text-xs font-normal text-slate-400">/ mo</span>
              </h3>
              <p className="text-xs text-slate-300">Complete suite for high-volume beauty salons and chains.</p>
              <ul className="text-xs text-slate-300 space-y-3 pt-4 border-t border-slate-700 font-medium">
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-400 font-bold" /><span>Unlimited Stylists</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-400 font-bold" /><span>Client VIP Memberships</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-400 font-bold" /><span>Commission & Split Payments</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-400 font-bold" /><span>Inventory Stock Warnings</span></li>
              </ul>
            </div>
            <button
              onClick={onNavigateRegister}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white py-3 rounded-xl text-xs font-bold shadow-lg shadow-pink-500/30 transition duration-200"
            >
              Start Free Trial Now
            </button>
          </div>

          <div className="bg-white border border-pink-100 p-8 rounded-3xl space-y-6 shadow-sm flex flex-col justify-between hover:border-pink-300 transition duration-300">
            <div className="space-y-4">
              <span className="text-xs font-bold text-pink-600 uppercase tracking-wide bg-pink-50 px-3 py-1 rounded-full">Enterprise Chain</span>
              <h3 className="text-2xl font-extrabold text-slate-900">
                INR {billingCycle === "monthly" ? "3,999" : "3,199"} <span className="text-xs font-normal text-slate-500">/ mo</span>
              </h3>
              <p className="text-xs text-slate-600">Multi-location salon chains with central management controls.</p>
              <ul className="text-xs text-slate-600 space-y-3 pt-4 border-t border-pink-100 font-medium">
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-bold" /><span>Unlimited Everything</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-bold" /><span>Priority Customer Support</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-bold" /><span>Custom Tax & Receipt Templates</span></li>
              </ul>
            </div>
            <button
              onClick={onNavigateRegister}
              className="w-full bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-600 py-3 rounded-xl text-xs font-bold transition duration-200"
            >
              Contact Enterprise
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="mt-auto bg-slate-900 text-slate-300 px-6 lg:px-12 py-10 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-pink-600 flex items-center justify-center text-white font-bold">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm block">SmartGoNext Beauty Parlour</span>
              <span className="text-[10px] text-pink-400 font-semibold block">Salon Management SaaS Platform</span>
            </div>
          </div>
          <p className="text-slate-400">© 2026 SmartGoNext. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
