import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useModalFocusTrap, useFormKeyboardNavigation } from "../utils/keyboardNavigation";
import { User, X, ChevronDown, Check, Printer, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF } from "../utils/exportUtils";

function CustomerMemberships() {
  const { formatCurrency, currencySymbol, t } = useLanguageCurrency();
  const assignModalRef = useRef(null);
  const assignFormRef = useRef(null);
  const upgradeModalRef = useRef(null);

  const [plans, setPlans] = useState([]);
  const [services, setServices] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allMemberships, setAllMemberships] = useState([]);

  // Assignment Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    customer_id: "",
    plan_id: "",
    benefits: [], // array of { service_id, quantity }
  });

  // Combobox customer dropdown inside modal
  const [comboboxSearch, setComboboxSearch] = useState("");
  const [showComboboxDropdown, setShowComboboxDropdown] = useState(false);
  const comboboxRef = useRef(null);

  // Action Modals (Renew / Upgrade)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeMembershipId, setActiveMembershipId] = useState(null);
  const [upgradePlanId, setUpgradePlanId] = useState("");
  const [upgradeBenefits, setUpgradeBenefits] = useState([]);

  // View Specific Customer Packages
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useModalFocusTrap(showAssignModal, assignModalRef, () => setShowAssignModal(false));
  useModalFocusTrap(showUpgradeModal, upgradeModalRef, () => setShowUpgradeModal(false));
  useFormKeyboardNavigation(assignFormRef, () => {
    const submitBtn = assignModalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  // Fetch initial collections
  const fetchAllMemberships = () => {
    API.get("/memberships")
      .then((res) => setAllMemberships(res.data || []))
      .catch((err) => console.error("Failed to load all memberships:", err));
  };

  const fetchPlans = () => {
    API.get("/membership-plans?status=active").then((res) => {
      const fetchedPlans = res.data.items || [];
      setPlans(fetchedPlans);
      if (fetchedPlans.length > 0) {
        setAssignForm(prev => ({ ...prev, plan_id: fetchedPlans[0].id.toString() }));
      }
    });
  };

  const fetchCustomers = () => {
    API.get("/customers?limit=100").then((res) => setAllCustomers(res.data.items || []));
  };

  useEffect(() => {
    fetchPlans();
    API.get("/services?status=active").then((res) => setServices(res.data.items || []));
    fetchCustomers();
    fetchAllMemberships();
  }, []);

  // Customer Autocomplete Lookup for the View Specific section
  useEffect(() => {
    if (customerSearch.trim().length >= 2) {
      API.get(`/customers?q=${customerSearch}`).then((res) => setCustomers(res.data.items || []));
    } else {
      setCustomers([]);
    }
  }, [customerSearch]);

  // Click outside Combobox dropdown handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setShowComboboxDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrint = () => {
    const columns = [
      { header: "Customer Name", accessor: "customer_name" },
      { header: "Mobile", accessor: "customer_phone" },
      { header: "Membership Plan", accessor: "plan_name" },
      { header: "Status", accessor: "status" },
      { header: "Expiry Date", accessor: (row) => new Date(row.expires_at).toLocaleDateString() }
    ];
    printDataList("Customer Subscriptions & Packages List", allMemberships, columns);
  };

  const handleExportExcel = () => {
    const columns = [
      { header: "Customer Name", accessor: "customer_name" },
      { header: "Mobile", accessor: "customer_phone" },
      { header: "Membership Plan", accessor: "plan_name" },
      { header: "Status", accessor: "status" },
      { header: "Expiry Date", accessor: (row) => new Date(row.expires_at).toLocaleDateString() }
    ];
    exportToCSV(allMemberships, columns, "customer_memberships_list");
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "Customer Name", accessor: "customer_name", width: 45 },
      { header: "Mobile", accessor: "customer_phone", width: 35 },
      { header: "Membership Plan", accessor: "plan_name", width: 45 },
      { header: "Status", accessor: "status", width: 25 },
      { header: "Expiry Date", accessor: (row) => new Date(row.expires_at).toLocaleDateString(), width: 30 }
    ];
    exportToPDF("Customer Subscriptions & Packages List", allMemberships, columns, "customer_memberships_list");
  };

  // Load customer's active memberships
  const fetchCustomerMemberships = (cust) => {
    setSelectedCustomer(cust);
    setLoading(true);
    API.get(`/customers/${cust.id}/memberships`)
      .then((res) => {
        setMemberships(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  const handleAddBenefitRow = (isUpgrade = false) => {
    const defaultSvc = services.length > 0 ? services[0].id : "";
    if (isUpgrade) {
      setUpgradeBenefits([...upgradeBenefits, { service_id: defaultSvc, quantity: 1 }]);
    } else {
      setAssignForm({
        ...assignForm,
        benefits: [...assignForm.benefits, { service_id: defaultSvc, quantity: 1 }],
      });
    }
  };

  const handleBenefitChange = (index, field, val, isUpgrade = false) => {
    if (isUpgrade) {
      const updated = [...upgradeBenefits];
      updated[index][field] = field === "quantity" ? parseInt(val) || 1 : val;
      setUpgradeBenefits(updated);
    } else {
      const updated = [...assignForm.benefits];
      updated[index][field] = field === "quantity" ? parseInt(val) || 1 : val;
      setAssignForm({ ...assignForm, benefits: updated });
    }
  };

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!assignForm.customer_id) {
      alert("Please select a customer first.");
      return;
    }
    if (!assignForm.plan_id) {
      alert("Please select a membership plan.");
      return;
    }

    setSubmitting(true);
    API.post("/memberships/assign", assignForm)
      .then(() => {
        setSubmitting(false);
        setShowAssignModal(false);
        setComboboxSearch("");
        setAssignForm({
          customer_id: "",
          plan_id: plans.length > 0 ? plans[0].id.toString() : "",
          benefits: [],
        });
        fetchAllMemberships();
        fetchCustomers();
        if (selectedCustomer && selectedCustomer.id === parseInt(assignForm.customer_id)) {
          fetchCustomerMemberships(selectedCustomer);
        } else {
          alert("Membership assigned successfully.");
        }
      })
      .catch((err) => {
        setSubmitting(false);
        const errMsg = err.response?.data?.message || err.message || "Failed to assign membership.";
        alert(errMsg);
      });
  };

  const handleRenew = (cmId) => {
    if (window.confirm("Are you sure you want to renew this membership? Renewal extends expiry date and resets benefit balances.")) {
      API.post(`/memberships/${cmId}/renew`)
        .then(() => {
          fetchAllMemberships();
          if (selectedCustomer) {
            fetchCustomerMemberships(selectedCustomer);
          } else {
            alert("Membership renewed successfully.");
          }
        })
        .catch((err) => alert(err.response?.data?.message || err.message || "Failed to renew."));
    }
  };

  const handleCancel = (cmId) => {
    if (window.confirm("Are you sure you want to cancel this customer membership?")) {
      API.post(`/memberships/${cmId}/cancel`)
        .then(() => {
          fetchAllMemberships();
          if (selectedCustomer) {
            fetchCustomerMemberships(selectedCustomer);
          } else {
            alert("Membership cancelled successfully.");
          }
        })
        .catch((err) => alert(err.response?.data?.message || err.message || "Failed to cancel."));
    }
  };

  const openUpgradeModal = (cmId) => {
    setActiveMembershipId(cmId);
    setUpgradePlanId(plans.length > 0 ? plans[0].id : "");
    setUpgradeBenefits([]);
    setShowUpgradeModal(true);
  };

  const handleUpgradeSubmit = (e) => {
    e.preventDefault();
    API.post(`/memberships/${activeMembershipId}/upgrade`, {
      plan_id: upgradePlanId,
      benefits: upgradeBenefits,
    })
      .then(() => {
        setShowUpgradeModal(false);
        fetchAllMemberships();
        if (selectedCustomer) {
          fetchCustomerMemberships(selectedCustomer);
        } else {
          alert("Membership upgraded successfully.");
        }
      })
      .catch((err) => alert(err.response?.data?.message || err.message || "Failed to upgrade."));
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Customer Subscriptions & Packages</h1>
          <p className="text-xs text-text-secondary">Assign membership packages, manage benefit balances, renewals, and upgrades.</p>
        </div>
        <button
          onClick={() => {
            setAssignForm({
              customer_id: selectedCustomer ? selectedCustomer.id.toString() : "",
              plan_id: plans.length > 0 ? plans[0].id.toString() : "",
              benefits: [],
            });
            if (selectedCustomer) {
              setComboboxSearch(`${selectedCustomer.first_name} ${selectedCustomer.last_name || ""} (${selectedCustomer.phone || "No Phone"})`);
            } else {
              setComboboxSearch("");
            }
            setShowAssignModal(true);
          }}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Assign Membership
        </button>
      </div>

      {/* Customer Selector / Search */}
      <div className="bg-surface border border-border-soft p-4 rounded-lg space-y-2 relative">
        <label className="block text-xs font-semibold text-text-secondary">Select Customer to View Active Packages</label>
        {selectedCustomer ? (
          <div className="flex justify-between items-center bg-primary-light border border-primary/20 px-4 py-2.5 rounded-lg">
            <span className="text-sm font-semibold text-primary flex items-center space-x-1.5">
              <User className="w-4 h-4 text-primary" />
              <span>{selectedCustomer.first_name} {selectedCustomer.last_name || ""} ({selectedCustomer.phone})</span>
            </span>
            <button
              onClick={() => {
                setSelectedCustomer(null);
                setMemberships([]);
              }}
              className="text-xs text-danger font-semibold hover:underline"
            >
              Change Customer
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Type customer name or phone number..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full bg-background border border-border-soft px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
            {customers.length > 0 && (
              <div className="absolute left-4 right-4 top-16 bg-surface border border-border-soft rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto divide-y divide-border-soft">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      fetchCustomerMemberships(c);
                      setCustomers([]);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-background transition"
                  >
                    {c.first_name} {c.last_name || ""} ({c.phone})
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Active Customer Memberships Content */}
      {selectedCustomer && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Active & Past Packages for {selectedCustomer.first_name}</h3>
          {loading ? (
            <div className="p-8 space-y-4">
              <div className="h-6 bg-border-soft rounded animate-pulse w-1/4"></div>
              <div className="h-10 bg-border-soft rounded animate-pulse"></div>
            </div>
          ) : memberships.length === 0 ? (
            <div className="bg-surface border border-border-soft p-12 text-center rounded-lg">
              <p className="text-sm text-text-secondary mb-3">No membership package currently active for this customer.</p>
              <button
                onClick={() => {
                  setAssignForm({
                    customer_id: selectedCustomer.id.toString(),
                    plan_id: plans.length > 0 ? plans[0].id.toString() : "",
                    benefits: [],
                  });
                  setComboboxSearch(`${selectedCustomer.first_name} ${selectedCustomer.last_name || ""} (${selectedCustomer.phone || "No Phone"})`);
                  setShowAssignModal(true);
                }}
                className="text-sm text-primary font-medium hover:underline"
              >
                Assign Package Now
              </button>
            </div>
          ) : (
            memberships.map((m) => (
              <div key={m.id} className="bg-surface border border-border-soft rounded-lg p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-border-soft pb-4">
                  <div>
                    <h4 className="text-base font-semibold text-text-primary">{m.plan_name}</h4>
                    <p className="text-xs text-text-secondary mt-1">
                      Expires: {new Date(m.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      m.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}>
                      {m.status}
                    </span>
                    {m.status === "active" && (
                      <>
                        <button
                          onClick={() => handleRenew(m.id)}
                          className="px-3 py-1.5 border border-border-soft rounded-lg text-xs font-medium text-text-primary hover:bg-background transition"
                        >
                          Renew
                        </button>
                        <button
                          onClick={() => openUpgradeModal(m.id)}
                          className="px-3 py-1.5 bg-primary-light text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition"
                        >
                          Upgrade Plan
                        </button>
                        <button
                          onClick={() => handleCancel(m.id)}
                          className="px-3 py-1.5 text-danger text-xs font-medium hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Benefits List */}
                <div>
                  <h5 className="text-xs font-semibold text-text-secondary uppercase mb-3">Service Benefits Balance</h5>
                  {(!m.benefits || m.benefits.length === 0) ? (
                    <p className="text-xs text-text-secondary">No free service perks attached to this plan.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {(m.benefits || []).map((b) => (
                        <div key={b.id || b.service_id} className="bg-background border border-border-soft p-3 rounded-lg flex justify-between items-center">
                          <span className="text-xs font-medium text-text-primary">{b.service_name}</span>
                          <span className="text-xs font-semibold text-primary">
                            {b.remaining_quantity} / {b.total_quantity} Left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Datatable Listing of All Customer Memberships */}
      <div className="bg-surface border border-border-soft rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border-soft bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-text-primary">All Assigned Customer Memberships</h3>
          
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-200"
              title="Print List"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-emerald-200"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-rose-200"
              title="Export to PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary-light border-b border-border-soft">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Customer</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Mobile</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Membership Plan</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Expiry Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {allMemberships.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-xs text-text-secondary">
                    No assigned memberships found.
                  </td>
                </tr>
              ) : (
                allMemberships.map((m) => (
                  <tr key={m.id} className="hover:bg-background/50 transition">
                    <td className="px-6 py-4 text-xs font-bold text-text-primary">
                      {m.customer_name}
                    </td>
                    <td className="px-6 py-4 text-xs text-text-secondary">
                      {m.customer_phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs text-text-secondary font-semibold">
                      {m.plan_name}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        m.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-secondary">
                      {new Date(m.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-xs space-x-3">
                      <button
                        onClick={() => {
                          const mockCust = {
                            id: m.customer_id,
                            first_name: m.customer_name.split(" ")[0],
                            last_name: m.customer_name.split(" ").slice(1).join(" "),
                            phone: m.customer_phone
                          };
                          fetchCustomerMemberships(mockCust);
                        }}
                        className="text-primary hover:underline font-semibold"
                      >
                        View
                      </button>
                      {m.status === "active" && (
                        <>
                          <button
                            onClick={() => handleRenew(m.id)}
                            className="text-text-primary hover:underline font-semibold"
                          >
                            Renew ({m.renew_count || 0})
                          </button>
                          <button
                            onClick={() => handleCancel(m.id)}
                            className="text-danger hover:underline font-semibold"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Membership Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={assignModalRef} className="bg-surface max-w-lg w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">Assign Customer Membership</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={assignFormRef} onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              {/* Single Searchable Combobox Dropdown */}
              <div className="relative" ref={comboboxRef}>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Customer *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Search customer by Name or Mobile..."
                    value={comboboxSearch}
                    onFocus={() => setShowComboboxDropdown(true)}
                    onChange={(e) => {
                      setComboboxSearch(e.target.value);
                      setShowComboboxDropdown(true);
                      if (assignForm.customer_id) {
                        setAssignForm({ ...assignForm, customer_id: "" });
                      }
                    }}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
                  />
                  {assignForm.customer_id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignForm({ ...assignForm, customer_id: "" });
                        setComboboxSearch("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-danger font-semibold hover:underline"
                    >
                      Clear
                    </button>
                  ) : (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  )}
                </div>

                {showComboboxDropdown && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface border border-border-soft rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-border-soft">
                    {allCustomers
                      .filter((c) => {
                        const term = comboboxSearch.toLowerCase();
                        return (
                          !term ||
                          `${c.first_name} ${c.last_name || ""} ${c.phone || ""}`
                            .toLowerCase()
                            .includes(term)
                        );
                      })
                      .map((c) => {
                        const isSelected = assignForm.customer_id === c.id.toString();
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setAssignForm({ ...assignForm, customer_id: c.id.toString() });
                              setComboboxSearch(`${c.first_name} ${c.last_name || ""} (${c.phone || "No Phone"})`);
                              setShowComboboxDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-background transition flex justify-between items-center ${
                              isSelected ? "bg-primary-light text-primary font-semibold" : ""
                            }`}
                          >
                            <span>{c.first_name} {c.last_name || ""} ({c.phone || "No Phone"})</span>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    {allCustomers.filter((c) => {
                      const term = comboboxSearch.toLowerCase();
                      return (
                        !term ||
                        `${c.first_name} ${c.last_name || ""} ${c.phone || ""}`
                          .toLowerCase()
                          .includes(term)
                      );
                    }).length === 0 && (
                      <div className="px-3 py-2.5 text-xs text-text-secondary">No customers found.</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Select Membership Plan *</label>
                <select
                  required
                  value={assignForm.plan_id}
                  onChange={(e) => setAssignForm({ ...assignForm, plan_id: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">[ Select Membership Plan ]</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatCurrency(p.price)} ({p.duration_days} Days)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-md text-xs font-semibold text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? "Assigning..." : "Assign Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgrade Membership Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={upgradeModalRef} className="bg-surface max-w-lg w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">Upgrade Membership Tier</h3>
              <button onClick={() => setShowUpgradeModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpgradeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Select New Target Plan *</label>
                <select
                  required
                  value={upgradePlanId}
                  onChange={(e) => setUpgradePlanId(e.target.value)}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatCurrency(p.price)} ({p.duration_days} Days)
                    </option>
                  ))}
                </select>
              </div>

              {/* Upgrade Perks entry */}
              <div className="space-y-2 border-t border-border-soft pt-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-text-secondary font-semibold">New Plan Service Perks</label>
                  <button
                    type="button"
                    onClick={() => handleAddBenefitRow(true)}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    + Add Perk
                  </button>
                </div>
                {upgradeBenefits.map((row, idx) => (
                  <div key={idx} className="flex space-x-2 items-center">
                    <select
                      value={row.service_id}
                      onChange={(e) => handleBenefitChange(idx, "service_id", e.target.value, true)}
                      className="flex-1 bg-background border border-border-soft px-2 py-1.5 rounded text-xs focus:outline-none"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => handleBenefitChange(idx, "quantity", e.target.value, true)}
                      className="w-20 bg-background border border-border-soft px-2 py-1.5 rounded text-xs focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-md text-xs font-semibold text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md text-xs font-semibold"
                >
                  Upgrade Membership
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerMemberships;
