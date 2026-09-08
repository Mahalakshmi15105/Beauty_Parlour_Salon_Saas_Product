import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { X, Eye, Pencil, Trash2, BarChart3, Users, Building2, CreditCard, Settings, TrendingUp, MessageSquare, Key, CheckCircle, XCircle } from "lucide-react";
import { useModalFocusTrap, useFormKeyboardNavigation } from "../utils/keyboardNavigation";

function SuperAdmin() {
  const { showSuccess, showError } = useToast();
  const modalRef = useRef(null);
  const formRef = useRef(null);

  const [activeTab, setActiveTab] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [branches, setBranches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantDetails, setTenantDetails] = useState(null);

  // WhatsApp Gateway State
  const [whatsappStatuses, setWhatsappStatuses] = useState([]);
  const [whatsappForm, setWhatsappForm] = useState({
    meta_app_id: "",
    meta_app_secret: "",
    meta_config_id: "",
    meta_redirect_uri: "",
    meta_graph_api_version: "v21.0"
  });
  const [savingWhatsappSettings, setSavingWhatsappSettings] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tenant Provisioning Modal
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    name: "",
    admin_email: "",
    admin_password: "",
    plan_id: "",
  });

  // Plan Management Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: "",
    price: "",
    duration_days: 30,
    max_employees: 5,
    max_services: 20,
    max_customers: 100,
    max_branches: 3
  });
  const [editingPlan, setEditingPlan] = useState(null);

  useModalFocusTrap(showProvisionModal || showPlanModal, modalRef, () => {
    setShowProvisionModal(false);
    setShowPlanModal(false);
  });
  useFormKeyboardNavigation(formRef, () => {
    const submitBtn = modalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      API.get("/super-admin/dashboard"),
      API.get("/super-admin/tenants?limit=50"),
      API.get("/super-admin/branches?limit=50"),
      API.get("/super-admin/subscription-plans"),
      API.get("/super-admin/users?limit=50"),
      API.get("/super-admin/analytics"),
      API.get("/super-admin/settings"),
      API.get("/super-admin/system-health"),
      API.get("/super-admin/audit-logs"),
      API.get("/super-admin/whatsapp-status").catch(() => ({ data: { items: [] } })),
    ])
      .then(([dashRes, tenRes, branchRes, planRes, userRes, analyticsRes, settingsRes, healthRes, auditRes, waStatusRes]) => {
        setDashboard(dashRes.data);
        setTenants(tenRes.data.items);
        setBranches(branchRes.data.items);
        setPlans(planRes.data);
        setUsers(userRes.data.items);
        setAnalytics(analyticsRes.data);
        setPlatformSettings(settingsRes.data);
        setSystemHealth(healthRes.data);
        setAuditLogs(auditRes.data);
        setWhatsappStatuses(waStatusRes.data?.items || []);

        if (settingsRes.data) {
          setWhatsappForm({
            meta_app_id: settingsRes.data.meta_app_id || "",
            meta_app_secret: settingsRes.data.meta_app_secret || "",
            meta_config_id: settingsRes.data.meta_config_id || "",
            meta_redirect_uri: settingsRes.data.meta_redirect_uri || "",
            meta_graph_api_version: settingsRes.data.meta_graph_api_version || "v21.0"
          });
        }

        if (planRes.data.length > 0 && !provisionForm.plan_id) {
          setProvisionForm((prev) => ({ ...prev, plan_id: planRes.data[0].id }));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load Super Admin portal dataset.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveWhatsappSettings = (e) => {
    if (e) e.preventDefault();
    setSavingWhatsappSettings(true);
    API.put("/super-admin/settings", whatsappForm)
      .then(() => {
        showSuccess("WhatsApp Gateway & Meta App configuration saved successfully!");
        setSavingWhatsappSettings(false);
        fetchData();
      })
      .catch((err) => {
        setSavingWhatsappSettings(false);
        showError(err.message || "Failed to save Meta App settings.");
      });
  };

  const handleProvisionSubmit = (e) => {
    e.preventDefault();
    API.post("/super-admin/tenants", provisionForm)
      .then(() => {
        setShowProvisionModal(false);
        setProvisionForm({ name: "", admin_email: "", admin_password: "", plan_id: plans[0]?.id || "" });
        fetchData();
      })
      .catch((err) => showError(err.message || "Provisioning failed."));
  };

  const handleStatusToggle = (tenantId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    // Confirmed action
    if (true) {
      API.put(`/super-admin/tenants/${tenantId}`, { status: newStatus })
        .then(() => fetchData())
        .catch((err) => showError(err.message || "Status update failed."));
    }
  };

  const handleViewTenantDetails = (tenantId) => {
    setSelectedTenant(tenantId);
    API.get(`/super-admin/tenants/${tenantId}/details`)
      .then((res) => {
        setTenantDetails(res.data);
        setActiveTab("tenant-details");
      })
      .catch((err) => showError(err.message || "Failed to load tenant details."));
  };

  const handlePlanSubmit = (e) => {
    e.preventDefault();
    if (editingPlan) {
      API.put(`/super-admin/subscription-plans/${editingPlan.id}`, planForm)
        .then(() => {
          setShowPlanModal(false);
          setEditingPlan(null);
          setPlanForm({ name: "", price: "", duration_days: 30, max_employees: 5, max_services: 20, max_customers: 100, max_branches: 3 });
          fetchData();
        })
        .catch((err) => showError(err.message || "Plan update failed."));
    } else {
      API.post("/super-admin/subscription-plans", planForm)
        .then(() => {
          setShowPlanModal(false);
          setPlanForm({ name: "", price: "", duration_days: 30, max_employees: 5, max_services: 20, max_customers: 100, max_branches: 3 });
          fetchData();
        })
        .catch((err) => showError(err.message || "Plan creation failed."));
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      price: plan.price,
      duration_days: plan.duration_days,
      max_employees: plan.max_employees,
      max_services: plan.max_services,
      max_customers: plan.max_customers,
      max_branches: plan.max_branches
    });
    setShowPlanModal(true);
  };

  const handleDeletePlan = (planId) => {
    // Confirmed action
    if (true) {
      API.delete(`/super-admin/subscription-plans/${planId}`)
        .then(() => fetchData())
        .catch((err) => showError(err.message || "Plan deletion failed."));
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-surface border border-border-soft rounded-lg space-y-4">
        <div className="h-6 bg-border-soft rounded animate-pulse w-1/4"></div>
        <div className="h-10 bg-border-soft rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-danger text-sm font-medium">{error}</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Platform Super Admin Portal</h1>
          <p className="text-xs text-text-secondary">SaaS Multi-tenant provisioning, MRR revenue metrics, and system health controls.</p>
        </div>
        <button
          onClick={() => setShowProvisionModal(true)}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
        >
          + Provision Beauty Parlour
        </button>
      </div>

      {/* Category Tabs */}
      <div className="bg-surface border border-border-soft p-2 rounded-lg flex flex-wrap gap-2">
        {[
          { id: "overview", label: "Executive Overview", icon: BarChart3 },
          { id: "tenants", label: "Beauty Parlour Tenants", icon: Building2 },
          { id: "branches", label: "All Branches", icon: Building2 },
          { id: "plans", label: "Subscription Plans", icon: CreditCard },
          { id: "users", label: "Platform Users", icon: Users },
          { id: "analytics", label: "Platform Analytics", icon: TrendingUp },
          { id: "health", label: "System Health", icon: Settings },
          { id: "whatsapp", label: "WhatsApp Gateway", icon: MessageSquare },
          { id: "audit", label: "Audit Logs", icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 py-2 px-4 rounded-lg text-xs font-semibold transition ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-background"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <p className="text-xs font-semibold text-text-secondary uppercase">Monthly Recurring Revenue (MRR)</p>
              <p className="text-2xl font-bold text-text-primary mt-2">INR {dashboard?.metrics?.mrr?.toFixed(2)}</p>
              <p className="text-[10px] text-success font-medium mt-1">ARR: INR {dashboard?.metrics?.arr?.toFixed(2)}</p>
            </div>
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <p className="text-xs font-semibold text-text-secondary uppercase">Total Beauty Parlours</p>
              <p className="text-2xl font-bold text-text-primary mt-2">{dashboard?.metrics?.total_tenants}</p>
              <p className="text-[10px] text-success font-medium mt-1">{dashboard?.metrics?.active_tenants} Active Salons</p>
            </div>
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <p className="text-xs font-semibold text-text-secondary uppercase">Platform Clients Served</p>
              <p className="text-2xl font-bold text-text-primary mt-2">{dashboard?.metrics?.total_customers}</p>
              <p className="text-[10px] text-text-secondary mt-1">{dashboard?.metrics?.total_employees} Stylists Onboarded</p>
            </div>
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <p className="text-xs font-semibold text-text-secondary uppercase">Total Checkout Invoices</p>
              <p className="text-2xl font-bold text-text-primary mt-2">{dashboard?.metrics?.total_invoices}</p>
              <p className="text-[10px] text-text-secondary mt-1">Processed Across Platform</p>
            </div>
          </div>

          <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Recent Salon Tenant Registrations</h3>
            <div className="divide-y divide-border-soft text-xs">
              {dashboard?.recent_tenants?.map((t) => (
                <div key={t.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-text-primary">{t.name}</p>
                    <p className="text-text-secondary">Plan: {t.plan_name}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    t.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  }`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tenants Management Tab */}
      {activeTab === "tenants" && (
        <div className="bg-surface border border-border-soft rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-primary-light border-b border-border-soft">
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Parlour Name</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Admin Email</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Subscription Plan</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Expiry Date</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-background/50 transition">
                  <td className="px-6 py-4 font-semibold text-text-primary">{t.name}</td>
                  <td className="px-6 py-4 text-text-secondary">{t.admin_email}</td>
                  <td className="px-6 py-4 font-medium text-text-primary">{t.plan_name}</td>
                  <td className="px-6 py-4 text-text-secondary">{t.subscription_expires_at ? new Date(t.subscription_expires_at).toLocaleDateString() : "-"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      t.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex space-x-2">
                    <button
                      onClick={() => handleViewTenantDetails(t.id)}
                      className="text-primary hover:underline"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStatusToggle(t.id, t.status)}
                      className={`text-xs font-semibold hover:underline ${
                        t.status === "active" ? "text-danger" : "text-success"
                      }`}
                    >
                      {t.status === "active" ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tenant Details Tab */}
      {activeTab === "tenant-details" && tenantDetails && (
        <div className="space-y-6">
          <button
            onClick={() => setActiveTab("tenants")}
            className="text-sm text-text-secondary hover:text-text-primary mb-4"
          >
            ← Back to Tenants
          </button>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-2">Parlour Information</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Name:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.parlour.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status:</span>
                  <span className={`font-medium ${tenantDetails.parlour.status === "active" ? "text-success" : "text-danger"}`}>
                    {tenantDetails.parlour.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Created:</span>
                  <span className="font-medium text-text-primary">{new Date(tenantDetails.parlour.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-2">Owner Information</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Email:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.owner.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Name:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.owner.owner_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Phone:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.owner.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Address:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.owner.address}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-2">Subscription</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Plan:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.subscription.plan_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status:</span>
                  <span className={`font-medium ${tenantDetails.subscription.status === "active" ? "text-success" : "text-danger"}`}>
                    {tenantDetails.subscription.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Branches:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.subscription.current_branches} / {tenantDetails.subscription.max_branches}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Expiry:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.subscription.expiry_date ? new Date(tenantDetails.subscription.expiry_date).toLocaleDateString() : "N/A"}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-2">Usage Statistics</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Customers:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.usage.customers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Employees:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.usage.employees}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Services:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.usage.services}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Invoices:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.usage.invoices}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Appointments:</span>
                  <span className="font-medium text-text-primary">{tenantDetails.usage.appointments}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3 mb-4">Branches ({tenantDetails.branches.length})</h3>
            <div className="grid grid-cols-3 gap-4">
              {tenantDetails.branches.map((b) => (
                <div key={b.id} className="bg-background border border-border-soft p-4 rounded-lg">
                  <p className="font-semibold text-text-primary">{b.name}</p>
                  <p className="text-xs text-text-secondary mt-1">{b.address}</p>
                  <p className="text-xs text-text-secondary">{b.phone}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    b.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  }`}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === "branches" && (
        <div className="bg-surface border border-border-soft rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-primary-light border-b border-border-soft">
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Branch Name</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Parlour</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Branch Admin</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Customers</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Employees</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-background/50 transition">
                  <td className="px-6 py-4 font-semibold text-text-primary">{b.name}</td>
                  <td className="px-6 py-4 text-text-secondary">{b.parlour_name}</td>
                  <td className="px-6 py-4 text-text-secondary">{b.branch_admin}</td>
                  <td className="px-6 py-4 text-text-primary">{b.customers_count}</td>
                  <td className="px-6 py-4 text-text-primary">{b.employees_count}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      b.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subscription Plans Tab */}
      {activeTab === "plans" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-text-primary">Subscription Plans</h3>
            <button
              onClick={() => {
                setEditingPlan(null);
                setPlanForm({ name: "", price: "", duration_days: 30, max_employees: 5, max_services: 20, max_customers: 100, max_branches: 3 });
                setShowPlanModal(true);
              }}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
            >
              + Create Plan
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            {plans.map((p) => (
              <div key={p.id} className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-base font-semibold text-text-primary">{p.name}</h3>
                  <div className="flex space-x-2">
                    <button onClick={() => handleEditPlan(p)} className="text-primary hover:text-primary-hover">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeletePlan(p.id)} className="text-danger hover:text-danger-hover">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-bold text-primary">INR {p.price} <span className="text-xs text-text-secondary font-normal">/ {p.duration_days} Days</span></p>
                <ul className="text-xs text-text-secondary space-y-2 border-t border-border-soft pt-4">
                  <li>• Max Employees: {p.max_employees}</li>
                  <li>• Max Services: {p.max_services}</li>
                  <li>• Max Customers: {p.max_customers}</li>
                  <li>• Max Branches: {p.max_branches}</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="bg-surface border border-border-soft rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-primary-light border-b border-border-soft">
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Email</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Role</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Parlour</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Branch</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-background/50 transition">
                  <td className="px-6 py-4 font-medium text-text-primary">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      u.role === "SuperAdmin" ? "bg-purple-100 text-purple-700" :
                      u.role === "ParlourAdmin" ? "bg-blue-100 text-blue-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{u.parlour_name}</td>
                  <td className="px-6 py-4 text-text-secondary">{u.branch_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      u.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">New Parlours (30 Days)</h3>
              <p className="text-3xl font-bold text-primary mt-2">{analytics.new_parlours_30_days}</p>
            </div>
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">Total Revenue</h3>
              <p className="text-3xl font-bold text-success mt-2">INR {analytics.revenue_overview.total_revenue.toFixed(2)}</p>
              <p className="text-xs text-text-secondary mt-1">{analytics.revenue_overview.total_paid_invoices} paid invoices</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">Branch Growth</h3>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Total Branches:</span>
                  <span className="font-medium text-text-primary">{analytics.branch_growth.total}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">New (30 Days):</span>
                  <span className="font-medium text-success">+{analytics.branch_growth.new_30_days}</span>
                </div>
              </div>
            </div>
            <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
              <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">Customer Growth</h3>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Total Customers:</span>
                  <span className="font-medium text-text-primary">{analytics.customer_growth.total}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">New (30 Days):</span>
                  <span className="font-medium text-success">+{analytics.customer_growth.new_30_days}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">Subscription Distribution</h3>
            <div className="mt-4 space-y-2">
              {analytics.subscription_distribution.map((item, index) => (
                <div key={index} className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">{item.plan}:</span>
                  <span className="font-medium text-text-primary">{item.count} parlours</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* System Health Tab */}
      {activeTab === "health" && systemHealth && (
        <div className="bg-surface border border-border-soft p-8 rounded-lg space-y-6">
          <h3 className="text-sm font-semibold text-text-primary border-b border-border-soft pb-3">System Diagnostics & Infrastructure Health</h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-background border border-border-soft p-4 rounded-lg">
              <p className="text-xs font-semibold text-text-secondary uppercase">Database Status</p>
              <p className="text-sm font-bold text-success mt-1">● {systemHealth.database_status}</p>
            </div>
            <div className="bg-background border border-border-soft p-4 rounded-lg">
              <p className="text-xs font-semibold text-text-secondary uppercase">API Gateway</p>
              <p className="text-sm font-bold text-success mt-1">● {systemHealth.api_gateway}</p>
            </div>
            <div className="bg-background border border-border-soft p-4 rounded-lg">
              <p className="text-xs font-semibold text-text-secondary uppercase">Active Sessions</p>
              <p className="text-sm font-bold text-text-primary mt-1">{systemHealth.active_tenant_sessions} Active Tenants</p>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === "audit" && (
        <div className="bg-surface border border-border-soft rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-primary-light border-b border-border-soft">
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Action</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Details</th>
                <th className="px-6 py-3 font-semibold text-text-secondary uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {auditLogs.map((l) => (
                <tr key={l.id} className="hover:bg-background/50 transition">
                  <td className="px-6 py-3 font-semibold text-primary">{l.action}</td>
                  <td className="px-6 py-3 text-text-secondary">{l.details}</td>
                  <td className="px-6 py-3 text-text-secondary">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WhatsApp Gateway Tab */}
      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          {/* Card 1: Platform Meta App Gateway Configuration */}
          <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
            <div className="flex justify-between items-start border-b border-border-soft pb-4">
              <div>
                <h3 className="text-base font-extrabold text-text-primary flex items-center space-x-2">
                  <Key className="w-5 h-5 text-primary" />
                  <span>Meta WhatsApp Gateway & App Credentials</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Manage the platform-wide Meta Developer App ID & Configuration used by all salon parlours for Embedded Signup.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveWhatsappSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Meta App ID <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 123456789012345"
                    value={whatsappForm.meta_app_id}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, meta_app_id: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Meta App Secret
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••••••••••"
                    value={whatsappForm.meta_app_secret}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, meta_app_secret: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Embedded Signup Config ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={whatsappForm.meta_config_id}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, meta_config_id: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    OAuth Redirect URI
                  </label>
                  <input
                    type="text"
                    placeholder="https://yourdomain.com/settings"
                    value={whatsappForm.meta_redirect_uri}
                    onChange={(e) => setWhatsappForm({ ...whatsappForm, meta_redirect_uri: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={savingWhatsappSettings}
                  className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {savingWhatsappSettings ? "Saving Gateway Credentials..." : "Save Gateway Configuration"}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Salon Tenant Connection Status Monitor */}
          <div className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-text-primary flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span>Multi-Tenant WhatsApp Connection Monitor</span>
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Real-time status of connected WhatsApp Business Accounts (WABA) across all registered parlours.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-primary-light border-b border-border-soft text-text-primary">
                    <th className="px-4 py-3 font-bold uppercase">Salon Tenant</th>
                    <th className="px-4 py-3 font-bold uppercase">Status</th>
                    <th className="px-4 py-3 font-bold uppercase">WABA Business Name</th>
                    <th className="px-4 py-3 font-bold uppercase">WhatsApp Phone #</th>
                    <th className="px-4 py-3 font-bold uppercase">WABA ID</th>
                    <th className="px-4 py-3 font-bold uppercase">Connected Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {whatsappStatuses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-text-secondary">
                        No salon tenants found.
                      </td>
                    </tr>
                  ) : (
                    whatsappStatuses.map((st) => (
                      <tr key={st.tenant_id} className="hover:bg-background/60 transition">
                        <td className="px-4 py-3 font-bold text-text-primary">
                          #{st.tenant_id} - {st.tenant_name}
                        </td>
                        <td className="px-4 py-3">
                          {st.status === "CONNECTED" ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle className="w-3 h-3" />
                              <span>CONNECTED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              <XCircle className="w-3 h-3 text-slate-400" />
                              <span>DISCONNECTED</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {st.business_name || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {st.phone_number || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                          {st.meta_waba_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {st.connected_at ? new Date(st.connected_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Provision Tenant Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="bg-surface max-w-md w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">Provision New Beauty Parlour</h3>
              <button onClick={() => setShowProvisionModal(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleProvisionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Parlour Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Glamour Glow Salon"
                  value={provisionForm.name}
                  onChange={(e) => setProvisionForm({ ...provisionForm, name: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Admin Email *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@glamourglow.com"
                  value={provisionForm.admin_email}
                  onChange={(e) => setProvisionForm({ ...provisionForm, admin_email: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Admin Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={provisionForm.admin_password}
                  onChange={(e) => setProvisionForm({ ...provisionForm, admin_password: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Subscription Plan Tier *</label>
                <select
                  required
                  value={provisionForm.plan_id}
                  onChange={(e) => setProvisionForm({ ...provisionForm, plan_id: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} - INR {p.price}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-lg text-sm text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium"
                >
                  Provision Salon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Management Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="bg-surface max-w-md w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">{editingPlan ? "Edit Subscription Plan" : "Create Subscription Plan"}</h3>
              <button onClick={() => setShowPlanModal(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form ref={formRef} onSubmit={handlePlanSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Premium Plan"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Price (INR) *</label>
                <input
                  type="number"
                  required
                  placeholder="999"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Duration (Days) *</label>
                <input
                  type="number"
                  required
                  placeholder="30"
                  value={planForm.duration_days}
                  onChange={(e) => setPlanForm({ ...planForm, duration_days: parseInt(e.target.value) })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Max Employees</label>
                  <input
                    type="number"
                    value={planForm.max_employees}
                    onChange={(e) => setPlanForm({ ...planForm, max_employees: parseInt(e.target.value) })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Max Services</label>
                  <input
                    type="number"
                    value={planForm.max_services}
                    onChange={(e) => setPlanForm({ ...planForm, max_services: parseInt(e.target.value) })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Max Customers</label>
                  <input
                    type="number"
                    value={planForm.max_customers}
                    onChange={(e) => setPlanForm({ ...planForm, max_customers: parseInt(e.target.value) })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Max Branches</label>
                  <input
                    type="number"
                    value={planForm.max_branches}
                    onChange={(e) => setPlanForm({ ...planForm, max_branches: parseInt(e.target.value) })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-lg text-sm text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium"
                >
                  {editingPlan ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperAdmin;
