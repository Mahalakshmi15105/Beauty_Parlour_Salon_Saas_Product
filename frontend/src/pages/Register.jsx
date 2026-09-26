import React, { useState, useRef } from "react";
import API from "../services/api";
import { useFormKeyboardNavigation } from "../utils/keyboardNavigation";

function Register({ onRegisterSuccess, onNavigateLogin, onNavigateHome }) {
  const formRef = useRef(null);
  const [formData, setFormData] = useState({
    parlour_name: "",
    owner_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    API.post("/auth/register", formData)
      .then((res) => {
        setLoading(false);
        const payload = res?.data || res;
        const token = payload?.token || res?.token;
        const user = payload?.user || res?.user;
        if (token) {
          localStorage.setItem("token", token);
          localStorage.setItem("sidebar_collapsed", "true");
          if (user) localStorage.setItem("user", JSON.stringify(user));
          onRegisterSuccess(token, user);
        } else {
          setError(payload?.message || "Registration succeeded, but response was invalid.");
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(err.message || err.error || "Registration failed. Please try again.");
      });
  };

  useFormKeyboardNavigation(formRef, handleSubmit);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100/70 via-pink-50/40 to-white flex flex-col justify-center items-center p-6 font-sans">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl shadow-pink-500/15 border border-pink-100 space-y-7">
        <div className="text-center space-y-3">
          <button onClick={onNavigateHome} className="text-xs text-pink-600 font-extrabold hover:underline mb-3 block mx-auto transition-colors">
            ← Back to SmartGoNext Home
          </button>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Register Your Parlour</h2>
          <p className="text-xs text-slate-600 font-medium">Start your 14-day free trial. No credit card required.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-xs font-bold text-rose-600 text-center shadow-xs">
            {error}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Beauty Parlour Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Glamour Glow Salon"
              value={formData.parlour_name}
              onChange={(e) => setFormData({ ...formData, parlour_name: e.target.value })}
              className="w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Owner Name</label>
            <input
              type="text"
              placeholder="Your full name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address *</label>
            <input
              type="email"
              required
              placeholder="owner@yourparlour.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
            <input
              type="text"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Password *</label>
            <input
              type="password"
              required
              placeholder="Create strong password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 shadow-xs transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-600 hover:to-rose-600 text-white py-3.5 rounded-full text-xs font-extrabold shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40 transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
          >
            {loading ? "Creating Your Salon Account..." : "Create Account & Start Free Trial"}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-pink-100">
          <p className="text-xs text-slate-600 font-medium">
            Already have a parlour account?{" "}
            <button onClick={onNavigateLogin} className="text-pink-600 font-extrabold hover:underline transition-colors">
              Log in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
