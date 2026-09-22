import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useModalFocusTrap, useFormKeyboardNavigation, focusAndOpenSelect } from "../utils/keyboardNavigation";
import { X, Printer, FileSpreadsheet, FileText, Upload, DollarSign } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF, exportToExcel } from "../utils/exportUtils";
import BulkUploadModal from "../components/BulkUploadModal";
import AddPayrollAdjustmentModal from "../components/AddPayrollAdjustmentModal";
import { useToast } from "../context/ToastContext";

function Employees() {
  const { showSuccess, showError } = useToast();
  const modalRef = useRef(null);
  const formRef = useRef(null);
  const firstNameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const roleSelectRef = useRef(null);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [parlourName, setParlourName] = useState("SmartGoNext Beauty SaaS");

  // Form & Payroll State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [selectedPayrollEmpId, setSelectedPayrollEmpId] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    username: "",
    password: "",
    specialization: "",
    role: "",
    salary: "",
    target: "",
    level: "L1",
    commission_percentage: "",
    joining_date: "",
    status: "active",
  });

  useModalFocusTrap(showModal, modalRef, () => setShowModal(false));
  useFormKeyboardNavigation(formRef, () => {
    const submitBtn = modalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  const fetchEmployees = (currentCursor = null) => {
    setLoading(true);
    let url = `/employees?limit=10`;
    if (currentCursor) url += `&cursor=${currentCursor}`;
    if (search) url += `&q=${search}`;
    if (status) url += `&status=${status}`;

    API.get(url)
      .then((res) => {
        setEmployees(res.data.items || []);
        setNextCursor(res.data.next_cursor || null);
        if (res.data.parlour_name) setParlourName(res.data.parlour_name);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load employees.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEmployees();
  }, [search, status]);

  const handleExportCSV = () => {
    const columns = [
      { header: "First Name", accessor: "first_name" },
      { header: "Last Name", accessor: "last_name" },
      { header: "Role", accessor: "role" },
      { header: "Level", accessor: "level" },
      { header: "Phone", accessor: "phone" },
      { header: "Specialization", accessor: "specialization" },
      { header: "Salary", accessor: "salary" },
      { header: "Target", accessor: "target" },
      { header: "Commission %", accessor: "commission_percentage" },
      { header: "Status", accessor: "status" }
    ];
    exportToCSV("Employees List", employees, columns, "employees_list", parlourName);
  };

  const handlePrint = () => {
    const columns = [
      { header: "Name", accessor: (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() },
      { header: "Role", accessor: "role" },
      { header: "Level", accessor: "level" },
      { header: "Phone", accessor: "phone" },
      { header: "Specialization", accessor: "specialization" },
      { header: "Salary", accessor: "salary" },
      { header: "Target", accessor: "target" },
      { header: "Commission %", accessor: (row) => `${row.commission_percentage || 0}%` },
      { header: "Status", accessor: "status" }
    ];
    printDataList("Employees List", employees, columns, parlourName);
  };

  const handleExportExcel = () => {
    const columns = [
      { header: "First Name", accessor: "first_name" },
      { header: "Last Name", accessor: "last_name" },
      { header: "Role", accessor: "role" },
      { header: "Level", accessor: "level" },
      { header: "Phone", accessor: "phone" },
      { header: "Specialization", accessor: "specialization" },
      { header: "Salary", accessor: "salary" },
      { header: "Target", accessor: "target" },
      { header: "Commission %", accessor: "commission_percentage" },
      { header: "Status", accessor: "status" }
    ];
    exportToExcel("Employees List", employees, columns, "employees_list", parlourName);
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "Name", accessor: (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() },
      { header: "Role", accessor: "role" },
      { header: "Level", accessor: "level" },
      { header: "Phone", accessor: "phone" },
      { header: "Specialization", accessor: "specialization" },
      { header: "Salary", accessor: "salary" },
      { header: "Target", accessor: "target" },
      { header: "Commission %", accessor: (row) => `${row.commission_percentage || 0}%` },
      { header: "Status", accessor: "status" }
    ];
    exportToPDF("Employees List", employees, columns, "employees_list", parlourName);
  };

  const handleNextPage = () => {
    if (nextCursor) {
      setCursorHistory([...cursorHistory, cursor]);
      setCursor(nextCursor);
      fetchEmployees(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prev = cursorHistory[cursorHistory.length - 1];
      const newHistory = cursorHistory.slice(0, -1);
      setCursorHistory(newHistory);
      setCursor(prev);
      fetchEmployees(prev);
    }
  };

  const openAddModal = () => {
    setEditId(null);
    setFormData({
      first_name: "",
      last_name: "",
      phone: "",
      username: "",
      password: "",
      specialization: "",
      role: "",
      salary: "",
      target: "",
      level: "L1",
      commission_percentage: "",
      joining_date: new Date().toISOString().split("T")[0],
      shift_start_time: "09:00",
      shift_end_time: "18:00",
      status: "active",
    });
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setEditId(emp.id);
    setFormData({
      first_name: emp.first_name || "",
      last_name: emp.last_name || "",
      phone: emp.phone || "",
      username: emp.username || emp.phone || "",
      password: "",
      specialization: emp.specialization || "",
      role: emp.role || "",
      salary: emp.salary || "",
      target: emp.target || "",
      level: emp.level || "L1",
      commission_percentage: emp.commission_percentage || "",
      joining_date: emp.joining_date || "",
      shift_start_time: emp.shift_start_time || "09:00",
      shift_end_time: emp.shift_end_time || "18:00",
      status: emp.status || "active",
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

    const payload = {
      ...formData,
      salary: formData.salary !== "" && formData.salary !== null ? parseFloat(formData.salary) : 0,
      target: formData.target !== "" && formData.target !== null ? parseFloat(formData.target) : 0,
      level: formData.level || "L1",
      commission_percentage: formData.commission_percentage !== "" && formData.commission_percentage !== null ? parseFloat(formData.commission_percentage) : 0,
    };

    const action = editId ? API.put(`/employees/${editId}`, payload) : API.post("/employees", payload);

    action
      .then(() => {
        setShowModal(false);
        showSuccess(editId ? "Employee updated successfully!" : "Employee added successfully!");
        setFormData({
          first_name: "",
          last_name: "",
          phone: "",
          specialization: "",
          role: "",
          salary: "",
          target: "",
          level: "L1",
          commission_percentage: "",
          joining_date: new Date().toISOString().split("T")[0],
          status: "active",
        });
        setEditId(null);
        fetchEmployees(cursor);
      })
      .catch((err) => {
        const errorMessage = err.response?.data?.message || err.message || "Operation failed.";
        showError(errorMessage);
      });
  };

  const handleDelete = (id) => {
    API.delete(`/employees/${id}`)
      .then(() => {
        showSuccess("Employee removed successfully.");
        fetchEmployees(cursor);
      })
      .catch((err) => {
        showError(err.message || "Failed to delete employee.");
      });
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Staff & Employee Roster</h1>
          <p className="text-xs text-text-secondary">Configure commissions, salaries, specializations, and access status.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSelectedPayrollEmpId(null);
              setShowPayrollModal(true);
            }}
            className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4 text-indigo-600" />
            Advance / Deduction
          </button>
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
            + Add Employee
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-surface border border-border-soft p-4 rounded-lg flex space-x-4 items-center">
        <input
          type="text"
          placeholder="Search by name, phone, specialization..."
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
        ) : employees.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-text-secondary mb-4">No employees registered yet.</p>
            <button onClick={openAddModal} className="text-sm text-primary font-medium hover:underline">
              Add your first employee
            </button>
          </div>
        ) : (
          <>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary-light border-b border-border-soft">
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Name</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Role</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Phone</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Status</th>
                  <th className="px-6 py-3 text-sm font-semibold text-text-secondary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-background/50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-text-primary">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{emp.role || "-"}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{emp.phone}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        emp.status === "active" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3">
                      <button onClick={() => openEditModal(emp)} className="text-primary hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="text-danger hover:underline">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="glowe-glass-card max-w-lg w-full rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
            <div className="px-6 py-4 border-b border-pink-100/60 flex justify-between items-center bg-white/50 backdrop-blur-md">
              <h3 className="text-md font-bold text-slate-900">
                {editId ? "Edit Employee" : "Add New Employee"}
              </h3>
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

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Role / Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Stylist, Therapist"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Login Username / Email</label>
                  <input
                    type="text"
                    placeholder="Enter login username or email"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Login Password</label>
                  <input
                    type="password"
                    placeholder={editId ? "Leave blank to keep current" : "Set employee password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Specialization</label>
                <input
                  type="text"
                  placeholder="e.g. Haircut, Skincare"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Salary (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="20000"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Target (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="100000"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Level</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  >
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    value={formData.shift_start_time || "09:00"}
                    onChange={(e) => setFormData({ ...formData, shift_start_time: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Shift End Time</label>
                  <input
                    type="time"
                    value={formData.shift_end_time || "18:00"}
                    onChange={(e) => setFormData({ ...formData, shift_end_time: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
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
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {showBulkUpload && (
        <BulkUploadModal
          module="employees"
          onClose={() => setShowBulkUpload(false)}
          onSuccess={fetchEmployees}
        />
      )}

      <AddPayrollAdjustmentModal
        isOpen={showPayrollModal}
        defaultEmployeeId={selectedPayrollEmpId}
        onClose={() => setShowPayrollModal(false)}
      />
    </div>
  );
}

export default Employees;
