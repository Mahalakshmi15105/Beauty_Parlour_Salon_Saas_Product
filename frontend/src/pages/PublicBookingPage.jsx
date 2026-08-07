import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  User,
  Scissors,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Search,
  Ticket,
  UserCheck,
  ShieldCheck,
  Building2,
  Info,
  CalendarCheck2
} from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
const BACKEND_BASE = API_BASE.replace(/\/api\/v1\/?$/, "");

function PublicBookingPage({ tenantId = 1, tenantIdentifier, onNavigateHome }) {
  const identifier = tenantIdentifier || tenantId || "1";

  const [config, setConfig] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [errorConfig, setErrorConfig] = useState(null);
  const [logoError, setLogoError] = useState(false);

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);

  // Selection States
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedBookingMethod, setSelectedBookingMethod] = useState("Slot"); // "Token" or "Slot"
  const [selectedSlotTime, setSelectedSlotTime] = useState("");
  const [selectedTokenNumber, setSelectedTokenNumber] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  // Slots / Tokens State from API
  const [slotsData, setSlotsData] = useState({ booking_type: "Token", is_open: true, slots: [], tokens: [] });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(null);

  // Customer Form State
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerGender, setCustomerGender] = useState("Female");
  const [notes, setNotes] = useState("");
  const [lookingUpPhone, setLookingUpPhone] = useState(false);
  const [phoneFound, setPhoneFound] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmationData, setConfirmationData] = useState(null);

  // Service Category / Search Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    fetchParlourConfig();
  }, [identifier]);

  // Fetch slots whenever stepping into slot/token selection, changing date, staff, or booking method
  const allowStaff = Boolean(config?.allow_staff_selection);
  const slotSelectionStep = allowStaff ? 4 : 3;

  useEffect(() => {
    if (currentStep === slotSelectionStep && selectedDate) {
      fetchSlotsAndTokens();
    }
  }, [currentStep, selectedDate, selectedStaffId, selectedBookingMethod]);

  const fetchParlourConfig = async () => {
    setLoadingConfig(true);
    setErrorConfig(null);
    setLogoError(false);
    try {
      const resConfig = await axios.get(`${API_BASE}/public/booking/${identifier}/config`);
      const cfg = resConfig.data?.data || resConfig.data;
      setConfig(cfg);

      const defaultMethod = cfg.booking_type || "Slot";
      setSelectedBookingMethod(defaultMethod);

      const resServices = await axios.get(`${API_BASE}/public/booking/${identifier}/services`);
      const srvList = resServices.data?.data || resServices.data || [];
      setServices(srvList);

      if (cfg.allow_staff_selection) {
        const resStaff = await axios.get(`${API_BASE}/public/booking/${identifier}/staff`);
        const stfList = resStaff.data?.data || resStaff.data || [];
        setStaff(stfList);
      }
    } catch (err) {
      console.error("Failed to load public booking config:", err);
      setErrorConfig(err.response?.data?.message || "Failed to load parlour details.");
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchSlotsAndTokens = async () => {
    setLoadingSlots(true);
    setSlotsError(null);
    try {
      let url = `${API_BASE}/public/booking/${identifier}/slots?date=${selectedDate}&booking_type=${selectedBookingMethod}`;
      if (selectedStaffId) {
        url += `&employee_id=${selectedStaffId}`;
      }
      const res = await axios.get(url);
      const data = res.data?.data || res.data;
      setSlotsData(data);
      if (!data.is_open) {
        setSlotsError(data.message || "Parlour is closed on this date.");
      }
    } catch (err) {
      console.error("Failed to fetch slots:", err);
      setSlotsError(err.response?.data?.message || "Failed to fetch availability.");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handlePhoneLookup = async (phone) => {
    setCustomerPhone(phone);
    if (phone.length >= 10) {
      setLookingUpPhone(true);
      try {
        const res = await axios.get(`${API_BASE}/public/booking/${identifier}/customer-lookup?phone=${encodeURIComponent(phone)}`);
        const d = res.data?.data;
        if (d && d.found) {
          const fetchedName = d.customer_name || `${d.first_name || ""} ${d.last_name || ""}`.trim();
          setCustomerName(fetchedName);
          if (d.email) setCustomerEmail(d.email);
          if (d.gender) setCustomerGender(d.gender);
          setPhoneFound(true);
        } else {
          setPhoneFound(false);
        }
      } catch (err) {
        setPhoneFound(false);
      } finally {
        setLookingUpPhone(false);
      }
    }
  };

  const handleServiceToggle = (id) => {
    if (selectedServiceIds.includes(id)) {
      setSelectedServiceIds(selectedServiceIds.filter((item) => item !== id));
    } else {
      setSelectedServiceIds([...selectedServiceIds, id]);
    }
  };

  const calculateTotals = () => {
    const selectedObj = services.filter((s) => selectedServiceIds.includes(s.id));
    const totalPrice = selectedObj.reduce((sum, s) => sum + (s.price || 0), 0);
    const totalDuration = selectedObj.reduce((sum, s) => sum + (s.duration_minutes || 30), 0);
    return { selectedObj, totalPrice, totalDuration };
  };

  const handleBookingSubmit = async () => {
    if (!customerName || !customerPhone) {
      setSubmitError("Customer Name and Phone Number are required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const itemsPayload = selectedServiceIds.map((id) => ({
      service_id: id,
      employee_id: selectedStaffId ? parseInt(selectedStaffId) : null
    }));

    const payload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      gender: customerGender || null,
      appointment_date: selectedDate,
      start_time: selectedBookingMethod === "Slot" ? selectedSlotTime : null,
      token_number: selectedBookingMethod === "Token" ? selectedTokenNumber : null,
      booking_source: "Website",
      booking_channel: "Website",
      booking_type: selectedBookingMethod,
      notes: notes || null,
      items: itemsPayload
    };

    try {
      const res = await axios.post(`${API_BASE}/public/booking/${identifier}`, payload);
      const appt = res.data?.data || res.data;
      setConfirmationData(appt);
      setCurrentStep(allowStaff ? 6 : 5);
    } catch (err) {
      console.error("Website booking submission error:", err);
      setSubmitError(err.response?.data?.message || err.message || "Failed to submit booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-600">Loading Parlour Booking Portal...</p>
        </div>
      </div>
    );
  }

  if (errorConfig || !config) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-rose-200 shadow-xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Booking Portal Unavailable</h2>
          <p className="text-xs text-slate-600 font-medium">{errorConfig || "Parlour does not exist or is currently inactive."}</p>
          {onNavigateHome && (
            <button onClick={onNavigateHome} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition">
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  const { selectedObj, totalPrice, totalDuration } = calculateTotals();
  const categories = ["All", ...Array.from(new Set(services.map((s) => s.category_name || "General")))];
  const filteredServices = services.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || (s.category_name || "General") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Construct absolute logo URL if relative path
  let formattedLogoUrl = config.logo_url || "";
  if (formattedLogoUrl && !formattedLogoUrl.startsWith("http://") && !formattedLogoUrl.startsWith("https://")) {
    formattedLogoUrl = `${BACKEND_BASE}${formattedLogoUrl.startsWith("/") ? "" : "/"}${formattedLogoUrl}`;
  }

  // Construct display address
  const fullAddress = [config.address, config.city, config.state, config.postal_code].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-pink-50/30 text-slate-800 font-sans pb-24">
      {/* Top Banner Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {formattedLogoUrl && !logoError ? (
              <img
                src={formattedLogoUrl}
                alt={config.parlour_name}
                onError={() => setLogoError(true)}
                className="h-12 w-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="h-12 w-12 bg-gradient-to-tr from-pink-600 to-rose-400 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">{config.parlour_name}</h1>
              {fullAddress && (
                <p className="text-[11px] text-slate-500 font-medium flex items-center space-x-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-pink-500 inline shrink-0 mr-0.5" />
                  <span>{fullAddress}</span>
                </p>
              )}
              {config.phone && (
                <p className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
                  <Phone className="w-3 h-3 text-pink-500 inline shrink-0 mr-0.5" />
                  <span>Contact: {config.phone}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-semibold text-slate-600">
            <span className="flex items-center space-x-1 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-pink-500" />
              <span>{config.opening_time} - {config.closing_time}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Wizard Steps Navigation Bar */}
        {((allowStaff && currentStep <= 5) || (!allowStaff && currentStep <= 4)) && (
          <div className="mb-6 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between text-xs font-bold">
            {/* Step 1: Services */}
            <div className={`flex items-center space-x-1.5 ${currentStep >= 1 ? "text-pink-600" : "text-slate-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${currentStep >= 1 ? "bg-pink-100 text-pink-600" : "bg-slate-100 text-slate-400"}`}>1</span>
              <span className="hidden sm:inline">Services</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />

            {/* Step 2: Staff (If Enabled) */}
            {allowStaff && (
              <>
                <div className={`flex items-center space-x-1.5 ${currentStep >= 2 ? "text-pink-600" : "text-slate-400"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${currentStep >= 2 ? "bg-pink-100 text-pink-600" : "bg-slate-100 text-slate-400"}`}>2</span>
                  <span className="hidden sm:inline">Staff</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </>
            )}

            {/* Booking Method Step */}
            <div className={`flex items-center space-x-1.5 ${currentStep >= (allowStaff ? 3 : 2) ? "text-pink-600" : "text-slate-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${currentStep >= (allowStaff ? 3 : 2) ? "bg-pink-100 text-pink-600" : "bg-slate-100 text-slate-400"}`}>
                {allowStaff ? "3" : "2"}
              </span>
              <span className="hidden sm:inline">Method</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />

            {/* Slot / Token Selection Step */}
            <div className={`flex items-center space-x-1.5 ${currentStep >= (allowStaff ? 4 : 3) ? "text-pink-600" : "text-slate-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${currentStep >= (allowStaff ? 4 : 3) ? "bg-pink-100 text-pink-600" : "bg-slate-100 text-slate-400"}`}>
                {allowStaff ? "4" : "3"}
              </span>
              <span className="hidden sm:inline">{selectedBookingMethod === "Token" ? "Token" : "Time Slot"}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />

            {/* Customer Details Step */}
            <div className={`flex items-center space-x-1.5 ${currentStep >= (allowStaff ? 5 : 4) ? "text-pink-600" : "text-slate-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${currentStep >= (allowStaff ? 5 : 4) ? "bg-pink-100 text-pink-600" : "bg-slate-100 text-slate-400"}`}>
                {allowStaff ? "5" : "4"}
              </span>
              <span className="hidden sm:inline">Your Details</span>
            </div>
          </div>
        )}

        {/* STEP 1: SERVICE SELECTION */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Select Services</h2>
                  <p className="text-xs text-slate-500 font-medium">Choose one or more treatments you would like to book.</p>
                </div>
                <span className="text-xs font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full border border-pink-200">
                  {selectedServiceIds.length} Selected
                </span>
              </div>

              {/* Search & Category Filter */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search treatments..."
                    className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-pink-500 transition font-medium"
                  />
                </div>

                <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        selectedCategory === cat ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Services List */}
              <div className="space-y-3 pt-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredServices.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-medium">
                    No services found matching your filter.
                  </div>
                ) : (
                  filteredServices.map((srv) => {
                    const isSelected = selectedServiceIds.includes(srv.id);
                    return (
                      <div
                        key={srv.id}
                        onClick={() => handleServiceToggle(srv.id)}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                          isSelected ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20" : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-sm text-slate-900">{srv.name}</span>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">
                              {srv.category_name}
                            </span>
                          </div>
                          {srv.description && <p className="text-xs text-slate-500 font-medium line-clamp-1">{srv.description}</p>}
                          <div className="flex items-center space-x-3 text-xs font-semibold text-slate-500 pt-1">
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{srv.duration_minutes} mins</span>
                            </span>
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <div className="text-base font-extrabold text-slate-900">{config.currency_symbol}{srv.price.toFixed(2)}</div>
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ml-auto transition ${
                            isSelected ? "bg-pink-600 border-pink-600 text-white" : "border-slate-300 bg-slate-50"
                          }`}>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Summary Floating Bar */}
            {selectedServiceIds.length > 0 && (
              <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between z-30">
                <div>
                  <div className="text-xs text-slate-400 font-medium">{selectedServiceIds.length} Service(s) • ~{totalDuration} Mins</div>
                  <div className="text-lg font-extrabold text-white">{config.currency_symbol}{totalPrice.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-pink-500/25 transition flex items-center space-x-1.5"
                >
                  <span>{allowStaff ? "Select Staff Member" : "Choose Booking Method"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 (ONLY WHEN STAFF SELECTION ENABLED): STAFF SELECTION */}
        {currentStep === 2 && allowStaff && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Select Staff Member</h2>
                  <p className="text-xs text-slate-500 font-medium">Choose your preferred beautician/stylist or select Any Available Staff.</p>
                </div>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-bold text-slate-600 hover:text-pink-600 flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Change Services</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setSelectedStaffId("")}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex items-center space-x-3 ${
                    selectedStaffId === "" ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20" : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">Any Available Staff</div>
                    <div className="text-[11px] text-slate-500 font-medium">First available beautician</div>
                  </div>
                </div>

                {staff.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedStaffId(emp.id.toString())}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex items-center space-x-3 ${
                      selectedStaffId === emp.id.toString() ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20" : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="h-10 w-10 bg-pink-100 text-pink-700 rounded-xl flex items-center justify-center font-bold">
                      <Scissors className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">{emp.full_name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{emp.specialization}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-pink-500/25 transition flex items-center space-x-1"
                >
                  <span>Choose Booking Method</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: CHOOSE BOOKING METHOD (STEP 3 IF STAFF ENABLED, STEP 2 IF STAFF DISABLED) */}
        {((allowStaff && currentStep === 3) || (!allowStaff && currentStep === 2)) && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Select Booking Method</h2>
                  <p className="text-xs text-slate-500 font-medium">Choose how you would like to reserve your appointment.</p>
                </div>
                <button
                  onClick={() => setCurrentStep(allowStaff ? 2 : 1)}
                  className="text-xs font-bold text-slate-600 hover:text-pink-600 flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{allowStaff ? "Change Staff" : "Change Services"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* TOKEN BOOKING CARD */}
                <div
                  onClick={() => setSelectedBookingMethod("Token")}
                  className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    selectedBookingMethod === "Token"
                      ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center font-bold">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">Token Booking</div>
                      <div className="text-[11px] text-slate-500 font-medium">Get a queue token for your visit</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Reserve a sequential digital queue token for the day. Perfect for walk-in style service with minimal waiting.
                  </p>
                  <div className="pt-2 flex items-center justify-between text-xs font-bold">
                    <span className={selectedBookingMethod === "Token" ? "text-pink-600" : "text-slate-400"}>
                      {selectedBookingMethod === "Token" ? "Selected Mode" : "Click to select"}
                    </span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      selectedBookingMethod === "Token" ? "bg-pink-600 border-pink-600 text-white" : "border-slate-300 bg-slate-50"
                    }`}>
                      {selectedBookingMethod === "Token" && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>

                {/* TIME SLOT BOOKING CARD */}
                <div
                  onClick={() => setSelectedBookingMethod("Slot")}
                  className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    selectedBookingMethod === "Slot"
                      ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center font-bold">
                      <CalendarCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">Time Slot Booking</div>
                      <div className="text-[11px] text-slate-500 font-medium">Pick an exact appointment time</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Select a specific date and available 30-minute time slot. Ideal for scheduled, guaranteed treatment times.
                  </p>
                  <div className="pt-2 flex items-center justify-between text-xs font-bold">
                    <span className={selectedBookingMethod === "Slot" ? "text-pink-600" : "text-slate-400"}>
                      {selectedBookingMethod === "Slot" ? "Selected Mode" : "Click to select"}
                    </span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      selectedBookingMethod === "Slot" ? "bg-pink-600 border-pink-600 text-white" : "border-slate-300 bg-slate-50"
                    }`}>
                      {selectedBookingMethod === "Slot" && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(allowStaff ? 2 : 1)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(allowStaff ? 4 : 3)}
                  className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-pink-500/25 transition flex items-center space-x-1"
                >
                  <span>Select {selectedBookingMethod === "Token" ? "Token" : "Time Slot"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: TOKEN OR TIME SLOT SELECTION (STEP 4 IF STAFF ENABLED, STEP 3 IF STAFF DISABLED) */}
        {((allowStaff && currentStep === 4) || (!allowStaff && currentStep === 3)) && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    {selectedBookingMethod === "Token" ? "Select Booking Token" : "Select Time Slot"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Pick your preferred date and available slot.</p>
                </div>
                <button
                  onClick={() => setCurrentStep(allowStaff ? 3 : 2)}
                  className="text-xs font-bold text-slate-600 hover:text-pink-600 flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Change Method</span>
                </button>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Appointment Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlotTime("");
                    setSelectedTokenNumber(null);
                  }}
                  className="w-full sm:w-64 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500 transition"
                />
              </div>

              {/* Slots / Tokens Display */}
              {loadingSlots ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-6 h-6 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold text-slate-500">Checking availability...</p>
                </div>
              ) : slotsError ? (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>{slotsError}</span>
                </div>
              ) : selectedBookingMethod === "Token" ? (
                /* TOKEN BOOKING DISPLAY (COMPACT RECTANGLE CARDS) */
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Available Queue Tokens</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-64 overflow-y-auto pr-1">
                    {slotsData.tokens && slotsData.tokens.map((tok) => {
                      const isSelected = selectedTokenNumber === tok.token_number;
                      return (
                        <button
                          key={tok.token_number}
                          disabled={!tok.available}
                          onClick={() => setSelectedTokenNumber(tok.token_number)}
                          className={`px-3 py-2 rounded-xl text-center text-xs font-bold transition flex flex-col items-center justify-center space-y-0.5 ${
                            !tok.available
                              ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                              : isSelected
                              ? "bg-pink-600 border border-pink-600 text-white font-extrabold shadow-md shadow-pink-500/25 scale-[1.02]"
                              : "bg-slate-50 border border-slate-200 text-slate-800 hover:border-pink-400 hover:bg-pink-50/50"
                          }`}
                        >
                          <span className="text-[11px] font-extrabold">Token {tok.token_number}</span>
                          <span className="text-[9px] opacity-75">{tok.available ? "Free" : "Booked"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* TIME SLOT BOOKING DISPLAY (COMPACT RECTANGLE CARDS) */
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Available Time Slots ({slotsData.slots?.length || 0})</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-1">
                    {slotsData.slots && slotsData.slots.map((s) => {
                      const isSelected = selectedSlotTime === s.time;
                      return (
                        <button
                          key={s.time}
                          disabled={!s.available}
                          onClick={() => setSelectedSlotTime(s.time)}
                          className={`px-3 py-2.5 rounded-xl text-center text-xs font-bold transition flex flex-col items-center justify-center space-y-0.5 ${
                            !s.available
                              ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                              : isSelected
                              ? "bg-pink-600 border border-pink-600 text-white font-extrabold shadow-md shadow-pink-500/25 scale-[1.02]"
                              : "bg-slate-50 border border-slate-200 text-slate-800 hover:border-pink-400 hover:bg-pink-50/50"
                          }`}
                        >
                          <span className="text-xs font-extrabold">{s.time_12h}</span>
                          <span className="text-[9px] opacity-75">{s.available ? "Available" : s.reason || "Booked"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(allowStaff ? 3 : 2)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  disabled={selectedBookingMethod === "Token" ? !selectedTokenNumber : !selectedSlotTime}
                  onClick={() => setCurrentStep(allowStaff ? 5 : 4)}
                  className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-pink-500/25 transition disabled:opacity-50 flex items-center space-x-1"
                >
                  <span>Enter Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: CUSTOMER DETAILS (STEP 5 IF STAFF ENABLED, STEP 4 IF STAFF DISABLED) */}
        {((allowStaff && currentStep === 5) || (!allowStaff && currentStep === 4)) && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Your Details</h2>
                <p className="text-xs text-slate-500 font-medium">Enter your contact details to confirm the appointment.</p>
              </div>

              {submitError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold">
                  {submitError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter 10-digit mobile number"
                    value={customerPhone}
                    onChange={(e) => handlePhoneLookup(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                  />
                  {lookingUpPhone && <p className="text-[11px] text-pink-600 font-semibold mt-1">Looking up customer profile...</p>}
                  {phoneFound && <p className="text-[11px] text-emerald-600 font-semibold mt-1">Welcome back! Details fetched automatically.</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                    <select
                      value={customerGender}
                      onChange={(e) => setCustomerGender(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Special Requests / Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Any specific requests for your appointment..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                  />
                </div>
              </div>

              {/* Booking Summary Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] text-slate-400">Booking Summary</div>
                <div className="flex justify-between text-slate-700">
                  <span>Booking Method:</span>
                  <span className="font-bold text-slate-900">{selectedBookingMethod === "Token" ? "Token Booking" : "Time Slot Booking"}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Date & Slot:</span>
                  <span className="font-bold text-slate-900">
                    {selectedDate} {selectedBookingMethod === "Token" ? `(Token #${selectedTokenNumber})` : `at ${selectedSlotTime}`}
                  </span>
                </div>
                {allowStaff && (
                  <div className="flex justify-between text-slate-700">
                    <span>Assigned Staff:</span>
                    <span className="font-bold text-slate-900">
                      {selectedStaffId ? (staff.find((e) => e.id.toString() === selectedStaffId)?.full_name || "Assigned Stylist") : "Any Available Staff"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700">
                  <span>Selected Treatments:</span>
                  <span className="font-bold text-slate-900">{selectedObj.map((s) => s.name).join(", ")}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200 text-sm">
                  <span>Total Amount:</span>
                  <span className="text-pink-600">{config.currency_symbol}{totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentStep(allowStaff ? 4 : 3)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  disabled={submitting}
                  onClick={handleBookingSubmit}
                  className="px-8 py-3.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-pink-500/25 transition disabled:opacity-50"
                >
                  {submitting ? "Booking Appointment..." : "Confirm & Book Appointment"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: CONFIRMATION SCREEN (STEP 6 IF STAFF ENABLED, STEP 5 IF STAFF DISABLED) */}
        {((allowStaff && currentStep === 6) || (!allowStaff && currentStep === 5)) && confirmationData && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-xl text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Booking Confirmed!
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">Appointment Scheduled Successfully</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">We look forward to serving you at {config.parlour_name}.</p>
              </div>

              {/* Confirmation Details Card */}
              <div className="max-w-md mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 text-left space-y-3 text-xs">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Appointment Number</span>
                  <span className="font-extrabold text-slate-900 text-sm bg-white px-2.5 py-1 rounded-lg border border-slate-200">{confirmationData.appointment_number}</span>
                </div>

                {confirmationData.token_number && (
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-slate-500 font-semibold">Token Number</span>
                    <span className="font-extrabold text-pink-600 text-base">Token #{confirmationData.token_number}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500 font-semibold">Customer Name</span>
                  <span className="font-bold text-slate-900">{confirmationData.customer_name}</span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500 font-semibold">Date & Time</span>
                  <span className="font-bold text-slate-900">
                    {confirmationData.appointment_date} {confirmationData.start_time_12h ? `at ${confirmationData.start_time_12h}` : ""}
                  </span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span className="text-slate-500 font-semibold">Treatments</span>
                  <span className="font-bold text-slate-900 text-right max-w-[200px]">
                    {confirmationData.items && confirmationData.items.map((i) => i.service_name).join(", ")}
                  </span>
                </div>

                {confirmationData.items && confirmationData.items.some((i) => i.employee_name) && (
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500 font-semibold">Assigned Beautician</span>
                    <span className="font-bold text-pink-600">
                      {confirmationData.items.map((i) => i.employee_name).filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-900 font-extrabold pt-2 border-t border-slate-200 text-sm">
                  <span>Total Amount Payable</span>
                  <span className="text-pink-600">{config.currency_symbol}{confirmationData.total_amount?.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center space-x-3">
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setSelectedServiceIds([]);
                    setSelectedSlotTime("");
                    setSelectedTokenNumber(null);
                    setSelectedStaffId("");
                    setConfirmationData(null);
                  }}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition shadow-md"
                >
                  Book Another Appointment
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PublicBookingPage;
