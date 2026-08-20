import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useModalFocusTrap, useFormKeyboardNavigation } from "../utils/keyboardNavigation";
import { X, Printer, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF } from "../utils/exportUtils";
import BulkUploadModal from "../components/BulkUploadModal";

function Services() {
  const { formatCurrency, currencySymbol, t } = useLanguageCurrency();
  const serviceModalRef = useRef(null);
  const serviceFormRef = useRef(null);
  const categoryModalRef = useRef(null);
  const categoryFormRef = useRef(null);

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);

  // Modals Toggle
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editId, setEditId] = useState(null);
  
  // Category Form State & Edit State
  const [categoryName, setCategoryName] = useState("");
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState("");

  // Membership Plans & Multi-Discount State
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [membershipDiscounts, setMembershipDiscounts] = useState([
    { plan_id: "", percentage: "", amount: "" }
  ]);

  // Service Form State
  const [serviceForm, setServiceForm] = useState({
    name: "",
    category_id: "",
    price: "",
    status: "active",
  });

  useModalFocusTrap(showServiceModal, serviceModalRef, () => setShowServiceModal(false));
  useModalFocusTrap(showCategoryModal, categoryModalRef, () => setShowCategoryModal(false));
  useFormKeyboardNavigation(serviceFormRef, () => {
    const submitBtn = serviceModalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });
  useFormKeyboardNavigation(categoryFormRef, () => {
    const submitBtn = categoryModalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  const fetchCategories = () => {
    API.get("/service-categories")
      .then((res) => setCategories(res.data || []))
      .catch((err) => console.error("Error loading categories", err));
  };

  const fetchMembershipPlans = () => {
    API.get("/membership-plans")
      .then((res) => {
        const plans = res.data?.items || res.data?.plans || res.data || [];
        setMembershipPlans(Array.isArray(plans) ? plans : []);
      })
      .catch(() => {
        API.get("/memberships/plans")
          .then((res) => {
            const plans = res.data?.plans || res.data?.items || res.data || [];
            setMembershipPlans(Array.isArray(plans) ? plans : []);
          })
          .catch((err) => console.error("Error loading membership plans", err));
      });
  };

  const fetchServices = (currentCursor = null) => {
    setLoading(true);
    let url = `/services?limit=100`;
    if (currentCursor) url += `&cursor=${currentCursor}`;
    if (search) url += `&q=${search}`;
    if (categoryId) url += `&category_id=${categoryId}`;

    API.get(url)
      .then((res) => {
        setServices(res.data?.items || []);
        setNextCursor(res.data?.next_cursor || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load services.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCategories();
    fetchServices();
    fetchMembershipPlans();
  }, [search, categoryId]);

  const handlePrint = () => {
    const columns = [
      { header: "Service Name", accessor: "name" },
      { header: "Category", accessor: "category_name" },
      {
        header: "Plan",
        accessor: (row) =>
          (row.membership_discounts || [])
            .map((d) => {
              const pObj = membershipPlans.find((p) => String(p.id) === String(d.plan_id));
              const planLabel = d.plan_name || pObj?.name || pObj?.plan_name || `Plan #${d.plan_id}`;
              const discountStr = d.percentage > 0 ? `${d.percentage}%` : `${currencySymbol}${d.amount}`;
              return `${planLabel} (${discountStr})`;
            })
            .join(", ") || "-"
      },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}` },
      { header: "Status", accessor: "status" }
    ];
    printDataList("Services & Treatments Catalog", services, columns);
  };

  const handleExportExcel = () => {
    const columns = [
      { header: "Service Name", accessor: "name" },
      { header: "Category", accessor: "category_name" },
      {
        header: "Plan",
        accessor: (row) =>
          (row.membership_discounts || [])
            .map((d) => {
              const pObj = membershipPlans.find((p) => String(p.id) === String(d.plan_id));
              const planLabel = d.plan_name || pObj?.name || pObj?.plan_name || `Plan #${d.plan_id}`;
              const discountStr = d.percentage > 0 ? `${d.percentage}%` : `${currencySymbol}${d.amount}`;
              return `${planLabel} (${discountStr})`;
            })
            .join(", ") || "-"
      },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}` },
      { header: "Status", accessor: "status" }
    ];
    exportToCSV(services, columns, "services_list");
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "Service Name", accessor: "name", width: 50 },
      { header: "Category", accessor: "category_name", width: 35 },
      {
        header: "Plan",
        accessor: (row) =>
          (row.membership_discounts || [])
            .map((d) => {
              const pObj = membershipPlans.find((p) => String(p.id) === String(d.plan_id));
              const planLabel = d.plan_name || pObj?.name || pObj?.plan_name || `Plan #${d.plan_id}`;
              const discountStr = d.percentage > 0 ? `${d.percentage}%` : `${currencySymbol}${d.amount}`;
              return `${planLabel} (${discountStr})`;
            })
            .join(", ") || "-",
        width: 45
      },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}`, width: 25 },
      { header: "Status", accessor: "status", width: 20 }
    ];
    exportToPDF("Services & Treatments Catalog", services, columns, "services_list");
  };

  const handleNextPage = () => {
    if (nextCursor) {
      setCursorHistory([...cursorHistory, cursor]);
      setCursor(nextCursor);
      fetchServices(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prev = cursorHistory[cursorHistory.length - 1];
      const newHistory = cursorHistory.slice(0, -1);
      setCursorHistory(newHistory);
      setCursor(prev);
      fetchServices(prev);
    }
  };

  // Membership Discount Auto-Calculation Handlers
  const handleServicePriceChange = (newPrice) => {
    setServiceForm((prev) => ({ ...prev, price: newPrice }));
    const priceNum = parseFloat(newPrice) || 0;
    if (priceNum > 0) {
      setMembershipDiscounts((prev) =>
        prev.map((row) => {
          if (row.percentage !== "" && row.percentage !== null) {
            const calcAmt = ((parseFloat(row.percentage) || 0) / 100 * priceNum).toFixed(2);
            return { ...row, amount: calcAmt };
          }
          return row;
        })
      );
    }
  };

  const handleDiscountPercentageChange = (index, pctVal) => {
    const priceNum = parseFloat(serviceForm.price) || 0;
    const updated = [...membershipDiscounts];
    updated[index].percentage = pctVal;
    if (priceNum > 0 && pctVal !== "" && pctVal !== null) {
      const calcAmt = ((parseFloat(pctVal) || 0) / 100 * priceNum).toFixed(2);
      updated[index].amount = calcAmt;
    } else if (pctVal === "") {
      updated[index].amount = "";
    }
    setMembershipDiscounts(updated);
  };

  const handleDiscountAmountChange = (index, amtVal) => {
    const priceNum = parseFloat(serviceForm.price) || 0;
    const updated = [...membershipDiscounts];
    updated[index].amount = amtVal;
    if (priceNum > 0 && amtVal !== "" && amtVal !== null) {
      const calcPct = (((parseFloat(amtVal) || 0) / priceNum) * 100).toFixed(2);
      updated[index].percentage = calcPct;
    } else if (amtVal === "") {
      updated[index].percentage = "";
    }
    setMembershipDiscounts(updated);
  };

  const handleDiscountPlanChange = (index, planIdVal) => {
    const updated = [...membershipDiscounts];
    updated[index].plan_id = planIdVal;
    setMembershipDiscounts(updated);
  };

  const handleAddDiscountRow = () => {
    setMembershipDiscounts([...membershipDiscounts, { plan_id: "", percentage: "", amount: "" }]);
  };

  const handleRemoveDiscountRow = (index) => {
    if (membershipDiscounts.length === 1) {
      setMembershipDiscounts([{ plan_id: "", percentage: "", amount: "" }]);
    } else {
      setMembershipDiscounts(membershipDiscounts.filter((_, i) => i !== index));
    }
  };

  const openAddServiceModal = () => {
    setEditId(null);
    setServiceForm({
      name: "",
      category_id: categories.length > 0 ? categories[0].id : "",
      price: "",
      status: "active",
    });
    setMembershipDiscounts([{ plan_id: "", percentage: "", amount: "" }]);
    setShowServiceModal(true);
  };

  const openEditServiceModal = (s) => {
    setEditId(s.id);
    setServiceForm({
      name: s.name || "",
      category_id: s.category_id || "",
      price: s.price || "",
      status: s.status || "active",
    });
    const existingDiscounts = s.membership_discounts || s.discounts || [];
    if (Array.isArray(existingDiscounts) && existingDiscounts.length > 0) {
      setMembershipDiscounts(
        existingDiscounts.map((d) => ({
          plan_id: d.plan_id || d.membership_plan_id || "",
          percentage: d.percentage !== undefined ? d.percentage : (d.discount_percentage || ""),
          amount: d.amount !== undefined ? d.amount : (d.discount_amount || ""),
        }))
      );
    } else {
      setMembershipDiscounts([{ plan_id: "", percentage: "", amount: "" }]);
    }
    setShowServiceModal(true);
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...serviceForm,
      duration_minutes: 30, // Default duration fallback
      membership_discounts: membershipDiscounts
        .filter((d) => d.plan_id !== "" && d.plan_id !== null && d.plan_id !== undefined)
        .map((d) => ({
          plan_id: parseInt(d.plan_id),
          percentage: parseFloat(d.percentage) || 0,
          amount: parseFloat(d.amount) || 0,
        })),
    };

    const action = editId ? API.put(`/services/${editId}`, payload) : API.post("/services", payload);

    action
      .then(() => {
        setShowServiceModal(false);
        fetchServices(cursor);
      })
      .catch((err) => {
        alert(err.message || "Operation failed.");
      });
  };

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    API.post("/service-categories", { name: categoryName })
      .then(() => {
        setCategoryName("");
        setShowCategoryModal(false);
        fetchCategories();
      })
      .catch((err) => {
        alert(err.message || "Operation failed.");
      });
  };

  const handleEditCategorySubmit = (catId) => {
    if (!editingCatName.trim()) return;
    API.put(`/service-categories/${catId}`, { name: editingCatName.trim() })
      .then(() => {
        setEditingCatId(null);
        setEditingCatName("");
        fetchCategories();
      })
      .catch((err) => {
        alert(err.message || "Failed to update category name.");
      });
  };

  const handleDeleteService = (id) => {
    if (window.confirm("Are you sure you want to delete this service?")) {
      API.delete(`/services/${id}`)
        .then(() => {
          fetchServices(cursor);
        })
        .catch((err) => {
          alert(err.message || "Failed to delete.");
        });
    }
  };

  const handleDeleteCategory = (id) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      API.delete(`/service-categories/${id}`)
        .then(() => {
          fetchCategories();
        })
        .catch((err) => {
          alert(err.message || "Failed to delete. Make sure it contains no active services.");
        });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Services & Treatments Catalog</h1>
          <p className="text-xs text-text-secondary">Manage service offerings, category partitions, and pricing.</p>
        </div>
        <div className="space-x-3">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="border border-border-soft hover:bg-background text-text-primary px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Manage Categories
          </button>
          <button
            onClick={openAddServiceModal}
            className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Add Service
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-surface border border-border-soft p-4 rounded-lg flex space-x-4 items-center">
        <input
          type="text"
          placeholder="Search services by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-background border border-border-soft px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="bg-background border border-border-soft px-4 py-2 rounded-lg text-sm text-text-secondary focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
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
        ) : services.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-text-secondary mb-4">No services registered yet.</p>
            <button onClick={openAddServiceModal} className="text-sm text-primary font-medium hover:underline">
              Add your first service
            </button>
          </div>
        ) : (
          <>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary-light border-b border-border-soft">
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Service Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Category</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Plan</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Price</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-background/50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">{s.name}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{s.category_name || "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      {(!s.membership_discounts || s.membership_discounts.length === 0) ? (
                        <span className="text-slate-400 text-xs italic">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.membership_discounts.map((d, idx) => {
                            const pObj = membershipPlans.find((p) => String(p.id) === String(d.plan_id));
                            const planLabel = d.plan_name || pObj?.name || pObj?.plan_name || `Plan #${d.plan_id}`;
                            const discountStr = d.percentage > 0 ? `${d.percentage}%` : formatCurrency(d.amount);
                            return (
                              <span
                                key={idx}
                                className="inline-flex items-center text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full"
                              >
                                {planLabel} ({discountStr})
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{formatCurrency(s.price)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        s.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <button onClick={() => openEditServiceModal(s)} className="text-primary hover:underline font-semibold">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteService(s.id)} className="text-danger hover:underline">
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

      {/* Service Modal (Glowing First Field, Duration & Description removed, Auto-Calculated Multi-Membership Discounts) */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={serviceModalRef} className="bg-surface max-w-xl w-full rounded-2xl shadow-xl border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-bold text-text-primary">
                {editId ? "Edit Service" : "Add New Service"}
              </h3>
              <button onClick={() => setShowServiceModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={serviceFormRef} onSubmit={handleServiceSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* First Field with Focus Glow */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full bg-background border border-primary ring-2 ring-pink-500/20 shadow-md shadow-pink-500/20 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="Enter service name..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Category *</label>
                  <select
                    required
                    value={serviceForm.category_id}
                    onChange={(e) => setServiceForm({ ...serviceForm, category_id: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={serviceForm.price}
                    onChange={(e) => handleServicePriceChange(e.target.value)}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
                  <select
                    value={serviceForm.status}
                    onChange={(e) => setServiceForm({ ...serviceForm, status: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* MEMBERSHIP DISCOUNTS SECTION (Auto-Calculating Multi-Membership Plans) */}
              <div className="pt-2 border-t border-border-soft space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Service Membership Discounts
                  </span>
                  <button
                    type="button"
                    onClick={handleAddDiscountRow}
                    className="text-xs font-bold text-primary hover:underline flex items-center space-x-1"
                  >
                    <span>+ Add Membership Plan</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {membershipDiscounts.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-background/60 p-2.5 rounded-xl border border-border-soft/60">
                      {/* Field 1: Membership Plan Dropdown */}
                      <div className="col-span-5">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Membership Plan</label>
                        <select
                          value={row.plan_id}
                          onChange={(e) => handleDiscountPlanChange(idx, e.target.value)}
                          className="w-full bg-surface border border-border-soft px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                        >
                          <option value="">-- Select Membership Plan --</option>
                          {membershipPlans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name || p.plan_name || `Plan #${p.id}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Field 2: Percentage Field */}
                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Discount (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="%"
                          value={row.percentage}
                          onChange={(e) => handleDiscountPercentageChange(idx, e.target.value)}
                          className="w-full bg-surface border border-border-soft px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-primary text-center"
                        />
                      </div>

                      {/* Field 3: Amount Field */}
                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Amount ({currencySymbol})</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="₹ Amount"
                          value={row.amount}
                          onChange={(e) => handleDiscountAmountChange(idx, e.target.value)}
                          className="w-full bg-surface border border-border-soft px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-primary text-center"
                        />
                      </div>

                      {/* Remove Row Action */}
                      <div className="col-span-1 flex justify-center pt-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveDiscountRow(idx)}
                          className="text-slate-400 hover:text-danger p-1 rounded-md transition"
                          title="Remove Membership Plan"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-lg text-sm text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal (Glowing First Field, Edit Option beside Delete, Lucide X Close Icon) */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={categoryModalRef} className="bg-surface max-w-md w-full rounded-2xl shadow-xl border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-bold text-text-primary">Manage Service Categories</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Add New Category form with Focus Glow on First Field */}
              <form ref={categoryFormRef} onSubmit={handleCategorySubmit} className="flex space-x-3">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="New Category name..."
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="flex-1 bg-background border border-primary ring-2 ring-pink-500/20 shadow-md shadow-pink-500/20 px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-xs"
                >
                  Add
                </button>
              </form>

              {/* Category list with Edit & Delete options */}
              <div className="border-t border-border-soft pt-4 space-y-2 max-h-60 overflow-y-auto">
                <h4 className="text-xs font-bold text-text-secondary uppercase mb-2">Existing Categories</h4>
                {categories.length === 0 ? (
                  <p className="text-xs text-text-secondary">No categories created yet.</p>
                ) : (
                  categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-border-soft/50 last:border-0">
                      {editingCatId === c.id ? (
                        <div className="flex items-center space-x-2 flex-1 mr-2">
                          <input
                            type="text"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditCategorySubmit(c.id);
                              else if (e.key === "Escape") setEditingCatId(null);
                            }}
                            className="flex-1 bg-background border border-primary px-2 py-1 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleEditCategorySubmit(c.id)}
                            className="text-xs font-bold text-emerald-600 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="text-xs text-slate-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-text-primary">{c.name}</span>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => {
                                setEditingCatId(c.id);
                                setEditingCatName(c.name);
                              }}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(c.id)}
                              className="text-xs text-danger hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showBulkUpload && (
        <BulkUploadModal
          module="services"
          onClose={() => setShowBulkUpload(false)}
          onSuccess={fetchServices}
        />
      )}
    </div>
  );
}

export default Services;
