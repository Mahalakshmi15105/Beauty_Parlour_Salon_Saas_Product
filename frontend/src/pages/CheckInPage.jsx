import React, { useState, useEffect } from "react";
import API from "../services/api";
import { QrCode, MapPin, CheckCircle, AlertTriangle, ShieldAlert, LogIn, Lock, ArrowRight, RefreshCw } from "lucide-react";

export default function CheckInPage({ onNavigateHome }) {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Check-in state
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState(null);
  const [checkinError, setCheckinError] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle, fetching, success, error
  const [coords, setCoords] = useState(null);

  const searchParams = new URLSearchParams(window.location.search);
  const branchId = searchParams.get("branch_id") || "1";
  const tenantId = searchParams.get("tenant_id") || "1";

  // Handle Employee Login inside Checkin page
  const handleEmployeeLogin = (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    API.post("/auth/login", { email, password })
      .then((res) => {
        const payload = res?.data || res;
        const newToken = payload?.token || res?.token;
        const userObj = payload?.user || res?.user;
        if (!newToken) {
          setLoginError("Invalid server response format.");
          setLoginLoading(false);
          return;
        }
        localStorage.setItem("token", newToken);
        if (userObj) localStorage.setItem("user", JSON.stringify(userObj));
        setToken(newToken);
        setUser(userObj);
        setLoginLoading(false);
      })
      .catch((err) => {
        setLoginError(err.message || err.error || "Invalid credentials. Please enter your employee login details.");
        setLoginLoading(false);
      });
  };

  // Obtain GPS Location
  const requestLocation = () => {
    setLocationStatus("fetching");
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setCheckinError("GPS Geolocation is not supported by your mobile device browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationStatus("success");
      },
      (err) => {
        setLocationStatus("error");
        setCheckinError("GPS Location Permission Denied. Please allow location access on your phone to check in.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (token) {
      requestLocation();
    }
  }, [token]);

  // Submit Check-In
  const handleCheckInSubmit = () => {
    if (!coords) {
      requestLocation();
      return;
    }

    setCheckingIn(true);
    setCheckinError(null);
    setCheckinSuccess(null);

    API.post("/attendance/checkin", {
      branch_id: parseInt(branchId, 10),
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
      .then((res) => {
        setCheckinSuccess(res.data);
        setCheckingIn(false);
      })
      .catch((err) => {
        setCheckinError(err.message || "Attendance Rejected: You are outside the salon location radius.");
        setCheckingIn(false);
      });
  };

  // Submit Check-Out
  const handleCheckOutSubmit = () => {
    if (!coords) {
      requestLocation();
      return;
    }

    setCheckingIn(true);
    setCheckinError(null);
    setCheckinSuccess(null);

    API.post("/attendance/checkout", {
      branch_id: parseInt(branchId, 10),
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
      .then((res) => {
        setCheckinSuccess(res.data);
        setCheckingIn(false);
      })
      .catch((err) => {
        setCheckinError(err.message || "Check-out Rejected: You are outside the salon location radius.");
        setCheckingIn(false);
      });
  };

  return (
    <div className="min-h-screen glowe-bg-gradient flex flex-col items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-md w-full glowe-glass-card p-6 sm:p-8 rounded-3xl glowe-glow-shadow space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
            <QrCode className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Salon Employee Attendance</h1>
          <p className="text-xs text-slate-500 font-medium">Scan & Verify Parlour Branch Geofence Check-in / Check-out</p>
        </div>

        {/* 1. NOT LOGGED IN -> EMPLOYEE LOGIN MODAL */}
        {!token ? (
          <div className="space-y-4 pt-2">
            <div className="bg-pink-50/80 border border-pink-100 p-3.5 rounded-2xl flex items-center space-x-3 text-xs font-semibold text-pink-700">
              <Lock className="w-4 h-4 shrink-0 text-pink-600" />
              <span>Please sign in with your Salon Employee credentials to check in / check out.</span>
            </div>

            {loginError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-xs font-semibold text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleEmployeeLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employee Email / Phone</label>
                <input
                  type="text"
                  required
                  placeholder="Enter employee username or phone"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/90 border border-pink-100 px-4 py-3 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/90 border border-pink-100 px-4 py-3 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-pink-500"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full glowe-pink-gradient text-white py-3.5 rounded-full text-xs font-extrabold transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{loginLoading ? "Authenticating..." : "Sign In & Continue"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* 2. LOGGED IN -> CHECK-IN & GEOFENCE STATUS */
          <div className="space-y-5 pt-2">
            
            {/* Logged-in Staff Info */}
            <div className="bg-white/80 border border-pink-100 p-3.5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Logged in Staff</p>
                <p className="text-xs font-extrabold text-slate-900">{user?.email || "Employee"}</p>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  setToken(null);
                  setUser(null);
                }}
                className="text-[11px] font-bold text-pink-600 hover:underline"
              >
                Switch Account
              </button>
            </div>

            {/* GPS Location Status Box */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-pink-600" />
                  <span className="text-xs font-bold text-slate-800">GPS Location Verification</span>
                </div>
                {locationStatus === "fetching" && <RefreshCw className="w-3.5 h-3.5 text-pink-600 animate-spin" />}
              </div>

              {locationStatus === "fetching" && (
                <p className="text-xs text-slate-500">Detecting your phone's GPS coordinates...</p>
              )}
              {locationStatus === "success" && (
                <p className="text-xs font-semibold text-emerald-600">
                  GPS Coordinates Acquired ({coords?.latitude?.toFixed(4)}, {coords?.longitude?.toFixed(4)})
                </p>
              )}
              {locationStatus === "error" && (
                <p className="text-xs font-semibold text-rose-600">
                  Location Unavailable. Please grant location access.
                </p>
              )}
            </div>

            {/* ERROR / REJECTION NOTIFICATION */}
            {checkinError && (
              <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl space-y-2 text-center animate-shake">
                <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
                <h3 className="text-xs font-black text-rose-700 uppercase tracking-wider">Action Rejected</h3>
                <p className="text-xs font-semibold text-rose-600">{checkinError}</p>
                <button
                  onClick={requestLocation}
                  className="mt-2 text-xs font-bold text-pink-700 underline block mx-auto"
                >
                  Retry GPS Location Detection
                </button>
              </div>
            )}

            {/* SUCCESS NOTIFICATION */}
            {checkinSuccess && (
              <div className="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-2xl text-center space-y-3">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-sm font-black text-emerald-800">Attendance Logged!</h3>
                <p className="text-xs font-semibold text-emerald-700">{checkinSuccess.message}</p>
              </div>
            )}

            {/* CHECK-IN & CHECK-OUT ACTION BUTTONS */}
            {!checkinSuccess && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCheckInSubmit}
                  disabled={checkingIn || locationStatus === "fetching"}
                  className="glowe-pink-gradient text-white py-4 rounded-2xl text-xs font-extrabold shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <span>{checkingIn ? "Verifying..." : "Check In"}</span>
                </button>
                <button
                  onClick={handleCheckOutSubmit}
                  disabled={checkingIn || locationStatus === "fetching"}
                  className="bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-xs font-extrabold shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <span>{checkingIn ? "Verifying..." : "Check Out"}</span>
                </button>
              </div>
            )}

            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="w-full text-xs text-slate-500 font-bold hover:underline text-center block pt-2"
              >
                Back to Home Page
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
