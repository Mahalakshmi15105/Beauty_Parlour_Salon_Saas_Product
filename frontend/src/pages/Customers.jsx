import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useModalFocusTrap, useFormKeyboardNavigation, focusAndOpenSelect } from "../utils/keyboardNavigation";
import { UserRoundX, X, MessageSquare, Phone, AlertTriangle, Calendar, Settings as SettingsIcon, Printer, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF, exportToExcel } from "../utils/exportUtils";
import BulkUploadModal from "../components/BulkUploadModal";
import { useToast } from "../context/ToastContext";

function Customers() {
  const { showSuccess, showError } = useToast();
  const modalRef = useRef(null);
  const formRef = useRef(null);
  const firstNameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [editId, setEditId] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
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
        setDormantCustomers(res.data || []);
        setDormantLoading(false);
      })
      .catch((err) => {
        showError(err.message || "Failed to load dormant clients.");
        setDormantLoading(false);
      });
  };

  const fetchCustomers = (currentCursor = null) => {
    setLoading(true);
    let url = `/customers?limit=10`;
    if (currentCursor) url += `&cursor=${currentCursor}`;
    if (search) url += `&q=${search}`;
    if (gender) url += `&gender=${gender}`;

    API.get(url)
      .then((res) => {
        setCustomers(res.data.items || []);
        setNextCursor(res.data.next_cursor || null);
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

  const handlePrint = () => {
    const exportData = activeSubTab === "dormant" ? dormantCustomers : customers;
    const title = activeSubTab === "dormant" ? "Dormant Clients List" : "Customers List";
    const columns = [
      { header: "Name", accessor: (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() },
      { header: "Phone", accessor: "phone" },
      { header: "Email", accessor: "email" },
      { header: "Gender", accessor: "gender" },
      { header: "DOB", accessor: "date_of_birth" }
    ];
    printDataList(title, exportData, columns);
  };

  const handleExportCSV = () => {
    const exportData = activeSubTab === "dormant" ? dormantCustomers : customers;
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
  };

  const handleExportExcel = () => {
    const exportData = activeSubTab === "dormant" ? dormantCustomers : customers;
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
    exportToExcel(title, exportData, columns, filename);
  };

  const handleExportPDF = () => {
    const exportData = activeSubTab === "dormant" ? dormantCustomers : customers;
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
      if (firstNameInputRef.current) firstNameInputRef.current.focus();
      return;
    }
    if (!formData.phone.trim()) {
      if (phoneInputRef.current) phoneInputRef.current.focus();
      return;
    }

    const action = editId ? API.put(`/customers/${editId}`, formData) : API.post("/customers", formData);

    action
      .then(() => {
        setShowModal(false);
        showSuccess(editId ? "Customer updated successfully!" : "Customer registered successfully!");
        fetchCustomers(cursor);
      })
      .catch((err) => {
        showError(err.response?.data?.message || err.message || "Operation failed.");
      });
  };

  const handleDelete = (id) => {
    API.delete(`/customers/${id}`)
      .then(() => {
        showSuccess("Customer record deleted.");
        fetchCustomers(cursor);
      })
      .catch((err) => {
        showError(err.response?.data?.message || err.message || "Failed to delete customer.");
      });
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Customers Manager</h1>
          <p className="text-xs text-text-secondary">Manage visitor directories, preferences, and dormant re-engagement campaigns.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
          <button
            onClick={openAddModal}
            className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-border-soft space-x-2">
        <button
          onClick={() => setActiveSubTab("all")}
          className={`py-2.5 px-4 font-semibold text-xs border-b-2 transition-all ${
            activeSubTab === "all" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          All Customers
        </button>
        <button
          onClick={() => setActiveSubTab("dormant")}
          className={`py-2.5 px-4 font-semibold text-xs border-b-2 transition-all flex items-center space-x-1.5 ${
            activeSubTab === "dormant" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <UserRoundX className="w-3.5 h-3.5" />
          <span>Dormant Clients (Churn)</span>
        </button>
      </div>

      {activeSubTab === "all" ? (
        <>
          <div className="bg-surface border border-border-soft p-4 rounded-lg flex space-x-4 items-center">
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-background border border-border-soft px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="bg-background border border-border-soft px-4 py-2 rounded-lg text-sm text-text-secondary focus:outline-none"
            >
              <option value="">All Genders</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary-light border-b border-border-soft">
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Name</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Phone</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Email</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Gender</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Actions</th>
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
                            <span>Inactive • {c.days_since_last_visit} Days</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{c.phone}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{c.email || "-"}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{c.gender || "-"}</td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <button onClick={() => openEditModal(c)} className="text-primary hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-danger hover:underline">
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
    </>
  ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Left panel: Message Template Editor */}
            <div className="col-span-12 md:col-span-4 space-y-4">
              <div className="bg-surface border border-border-soft p-5 rounded-xl space-y-4 shadow-sm">
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
            <div className="col-span-12 md:col-span-8 space-y-4">
              <div className="bg-surface border border-border-soft rounded-xl overflow-hidden shadow-sm">
                {dormantLoading ? (
                  <div className="p-8 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center space-y-2">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Scanning visit logs for slipping clients...</span>
                  </div>
                ) : dormantCustomers.length === 0 ? (
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
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-primary-light border-b border-border-soft">
                        <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Client</th>
                        <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Inactivity Duration</th>
                        <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Last Visit Date</th>
                        <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft">
                      {dormantCustomers.map((c) => {
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
                )}
              </div>
            </div>
          </div>
        )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="glowe-glass-card max-w-lg w-full rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
            <div className="px-6 py-4 border-b border-pink-100/60 flex justify-between items-center bg-white/50 backdrop-blur-md">
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
            <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
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
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
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
                    <option value="">Select</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Address</label>
                <textarea
                  rows="2"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
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
      
      {showBulkUpload && (
        <BulkUploadModal
          module="customers"
          onClose={() => setShowBulkUpload(false)}
          onSuccess={fetchCustomers}
        />
      )}
    </div>
  );
}

export default Customers;
