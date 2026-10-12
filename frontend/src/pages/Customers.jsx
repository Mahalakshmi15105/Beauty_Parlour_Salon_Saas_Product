import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useModalFocusTrap, useFormKeyboardNavigation, focusAndOpenSelect } from "../utils/keyboardNavigation";
import { UserRoundX, X, MessageSquare, Phone, AlertTriangle, Calendar, Settings as SettingsIcon, Printer, FileSpreadsheet, FileText, Upload, Eye, Users, Loader2 } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF, exportToExcel } from "../utils/exportUtils";
import BulkUploadModal from "../components/BulkUploadModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { useToast } from "../context/ToastContext";
import { invalidateCustomerCache } from "../services/customerCache";

function Customers() {
  const { showSuccess, showError } = useToast();
  const modalRef = useRef(null);
  const formRef = useRef(null);
  const firstNameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(() => {
    return parseInt(localStorage.getItem("total_customers_count") || "0", 10);
  });
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);

  // Sub-tab Navigation
  const [activeSubTab, setActiveSubTab] = useState("all");
  
  // Dormant Clients State
  const [dormantCustomers, setDormantCustomers] = useState([]);
  const [dormantLoading, setDormantLoading] = useState(false);
  const [churnThreshold, setChurnThreshold] = useState(45);
  const [messageTemplate, setMessageTemplate] = useState(
    "Hey [Name], it's been [Weeks] weeks since your last Hair Spa/visit. We miss you! Book today and get a free trim!"
  );

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    gender: "",
    date_of_birth: "",
    address: "",
    notes: "",
  });

  useModalFocusTrap(showModal, modalRef, () => setShowModal(false));
  useFormKeyboardNavigation(formRef, () => {
    const submitBtn = modalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  const fetchDormantCustomers = () => {
    setDormantLoading(true);
    API.get(`/customers/dormant?days=${churnThreshold}`)
      .then((res) => {
        const payload = res.data || res;
        const items = Array.isArray(payload) ? payload : (payload?.items || []);
        setDormantCustomers(Array.isArray(items) ? items : []);
        if (payload?.threshold_days) {
          setChurnThreshold(payload.threshold_days);
        }
        setDormantLoading(false);
      })
      .catch((err) => {
        showError(err.message || "Failed to load dormant clients.");
        setDormantCustomers([]);
        setDormantLoading(false);
      });
  };

  const fetchCustomers = (currentCursor = null) => {
    setLoading(true);
    let url = `/customers?limit=10`;
    if (currentCursor) url += `&cursor=${currentCursor}`;
    if (search) url += `&q=${encodeURIComponent(search)}`;
    if (gender) url += `&gender=${encodeURIComponent(gender)}`;

    API.get(url)
      .then((res) => {
        const items = res.data?.items || [];
        setCustomers(items);
        setNextCursor(res.data?.next_cursor || null);
        const total = res.data?.total_customers ?? res.data?.total_count ?? items.length;
        setTotalCustomers(total);
        try {
          localStorage.setItem("total_customers_count", String(total));
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('customers-count-updated', { detail: total }));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load customers.");
        setLoading(false);
      });
  };

  useEffect(() => {
    if (activeSubTab === "all") {
      fetchCustomers();
    } else if (activeSubTab === "dormant") {
      fetchDormantCustomers();
    }
  }, [search, gender, activeSubTab, churnThreshold]);

  // Fetch complete dataset (all 1000+ customers) for export / printing
  const fetchAllCustomersForExport = async () => {
    if (activeSubTab === "dormant") {
      return dormantCustomers;
    }
    let url = `/customers?all=true`;
    if (search) url += `&q=${encodeURIComponent(search)}`;
    if (gender) url += `&gender=${encodeURIComponent(gender)}`;

    const res = await API.get(url);
    const data = res?.data?.items || res?.data || [];
    return Array.isArray(data) ? data : [];
  };

  const handlePrint = async () => {
    try {
      setExportLoading(true);
      const exportData = await fetchAllCustomersForExport();
      if (!exportData || exportData.length === 0) {
        showError("No customers found to print.");
        return;
      }
      const title = activeSubTab === "dormant" ? "Dormant Clients List" : "Customers List";
      const columns = [
        { header: "Name", accessor: (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() },
        { header: "Phone", accessor: "phone" },
        { header: "Email", accessor: "email" },
        { header: "Gender", accessor: "gender" },
        { header: "DOB", accessor: "date_of_birth" }
      ];
      printDataList(title, exportData, columns);
    } catch (err) {
      showError("Failed to prepare complete customer list for printing.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExportLoading(true);
      const exportData = await fetchAllCustomersForExport();
      if (!exportData || exportData.length === 0) {
        showError("No customers found to export.");
        return;
      }
      const title = activeSubTab === "dormant" ? "Dormant Clients List" : "Customers List";
      const filename = activeSubTab === "dormant" ? "dormant_clients_list" : "customers_list";
      const columns = [
        { header: "First Name", accessor: "first_name" },
        { header: "Last Name", accessor: "last_name" },
        { header: "Phone", accessor: "phone" },
        { header: "Email", accessor: "email" },
        { header: "Gender", accessor: "gender" },
        { header: "DOB", accessor: "date_of_birth" },
        { header: "Address", accessor: "address" }
      ];
      exportToCSV(exportData, columns, filename);
    } catch (err) {
      showError("Failed to export complete customer list to CSV.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const exportData = await fetchAllCustomersForExport();
      if (!exportData || exportData.length === 0) {
        showError("No customers found to export.");
        return;
      }
      const title = activeSubTab === "dormant" ? "Dormant Clients List" : "Customers List";
      const filename = activeSubTab === "dormant" ? "dormant_clients_list" : "customers_list";
      const columns = [
        { header: "First Name", accessor: "first_name" },
        { header: "Last Name", accessor: "last_name" },
        { header: "Phone Number", accessor: "phone" },
        { header: "Email", accessor: "email" },
        { header: "Gender", accessor: "gender" },
        { header: "Date of Birth", accessor: "date_of_birth" },
        { header: "Address", accessor: "address" },
        { header: "Notes", accessor: "notes" }
      ];
      exportToExcel(title, exportData, columns, filename);
    } catch (err) {
      showError("Failed to export complete customer list to Excel.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportLoading(true);
      const exportData = await fetchAllCustomersForExport();
      if (!exportData || exportData.length === 0) {
        showError("No customers found to export.");
        return;
      }
      const title = activeSubTab === "dormant" ? "Dormant Clients List" : "Customers List";
      const filename = activeSubTab === "dormant" ? "dormant_clients_list" : "customers_list";
      const columns = [
        { header: "Name", accessor: (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim(), width: 35 },
        { header: "Phone", accessor: "phone", width: 25 },
        { header: "Email", accessor: "email", width: 35 },
        { header: "Gender", accessor: "gender", width: 20 },
        { header: "DOB", accessor: "date_of_birth", width: 25 }
      ];
      exportToPDF(title, exportData, columns, filename);
    } catch (err) {
      showError("Failed to export complete customer list to PDF.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleNextPage = () => {
    if (nextCursor) {
      setCursorHistory([...cursorHistory, cursor]);
      setCursor(nextCursor);
      fetchCustomers(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prev = cursorHistory[cursorHistory.length - 1];
      const newHistory = cursorHistory.slice(0, -1);
      setCursorHistory(newHistory);
      setCursor(prev);
      fetchCustomers(prev);
    }
  };

  const openAddModal = () => {
    setEditId(null);
    setFormData({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      gender: "",
      date_of_birth: "",
      address: "",
      notes: "",
    });
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditId(customer.id);
    setFormData({
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      gender: customer.gender || "",
      date_of_birth: customer.date_of_birth || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.first_name.trim()) {
      showError("Please enter First Name.");
      if (firstNameInputRef.current) firstNameInputRef.current.focus();
      return;
    }
    if (!formData.phone.trim()) {
      showError("Please enter Phone Number.");
      if (phoneInputRef.current) phoneInputRef.current.focus();
      return;
    }

    const action = editId ? API.put(`/customers/${editId}`, formData) : API.post("/customers", formData);

    action
      .then(() => {
        invalidateCustomerCache();
        setShowModal(false);
        showSuccess(editId ? "Customer updated successfully!" : "Customer registered successfully!");
        fetchCustomers(cursor);
      })
      .catch((err) => {
        showError(err.response?.data?.message || err.message || "Operation failed.");
      });
  };

  const handleDeleteClick = (c) => {
    setDeleteTarget({
      id: c.id,
      name: c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.phone || "Customer",
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    API.delete(`/customers/${deleteTarget.id}`)
      .then(() => {
        invalidateCustomerCache();
        showSuccess(`Customer "${deleteTarget.name}" permanently deleted.`);
        setDeleteTarget(null);
        setIsDeleting(false);
        fetchCustomers(cursor);
      })
      .catch((err) => {
        setIsDeleting(false);
        showError(err.response?.data?.message || err.message || "Failed to delete customer.");
      });
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-semibold text-text-primary">Customers Manager</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Users className="w-3.5 h-3.5" />
              Total Customers: <span className="numeric">{totalCustomers.toLocaleString()}</span>
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Manage visitor directories, preferences, and dormant re-engagement campaigns.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="flex-1 sm:flex-initial justify-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-initial justify-center bg-primary hover:bg-primary-hover text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-border-soft space-x-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab("all")}
          className={`py-2.5 px-4 font-semibold text-xs border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === "all" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <span>All Customers</span>
          <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
            {totalCustomers.toLocaleString()}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab("dormant")}
          className={`py-2.5 px-4 font-semibold text-xs border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
            activeSubTab === "dormant" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <UserRoundX className="w-3.5 h-3.5" />
          <span>Dormant Clients (Churn)</span>
        </button>
      </div>

      {activeSubTab === "all" ? (
        <>
          <div className="bg-surface border border-border-soft p-3 sm:p-4 rounded-xl flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-background border border-border-soft px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm focus:outline-none focus:border-primary"
              />
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="bg-background border border-border-soft px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm text-text-secondary focus:outline-none shrink-0"
              >
                <option value="">All Genders</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-2 border-t md:border-t-0 md:border-l border-border-soft pt-2 md:pt-0 md:pl-3">
              <button
                onClick={handlePrint}
                disabled={exportLoading}
                className="flex-1 sm:flex-initial justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition border border-slate-200 cursor-pointer"
                title={`Print All Customers (${totalCustomers})`}
              >
                {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                <span>Print</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportLoading}
                className="flex-1 sm:flex-initial justify-center bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition border border-emerald-200 cursor-pointer"
                title={`Export All Customers to Excel (${totalCustomers})`}
              >
                {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span>Excel</span>
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportLoading}
                className="flex-1 sm:flex-initial justify-center bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition border border-rose-200 cursor-pointer"
                title={`Export All Customers to PDF (${totalCustomers})`}
              >
                {exportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Data Display: Mobile Cards + Desktop Table */}
          <div className="bg-surface border border-border-soft rounded-xl overflow-hidden shadow-sm">
            {/* Prominent Header Banner Showing Total Number of Customers */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50/90 dark:bg-slate-800/40 border-b border-border-soft flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Total Registered:</span>
                <span className="bg-primary text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-2xs">
                  {totalCustomers.toLocaleString()}
                </span>
              </div>
              <div className="text-slate-500 font-medium text-[11px]">
                {search ? (
                  <span>Showing results matching &quot;<strong className="text-slate-700">{search}</strong>&quot;</span>
                ) : (
                  <span>All <strong className="text-slate-700">{totalCustomers.toLocaleString()}</strong> customers ready for export</span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-8 space-y-4">
                <div className="h-6 bg-border-soft rounded animate-pulse w-1/4"></div>
                <div className="h-10 bg-border-soft rounded animate-pulse"></div>
                <div className="h-10 bg-border-soft rounded animate-pulse"></div>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-danger text-sm font-medium">{error}</div>
            ) : customers.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-sm text-text-secondary mb-4">No customers found matching your criteria.</p>
                <button onClick={openAddModal} className="text-sm text-primary font-medium hover:underline">
                  Add your first customer
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Touch Cards View (visible on < md) */}
                <div className="block md:hidden divide-y divide-border-soft">
                  {customers.map((c) => (
                    <div key={c.id} className="p-4 space-y-3 bg-surface hover:bg-background/40 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-extrabold text-sm flex items-center justify-center shrink-0">
                            {(c.first_name?.[0] || "C").toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-text-primary">
                              {c.first_name} {c.last_name || ""}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.gender && (
                                <span className="text-[10px] font-semibold text-text-secondary bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                  {c.gender}
                                </span>
                              )}
                              {c.days_since_last_visit && c.days_since_last_visit >= 60 && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <UserRoundX className="w-3 h-3 text-indigo-600" />
                                  <span>Inactive {c.days_since_last_visit}d</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact row with direct call & whatsapp links */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {c.phone && (
                          <>
                            <a
                              href={`tel:${c.phone}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                            >
                              <Phone className="w-3.5 h-3.5 text-primary" />
                              <span className="numeric">{c.phone}</span>
                            </a>
                            <a
                              href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        )}
                        {c.email && (
                          <span className="text-[11px] text-text-secondary truncate max-w-[200px]">
                            {c.email}
                          </span>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-soft/60">
                        <button
                          onClick={() => setViewCustomer(c)}
                          className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(c)}
                          className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (visible on >= md) */}
                <div className="hidden md:block overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Name</th>
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Phone</th>
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Email</th>
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Gender</th>
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-background/50 transition">
                          <td className="px-6 py-4 text-sm font-medium text-text-primary">
                            <div className="flex items-center space-x-2">
                              <span>{c.first_name} {c.last_name}</span>
                              {c.days_since_last_visit && c.days_since_last_visit >= 60 && (
                                <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-1">
                                  <UserRoundX className="w-3 h-3 text-indigo-600" />
                                  <span>Inactive • <span className="numeric">{c.days_since_last_visit}</span> Days</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary numeric">{c.phone}</td>
                          <td className="px-6 py-4 text-sm text-text-secondary">{c.email || "-"}</td>
                          <td className="px-6 py-4 text-sm text-text-secondary">{c.gender || "-"}</td>
                          <td className="px-6 py-4 text-sm space-x-3">
                            <button onClick={() => setViewCustomer(c)} className="text-indigo-600 font-medium hover:underline">
                              View
                            </button>
                            <button onClick={() => openEditModal(c)} className="text-primary hover:underline">
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClick(c)}
                              className="text-danger hover:underline font-semibold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-4 sm:px-6 py-3.5 border-t border-border-soft flex justify-between items-center">
                  <button
                    disabled={cursorHistory.length === 0}
                    onClick={handlePrevPage}
                    className="px-4 py-2 border border-border-soft rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 transition"
                  >
                    Previous
                  </button>
                  <button
                    disabled={!nextCursor}
                    onClick={handleNextPage}
                    className="px-4 py-2 border border-border-soft rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 transition"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left panel: Message Template Editor */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <div className="bg-surface border border-border-soft p-4 sm:p-5 rounded-xl space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center space-x-1.5">
                  <SettingsIcon className="w-4 h-4 text-primary" />
                  <span>Re-engagement Settings</span>
                </h3>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-text-secondary block">Active Threshold</label>
                  <div className="bg-background border border-border-soft p-2.5 rounded-lg text-xs font-medium text-text-primary flex items-center justify-between">
                    <span>Current Limit:</span>
                    <span className="font-extrabold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">{churnThreshold} Days</span>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-1">You can adjust this value anytime under Settings → Security & Notifications.</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-border-soft">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">WhatsApp Blast Template</label>
                  <textarea
                    rows={4}
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    className="w-full bg-background border border-border-soft p-3 rounded-lg text-xs text-text-primary focus:outline-none focus:border-primary"
                    placeholder="Hey [Name]..."
                  />
                  <div className="text-[10px] text-text-secondary space-y-1">
                    <p className="font-semibold text-text-primary">Supported Placeholders:</p>
                    <ul className="list-disc pl-4 space-y-0.5 font-mono text-[9px]">
                      <li>[Name] - Client First Name</li>
                      <li>[Weeks] - Weeks since last visit</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-primary-light border border-primary/20 p-3.5 rounded-xl space-y-1.5">
                  <h4 className="text-[11px] font-bold text-primary flex items-center space-x-1">
                    <span>📝 Message Live Preview</span>
                  </h4>
                  <p className="text-[11px] text-slate-700 italic bg-white p-2.5 rounded-lg border border-primary/10 leading-relaxed font-mono">
                    {messageTemplate
                      .replace("[Name]", dormantCustomers[0]?.first_name || "Priya")
                      .replace("[Weeks]", Math.floor((dormantCustomers[0]?.days_inactive || 52) / 7))}
                  </p>
                </div>
              </div>
            </div>

            {/* Right panel: Dormant Client List */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              <div className="bg-surface border border-border-soft rounded-xl overflow-hidden shadow-sm">
                {dormantLoading ? (
                  <div className="p-8 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center space-y-2">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Scanning visit logs for slipping clients...</span>
                  </div>
                ) : (!Array.isArray(dormantCustomers) || dormantCustomers.length === 0) ? (
                  <div className="p-16 text-center space-y-3">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <UserRoundX className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-800">All Clients Active!</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                      No customers have crossed your {churnThreshold}-day inactivity threshold. Great job keeping them engaged!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Dormant Cards */}
                    <div className="block md:hidden divide-y divide-border-soft">
                      {(Array.isArray(dormantCustomers) ? dormantCustomers : []).map((c) => {
                        const weeks = Math.floor(c.days_inactive / 7);
                        const customMessage = messageTemplate
                          .replace("[Name]", c.first_name)
                          .replace("[Weeks]", weeks);

                        return (
                          <div key={c.id} className="p-4 space-y-2.5 bg-surface hover:bg-background/40 transition">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-bold text-sm text-text-primary">{c.first_name} {c.last_name || ""}</h4>
                                <p className="text-xs text-text-secondary numeric mt-0.5">{c.phone}</p>
                              </div>
                              <span className="text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-black">
                                {c.days_inactive}d Inactive
                              </span>
                            </div>
                            <div className="text-[11px] text-text-secondary">
                              Last Visit: <span className="font-medium text-text-primary">{c.last_visit_date ? new Date(c.last_visit_date).toLocaleDateString() : "No visits recorded"}</span>
                            </div>
                            <div className="pt-2">
                              <a
                                href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(customMessage)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-xs"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Re-engage on WhatsApp</span>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Dormant Table */}
                    <div className="hidden md:block overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-primary-light border-b border-border-soft">
                            <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Client</th>
                            <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Inactivity Duration</th>
                            <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Last Visit Date</th>
                            <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Quick Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft">
                          {(Array.isArray(dormantCustomers) ? dormantCustomers : []).map((c) => {
                            const weeks = Math.floor(c.days_inactive / 7);
                            const customMessage = messageTemplate
                              .replace("[Name]", c.first_name)
                              .replace("[Weeks]", weeks);
                            
                            return (
                              <tr key={c.id} className="hover:bg-background/50 transition">
                                <td className="px-6 py-4 text-sm font-medium text-text-primary">
                                  <div>
                                    <p className="font-semibold">{c.first_name} {c.last_name}</p>
                                    <p className="text-[10px] text-text-secondary font-mono">{c.phone}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <span className="text-rose-600 font-bold">{c.days_inactive} Days</span>
                                  <span className="text-[10px] text-text-secondary ml-2 font-medium">({weeks} Weeks)</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                                  {c.last_visit_date ? new Date(c.last_visit_date).toLocaleDateString() : "No visits recorded"}
                                </td>
                                <td className="px-6 py-4 text-sm text-right">
                                  <a
                                    href={`https://wa.me/${c.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(customMessage)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs animate-pulse hover:animate-none"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Re-engage</span>
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="glowe-glass-card max-w-lg w-full max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
            <div className="px-6 py-4 border-b border-pink-100/60 flex justify-between items-center bg-white/50 backdrop-blur-md shrink-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-md font-bold text-slate-900">
                  {editId ? "Edit Customer" : "Add New Customer"}
                </h3>
                {editId && (() => {
                  const currentCust = customers.find((c) => c.id === editId);
                  if (currentCust?.days_since_last_visit && currentCust.days_since_last_visit >= 60) {
                    return (
                      <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                        <UserRoundX className="w-3 h-3 text-indigo-600" />
                        <span>Inactive • {currentCust.days_since_last_visit} Days</span>
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Last Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none numeric"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  >
                    <option value="">Select (Optional)</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Date of Birth (Optional)</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none numeric"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Address (Optional)</label>
                <textarea
                  rows="2"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  placeholder="Street, City, Area (Optional)"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
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
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* View Customer Details Modal */}
      {viewCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="glowe-glass-card max-w-lg w-full max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
            <div className="px-6 py-4 border-b border-pink-100/60 flex justify-between items-center bg-white/50 backdrop-blur-md shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                  {viewCustomer.first_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-md font-extrabold text-slate-900">
                    {viewCustomer.first_name} {viewCustomer.last_name || ""}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold">Customer Details Profile</p>
                </div>
              </div>
              <button onClick={() => setViewCustomer(null)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</span>
                  <span className="text-sm font-extrabold text-slate-900 numeric mt-0.5 block">{viewCustomer.phone || "-"}</span>
                </div>
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                  <span className="text-sm font-extrabold text-slate-900 mt-0.5 block truncate">{viewCustomer.email || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gender</span>
                  <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{viewCustomer.gender || "-"}</span>
                </div>
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date of Birth</span>
                  <span className="text-sm font-extrabold text-slate-900 numeric mt-0.5 block">{viewCustomer.date_of_birth || "-"}</span>
                </div>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Address</span>
                <p className="text-xs font-semibold text-slate-800 mt-1 leading-relaxed">{viewCustomer.address || "No address specified."}</p>
              </div>

              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Notes</span>
                <p className="text-xs font-medium text-slate-700 mt-1 italic">{viewCustomer.notes || "No additional notes."}</p>
              </div>

              {viewCustomer.days_since_last_visit !== undefined && (
                <div className="bg-pink-50/60 p-3.5 rounded-2xl border border-pink-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-pink-700">Days Since Last Visit:</span>
                  <span className="text-xs font-black text-pink-900 bg-white px-3 py-1 rounded-full border border-pink-200 numeric">
                    {viewCustomer.days_since_last_visit} Days
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setViewCustomer(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-extrabold transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const custToEdit = viewCustomer;
                    setViewCustomer(null);
                    openEditModal(custToEdit);
                  }}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md transition"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkUpload && (
        <BulkUploadModal
          module="customers"
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            invalidateCustomerCache();
            fetchCustomers();
          }}
        />
      )}

      {/* Modern In-App Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Customer?"
        itemName={deleteTarget?.name}
        itemType="customer"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default Customers;
