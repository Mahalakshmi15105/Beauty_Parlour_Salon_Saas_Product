import React, { useState, useEffect } from "react";
import API from "../services/api";
import { QrCode, Download, Printer, Search, RefreshCw, UserCheck, CheckCircle, AlertTriangle, ShieldAlert, FileText } from "lucide-react";
import { exportToPDF, exportToExcel, printDataList } from "../utils/exportUtils";

export default function Attendance() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isEmployee = user.role === "Employee";

  const [activeTab, setActiveTab] = useState("report"); // "report" or "qr"
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Filters
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [branchId, setBranchId] = useState("all");
  const [branches, setBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // QR Section State (Admin Only)
  const [selectedQrBranch, setSelectedQrBranch] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  // Manual Attendance State (Admin & Receptionist)
  const [showManualForm, setShowManualForm] = useState(true);
  const [manualAction, setManualAction] = useState("checkin"); // "checkin" or "checkout"
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualStatus, setManualStatus] = useState("P");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualFeedback, setManualFeedback] = useState(null);

  // Fetch branches and employees on mount
  useEffect(() => {
    API.get("/branches")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data?.data || res?.data || res?.items || []);
        setBranches(list);
        if (list.length > 0) {
          let targetB = null;
          if (user?.role === "BranchAdmin" && user?.branch_id) {
            targetB = list.find((b) => String(b.id) === String(user.branch_id));
          }
          if (!targetB) {
            targetB = list.find((b) => b.is_main_branch) || list[0];
          }
          const targetId = String(targetB.id);
          setSelectedQrBranch(targetId);
          if (!isEmployee) {
            fetchQrCode(targetId);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load branches in Attendance:", err);
      });

    // Fetch active employees for manual selection
    API.get("/employees?limit=100")
      .then((res) => {
        const items = res?.data?.items || res?.data?.data || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
        setEmployeesList(Array.isArray(items) ? items : []);
      })
      .catch((err) => console.error("Failed to load employees for manual attendance:", err));
  }, []);

  // Submit Manual Check-In
  const handleManualCheckInSubmit = (e) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setManualFeedback({ type: "error", message: "Please select an employee." });
      return;
    }
    setManualLoading(true);
    setManualFeedback(null);

    const selectedEmp = employeesList.find((e) => String(e.id) === String(selectedEmployeeId));
    const empBranchId = selectedEmp?.branch_id || user?.branch_id;

    API.post("/attendance/manual-checkin", {
      action_type: manualAction,
      employee_id: parseInt(selectedEmployeeId, 10),
      branch_id: empBranchId ? parseInt(empBranchId, 10) : undefined,
      reason: manualReason || "Manual Front-Desk Fallback",
      status: manualStatus,
    })
      .then((res) => {
        setManualLoading(false);
        setManualFeedback({ type: "success", message: res.data?.message || "Manual attendance recorded successfully." });
        setManualReason("");
        fetchAttendance();
      })
      .catch((err) => {
        setManualLoading(false);
        const msg = err.response?.data?.message || err.message || "Manual attendance action failed.";
        setManualFeedback({ type: "error", message: msg });
      });
  };

  // Fetch attendance records
  const fetchAttendance = () => {
    setLoading(true);
    let url = `/attendance?`;
    if (branchId && branchId !== "all") url += `branch_id=${branchId}&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;

    API.get(url)
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
          ? res.data.data
          : [];
        setRecords(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load attendance records");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAttendance();
  }, [startDate, endDate, branchId]);

  // Generate QR image (Admin only)
  const fetchQrCode = (bId) => {
    if (!bId) return;
    setQrLoading(true);
    API.get(`/attendance/qr/image?branch_id=${bId}`, { responseType: "blob" })
      .then((res) => {
        const blobData = res instanceof Blob ? res : (res?.data instanceof Blob ? res.data : new Blob([res]));
        const url = URL.createObjectURL(blobData);
        setQrImageUrl(url);
        setQrLoading(false);
      })
      .catch((err) => {
        console.warn("Backend QR fetch notice, activating instant fallback QR generator:", err);
        const checkinUrl = `${window.location.origin}/attendance/checkin?branch_id=${bId}&tenant_id=1`;
        const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkinUrl)}&color=FF4D6D`;
        setQrImageUrl(fallbackUrl);
        setQrLoading(false);
      });
  };

  useEffect(() => {
    if (!isEmployee && activeTab === "qr" && selectedQrBranch) {
      fetchQrCode(selectedQrBranch);
    }
  }, [activeTab, selectedQrBranch, isEmployee]);

  // Filtered records
  const filteredRecords = records.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.employee_name?.toLowerCase().includes(q) ||
      r.work_branch_name?.toLowerCase().includes(q) ||
      r.home_branch_name?.toLowerCase().includes(q) ||
      r.date?.includes(q)
    );
  });

  // Export Table Data
  const exportColumns = [
    { header: "Employee Name", accessor: "employee_name" },
    { header: "Branch", accessor: "work_branch_name" },
    { header: "Date", accessor: "date" },
    { header: "Check-in Time", accessor: "checkin_time" },
    { header: "Check-out Time", accessor: "checkout_time" },
    { header: "Status", accessor: "status" },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Sub-Navigation Tabs */}
      <div className="bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-pink-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-pink-600 font-extrabold text-xs uppercase tracking-wider mb-1">
              <UserCheck className="w-4 h-4" />
              <span>Employee Attendance System</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {isEmployee ? "My Attendance Records" : "Attendance Logs & Branch QR Generator"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {isEmployee
                ? "Read-only history of your past check-ins, check-outs, and attendance status."
                : "Manage attendance reports, front-desk manual fallback, and location-scoped reception QR codes."}
            </p>
          </div>

          {/* Tab Switcher - Only shown for Admins */}
          {!isEmployee && (
            <div className="flex items-center space-x-2 bg-pink-50/80 p-1.5 rounded-full border border-pink-100">
              <button
                onClick={() => setActiveTab("report")}
                className={`px-5 py-2 rounded-full text-xs font-extrabold transition ${
                  activeTab === "report" ? "glowe-pink-gradient text-white shadow-md" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Attendance Report</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`px-5 py-2 rounded-full text-xs font-extrabold transition ${
                  activeTab === "manual" ? "glowe-pink-gradient text-white shadow-md" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Manual Attendance</span>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab("qr");
                  if (branches.length > 0 && !selectedQrBranch) setSelectedQrBranch(String(branches[0].id));
                }}
                className={`px-5 py-2 rounded-full text-xs font-extrabold transition ${
                  activeTab === "qr" ? "glowe-pink-gradient text-white shadow-md" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Attendance QR Generator</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. ATTENDANCE REPORT VIEW */}
      {activeTab === "report" && (
        <div className="space-y-4">

          {/* Filter Toolbar */}
          <div className="bg-white/80 p-4 rounded-2xl border border-pink-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Range Filters */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background border border-border-soft px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary numeric"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background border border-border-soft px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary numeric"
                />
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Search Records</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter by date or branch..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border border-border-soft px-3.5 py-1.5 pl-8 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary w-48"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Export Toolbar */}
            <div className="flex items-center space-x-2 pt-4 md:pt-0">
              <button
                onClick={() => exportToExcel("Attendance Logs", filteredRecords, exportColumns, "Attendance_Report")}
                className="px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                onClick={() => exportToPDF("Attendance Logs", filteredRecords, exportColumns, "Attendance_Report")}
                className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => printDataList("Attendance Logs", filteredRecords, exportColumns)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs font-bold transition flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Read-Only Attendance Log Table */}
          <div className="bg-white/80 rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-bold space-y-2">
                <RefreshCw className="w-6 h-6 text-pink-600 animate-spin mx-auto" />
                <span>Loading Attendance History...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No attendance logs found for the selected dates.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-pink-50/60 border-b border-pink-100 text-[11px] font-black uppercase text-pink-800 tracking-wider">
                      {!isEmployee && <th className="p-3.5">Employee</th>}
                      <th className="p-3.5">Branch</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Check-In Time</th>
                      <th className="p-3.5">Check-Out Time</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-100/60 text-xs font-medium text-slate-800">
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-pink-50/30 transition">
                        {!isEmployee && (
                          <td className="p-3.5 font-bold text-slate-900">
                            <div>{r.employee_name}</div>
                            {r.employee_phone && <div className="text-[11px] text-slate-400 font-normal numeric">{r.employee_phone}</div>}
                          </td>
                        )}
                        <td className="p-3.5 font-bold text-pink-600">{r.work_branch_name}</td>
                        <td className="p-3.5 font-bold text-slate-900 numeric">{r.date}</td>
                        <td className="p-3.5 font-semibold text-slate-800 numeric">{r.checkin_time || r.time || "-"}</td>
                        <td className="p-3.5 font-semibold text-slate-800 numeric">{r.checkout_time || "-"}</td>
                        <td className="p-3.5">
                          {r.status === "P" || r.status === "Present" ? (
                            <span className="inline-flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-[11px] font-extrabold">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Present (Full Day)</span>
                            </span>
                          ) : r.status === "HP" ? (
                            <span className="inline-flex items-center space-x-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full text-[11px] font-extrabold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Half Day (HP)</span>
                            </span>
                          ) : r.status === "OFF" ? (
                            <span className="inline-flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1 rounded-full text-[11px] font-extrabold">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>Off / Leave</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1 rounded-full text-[11px] font-extrabold">
                              <span>{r.status}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MANUAL FRONT-DESK FALLBACK VIEW (Admins & Receptionists) */}
      {!isEmployee && activeTab === "manual" && (
        <div className="bg-white/90 border border-pink-100 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-pink-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Manual Front-Desk Fallback</h2>
              <p className="text-xs text-slate-500 font-medium">Overide or log manual employee check-in when phone QR or GPS is unavailable.</p>
            </div>
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="text-xs font-extrabold text-pink-600 hover:text-pink-700 hover:underline transition"
            >
              {showManualForm ? "Hide Manual Form" : "Show Manual Form"}
            </button>
          </div>

          {showManualForm && (
            <form onSubmit={handleManualCheckInSubmit} className="space-y-5 pt-2">
              {manualFeedback && (
                <div
                  className={`p-4 rounded-2xl text-xs font-bold ${
                    manualFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {manualFeedback.message}
                </div>
              )}

              {/* Explicit Action Selector */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  ATTENDANCE ACTION *
                </label>
                <div className="flex flex-wrap items-center gap-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="manualAction"
                      value="checkin"
                      checked={manualAction === "checkin"}
                      onChange={() => setManualAction("checkin")}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">Manual Check-In</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="manualAction"
                      value="checkout"
                      checked={manualAction === "checkout"}
                      onChange={() => setManualAction("checkout")}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">Manual Check-Out</span>
                  </label>
                </div>
              </div>

              {/* Status Selector */}
              {manualAction === "checkin" && (
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                    ATTENDANCE STATUS *
                  </label>
                  <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="manualStatus"
                        value="P"
                        checked={manualStatus === "P"}
                        onChange={() => setManualStatus("P")}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-extrabold text-emerald-700">P (Present)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="manualStatus"
                        value="HP"
                        checked={manualStatus === "HP"}
                        onChange={() => setManualStatus("HP")}
                        className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="text-xs font-extrabold text-amber-700">HP (Half Day)</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="manualStatus"
                        value="L"
                        checked={manualStatus === "L" || manualStatus === "OFF"}
                        onChange={() => setManualStatus("L")}
                        className="w-4 h-4 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="text-xs font-extrabold text-rose-700">L / OFF (Leave / Day Off)</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  SELECT MEMBER / EMPLOYEE *
                </label>
                <select
                  required
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500 transition numeric"
                >
                  <option value="">Select a member / employee</option>
                  {(Array.isArray(employeesList) ? employeesList : []).map((emp) => (
                    <option key={emp.id} value={emp.id} className="numeric">
                      {emp.first_name} {emp.last_name || ""} ({emp.phone || "No phone"}) - {emp.role || "Staff"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="glowe-pink-gradient text-white font-extrabold text-xs px-8 py-4 rounded-2xl shadow-md hover:shadow-lg transition disabled:opacity-50"
                >
                  {manualLoading
                    ? manualAction === "checkin"
                      ? "Submitting Manual Check-In..."
                      : "Submitting Manual Check-Out..."
                    : manualAction === "checkin"
                    ? "Submit Manual Check-In"
                    : "Submit Manual Check-Out"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 3. ATTENDANCE QR GENERATOR VIEW (Admins Only) */}
      {!isEmployee && activeTab === "qr" && (
        <div className="bg-white/80 border border-pink-100 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Generate Reception Check-in QR Code</h2>
              <p className="text-xs text-slate-500 font-medium">
                High-resolution desk reception QR code for employee check-in.
              </p>
            </div>

            {/* QR Card Preview */}
            <div className="bg-gradient-to-b from-pink-50/80 to-rose-50/50 border-2 border-dashed border-pink-300 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[320px] text-center space-y-4 shadow-sm">
              {qrLoading ? (
                <div className="space-y-3">
                  <RefreshCw className="w-10 h-10 text-pink-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-pink-700">Generating High-Resolution Branch QR Code...</p>
                </div>
              ) : qrImageUrl ? (
                <>
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-pink-100">
                    <img src={qrImageUrl} alt="Branch Attendance QR" className="w-60 h-60 object-contain mx-auto rounded-xl" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                      {branches.find((b) => String(b.id) === String(selectedQrBranch))?.name || "Main Parlour"}
                    </h3>
                    <p className="text-xs font-bold text-pink-600 mt-1">Reception Desk Attendance QR Code</p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 font-bold">Please select a branch to view its QR code.</p>
              )}
            </div>

            {/* Actions */}
            {qrImageUrl && (
              <div className="flex justify-center items-center space-x-4">
                <a
                  href={qrImageUrl}
                  download={`${branches.find((b) => String(b.id) === String(selectedQrBranch))?.name || "Branch"}_Attendance_QR.png`}
                  className="glowe-pink-gradient text-white px-7 py-3.5 rounded-full text-xs font-extrabold shadow-lg flex items-center space-x-2 transition hover:brightness-105"
                >
                  <Download className="w-4 h-4" />
                  <span>Download High-Res Image</span>
                </a>
                <button
                  onClick={() => {
                    const win = window.open("", "_blank");
                    win.document.write(`
                      <html>
                        <head><title>Print QR Code</title></head>
                        <body style="text-align:center; font-family:sans-serif; padding:40px;">
                          <h2>${branches.find((b) => String(b.id) === String(selectedQrBranch))?.name || "Parlour"}</h2>
                          <p>Scan to Mark Staff Attendance</p>
                          <img src="${qrImageUrl}" style="width:300px; height:300px; margin:20px auto; display:block;" />
                        </body>
                      </html>
                    `);
                    win.document.close();
                    win.print();
                  }}
                  className="bg-white border-2 border-pink-300 text-pink-600 hover:bg-pink-50 px-7 py-3.5 rounded-full text-xs font-bold shadow-xs flex items-center space-x-2 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Desk QR</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
