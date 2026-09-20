import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { Building2, Plus, Edit, Trash2, AlertTriangle, Check, X, Clock, Phone, Mail, MapPin } from "lucide-react";
import { useModalFocusTrap, useFormKeyboardNavigation } from "../utils/keyboardNavigation";

function BranchManagement() {
  const modalRef = useRef(null);
  const formRef = useRef(null);

  const [branches, setBranches] = useState([]);
  const [branchLimit, setBranchLimit] = useState({ max_branches: 3, current_branch_count: 0, can_create_more: true, remaining_branches: 3 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    opening_time: "09:00",
    closing_time: "20:00",
    admin_email: "",
    admin_password: "",
    latitude: "",
    longitude: "",
    geofence_radius_meters: 100,
  });
  const [detectingLoc, setDetectingLoc] = useState(false);

  const fetchBranches = () => {
    setLoading(true);
    Promise.all([
      API.get("/branches"),
      API.get("/branches/limit-check")
    ])
      .then(([branchesRes, limitRes]) => {
        const branchList = Array.isArray(branchesRes)
          ? branchesRes
          : (branchesRes?.data?.data || branchesRes?.data || branchesRes?.items || []);
        const limitData = limitRes?.data || limitRes || { max_branches: 3, current_branch_count: 0, can_create_more: true, remaining_branches: 3 };

        setBranches(branchList);
        setBranchLimit(limitData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load branches");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setDetectingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setDetectingLoc(false);
        setSuccess("Current location captured!");
        setTimeout(() => setSuccess(null), 3000);
      },
      (err) => {
        setDetectingLoc(false);
        setError("Failed to fetch current GPS location. Please allow location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateBranch = (e) => {
    e.preventDefault();
    if (!branchLimit.can_create_more) {
      setError("Branch limit reached. Please upgrade your subscription.");
      return;
    }

    API.post("/branches", formData)
      .then(() => {
        setShowCreateModal(false);
        setFormData({
          name: "",
          address: "",
          phone: "",
          email: "",
          opening_time: "09:00",
          closing_time: "20:00",
          admin_email: "",
          admin_password: "",
          latitude: "",
          longitude: "",
          geofence_radius_meters: 100,
        });
        setSuccess("Branch created successfully!");
        setTimeout(() => setSuccess(null), 3000);
        fetchBranches();
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || "Failed to create branch");
      });
  };

  const handleUpdateBranch = (e) => {
    e.preventDefault();
    API.put(`/branches/${editingBranch.id}`, formData)
      .then(() => {
        setShowEditModal(false);
        setEditingBranch(null);
        setSuccess("Branch updated successfully!");
        setTimeout(() => setSuccess(null), 3000);
        fetchBranches();
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || "Failed to update branch");
      });
  };

  const handleDeleteBranch = (branchId) => {
    if (window.confirm("Are you sure you want to delete this branch? This action cannot be undone.")) {
      API.delete(`/branches/${branchId}`)
        .then(() => {
          setSuccess("Branch deleted successfully!");
          setTimeout(() => setSuccess(null), 3000);
          fetchBranches();
        })
        .catch((err) => {
          setError(err.response?.data?.message || err.message || "Failed to delete branch");
        });
    }
  };

  const handleEditClick = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      opening_time: branch.opening_time || "09:00",
      closing_time: branch.closing_time || "20:00",
      admin_email: "",
      admin_password: "",
      latitude: branch.latitude !== null && branch.latitude !== undefined ? String(branch.latitude) : "",
      longitude: branch.longitude !== null && branch.longitude !== undefined ? String(branch.longitude) : "",
      geofence_radius_meters: branch.geofence_radius_meters || 100,
      status: branch.status || "active",
    });
    setShowEditModal(true);
  };

  const handleCreateClick = () => {
    if (!branchLimit.can_create_more) {
      setError(`Branch limit (${branchLimit.max_branches}) reached. Please upgrade your subscription to add more branches.`);
      return;
    }
    setFormData({
      name: "",
      address: "",
      phone: "",
      email: "",
      opening_time: "09:00",
      closing_time: "20:00",
      admin_email: "",
      admin_password: "",
      latitude: "",
      longitude: "",
      geofence_radius_meters: 100,
    });
    setShowCreateModal(true);
  };

  // Modal focus trap for create/edit branch modals.
  useModalFocusTrap(showCreateModal || showEditModal, modalRef, () => {
    setShowCreateModal(false);
    setShowEditModal(false);
  });

  // Keyboard navigation: Enter advances through the branch form fields.
  useFormKeyboardNavigation(formRef, () => {
    const submitBtn = formRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.focus();
  });

  const secondaryBranches = branches.filter((b) => !b.is_main_branch);

  if (loading) {
    return (
      <div className="p-8 bg-surface border border-border-soft rounded-lg space-y-4">
        <div className="h-6 bg-border-soft rounded animate-pulse w-1/4"></div>
        <div className="h-10 bg-border-soft rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Branch Management</h2>
          <p className="text-xs text-text-secondary">
            Manage your additional parlour branches & GPS geofence settings. Additional Branches: {secondaryBranches.length}/{branchLimit.max_branches - 1}
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          disabled={!branchLimit.can_create_more}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            branchLimit.can_create_more
              ? "bg-primary hover:bg-primary-hover text-white shadow-sm"
              : "bg-border-soft text-text-secondary cursor-not-allowed"
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Add Branch</span>
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="bg-danger/15 border border-danger/30 px-4 py-3 rounded-lg text-xs font-semibold text-danger flex justify-between items-center animate-fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {success && (
        <div className="bg-success/15 border border-success/30 px-4 py-3 rounded-lg text-xs font-semibold text-success flex justify-between items-center animate-fade-in">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Branch Limit Warning */}
      {!branchLimit.can_create_more && (
        <div className="bg-warning/15 border border-warning/30 px-4 py-3 rounded-lg text-xs font-semibold text-warning flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4" />
          <span>
            Branch limit ({branchLimit.max_branches}) reached. Upgrade your subscription to add more branches.
          </span>
        </div>
      )}

      {/* Branches List */}
      {secondaryBranches.length === 0 ? (
        <div className="bg-surface border border-border-soft p-8 rounded-lg text-center space-y-3">
          <Building2 className="w-12 h-12 text-pink-500/40 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-text-primary">No Additional Branches Added Yet</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Your main parlour location is configured under <span className="font-semibold text-pink-600">Parlour Profile</span>. Use this section to create and manage additional salon branch locations.
          </p>
          <button
            onClick={handleCreateClick}
            disabled={!branchLimit.can_create_more}
            className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-full text-xs font-bold transition shadow-sm mt-2 disabled:opacity-50"
          >
            + Add Additional Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {secondaryBranches.map((branch) => (
            <div key={branch.id} className="bg-surface border border-border-soft p-6 rounded-lg shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-primary-light text-primary rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{branch.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      branch.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}>
                      {branch.status}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEditClick(branch)}
                    className="p-1.5 hover:bg-background rounded-lg text-text-secondary hover:text-text-primary transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBranch(branch.id)}
                    className="p-1.5 hover:bg-background rounded-lg text-text-secondary hover:text-danger transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {branch.address && (
                  <div className="flex items-center space-x-2 text-text-secondary">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center space-x-2 text-text-secondary">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{branch.phone}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-text-secondary">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{branch.opening_time} - {branch.closing_time}</span>
                </div>
                {/* Geofence Status Badge */}
                <div className="pt-2 border-t border-border-soft">
                  {branch.latitude && branch.longitude ? (
                    <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center space-x-1.5">
                      <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>GPS Configured ({Number(branch.latitude).toFixed(4)}, {Number(branch.longitude).toFixed(4)}) — Radius: {branch.geofence_radius_meters || 100}m</span>
                    </div>
                  ) : (
                    <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md flex items-center space-x-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>GPS Location Not Set (Geofence Disabled)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Branch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="bg-surface max-w-md w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">Create New Branch</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleCreateBranch} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Downtown Salon"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Address</label>
                <textarea
                  placeholder="Branch address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  rows="2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={formData.opening_time}
                    onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={formData.closing_time}
                    onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-border-soft pt-4">
                <p className="text-xs font-semibold text-text-secondary mb-2">Branch Admin (Optional)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Admin Email</label>
                    <input
                      type="email"
                      placeholder="branch-admin@example.com"
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Admin Password</label>
                    <input
                      type="password"
                      placeholder="•••••••••"
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-lg text-sm text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {showEditModal && editingBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="bg-surface max-w-md w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">Edit Branch</h3>
              <button onClick={() => setShowEditModal(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleUpdateBranch} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  rows="2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={formData.opening_time}
                    onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={formData.closing_time}
                    onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
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

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-lg text-sm text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium"
                >
                  Update Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BranchManagement;