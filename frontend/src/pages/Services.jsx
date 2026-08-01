import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useModalFocusTrap, useFormKeyboardNavigation } from "../utils/keyboardNavigation";
import { X, Printer, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF } from "../utils/exportUtils";

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
  const [editId, setEditId] = useState(null);
  
  // Category Form State
  const [categoryName, setCategoryName] = useState("");

  // Service Form State
  const [serviceForm, setServiceForm] = useState({
    name: "",
    category_id: "",
    price: "",
    duration_minutes: "",
    description: "",
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
  }, [search, categoryId]);

  const handlePrint = () => {
    const columns = [
      { header: "Service Name", accessor: "name" },
      { header: "Category", accessor: "category_name" },
      { header: "Duration", accessor: (row) => `${row.duration_minutes} mins` },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}` },
      { header: "Status", accessor: "status" }
    ];
    printDataList("Services & Treatments Catalog", services, columns);
  };

  const handleExportExcel = () => {
    const columns = [
      { header: "Service Name", accessor: "name" },
      { header: "Category", accessor: "category_name" },
      { header: "Duration", accessor: (row) => `${row.duration_minutes} mins` },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}` },
      { header: "Status", accessor: "status" }
    ];
    exportToCSV(services, columns, "services_list");
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "Service Name", accessor: "name", width: 55 },
      { header: "Category", accessor: "category_name", width: 40 },
      { header: "Duration", accessor: (row) => `${row.duration_minutes} mins`, width: 30 },
      { header: "Price", accessor: (row) => `${currencySymbol}${parseFloat(row.price || 0).toFixed(2)}`, width: 30 },
      { header: "Status", accessor: "status", width: 25 }
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

  const openAddServiceModal = () => {
    setEditId(null);
    setServiceForm({
      name: "",
      category_id: categories.length > 0 ? categories[0].id : "",
      price: "",
      duration_minutes: "30",
      description: "",
      status: "active",
    });
    setShowServiceModal(true);
  };

  const openEditServiceModal = (s) => {
    setEditId(s.id);
    setServiceForm({
      name: s.name || "",
      category_id: s.category_id || "",
      price: s.price || "",
      duration_minutes: s.duration_minutes || "30",
      description: s.description || "",
      status: s.status || "active",
    });
    setShowServiceModal(true);
  };

  const handleServiceSubmit = (e) => {
    e.preventDefault();
    const action = editId ? API.put(`/services/${editId}`, serviceForm) : API.post("/services", serviceForm);

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
          <p className="text-xs text-text-secondary">Manage service offerings, category partitions, durations, and pricing.</p>
        </div>
        <div className="space-x-3">
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
          placeholder="Search services by name or description..."
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
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Duration</th>
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
                    <td className="px-6 py-4 text-sm text-text-secondary">{s.duration_minutes} mins</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{formatCurrency(s.price)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        s.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <button onClick={() => openEditServiceModal(s)} className="text-primary hover:underline">
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

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={serviceModalRef} className="bg-surface max-w-lg w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">
                {editId ? "Edit Service" : "Add New Service"}
              </h3>
              <button onClick={() => setShowServiceModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={serviceFormRef} onSubmit={handleServiceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Duration (Minutes) *</label>
                  <input
                    type="number"
                    required
                    value={serviceForm.duration_minutes}
                    onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                <textarea
                  rows="3"
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                ></textarea>
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

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={categoryModalRef} className="bg-surface max-w-md w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">Manage Service Categories</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-text-secondary hover:text-text-primary">
                ✖
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Add New Category form */}
              <form ref={categoryFormRef} onSubmit={handleCategorySubmit} className="flex space-x-3">
                <input
                  type="text"
                  required
                  placeholder="New Category name..."
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="flex-1 bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Add
                </button>
              </form>

              {/* Category list */}
              <div className="border-t border-border-soft pt-4 space-y-2 max-h-60 overflow-y-auto">
                <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Existing Categories</h4>
                {categories.length === 0 ? (
                  <p className="text-xs text-text-secondary">No categories created yet.</p>
                ) : (
                  categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-border-soft/50 last:border-0">
                      <span className="text-sm font-medium text-text-primary">{c.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        className="text-xs text-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Services;
