import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useModalFocusTrap, useFormKeyboardNavigation } from "../utils/keyboardNavigation";
import { X, Printer, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF } from "../utils/exportUtils";

function MembershipPlans() {
  const { formatCurrency, currencySymbol, t } = useLanguageCurrency();
  const modalRef = useRef(null);
  const formRef = useRef(null);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [services, setServices] = useState([]);

  // Form Modal Toggle
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  
  // Plan Validity & Date State
  const getTodayDateStr = () => new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState("");
  const [validityType, setValidityType] = useState(""); // "" (choose plan), "Monthly", "Yearly"
  const [validityValue, setValidityValue] = useState(""); // number of months or years

  const calculateEndDate = (sDate, vType, vVal) => {
    if (!vVal || parseInt(vVal, 10) <= 0) return "";
    const effectiveStart = sDate || getTodayDateStr();
    const base = new Date(effectiveStart);
    if (isNaN(base.getTime())) return "";

    const count = parseInt(vVal, 10);
    const result = new Date(base);
    if (vType === "Yearly") {
      result.setFullYear(result.getFullYear() + count);
    } else {
      result.setMonth(result.getMonth() + count);
    }
    return result.toISOString().split("T")[0];
  };

  const computedStartDate = validityValue ? (startDate || getTodayDateStr()) : startDate;
  const computedEndDate = validityValue ? calculateEndDate(computedStartDate, validityType, validityValue) : "";

  // Plan Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration_days: "365",
    service_discount_percentage: "0",
    status: "active",
    day_restrictions: [],
    eligible_services: [],
  });

  useModalFocusTrap(showModal, modalRef, () => setShowModal(false));
  useFormKeyboardNavigation(formRef, () => {
    const submitBtn = modalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  useEffect(() => {
    API.get("/services?limit=100")
      .then((res) => {
        setServices(res.data.items || []);
      })
      .catch((err) => console.error("Failed to load services:", err));
  }, []);

  const fetchPlans = (currentCursor = null) => {
    setLoading(true);
    let url = `/membership-plans?limit=10`;
    if (currentCursor) url += `&cursor=${currentCursor}`;
    if (search) url += `&q=${search}`;
    if (status) url += `&status=${status}`;

    API.get(url)
      .then((res) => {
        setPlans(res.data.items);
        setNextCursor(res.data.next_cursor);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load membership plans.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPlans();
  }, [search, status]);

  const handlePrint = () => {
    const columns = [
      { header: "Plan Name", accessor: "name" },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}` },
      { header: "Validity", accessor: (row) => `${row.duration_days} Days` },
      { header: "Status", accessor: "status" }
    ];
    printDataList("Membership Plans Directory", plans, columns);
  };

  const handleExportExcel = () => {
    const columns = [
      { header: "Plan Name", accessor: "name" },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}` },
      { header: "Validity", accessor: (row) => `${row.duration_days} Days` },
      { header: "Status", accessor: "status" }
    ];
    exportToCSV(plans, columns, "membership_plans_list");
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "Plan Name", accessor: "name", width: 40 },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}`, width: 25 },
      { header: "Validity", accessor: (row) => `${row.duration_days} Days`, width: 25 },
      { header: "Status", accessor: "status", width: 15 }
    ];
    exportToPDF("Membership Plans Directory", plans, columns, "membership_plans_list");
  };

  const handleNextPage = () => {
    if (nextCursor) {
      setCursorHistory([...cursorHistory, cursor]);
      setCursor(nextCursor);
      fetchPlans(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prev = cursorHistory[cursorHistory.length - 1];
      const newHistory = cursorHistory.slice(0, -1);
      setCursorHistory(newHistory);
      setCursor(prev);
      fetchPlans(prev);
    }
  };

  const openAddModal = () => {
    setEditId(null);
    setStartDate("");
    setValidityType("");
    setValidityValue("");
    setFormData({
      name: "",
      description: "",
      price: "",
      duration_days: "365",
      service_discount_percentage: "0",
      status: "active",
      day_restrictions: [],
      eligible_services: [],
    });
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditId(p.id);
    const dur = parseInt(p.duration_days, 10) || 365;
    if (dur % 365 === 0 && dur >= 365) {
      setValidityType("Yearly");
      setValidityValue(String(dur / 365));
    } else {
      setValidityType("Monthly");
      setValidityValue(String(Math.max(1, Math.round(dur / 30))));
    }

    setFormData({
      name: p.name || "",
      description: "",
      price: p.price || "",
      duration_days: p.duration_days || "365",
      service_discount_percentage: "0",
      status: p.status || "active",
      day_restrictions: p.day_restrictions || [],
      eligible_services: [],
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validityType) {
      alert("Please select a validity plan type (Monthly or Yearly).");
      return;
    }

    const count = Math.max(1, parseInt(validityValue, 10) || 1);
    const calculatedDurationDays = validityType === "Yearly" ? count * 365 : count * 30;

    const payload = {
      ...formData,
      description: "",
      service_discount_percentage: 0,
      eligible_services: [],
      duration_days: calculatedDurationDays,
    };

    const action = editId ? API.put(`/membership-plans/${editId}`, payload) : API.post("/membership-plans", payload);

    action
      .then(() => {
        setShowModal(false);
        fetchPlans(cursor);
      })
      .catch((err) => {
        const errMsg = err.response?.data?.message || err.message || "Operation failed.";
        alert(errMsg);
      });
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this membership plan?")) {
      API.delete(`/membership-plans/${id}`)
        .then(() => {
          fetchPlans(cursor);
        })
        .catch((err) => {
          alert(err.message || "Failed to delete.");
        });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Membership Plans</h1>
          <p className="text-xs text-text-secondary">Configure salon membership tiers, pricing, free perks, and discount rates.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Create Plan
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-surface border border-border-soft p-4 rounded-lg flex space-x-4 items-center">
        <input
          type="text"
          placeholder="Search plan name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-background border border-border-soft px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-background border border-border-soft px-4 py-2 rounded-lg text-sm text-text-secondary focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="flex space-x-2 border-l border-border-soft pl-4">
          <button
            onClick={handlePrint}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-200"
            title="Print List"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-emerald-200"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-rose-200"
            title="Export to PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-surface border border-border-soft rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 bg-border-soft rounded animate-pulse w-1/4"></div>
            <div className="h-10 bg-border-soft rounded animate-pulse"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-danger text-sm font-medium">{error}</div>
        ) : plans.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-text-secondary mb-4">No membership plans created yet.</p>
            <button onClick={openAddModal} className="text-sm text-primary font-medium hover:underline">
              Create your first plan
            </button>
          </div>
        ) : (
          <>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary-light border-b border-border-soft">
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Plan Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Price</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Validity</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-background/50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      <p>{p.name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{formatCurrency(p.price)}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{p.duration_days} Days</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        p.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <button onClick={() => openEditModal(p)} className="text-primary hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-danger hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-border-soft flex justify-between items-center">
              <button
                disabled={cursorHistory.length === 0}
                onClick={handlePrevPage}
                className="px-4 py-2 border border-border-soft rounded-lg text-sm disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                disabled={!nextCursor}
                onClick={handleNextPage}
                className="px-4 py-2 border border-border-soft rounded-lg text-sm disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="bg-surface max-w-lg w-full rounded-lg shadow-lg border border-border-soft overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center shrink-0">
              <h3 className="text-md font-semibold text-text-primary">
                {editId ? "Edit Membership Plan" : "Create Membership Plan"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gold VIP Plan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Price ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Validity Fields (Plan Type Dropdown + Editable Duration Count) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Validity Plan *</label>
                    <select
                      required
                      value={validityType}
                      onChange={(e) => setValidityType(e.target.value)}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                    >
                      <option value="">choose plan</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Duration Count ({validityType === "Yearly" ? "Years" : "Months"}) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder={validityType === "Yearly" ? "Choose Yearly" : "Choose Months"}
                      value={validityValue}
                      onChange={(e) => setValidityValue(e.target.value)}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                    />
                  </div>
                </div>

                {/* Start Date & End Date (Auto-Calculated based on Current Date + Duration Count) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Start Date</label>
                    <input
                      type="date"
                      value={computedStartDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">End Date (Auto-Calculated)</label>
                    <input
                      type="date"
                      readOnly
                      value={computedEndDate}
                      className="w-full bg-slate-100 border border-border-soft px-3 py-2 rounded-lg text-sm text-slate-700 font-semibold cursor-not-allowed focus:outline-none"
                    />
                  </div>
                </div>

                {/* Day Restrictions Checklist (Optional) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-text-secondary">Day Restrictions (Optional - Membership not valid on checked days)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                      const isChecked = formData.day_restrictions.includes(day);
                      return (
                        <label key={day} className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${
                          isChecked 
                            ? "bg-pink-50 border-pink-200 text-pink-700 font-semibold"
                            : "bg-background border-border-soft text-slate-600 hover:bg-slate-50"
                        }`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const list = [...formData.day_restrictions];
                              if (e.target.checked) {
                                list.push(day);
                              } else {
                                const idx = list.indexOf(day);
                                if (idx > -1) list.splice(idx, 1);
                              }
                              setFormData({ ...formData, day_restrictions: list });
                            }}
                            className="rounded text-pink-600 focus:ring-pink-500 w-3.5 h-3.5"
                          />
                          <span>{day}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border-soft flex justify-end space-x-3 shrink-0 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-lg text-sm text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MembershipPlans;
