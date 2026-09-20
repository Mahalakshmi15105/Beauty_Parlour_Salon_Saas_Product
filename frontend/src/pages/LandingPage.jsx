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
    <div className="min-h-screen glowe-bg-gradient text-slate-800 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* SaaS Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-pink-100/80 px-6 lg:px-12 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img
            src="/smartgonext-logo.png"
            alt="SmartGoNext Logo"
            className="w-10 h-10 object-contain rounded-xl shadow-md shadow-slate-900/10"
          />
          <div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 bg-clip-text text-transparent">
              SmartGoNext
            </span>
            <span className="text-[10px] text-pink-600 font-bold block -mt-1 uppercase tracking-widest">
              Beauty Parlour
            </span>
          </div>
        </div>

        <nav className="hidden md:flex space-x-8 text-xs font-extrabold text-slate-700">
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
                className="flex items-center space-x-1.5 text-xs font-bold border-2 border-pink-400 text-pink-600 hover:bg-pink-50 px-5 py-2.5 rounded-full transition duration-200 shadow-xs"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center space-x-1.5 glowe-pink-gradient hover:brightness-105 text-white px-6 py-2.5 rounded-full text-xs font-extrabold shadow-md transition transform hover:-translate-y-0.5 duration-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onNavigateLogin}
                className="glowe-login-btn text-xs font-bold px-6 py-2.5 rounded-full"
              >
                Login
              </button>
              <button
                onClick={onNavigateRegister}
                className="glowe-pink-gradient hover:brightness-105 text-white px-6 py-2.5 rounded-full text-xs font-extrabold shadow-md transition transform hover:-translate-y-0.5 duration-200"
              >
                Start Free Trial
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 lg:px-12 pt-16 pb-24 max-w-6xl mx-auto text-center space-y-8 glowe-glass-card w-full rounded-3xl mt-6 glowe-glow-shadow overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-pink-300/30 to-rose-200/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative inline-flex items-center space-x-2 bg-white/70 backdrop-blur-md border border-white/80 px-4 py-1.5 rounded-full text-xs font-extrabold text-pink-700 shadow-xs animate-reveal-badge">
          <Sparkles className="w-4 h-4 text-pink-600 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Premium Beauty Parlour & Salon Management Platform</span>
        </div>

        <h1 className="relative text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-tight max-w-4xl mx-auto">
          <span className="block animate-reveal-h1-main">SmartGoNext Beauty Parlour.</span>
          <span className="animate-shimmer-text animate-reveal-h1-sub block mt-2">
            Run Your Salon Smarter, Not Harder
          </span>
        </h1>

        <p className="text-base md:text-lg font-black text-pink-600 tracking-wide uppercase animate-reveal-desc">
          Complete Salon Management SaaS Platform
        </p>

        <p className="max-w-2xl mx-auto text-sm text-slate-700 leading-relaxed font-medium animate-reveal-desc">
          SmartGoNext Beauty Parlour is an all-in-one salon management software platform for
          beauty salon owners, parlour admins, and multi-location chains in India. It brings
          online appointments, POS checkout billing, stylist commissions, inventory reordering,
          membership packages, and real-time revenue analytics into one simple dashboard.
        </p>

        {/* Key takeaway / bottom-line summary for AI-answer extraction */}
        <div className="relative max-w-3xl mx-auto bg-white/90 border border-pink-200 rounded-2xl px-6 py-4 text-left shadow-xs text-sm transform hover:scale-[1.01] transition duration-300">
          <p className="text-xs uppercase font-black tracking-widest text-pink-600 mb-1">
            Key takeaway
          </p>
          <p className="text-slate-700 font-semibold leading-relaxed">
            Compared with juggling paper registers, Excel sheets, and separate apps, SmartGoNext
            gives salon owners one place to run bookings, billing, commissions, and memberships —
            so less time is wasted on admin and more revenue and client repeat visits are captured.
          </p>
        </div>

        <div className="relative flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          {isLoggedIn ? (
            <>
              <button
                onClick={onNavigateDashboard}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 glowe-pink-gradient hover:brightness-105 text-white px-9 py-4 rounded-full text-sm font-extrabold shadow-lg transition transform hover:-translate-y-1 hover:shadow-pink-500/50 duration-200"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Your Dashboard</span>
              </button>
              <button
                onClick={onLogout}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white border-2 border-pink-400 text-pink-600 hover:bg-pink-50 px-9 py-4 rounded-full text-sm font-bold shadow-xs transition transform hover:-translate-y-0.5 duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onNavigateRegister}
                className="w-full sm:w-auto glowe-pink-gradient text-white px-9 py-4 rounded-full text-sm font-extrabold transition transform hover:-translate-y-1 duration-200"
              >
                Start 14-Day Free Trial
              </button>
              <button
                onClick={onNavigateLogin}
                className="w-full sm:w-auto glowe-login-btn px-9 py-4 rounded-full text-sm font-bold transition transform hover:-translate-y-0.5 duration-200"
              >
                Login to Admin Portal
              </button>
            </>
          )}
        </div>

        {/* Hero dashboard illustration with descriptive alt text */}
        <div className="relative pt-10 animate-float-soft">
          <img
            src="/hero-dashboard.svg"
            alt="SmartGoNext salon management dashboard showing appointments, POS billing, stylist commissions, and analytics"
            width="600"
            height="420"
            className="mx-auto w-full max-w-2xl h-auto rounded-2xl border border-pink-100 shadow-2xl shadow-pink-500/20 hover:shadow-pink-500/30 transition duration-500"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 text-xs font-bold text-slate-700 max-w-3xl mx-auto">
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2 transform hover:-translate-y-1 hover:border-pink-300 transition duration-200">
            <Scissors className="w-4 h-4 text-pink-600" />
            <span>Stylist Commissions</span>
          </div>
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2 transform hover:-translate-y-1 hover:border-pink-300 transition duration-200">
            <CreditCard className="w-4 h-4 text-pink-600" />
            <span>POS & Thermal Receipts</span>
          </div>
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2 transform hover:-translate-y-1 hover:border-pink-300 transition duration-200">
            <Award className="w-4 h-4 text-pink-600" />
            <span>Client Memberships</span>
          </div>
          <div className="bg-white/80 border border-pink-100 py-3 px-4 rounded-xl shadow-xs flex items-center justify-center space-x-2 transform hover:-translate-y-1 hover:border-pink-300 transition duration-200">
            <BarChart3 className="w-4 h-4 text-pink-600" />
            <span>Live Sales Analytics</span>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="features" className="px-6 lg:px-12 py-20 animate-fade-in-up">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-xs uppercase font-black tracking-widest text-pink-600">Designed For Salon Excellence</h2>
            <p className="text-3xl font-black text-slate-900">Powerful Tools Built to Grow Your Salon Revenue</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glowe-glass-card p-8 rounded-3xl space-y-4 glowe-glow-shadow hover:-translate-y-2 hover:shadow-2xl hover:border-pink-300 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-pink-100/80 text-pink-600 flex items-center justify-center font-bold text-xl shadow-xs">
                <CreditCard className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">POS Checkout & Split Payments</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Seamless checkout supporting Cash, Card, and UPI split allocations. Applies discounts, membership perks, and generates thermal receipts.
              </p>
            </div>

            <div className="glowe-glass-card p-8 rounded-3xl space-y-4 glowe-glow-shadow hover:-translate-y-2 hover:shadow-2xl hover:border-pink-300 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-pink-100/80 text-pink-600 flex items-center justify-center font-bold text-xl shadow-xs">
                <Award className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">VIP Membership Packages</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Automated customer membership tracking, free service benefit redemptions, renewal reminders, and tier upgrades.
              </p>
            </div>

            <div className="glowe-glass-card p-8 rounded-3xl space-y-4 glowe-glow-shadow hover:-translate-y-2 hover:shadow-2xl hover:border-pink-300 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-pink-100/80 text-pink-600 flex items-center justify-center font-bold text-xl shadow-xs">
                <Scissors className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Stylist Commission Tracking</h3>
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
          <div className="glowe-glass-card p-8 rounded-3xl space-y-6 glowe-glow-shadow flex flex-col justify-between hover:border-pink-300 transition duration-300">
            <div className="space-y-4">
              <span className="text-xs font-black text-pink-600 uppercase tracking-wider bg-pink-50/80 px-3.5 py-1.5 rounded-full border border-pink-100 shadow-xs inline-block">Starter Salon</span>
              <h3 className="text-2xl font-black text-slate-900">
                INR {billingCycle === "monthly" ? "999" : "799"} <span className="text-xs font-normal text-slate-500">/ mo</span>
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">Essential POS checkout and appointment management for growing boutique salons.</p>
              <ul className="text-xs text-slate-600 space-y-3 pt-4 border-t border-pink-100/60 font-semibold">
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-black" /><span>Up to 2 Stylists</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-black" /><span>POS Billing & Receipts</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-black" /><span>Basic Sales Analytics</span></li>
              </ul>
            </div>
            <button
              onClick={onNavigateRegister}
              className="w-full bg-pink-50/90 hover:bg-pink-100 border border-pink-200 text-pink-600 py-3 rounded-full text-xs font-bold transition duration-200 shadow-xs"
            >
              Get Started
            </button>
          </div>

          <div className="glowe-glass-card glowe-pink-gradient text-white p-8 rounded-3xl space-y-6 shadow-2xl relative flex flex-col justify-between transform md:-translate-y-2 border-2 border-pink-400/50 glowe-glow-shadow">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white text-pink-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md">
              Most Popular
            </div>
            <div className="space-y-4 pt-2">
              <span className="text-xs font-black text-white uppercase tracking-wider bg-white/20 px-3.5 py-1.5 rounded-full border border-white/30 inline-block backdrop-blur-xs">Pro Parlour</span>
              <h3 className="text-2xl font-black text-white">
                INR {billingCycle === "monthly" ? "1,999" : "1,599"} <span className="text-xs font-normal text-pink-100">/ mo</span>
              </h3>
              <p className="text-xs text-pink-50 font-medium leading-relaxed">Complete suite for high-volume beauty salons and chains.</p>
              <ul className="text-xs text-white space-y-3 pt-4 border-t border-white/20 font-semibold">
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-white font-black" /><span>Unlimited Stylists</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-white font-black" /><span>Client VIP Memberships</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-white font-black" /><span>Commission & Split Payments</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-white font-black" /><span>Inventory Stock Warnings</span></li>
              </ul>
            </div>
            <button
              onClick={onNavigateRegister}
              className="w-full bg-white hover:bg-pink-50 text-pink-600 py-3.5 rounded-full text-xs font-black shadow-lg transition duration-200"
            >
              Start Free Trial Now
            </button>
          </div>

          <div className="glowe-glass-card p-8 rounded-3xl space-y-6 glowe-glow-shadow flex flex-col justify-between hover:border-pink-300 transition duration-300">
            <div className="space-y-4">
              <span className="text-xs font-black text-pink-600 uppercase tracking-wider bg-pink-50/80 px-3.5 py-1.5 rounded-full border border-pink-100 shadow-xs inline-block">Enterprise Chain</span>
              <h3 className="text-2xl font-black text-slate-900">
                INR {billingCycle === "monthly" ? "3,999" : "3,199"} <span className="text-xs font-normal text-slate-500">/ mo</span>
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">Multi-location salon chains with central management controls.</p>
              <ul className="text-xs text-slate-600 space-y-3 pt-4 border-t border-pink-100/60 font-semibold">
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-black" /><span>Unlimited Everything</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-black" /><span>Priority Customer Support</span></li>
                <li className="flex items-center space-x-2"><Check className="w-4 h-4 text-pink-500 font-black" /><span>Custom Tax & Receipt Templates</span></li>
              </ul>
            </div>
            <button
              onClick={onNavigateRegister}
              className="w-full bg-pink-50/90 hover:bg-pink-100 border border-pink-200 text-pink-600 py-3 rounded-full text-xs font-bold transition duration-200 shadow-xs"
            >
              Contact Enterprise
            </button>
          </div>
        </div>
      </section>

      {/* Who should use SmartGoNext - audience & use-case clarity + internal links */}
      <section id="about" className="px-6 lg:px-12 py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-center text-3xl font-black text-slate-900">
            Who is SmartGoNext salon software for?
          </h2>
          <p className="text-center text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
            SmartGoNext is built for Indian beauty salon owners, parlour admins, franchise owners,
            and multi-location salon chains. Whether you run a single boutique parlour or manage
            several branches, the platform gives you one dashboard to run{" "}
            <a href="#features" className="text-pink-600 font-bold hover:underline">
              appointments, billing, commissions, and analytics
            </a>
            .
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="glowe-glass-card p-6 rounded-2xl space-y-2 glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">Boutique salons</h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                Keep booking, billing, and client records organised without extra admin staff.
              </p>
            </div>
            <div className="glowe-glass-card p-6 rounded-2xl space-y-2 glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">Parlour owners &amp; managers</h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                Track stylist commissions, expiry reminders, and daily sales from a simple dashboard.
              </p>
            </div>
            <div className="glowe-glass-card p-6 rounded-2xl space-y-2 glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">Multi-branch salon chains</h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                Manage multiple locations with central controls, bulk data upload, and consistent
                receipts. Compare{" "}
                <a href="#pricing" className="text-pink-600 font-bold hover:underline">
                  plans and pricing
                </a>{" "}
                to find the fit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section - question headings with direct answers */}
      <section id="faq" className="px-6 lg:px-12 py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-xs uppercase font-black tracking-widest text-pink-600">FAQ</h2>
            <p className="text-3xl font-black text-slate-900">
              Frequently Asked Questions About SmartGoNext
            </p>
          </div>

          <div className="space-y-6">
            <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">What is SmartGoNext salon management software?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mt-2 font-medium">
                SmartGoNext is an all-in-one SaaS platform for beauty parlours and salons. It handles
                online appointments, point-of-sale billing, stylist commissions, client VIP memberships,
                inventory, and real-time revenue analytics in one dashboard.
              </p>
            </div>

            <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">How does salon management software help my parlour?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mt-2 font-medium">
                It replaces manual registers and scattered spreadsheets. You reduce double-bookings,
                cut billing errors, track every stylist&apos;s commission automatically, and see daily
                revenue and top services at a glance — so you spend less time on admin and more on clients.
              </p>
            </div>

            <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">Can multiple stylists track commissions in SmartGoNext?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mt-2 font-medium">
                Yes. Assign stylists to each treatment line item during checkout and SmartGoNext
                automatically computes accurate commission payouts per stylist.
              </p>
            </div>

            <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">How much does SmartGoNext cost?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mt-2 font-medium">
                Monthly plans start at INR 999 for Starter Salon, INR 1,999 for Pro Parlour, and INR
                3,999 for Enterprise Chain. Choosing yearly billing saves 20%. You can compare options
                on the{" "}
                <a href="#pricing" className="text-pink-600 font-bold hover:underline">pricing</a>{" "}
                section above.
              </p>
            </div>

            <div className="glowe-glass-card p-6 rounded-2xl glowe-glow-shadow">
              <h3 className="font-extrabold text-slate-900">Does SmartGoNext support client memberships and split payments?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mt-2 font-medium">
                Yes. It supports client VIP memberships with free-service redemptions and renewal
                reminders, and lets you split a bill across Cash, Card, and UPI during checkout.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500 max-w-3xl mx-auto leading-relaxed font-medium">
            India&apos;s beauty and personal care industry is one of the fastest-growing consumer
            markets in the region, which is why more salon owners are adopting digital management
            tools. Source:{" "}
            <a
              href="https://www.ibef.org/industry/services"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-600 font-bold hover:underline"
            >
              IBEF — India Brand Equity Foundation
            </a>
            .
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="mt-auto bg-slate-900/95 backdrop-blur-md text-slate-300 px-6 lg:px-12 py-10 text-xs border-t border-pink-500/20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl glowe-pink-gradient flex items-center justify-center text-white font-bold shadow-md shadow-pink-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-black text-white text-sm block">SmartGoNext Beauty Parlour</span>
              <span className="text-[10px] text-pink-400 font-bold block">Salon Management SaaS Platform</span>
            </div>
          </div>
          <p className="text-slate-400 font-medium">© 2026 SmartGoNext. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
