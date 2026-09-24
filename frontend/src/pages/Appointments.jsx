import React, { useState, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  Globe,
  Settings,
  Link,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Sparkles,
  Phone,
  MessageSquare,
  User,
  Scissors,
  Trash2,
  RefreshCw,
  Award,
  Crown,
  ChevronRight,
} from "lucide-react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";

function Appointments() {
  const { showSuccess, showError } = useToast();
  const { formatCurrency } = useLanguageCurrency();
  const pageRef = useRef(null);
  const [activeSubTab, setActiveSubTab] = useState("todays");
  const [appointments, setAppointments] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filters State
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Manual Form State
  const [phoneInput, setPhoneInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [customerData, setCustomerData] = useState({
    found: false,
    customer_name: "",
    email: "",
    gender: "Female",
    visit_count: 0,
    active_memberships: [],
  });

  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [bookingTime, setBookingTime] = useState("10:00");
  const [bookingSource, setBookingSource] = useState("Walk-in");
  const [appointmentType, setAppointmentType] = useState("Regular");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState([
    { service_id: "", employee_id: "", price: 0, duration_minutes: 30 },
  ]);
  const [savingAppointment, setSavingAppointment] = useState(false);

  const subTabs = [
    { id: "todays", label: "Today's Appointments", icon: Clock },
    { id: "calendar", label: "Calendar", icon: CalendarIcon },
    { id: "manual", label: "Manual Appointment", icon: PlusCircle },
    { id: "website", label: "Website Bookings", icon: Globe },
    { id: "settings", label: "Booking Settings", icon: Settings },
    { id: "booking_link", label: "Booking Page Link", icon: Link },
  ];

  useEffect(() => {
    fetchAppointments();
    fetchCatalogAndStaff();
  }, [filterDate, filterStatus, filterSource, filterEmployee, searchTerm]);

  const fetchAppointments = () => {
    setLoading(true);
    let params = `?date=${filterDate}`;
    if (filterStatus) params += `&status=${filterStatus}`;
    if (filterSource) params += `&booking_source=${filterSource}`;
    if (filterEmployee) params += `&employee_id=${filterEmployee}`;
    if (searchTerm) params += `&search=${encodeURIComponent(searchTerm)}`;

    API.get(`/appointments${params}`)
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setAppointments(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchCatalogAndStaff = () => {
    API.get("/services?limit=100").then((res) => {
      console.log("[Appointments] GET /services unwrapped res:", res);
      const dataPayload = res?.data;
      let list = [];
      if (Array.isArray(dataPayload)) {
        list = dataPayload;
      } else if (dataPayload && Array.isArray(dataPayload.items)) {
        list = dataPayload.items;
      } else if (Array.isArray(res?.items)) {
        list = res.items;
      } else if (Array.isArray(res)) {
        list = res;
      }
      console.log("[Appointments] Extracted servicesList:", list);
      setServicesList(list);
    }).catch((err) => {
      console.error("[Appointments] GET /services error:", err);
      setServicesList([]);
    });

    API.get("/employees?limit=100").then((res) => {
      console.log("[Appointments] GET /employees unwrapped res:", res);
      const dataPayload = res?.data;
      let list = [];
      if (Array.isArray(dataPayload)) {
        list = dataPayload;
      } else if (dataPayload && Array.isArray(dataPayload.items)) {
        list = dataPayload.items;
      } else if (Array.isArray(res?.items)) {
        list = res.items;
      } else if (Array.isArray(res)) {
        list = res;
      }
      console.log("[Appointments] Extracted employeesList:", list);
      setEmployeesList(list);
    }).catch((err) => {
      console.error("[Appointments] GET /employees error:", err);
      setEmployeesList([]);
    });
  };

  // Phone Lookup Logic
  const handlePhoneLookup = (phone) => {
    setPhoneInput(phone);
    if (phone.length >= 10) {
      setLookupLoading(true);
      API.get(`/appointments/customer-lookup?phone=${encodeURIComponent(phone)}`)
        .then((res) => {
          const d = res.data?.data;
          if (d && d.found) {
            setCustomerData({
              found: true,
              customer_name: d.full_name,
              email: d.email || "",
              gender: d.gender || "Female",
              visit_count: d.visit_count || 0,
              active_memberships: d.active_memberships || [],
            });
          } else {
            setCustomerData({
              found: false,
              customer_name: "",
              email: "",
              gender: "Female",
              visit_count: 0,
              active_memberships: [],
            });
          }
        })
        .catch(() => {})
        .finally(() => setLookupLoading(false));
    }
  };

  // Item Rows Handlers
  const handleAddServiceRow = () => {
    setSelectedItems([
      ...selectedItems,
      { service_id: "", employee_id: "", price: 0, duration_minutes: 30 },
    ]);
  };

  const handleRemoveServiceRow = (index) => {
    if (selectedItems.length > 1) {
      setSelectedItems(selectedItems.filter((_, i) => i !== index));
    }
  };

  const floatVal = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
  const intVal = (v) => (isNaN(parseInt(v)) ? 0 : parseInt(v));

  const handleServiceChange = (index, serviceId) => {
    const s = servicesList.find((x) => String(x.id) === String(serviceId));
    const updated = [...selectedItems];
    updated[index].service_id = serviceId;
    updated[index].price = s ? floatVal(s.price) : 0;
    updated[index].duration_minutes = s ? intVal(s.duration_minutes) : 30;
    setSelectedItems(updated);
  };

  const handleEmployeeChange = (index, employeeId) => {
    const updated = [...selectedItems];
    updated[index].employee_id = employeeId;
    setSelectedItems(updated);
  };

  // Helper to format HH:MM into 12-hour AM/PM string
  const formatTime12h = (timeStr) => {
    if (!timeStr) return "Token";
    if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h.toString().padStart(2, "0")}:${mStr} ${ampm}`;
  };

  // Form Submit Handler
  const handleCreateAppointment = (e) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!customerData.customer_name.trim()) {
      return setActionError("Customer Name is required.");
    }
    if (!phoneInput.trim()) {
      return setActionError("Customer Phone Number is required.");
    }
    if (selectedItems.some((item) => !item.service_id)) {
      return setActionError("Please select a service for all added service rows.");
    }

    setSavingAppointment(true);

    const payload = {
      customer_name: customerData.customer_name.trim(),
      customer_phone: phoneInput.trim(),
      customer_email: customerData.email.trim(),
      gender: customerData.gender,
      appointment_date: bookingDate,
      start_time: bookingTime,
      booking_source: bookingSource,
      booking_channel: "Phone/Walk-in",
      appointment_type: appointmentType,
      notes: notes,
      items: selectedItems.map((item) => ({
        service_id: Number(item.service_id),
        employee_id: item.employee_id ? Number(item.employee_id) : null,
      })),
    };

    console.log("[Appointments] Submitting Appointment Payload:", payload);

    API.post("/appointments", payload)
      .then((res) => {
        console.log("[Appointments] Save Success Response:", res);
        setActionSuccess(res?.message || res?.data?.message || "Appointment booked successfully!");
        // Reset form
        setPhoneInput("");
        setCustomerData({
          found: false,
          customer_name: "",
          email: "",
          gender: "Female",
          visit_count: 0,
          active_memberships: [],
        });
        setNotes("");
        setSelectedItems([{ service_id: "", employee_id: "", price: 0, duration_minutes: 30 }]);
        setFilterDate(bookingDate);
        fetchAppointments();
        setActiveSubTab("todays");
      })
      .catch((err) => {
        console.error("[Appointments] Save Error Exception:", err);
        const msg = err?.message || err?.response?.data?.message || err?.error || "Failed to save appointment.";
        setActionError(msg);
      })
      .finally(() => setSavingAppointment(false));
  };

  // Status Change Handler
  const handleStatusChange = (appointmentId, newStatus) => {
    API.put(`/appointments/${appointmentId}/status`, { status: newStatus })
      .then(() => {
        fetchAppointments();
      })
      .catch((err) => {
        showError(err.response?.data?.message || "Failed to update status.");
      });
  };

  // ─────────────────────────────────────────────────────────────
  // CONTEXT-AWARE KEYBOARD NAVIGATION
  // Behavior depends on the currently focused element type. We only
  // intercept keys where the browser's native behavior is insufficient
  // and never override native cursor/option navigation.
  // ─────────────────────────────────────────────────────────────
  const focusAdjacentButton = (currentEl, direction) => {
    // Walk up to find the nearest container that groups multiple buttons so
    // arrow-key navigation stays within the current logical button group
    // (e.g. an appointment card's status workflow, the sub-navigation tabs,
    // the Booking Mode picker) instead of jumping to unrelated page buttons.
    let container = currentEl.parentElement;
    while (container && container !== pageRef.current) {
      const siblings = Array.from(container.querySelectorAll("button")).filter(
        (b) => b.offsetParent !== null
      );
      if (siblings.length >= 2) {
        const idx = siblings.indexOf(currentEl);
        if (idx !== -1) {
          let next = idx + direction;
          while (next >= 0 && next < siblings.length) {
            const candidate = siblings[next];
            if (!candidate.disabled) {
              candidate.focus();
              return;
            }
            next += direction;
          }
        }
        break;
      }
      container = container.parentElement;
    }
  };

  const focusNextFormField = (form, currentEl) => {
    const fields = Array.from(form.querySelectorAll("input, select, textarea, button"));
    const idx = fields.indexOf(currentEl);
    if (idx === -1) return;
    for (let i = idx + 1; i < fields.length; i++) {
      const f = fields[i];
      if (!f.disabled && !f.readOnly && f.type !== "hidden" && (f.type !== "submit" || i === fields.length - 1)) {
        f.focus();
        return;
      }
    }
    // Reached the end: focus the submit button so a second Enter submits.
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.focus();
  };

  const handlePageKeyDown = (e) => {
    const el = e.target;
    if (!el) return;
    const tag = el.tagName;
    const type = el.type || "";
    const key = e.key;

    // 1. SELECT FIELDS — native dropdown behavior:
    //    ↓/↑ highlight options, Enter confirms, Esc closes, and when the
    //    dropdown is open the Arrow keys control options (not other fields).
    if (tag === "SELECT") {
      return; // keep native behavior entirely
    }

    // 4. CHECKBOX / TOGGLE — native Space toggles; keep native Enter too.
    if (tag === "INPUT" && type === "checkbox") {
      return;
    }

    // Native submit/reset buttons keep their native activation.
    if (tag === "INPUT" && (type === "button" || type === "submit" || type === "reset")) {
      return;
    }

    // 2. TEXT / NUMBER / DATE / TIME INPUTS — allow normal typing & editing.
    //    ↑/↓/←/→ are left native (cursor movement, number spinner) so we never
    //    unexpectedly change fields. Enter moves to the next logical field only
    //    when inside a form (prevents premature/implicit form submission).
    if (tag === "INPUT") {
      if (key === "Enter") {
        const form = el.closest("form");
        if (form) {
          e.preventDefault();
          focusNextFormField(form, el);
        }
        // Outside a form (e.g. filter bar / search / phone lookup): keep native
        // behavior — no suggestion list exists, so nothing is triggered.
      }
      return;
    }

    // TEXTAREA — Enter inserts a newline; arrows move the caret. Never intercept.
    if (tag === "TEXTAREA") {
      return;
    }

    // 3. BUTTONS — Enter/Space perform the button's existing action natively.
    //    → / ← (and ↓ / ↑) move between logically arranged buttons in DOM order.
    if (tag === "BUTTON") {
      if (key === "Enter" || key === " ") {
        return; // native activation
      }
      if (key === "ArrowRight" || key === "ArrowDown") {
        e.preventDefault();
        focusAdjacentButton(el, 1);
        return;
      }
      if (key === "ArrowLeft" || key === "ArrowUp") {
        e.preventDefault();
        focusAdjacentButton(el, -1);
        return;
      }
    }
  };

  return (
    <div
      ref={pageRef}
      onKeyDown={handlePageKeyDown}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span>Appointments</span>
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage daily parlour walk-ins, phone calls, WhatsApp bookings, and automated website tokens/slots.
          </p>
        </div>

        <button
          onClick={() => setActiveSubTab("manual")}
          className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs shadow-md shadow-primary/20 flex items-center space-x-2 self-start md:self-auto transition active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Manual Appointment</span>
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b border-border-soft flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-text-secondary hover:bg-surface border border-transparent hover:border-border-soft"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Sub-Tab Content Views */}
      <div className="bg-surface border border-border-soft rounded-2xl p-6 shadow-xs">
        {/* 1. Today's Appointments Board */}
        {activeSubTab === "todays" && (
          <div className="space-y-6">
            {/* Filter Bar & Search */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-background/50 border border-border-soft rounded-xl">
              {/* Date Filter */}
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Filter Date</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full bg-surface border border-border-soft px-3 py-1.5 rounded-xl text-xs font-bold text-text-primary focus:outline-none numeric-input"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-surface border border-border-soft px-3 py-1.5 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="Booked">Booked</option>
                  <option value="Waiting">Waiting</option>
                  <option value="In Service">In Service</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="No Show">No Show</option>
                </select>
              </div>

              {/* Booking Source Filter */}
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Source</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="w-full bg-surface border border-border-soft px-3 py-1.5 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                >
                  <option value="">All Sources</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Website Token">Website Token</option>
                  <option value="Website Slot">Website Slot</option>
                </select>
              </div>

              {/* Staff Filter */}
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Assigned Staff</label>
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full bg-surface border border-border-soft px-3 py-1.5 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                >
                  <option value="">All Staff</option>
                  {Array.isArray(employeesList) && employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Instant Search Input */}
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Search Client / Ref #</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search name, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface border border-border-soft pl-8 pr-3 py-1.5 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Appointments Board List */}
            {loading ? (
              <div className="p-12 text-center text-xs text-text-secondary">Loading appointments...</div>
            ) : appointments.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-border-soft rounded-2xl bg-background/50 space-y-2">
                <Clock className="w-8 h-8 text-primary mx-auto opacity-70" />
                <p className="text-xs font-bold text-text-primary">No appointments found for selected filter.</p>
                <p className="text-[11px] text-text-secondary">
                  Click "New Manual Appointment" to schedule a walk-in, phone call, or social booking.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {appointments.map((app) => (
                  <div
                    key={app.id}
                    className="bg-background border border-border-soft rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-primary/50 transition shadow-xs"
                  >
                    {/* Header: Ref #, Status & Source */}
                    <div className="flex justify-between items-start border-b border-border-soft pb-2.5">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-text-secondary uppercase">
                          {app.appointment_number}
                        </span>
                        <h4 className="text-sm font-extrabold text-text-primary mt-0.5">{app.customer_name}</h4>
                        <p className="text-xs font-semibold text-text-secondary flex items-center space-x-1 mt-0.5">
                          <Phone className="w-3 h-3 text-primary" />
                          <span>{app.customer_phone}</span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end space-y-1">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                            app.status === "Completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : app.status === "In Service"
                              ? "bg-purple-100 text-purple-800"
                              : app.status === "Waiting"
                              ? "bg-amber-100 text-amber-800"
                              : app.status === "Cancelled" || app.status === "No Show"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {app.status}
                        </span>

                        <span className="text-[10px] font-bold text-text-secondary bg-surface border border-border-soft px-2 py-0.5 rounded-md">
                          {app.booking_source}
                        </span>
                      </div>
                    </div>

                    {/* Service & Time Info */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-text-secondary">
                        <span>Scheduled Time:</span>
                        <span className="font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {app.start_time_12h || formatTime12h(app.start_time)} ({app.estimated_duration_minutes} mins)
                        </span>
                      </div>

                      <div className="space-y-1 border-t border-border-soft pt-2">
                        <p className="text-[11px] font-bold text-text-secondary uppercase">Services Rendered:</p>
                        {app.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-surface p-2 rounded-xl border border-border-soft">
                            <div>
                              <p className="font-bold text-text-primary">{it.service_name}</p>
                              {it.employee_name && (
                                <p className="text-[10px] text-text-secondary">Staff: {it.employee_name}</p>
                              )}
                            </div>
                            <span className="font-bold text-primary">{formatCurrency(it.price)}</span>
                          </div>
                        ))}
                      </div>

                      {app.appointment_type === "VIP" && (
                        <div className="inline-flex items-center space-x-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                          <Crown className="w-3 h-3 text-amber-500" />
                          <span>VIP Client</span>
                        </div>
                      )}
                    </div>

                    {/* Status Action Workflow Buttons */}
                    <div className="border-t border-border-soft pt-3 flex flex-wrap gap-1.5">
                      {app.status === "Booked" && (
                        <button
                          onClick={() => handleStatusChange(app.id, "Waiting")}
                          className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:bg-amber-600 transition"
                        >
                          Mark Waiting
                        </button>
                      )}

                      {(app.status === "Booked" || app.status === "Waiting") && (
                        <button
                          onClick={() => handleStatusChange(app.id, "In Service")}
                          className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[11px] font-bold hover:bg-purple-700 transition"
                        >
                          Start Service
                        </button>
                      )}

                      {app.status === "In Service" && (
                        <button
                          onClick={() => handleStatusChange(app.id, "Completed")}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 transition"
                        >
                          Complete
                        </button>
                      )}

                      {app.status !== "Completed" && app.status !== "Cancelled" && (
                        <>
                          <button
                            onClick={() => handleStatusChange(app.id, "Cancelled")}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold hover:bg-rose-100 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleStatusChange(app.id, "No Show")}
                            className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold hover:bg-slate-200 transition"
                          >
                            No Show
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Manual Appointment Form */}
        {activeSubTab === "manual" && (
          <form onSubmit={handleCreateAppointment} className="space-y-6 max-w-4xl">
            <div className="border-b border-border-soft pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Manual Appointment Registration</h3>
                <p className="text-xs text-text-secondary">
                  Schedule phone calls, WhatsApp inquiries, walk-ins, or social media bookings.
                </p>
              </div>
              <span className="text-xs font-bold text-primary bg-primary-light px-3 py-1 rounded-full border border-primary/20">
                Staff Dashboard Portal
              </span>
            </div>

            {/* Section A: Customer Detection & Info */}
            <div className="p-4 bg-background/50 border border-border-soft rounded-2xl space-y-4">
              <h4 className="text-xs font-extrabold text-text-primary uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-4 h-4 text-primary" />
                <span>1. Customer Detection & Details</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Phone Search */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter 10-digit phone..."
                      value={phoneInput}
                      onChange={(e) => handlePhoneLookup(e.target.value)}
                      className="w-full bg-surface border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                    />
                    {lookupLoading && (
                      <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin absolute right-3 top-2.5" />
                    )}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Full Name..."
                    value={customerData.customer_name}
                    onChange={(e) => setCustomerData({ ...customerData, customer_name: e.target.value })}
                    className="w-full bg-surface border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="client@gmail.com"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                    className="w-full bg-surface border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Customer Auto-Found Badge */}
              {customerData.found && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-semibold">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Existing Client Found: {customerData.visit_count} previous visit(s)</span>
                  </div>

                  {customerData.active_memberships.length > 0 && (
                    <div className="flex items-center space-x-1 text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      <span>{customerData.active_memberships[0].plan_name} Member</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section B: Booking Logistics & Source */}
            <div className="p-4 bg-background/50 border border-border-soft rounded-2xl space-y-4">
              <h4 className="text-xs font-extrabold text-text-primary uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-primary" />
                <span>2. Schedule & Channel</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Appointment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-surface border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full bg-surface border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                  />
                </div>

                {/* Booking Source */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Booking Source</label>
                  <select
                    value={bookingSource}
                    onChange={(e) => setBookingSource(e.target.value)}
                    className="w-full bg-surface border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                  >
                    <option value="Phone Call">Phone Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                  </select>
                </div>

                {/* Appointment Type */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Client Type</label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="w-full bg-surface border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-text-primary focus:outline-none"
                  >
                    <option value="Regular">Regular</option>
                    <option value="VIP">VIP Client</option>
                    <option value="Home Service">Home Service</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section C: Multi-Service Selection */}
            <div className="p-4 bg-background/50 border border-border-soft rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-extrabold text-text-primary uppercase tracking-wider flex items-center space-x-1.5">
                  <Scissors className="w-4 h-4 text-primary" />
                  <span>3. Services & Staff Selection</span>
                </h4>

                <button
                  type="button"
                  onClick={handleAddServiceRow}
                  className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition flex items-center space-x-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Another Service</span>
                </button>
              </div>

              <div className="space-y-3">
                {selectedItems.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-surface p-3 rounded-xl border border-border-soft">
                    {/* Service Dropdown */}
                    <div className="col-span-5">
                      <label className="block text-[10px] font-bold text-text-secondary mb-0.5">Service #{idx + 1}</label>
                      <select
                        value={row.service_id}
                        onChange={(e) => handleServiceChange(idx, e.target.value)}
                        className="w-full bg-background border border-border-soft px-3 py-1.5 rounded-lg text-xs font-bold text-text-primary focus:outline-none"
                      >
                        <option value="">Select Service...</option>
                        {Array.isArray(servicesList) && servicesList.length > 0 ? (
                          servicesList.map((srv) => (
                            <option key={srv.id} value={srv.id}>
                              {srv.name} ({formatCurrency(srv.price)} - {srv.duration_minutes}m)
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No active services found</option>
                        )}
                      </select>
                    </div>

                    {/* Staff Dropdown */}
                    <div className="col-span-4">
                      <label className="block text-[10px] font-bold text-text-secondary mb-0.5">Assigned Staff (Optional)</label>
                      <select
                        value={row.employee_id}
                        onChange={(e) => handleEmployeeChange(idx, e.target.value)}
                        className="w-full bg-background border border-border-soft px-3 py-1.5 rounded-lg text-xs font-bold text-text-primary focus:outline-none"
                      >
                        <option value="">Auto Assign / Unassigned</option>
                        {Array.isArray(employeesList) && employeesList.length > 0 ? (
                          employeesList.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No employees found</option>
                        )}
                      </select>
                    </div>

                    {/* Read-Only Price */}
                    <div className="col-span-2 text-right">
                      <label className="block text-[10px] font-bold text-text-secondary mb-0.5">Price</label>
                      <span className="text-xs font-extrabold text-primary block numeric">{formatCurrency(row.price)}</span>
                    </div>

                    {/* Delete Row Button */}
                    <div className="col-span-1 text-center pt-3">
                      {selectedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveServiceRow(idx)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Remove Service"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section D: Notes & Submit */}
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Notes / Internal Instructions</label>
              <textarea
                rows={2}
                placeholder="Special instructions, hair allergy notes, preferred beverages..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-background border border-border-soft p-3 rounded-xl text-xs font-medium text-text-primary focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingAppointment}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-extrabold text-sm rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50"
            >
              {savingAppointment ? "Saving Appointment..." : "Confirm & Save Appointment"}
            </button>
          </form>
        )}

        {/* 2. Calendar Section */}
        {activeSubTab === "calendar" && (
          <div className="p-8 text-center border-2 border-dashed border-border-soft rounded-2xl bg-background/50 space-y-2">
            <CalendarIcon className="w-8 h-8 text-primary mx-auto opacity-70" />
            <p className="text-xs font-bold text-text-primary">Calendar Module Placeholder</p>
            <p className="text-[11px] text-text-secondary max-w-md mx-auto">
              Interactive monthly and daily timeline grid will be connected in later phases.
            </p>
          </div>
        )}

        {/* 4. Website Bookings Section */}
        {activeSubTab === "website" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Website Bookings Ledger</h3>
                <p className="text-xs text-text-secondary">Appointments booked online by customers from your public website portal.</p>
              </div>
              <button
                onClick={fetchAppointments}
                className="px-3 py-1.5 bg-surface hover:bg-hover-bg text-text-primary border border-border-soft rounded-xl text-xs font-bold transition flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5 text-primary" />
                <span>Refresh</span>
              </button>
            </div>

            {appointments.filter((a) => a.booking_channel === "Website" || (a.booking_source && a.booking_source.toLowerCase().includes("website"))).length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-border-soft rounded-2xl bg-background/50 space-y-3">
                <Globe className="w-10 h-10 text-primary mx-auto opacity-70" />
                <p className="text-xs font-bold text-text-primary">No Website Bookings Recorded Yet</p>
                <p className="text-[11px] text-text-secondary max-w-md mx-auto">
                  Share your public booking portal link with customers. When they book online, their token and slot appointments will automatically show up here!
                </p>
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-border-soft shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-background border-b border-border-soft text-sm font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="py-3 px-4">Booking Ref</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Date & Time / Token</th>
                        <th className="py-3 px-4">Services</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-soft text-sm font-medium">
                      {appointments
                        .filter((a) => a.booking_channel === "Website" || (a.booking_source && a.booking_source.toLowerCase().includes("website")))
                        .map((appt) => (
                          <tr key={appt.id} className="hover:bg-hover-bg/50 transition">
                            <td className="py-3 px-4">
                              <span className="font-extrabold text-text-primary">{appt.appointment_number}</span>
                              <span className="block text-[10px] text-primary font-bold">{appt.booking_source}</span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-text-primary">{appt.customer_name}</div>
                              <div className="text-[11px] text-text-secondary">{appt.customer_phone}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-text-primary">{appt.appointment_date}</div>
                              <div className="text-[11px] text-text-secondary">
                                {appt.token_number ? `Token #${appt.token_number}` : appt.start_time_12h || appt.start_time}
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              {appt.items && appt.items.length > 0 ? (
                                <div className="space-y-0.5">
                                  {appt.items.map((it, idx) => (
                                    <div key={idx} className="text-text-primary truncate font-semibold">
                                      • {it.service_name} {it.employee_name ? `(${it.employee_name})` : ""}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-text-secondary">Regular Service</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-extrabold text-text-primary numeric">
                              {formatCurrency(appt.total_amount)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                                  appt.status === "Completed"
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : appt.status === "In Service"
                                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                                    : appt.status === "Waiting"
                                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                                    : appt.status === "Cancelled"
                                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                                    : "bg-blue-100 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {appt.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <select
                                value={appt.status}
                                onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                                className="bg-background border border-border-soft px-2 py-1 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary"
                              >
                                <option value="Booked">Booked</option>
                                <option value="Waiting">Waiting</option>
                                <option value="In Service">In Service</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="No Show">No Show</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Booking Settings Section */}
        {activeSubTab === "settings" && (
          <BookingSettingsManager formatCurrency={formatCurrency} />
        )}

        {/* 6. Booking Page Link Section */}
        {activeSubTab === "booking_link" && (
          <BookingLinkPreview />
        )}
      </div>
    </div>
  );
}

// Sub-component to manage Tenant Booking Settings
function BookingSettingsManager({ formatCurrency }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    API.get("/appointments/settings")
      .then((res) => {
        const d = res.data?.data || res.data || {};
        setSettings({
          ...d,
          allow_staff_selection: Boolean(d.allow_staff_selection),
          booking_enabled: Boolean(d.booking_enabled)
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    API.put("/appointments/settings", settings)
      .then((res) => {
        const d = res.data?.data;
        if (d) {
          setSettings({
            ...d,
            allow_staff_selection: Boolean(d.allow_staff_selection),
            booking_enabled: Boolean(d.booking_enabled)
          });
        }
        setMsg({ type: "success", text: "Booking settings updated successfully!" });
      })
      .catch((err) => {
        setMsg({ type: "error", text: err.message || "Failed to update settings." });
      })
      .finally(() => setSaving(false));
  };

  const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const toggleDay = (day) => {
    if (!settings) return;
    const current = settings.working_days || [];
    if (current.includes(day)) {
      setSettings({ ...settings, working_days: current.filter((d) => d !== day) });
    } else {
      setSettings({ ...settings, working_days: [...current, day] });
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-xs font-bold text-text-secondary">Loading Booking Settings...</div>;
  }

  return (
    <form onSubmit={handleSave} className="bg-surface p-6 rounded-2xl border border-border-soft shadow-sm space-y-6 max-w-3xl">
      <div>
        <h3 className="text-sm font-extrabold text-text-primary">Online Booking & Appointment Rules</h3>
        <p className="text-xs text-text-secondary">Configure how customers book appointments on your public portal.</p>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-xs font-bold ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-background rounded-xl border border-border-soft flex items-center justify-between shadow-xs hover:border-pink-300 transition">
          <div>
            <div className="text-xs font-extrabold text-text-primary">Enable Online Booking</div>
            <div className="text-[11px] text-text-secondary">Allow public website bookings</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.booking_enabled)}
              onChange={(e) => setSettings({ ...settings, booking_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600 shadow-inner"></div>
          </label>
        </div>

        <div className="p-4 bg-background rounded-xl border border-border-soft flex items-center justify-between shadow-xs hover:border-pink-300 transition">
          <div>
            <div className="text-xs font-extrabold text-text-primary">Allow Staff Selection</div>
            <div className="text-[11px] text-text-secondary">Customers choose beautician</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.allow_staff_selection)}
              onChange={(e) => setSettings({ ...settings, allow_staff_selection: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600 shadow-inner"></div>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-text-primary">Booking Mode</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSettings({ ...settings, booking_type: "Token" })}
            className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-2 ${
              settings.booking_type === "Token" ? "bg-primary text-white border-primary shadow-sm" : "bg-background text-text-primary border-border-soft"
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Token Booking</span>
          </button>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, booking_type: "Slot" })}
            className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-2 ${
              settings.booking_type === "Slot" ? "bg-primary text-white border-primary shadow-sm" : "bg-background text-text-primary border-border-soft"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Time Slot Booking</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-text-primary">Working Days</label>
        <div className="flex flex-wrap gap-2">
          {allDays.map((day) => {
            const active = (settings.working_days || []).includes(day);
            return (
              <button
                type="button"
                key={day}
                onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  active ? "bg-pink-100 text-pink-700 border border-pink-300" : "bg-background text-text-secondary border border-border-soft"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-bold text-text-primary mb-1">Opening Time</label>
          <input
            type="time"
            value={settings.opening_time}
            onChange={(e) => setSettings({ ...settings, opening_time: e.target.value })}
            className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-medium text-text-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-primary mb-1">Closing Time</label>
          <input
            type="time"
            value={settings.closing_time}
            onChange={(e) => setSettings({ ...settings, closing_time: e.target.value })}
            className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-medium text-text-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-primary mb-1">Break Start</label>
          <input
            type="time"
            value={settings.break_start_time || "13:00"}
            onChange={(e) => setSettings({ ...settings, break_start_time: e.target.value })}
            className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-medium text-text-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-primary mb-1">Break End</label>
          <input
            type="time"
            value={settings.break_end_time || "14:00"}
            onChange={(e) => setSettings({ ...settings, break_end_time: e.target.value })}
            className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-medium text-text-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-text-primary mb-1">Slot Interval (Mins)</label>
          <select
            value={settings.booking_interval_minutes}
            onChange={(e) => setSettings({ ...settings, booking_interval_minutes: parseInt(e.target.value) })}
            className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-medium text-text-primary"
          >
            <option value={15}>15 Minutes</option>
            <option value={30}>30 Minutes</option>
            <option value={45}>45 Minutes</option>
            <option value={60}>60 Minutes</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-text-primary mb-1">Max Daily Bookings</label>
          <input
            type="number"
            value={settings.max_daily_bookings}
            onChange={(e) => setSettings({ ...settings, max_daily_bookings: parseInt(e.target.value) })}
            className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-medium text-text-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-primary mb-1">Max Concurrent Slots</label>
          <input
            type="number"
            value={settings.max_concurrent_slots}
            onChange={(e) => setSettings({ ...settings, max_concurrent_slots: parseInt(e.target.value) })}
            className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-medium text-text-primary"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl text-xs font-extrabold shadow-md transition disabled:opacity-50"
      >
        {saving ? "Saving Settings..." : "Save Booking Settings"}
      </button>
    </form>
  );
}

// Sub-component for Public Booking Link Preview & Copy
function BookingLinkPreview() {
  const [copied, setCopied] = useState(false);
  const [seoUrl, setSeoUrl] = useState("");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const tenantId = user.parlour_id || user.tenant_id || 1;
  const isBranchAdmin = user.role === "BranchAdmin" && user.branch_id;

  useEffect(() => {
    const configUrl = isBranchAdmin 
      ? `/public/booking/branch/${user.branch_id}/config` 
      : `/public/booking/${tenantId}/config`;

    API.get(configUrl)
      .then((res) => {
        const d = res.data?.data || res.data || {};
        if (d.booking_url) {
          setSeoUrl(`${window.location.origin}${d.booking_url}`);
        } else if (d.slug) {
          setSeoUrl(`${window.location.origin}/book/${d.slug}-${tenantId}`);
        } else {
          setSeoUrl(`${window.location.origin}/book/${tenantId}`);
        }
      })
      .catch(() => {
        setSeoUrl(`${window.location.origin}/book/${isBranchAdmin ? `branch/${user.branch_id}` : tenantId}`);
      });
  }, [tenantId, isBranchAdmin, user.branch_id]);

  const publicUrl = seoUrl || `${window.location.origin}/book/${isBranchAdmin ? `branch/${user.branch_id}` : tenantId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="bg-surface p-8 rounded-2xl border border-border-soft shadow-sm max-w-2xl space-y-6 text-center">
      <div className="h-14 w-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
        <Globe className="w-8 h-8" />
      </div>

      <div>
        <h3 className="text-lg font-extrabold text-text-primary">Public Website Booking Portal</h3>
        <p className="text-xs text-text-secondary max-w-md mx-auto mt-1">
          Share this URL with your clients or put it on your Instagram/WhatsApp. Clients can view your treatment menu and book appointments 24/7 without logging in.
        </p>
      </div>

      <div className="bg-background p-3 rounded-xl border border-border-soft flex items-center space-x-2">
        <input
          type="text"
          readOnly
          value={publicUrl}
          className="bg-transparent flex-1 text-xs font-mono font-bold text-text-primary focus:outline-none"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-extrabold hover:bg-primary/90 transition flex-shrink-0"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      <div className="flex justify-center space-x-3 pt-2">
        <button
          onClick={() => window.open(publicUrl, "_blank")}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-extrabold hover:bg-slate-800 transition shadow-sm flex items-center space-x-1.5"
        >
          <span>Test Live Booking Portal</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default Appointments;
