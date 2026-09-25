import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { QrCode, MapPin, CheckCircle, AlertTriangle, ShieldAlert, Lock, ArrowRight, RefreshCw, UserCheck } from "lucide-react";

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

  // Automatic Check-in / Check-out state
  const [status, setStatus] = useState("idle"); // idle, requesting_gps, submitting, success, completed, error, gps_denied
  const [coords, setCoords] = useState(null);
  const [resultMessage, setResultMessage] = useState("");
  const [resultData, setResultData] = useState(null);

  const searchParams = new URLSearchParams(window.location.search);
  const branchId = searchParams.get("branch_id") || "1";
  const tenantId = searchParams.get("tenant_id") || "1";

  const hasTriggeredRef = useRef(false);

  // Manual Front-Desk Fallback State
  const [showManualForm, setShowManualForm] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualFeedback, setManualFeedback] = useState(null);

  useEffect(() => {
    if (token) {
      API.get("/employees?limit=100")
        .then((res) => {
          const items = res?.data?.items || res?.data?.data || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
          setEmployeesList(Array.isArray(items) ? items : []);
        })
        .catch((err) => console.error("Failed to load employees:", err));
    }
  }, [token]);

  const handleManualCheckIn = (e) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setManualFeedback({ type: "error", message: "Please select a member / employee." });
      return;
    }
    setManualLoading(true);
    setManualFeedback(null);

    API.post("/attendance/manual-checkin", {
      employee_id: parseInt(selectedEmployeeId, 10),
      branch_id: parseInt(branchId, 10),
      reason: manualReason || "Manual Front-Desk Fallback",
    })
      .then((res) => {
        setManualLoading(false);
        setManualFeedback({ type: "success", message: res.data?.message || "Manual check-in submitted successfully." });
        setManualReason("");
      })
      .catch((err) => {
        setManualLoading(false);
        setManualFeedback({ type: "error", message: err.response?.data?.message || err.message || "Manual check-in failed." });
      });
  };

  // Handle Employee Login inside Checkin page (preserves URL branch_id)
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

  // Submit Auto-Scan API call once GPS coordinates are acquired
  const submitAutoScan = (lat, lng) => {
    setStatus("submitting");
    API.post("/attendance/auto-scan", {
      branch_id: parseInt(branchId, 10),
      latitude: lat,
      longitude: lng,
    })
      .then((res) => {
        const data = res.data;
        if (data.status === "completed") {
          setStatus("completed");
          setResultMessage(data.message);
          setResultData(data.data);
        } else {
          setStatus("success");
          setResultMessage(data.message);
          setResultData(data.data);
        }
      })
      .catch((err) => {
        const errMessage = err.response?.data?.message || err.message || "Attendance request rejected.";
        setStatus("error");
        setResultMessage(errMessage);
      });
  };

  // AUTOMATIC GPS Location Acquisition & Submission (NO BUTTON CLICK NEEDED)
  const autoDetectAndSubmit = () => {
    setStatus("requesting_gps");
    setResultMessage("");

    if (!navigator.geolocation) {
      setStatus("gps_denied");
      setResultMessage("GPS Geolocation is not supported by your mobile device browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setCoords({ latitude, longitude });
        submitAutoScan(latitude, longitude);
      },
      (err) => {
        setStatus("gps_denied");
        setResultMessage("❌ GPS Location Permission Denied. Please enable location access on your phone to check in / check out.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Automatically trigger GPS & Submission on page load when logged in
  useEffect(() => {
    if (token && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      autoDetectAndSubmit();
    }
  }, [token]);

  return (
    <div className="min-h-screen glowe-bg-gradient flex flex-col items-center justify-center p-4 font-sans text-slate-900">
      <div className="max-w-md w-full glowe-glass-card p-6 sm:p-8 rounded-3xl glowe-glow-shadow space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
            <QrCode className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Salon Employee Attendance</h1>
          <p className="text-xs text-slate-500 font-medium">Automatic Reception Desk QR Check-in & Check-out</p>
        </div>

        {/* 1. NOT LOGGED IN -> EMPLOYEE LOGIN FORM */}
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
                className="w-full glowe-pink-gradient text-white py-3.5 rounded-full text-xs font-extrabold transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-md"
              >
                <span>{loginLoading ? "Authenticating..." : "Sign In & Continue"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* 2. LOGGED IN -> AUTOMATIC CHECK-IN / CHECK-OUT STATUS */
          <div className="space-y-5 pt-2">
            
            {/* Logged-in Staff Bar */}
            <div className="bg-white/80 border border-pink-100 p-3.5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logged in Staff</p>
                <p className="text-xs font-extrabold text-slate-900">{user?.email || "Employee"}</p>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  setToken(null);
                  setUser(null);
                  hasTriggeredRef.current = false;
                }}
                className="text-[11px] font-bold text-pink-600 hover:underline"
              >
                Switch Account
              </button>
            </div>

            {/* A. LOADING / AUTOMATIC DETECTING STATE */}
            {(status === "requesting_gps" || status === "submitting") && (
              <div className="bg-pink-50/90 border border-pink-200 p-8 rounded-3xl text-center space-y-4 shadow-sm">
                <RefreshCw className="w-10 h-10 text-pink-600 animate-spin mx-auto" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {status === "requesting_gps" ? "Acquiring GPS Location..." : "Verifying Parlour Geofence..."}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {status === "requesting_gps"
                      ? "Requesting GPS coordinates from your device..."
                      : "Submitting automatic attendance verification to backend..."}
                  </p>
                </div>
              </div>
            )}

            {/* B. GPS DENIED STATE */}
            {status === "gps_denied" && (
              <div className="bg-rose-50 border-2 border-rose-300 p-5 rounded-2xl space-y-3 text-center">
                <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
                <h3 className="text-sm font-black text-rose-800">GPS Location Required</h3>
                <p className="text-xs font-semibold text-rose-700">{resultMessage}</p>
                <button
                  onClick={autoDetectAndSubmit}
                  className="glowe-pink-gradient text-white px-6 py-3 rounded-full text-xs font-extrabold shadow-md flex items-center justify-center space-x-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Enable Location & Retry</span>
                </button>
              </div>
            )}

            {/* C. SUCCESS SCREEN (Check-In or Check-Out) */}
            {status === "success" && (
              <div className="bg-emerald-50 border-2 border-emerald-300 p-6 rounded-3xl text-center space-y-4 shadow-md animate-fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-emerald-900">Attendance Logged!</h3>
                  <p className="text-xs font-extrabold text-emerald-700 mt-1">{resultMessage}</p>
                </div>

                {resultData && (
                  <div className="bg-white/90 p-4 rounded-2xl text-left border border-emerald-200 text-xs space-y-1.5 font-medium text-slate-700">
                    <p className="flex justify-between">
                      <span className="font-bold text-slate-500">Branch:</span>
                      <span className="font-extrabold text-slate-900">{resultData.branch_name}</span>
                    </p>
                    {resultData.checkin_time && (
                      <p className="flex justify-between">
                        <span className="font-bold text-slate-500">Check-in Time:</span>
                        <span className="font-extrabold text-slate-900">{resultData.checkin_time}</span>
                      </p>
                    )}
                    {resultData.checkout_time && (
                      <p className="flex justify-between">
                        <span className="font-bold text-slate-500">Check-out Time:</span>
                        <span className="font-extrabold text-slate-900">{resultData.checkout_time}</span>
                      </p>
                    )}
                    {resultData.status && (
                      <p className="flex justify-between">
                        <span className="font-bold text-slate-500">Status:</span>
                        <span className="font-extrabold text-emerald-700">{resultData.status}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* D. COMPLETED SCREEN (Already Checked In & Out Today) */}
            {status === "completed" && (
              <div className="bg-blue-50 border-2 border-blue-300 p-6 rounded-3xl text-center space-y-4 shadow-md">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <UserCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-black text-blue-900">Today's Attendance Completed</h3>
                  <p className="text-xs font-extrabold text-blue-800 mt-1">{resultMessage}</p>
                </div>
              </div>
            )}

            {/* E. ERROR SCREEN (Geofence Rejection / Already Checked-In / Out of Radius) */}
            {status === "error" && (
              <div className={`border-2 p-6 rounded-3xl text-center space-y-4 shadow-md ${
                resultMessage?.includes("Already") || resultMessage?.includes("already")
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-rose-50 border-rose-300 text-rose-900"
              }`}>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
                  resultMessage?.includes("Already") || resultMessage?.includes("already")
                    ? "bg-amber-100 text-amber-600"
                    : "bg-rose-100 text-rose-600"
                }`}>
                  {resultMessage?.includes("Already") || resultMessage?.includes("already") ? (
                    <UserCheck className="w-8 h-8 text-amber-600" />
                  ) : (
                    <ShieldAlert className="w-8 h-8 text-rose-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wide">
                    {resultMessage?.includes("Already") || resultMessage?.includes("already")
                      ? "Attendance Already Logged"
                      : "Check-in Rejected"}
                  </h3>
                  <p className="text-xs font-extrabold mt-2 leading-relaxed">{resultMessage}</p>
                </div>

                <button
                  onClick={autoDetectAndSubmit}
                  className="glowe-pink-gradient text-white px-6 py-3 rounded-full text-xs font-extrabold shadow-md flex items-center justify-center space-x-2 mx-auto mt-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Re-verify Geofence & Location</span>
                </button>
              </div>
            )}

            {/* F. MANUAL FRONT-DESK FALLBACK CARD (Exact match of Reference UI) */}
            <div className="bg-white/90 border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm space-y-4 text-left pt-4 mt-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Manual Front-Desk Fallback</h3>
                <button
                  type="button"
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="text-xs font-extrabold text-pink-600 hover:text-pink-700 hover:underline transition"
                >
                  {showManualForm ? "Hide Manual Form" : "Show Manual Form"}
                </button>
              </div>

              {showManualForm && (
                <form onSubmit={handleManualCheckIn} className="space-y-4 pt-1">
                  {manualFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold ${
                        manualFeedback.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {manualFeedback.message}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                      SELECT MEMBER *
                    </label>
                    <select
                      required
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
                    >
                      <option value="">Select a member</option>
                      {(Array.isArray(employeesList) ? employeesList : []).map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name || ""} ({emp.phone || "Staff"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                      MANUAL REASON (LOGGED FOR AUDIT) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Member phone battery dead"
                      value={manualReason}
                      onChange={(e) => setManualReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={manualLoading}
                    className="glowe-pink-gradient text-white font-extrabold text-xs px-6 py-3 rounded-full shadow-md hover:shadow-lg transition disabled:opacity-50"
                  >
                    {manualLoading ? "Submitting..." : "Submit Manual Check-In"}
                  </button>
                </form>
              )}
            </div>

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
