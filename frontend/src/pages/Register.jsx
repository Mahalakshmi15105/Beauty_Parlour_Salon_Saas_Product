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
        const { token, user } = res.data;
        localStorage.setItem("token", token);
        onRegisterSuccess(token, user);
      })
      .catch((err) => {
        setLoading(false);
        setError(err.message || "Registration failed. Please try again.");
      });
  };

  useFormKeyboardNavigation(formRef, handleSubmit);

  return (
    <div className="min-h-screen glowe-bg-gradient flex flex-col justify-center items-center p-6 font-sans">
      <div className="max-w-md w-full glowe-glass-card p-8 rounded-3xl glowe-glow-shadow space-y-6">
        <div className="text-center space-y-2">
          <button onClick={onNavigateHome} className="text-xs text-pink-600 font-extrabold hover:underline mb-2 block mx-auto">
            ← Back to SmartGoNext Home
          </button>
          <h2 className="text-2xl font-black text-slate-900">Register Your Parlour</h2>
          <p className="text-xs text-slate-600 font-medium">Start your 14-day free trial. No credit card required.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-xs font-bold text-rose-600 text-center">
            {error}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Beauty Parlour Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Glamour Glow Salon"
              value={formData.parlour_name}
              onChange={(e) => setFormData({ ...formData, parlour_name: e.target.value })}
              className="w-full bg-white/90 border border-pink-100 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Owner Name</label>
            <input
              type="text"
              placeholder="Your full name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              className="w-full bg-white/90 border border-pink-100 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              placeholder="owner@yourparlour.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white/90 border border-pink-100 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-white/90 border border-pink-100 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              required
              placeholder="Create strong password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-white/90 border border-pink-100 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full glowe-pink-gradient hover:opacity-95 text-white py-3.5 rounded-full text-xs font-extrabold shadow-md shadow-pink-500/30 transition disabled:opacity-50 mt-2"
          >
            {loading ? "Creating Your Salon Account..." : "Create Account & Start Free Trial"}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-pink-100/60">
          <p className="text-xs text-slate-600 font-medium">
            Already have a parlour account?{" "}
            <button onClick={onNavigateLogin} className="text-pink-600 font-extrabold hover:underline">
              Log in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
