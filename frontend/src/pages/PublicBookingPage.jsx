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
  Search,
  Ticket,
  UserCheck,
  CalendarCheck2,
  Star,
  Info,
  Menu,
  X
} from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "https://salon-backend.smartgonext.com/api/v1";
const BACKEND_BASE = API_BASE.replace(/\/api\/v1\/?$/, "");

function PublicBookingPage({ tenantId = 1, tenantIdentifier, isBranch = false, onNavigateHome }) {
  const identifier = tenantIdentifier || tenantId || "1";
  const isBranchPage = isBranch || window.location.pathname.includes("/book/branch/");
  const apiPrefix = isBranchPage ? `${API_BASE}/public/booking/branch/${identifier}` : `${API_BASE}/public/booking/${identifier}`;

  const [config, setConfig] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [errorConfig, setErrorConfig] = useState(null);
  const [logoError, setLogoError] = useState(false);
  
  // Branch-isolated theme state
  const [theme, setTheme] = useState({
    theme_name: "light",
    primary_color: "#EC4899",
    secondary_color: "#F472B6",
    accent_color: "#FDF2F8",
    shop_name_font_enabled: false,
    shop_name_font: "Outfit",
    shop_name_font_size: 32,
    shop_name_font_weight: "700",
    shop_name_letter_spacing: 0.00,
  });

  // Selection States
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlotTime, setSelectedSlotTime] = useState("");
  const [selectedTokenNumber, setSelectedTokenNumber] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  // Slots / Tokens State from API
  const [slotsData, setSlotsData] = useState({ booking_type: "Token", is_open: true, slots: [], tokens: [], current_token: null });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(null);

  // Customer Form State
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerGender, setCustomerGender] = useState("");
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

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchParlourConfig();
  }, [identifier, isBranchPage]);

  // Fetch slots whenever date, staff, or services change
  useEffect(() => {
    if (selectedDate && selectedServiceIds.length > 0) {
      fetchSlotsAndTokens();
    }
  }, [selectedDate, selectedStaffId, selectedServiceIds]);

  const fetchParlourConfig = async () => {
    setLoadingConfig(true);
    setErrorConfig(null);
    setLogoError(false);
    try {
      const resConfig = await axios.get(`${apiPrefix}/config`);
      const cfg = resConfig.data?.data || resConfig.data;
      setConfig(cfg);
      
      // Apply branch-isolated theme from API response
      if (cfg.theme) {
        setTheme(cfg.theme);
      }

      // Services and Staff endpoint resolution (use tenant identifier for catalogue)
      const baseTenantIdentifier = cfg.tenant_id || identifier;
      const resServices = await axios.get(`${API_BASE}/public/booking/${baseTenantIdentifier}/services`);
      const srvList = resServices.data?.data || resServices.data || [];
      setServices(srvList);

      if (cfg.allow_staff_selection) {
        const resStaff = await axios.get(`${API_BASE}/public/booking/${baseTenantIdentifier}/staff`);
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
      const bookingType = config?.booking_type || "Token";
      const baseTenantIdentifier = config?.tenant_id || identifier;
      let url = `${API_BASE}/public/booking/${baseTenantIdentifier}/slots?date=${selectedDate}&booking_type=${bookingType}`;
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
      setSlotsError(err.response?.data?.message || "Failed to load slots.");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handlePhoneLookup = async (phone) => {
    if (!phone || phone.trim().length < 10) return;
    setLookingUpPhone(true);
    try {
      const baseTenantIdentifier = config?.tenant_id || identifier;
      const res = await axios.get(`${API_BASE}/public/booking/${baseTenantIdentifier}/customer-lookup?phone=${encodeURIComponent(phone.trim())}`);
      const data = res.data?.data || res.data;
      if (data && data.found) {
        setCustomerName(data.customer_name || `${data.first_name || ""} ${data.last_name || ""}`.trim());
        if (data.email) setCustomerEmail(data.email);
        if (data.gender) setCustomerGender(data.gender);
        setPhoneFound(true);
      } else {
        setPhoneFound(false);
      }
    } catch (err) {
      console.error("Phone lookup failed:", err);
    } finally {
      setLookingUpPhone(false);
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

  const handleBookingSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!customerName || !customerPhone) {
      setSubmitError("Customer Name and Phone Number are required.");
      return;
    }

    if (selectedServiceIds.length === 0) {
      setSubmitError("Please select at least one service.");
      return;
    }

    const bookingType = config?.booking_type || "Token";
    
    if (bookingType === "Token" && !selectedTokenNumber) {
      setSubmitError("Please select a token number.");
      return;
    }

    if (bookingType === "Slot" && !selectedSlotTime) {
      setSubmitError("Please select a time slot.");
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
      start_time: bookingType === "Slot" ? selectedSlotTime : null,
      token_number: bookingType === "Token" ? selectedTokenNumber : null,
      booking_source: "Website",
      booking_channel: "Website",
      booking_type: bookingType,
      notes: notes || null,
      items: itemsPayload
    };

    try {
      const res = await axios.post(apiPrefix, payload);
      const appt = res.data?.data || res.data;
      setConfirmationData(appt);
    } catch (err) {
      console.error("Website booking submission error:", err);
      setSubmitError(err.response?.data?.message || err.message || "Failed to submit booking.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: `linear-gradient(to bottom right, #f8fafc, ${theme.accent_color}, ${theme.secondary_color})` }}>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: theme.primary_color, borderTopColor: 'transparent' }}></div>
          <p className="text-sm font-bold text-slate-600">Loading Parlour Booking Portal...</p>
        </div>
      </div>
    );
  }

  if (errorConfig || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: `linear-gradient(to bottom right, #f8fafc, ${theme.accent_color}, ${theme.secondary_color})` }}>
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border shadow-xl text-center space-y-4" style={{ borderColor: theme.secondary_color }}>
          <AlertCircle className="w-16 h-16 mx-auto" style={{ color: theme.primary_color }} />
          <h2 className="text-xl font-bold text-slate-900">Booking Portal Unavailable</h2>
          <p className="text-sm text-slate-600 font-medium">{errorConfig || "Parlour does not exist or is currently inactive."}</p>
          {onNavigateHome && (
            <button onClick={onNavigateHome} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition">
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
  const bookingType = config.booking_type || "Token";
  const allowStaff = config.allow_staff_selection || false;

  if (confirmationData) {
    return (
      <div className="min-h-screen" style={{ background: `linear-gradient(to bottom right, #f8fafc, ${theme.accent_color}, ${theme.secondary_color})` }}>
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {formattedLogoUrl && !logoError ? (
                <img
                  src={formattedLogoUrl}
                  alt={config.parlour_name}
                  onError={() => setLogoError(true)}
                  className="h-10 w-10 rounded-xl object-cover border border-slate-200"
                />
              ) : (
                <div className="h-10 w-10 text-white rounded-xl flex items-center justify-center font-bold" style={{ background: `linear-gradient(to right, ${theme.primary_color}, ${theme.secondary_color})` }}>
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
              <h1 className="text-lg font-extrabold text-slate-900">{config.parlour_name}</h1>
            </div>
          </div>
        </header>

        {/* Confirmation Content */}
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white p-8 rounded-3xl border shadow-xl text-center space-y-6" style={{ borderColor: theme.secondary_color }}>
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="text-sm font-extrabold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
                Booking Confirmed!
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-4">Appointment Scheduled Successfully</h2>
              <p className="text-sm text-slate-500 font-medium mt-2">We look forward to serving you at {config.parlour_name}.</p>
            </div>

            {/* Confirmation Details Card */}
            <div className="max-w-md mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 text-left space-y-4 text-sm">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Appointment Number</span>
                <span className="font-extrabold text-slate-900 text-base bg-white px-3 py-1.5 rounded-lg border border-slate-200">{confirmationData.appointment_number}</span>
              </div>

              {confirmationData.token_number && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Token Number</span>
                  <span className="font-extrabold text-pink-600 text-xl">Token #{confirmationData.token_number}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-700">
                <span className="text-slate-500 font-semibold">Customer Name</span>
                <span className="font-bold text-slate-900">{confirmationData.customer_name}</span>
              </div>

              <div className="flex justify-between text-slate-700">
                <span className="text-slate-500 font-semibold">Date & Time</span>
                <span className="font-bold text-slate-900">
                  {confirmationData.appointment_date} {confirmationData.start_time ? `at ${confirmationData.start_time}` : `(Token #${confirmationData.token_number})`}
                </span>
              </div>

              <div className="flex justify-between text-slate-700">
                <span className="text-slate-500 font-semibold">Services</span>
                <span className="font-bold text-slate-900 text-right flex-1 ml-4">
                  {selectedObj.map((s) => s.name).join(", ")}
                </span>
              </div>

              <div className="flex justify-between text-slate-900 font-extrabold pt-3 border-t border-slate-200 text-lg">
                <span>Total Amount</span>
                <span className="text-pink-600">{config.currency_symbol}{totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-pink-500/25 transition"
            >
              Book Another Appointment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {formattedLogoUrl && !logoError ? (
                <img
                  src={formattedLogoUrl}
                  alt={config.parlour_name}
                  onError={() => setLogoError(true)}
                  className="h-12 w-12 rounded-xl object-cover border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="h-12 w-12 bg-gradient-to-tr from-pink-600 to-rose-400 text-white rounded-xl flex items-center justify-center font-bold shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{config.parlour_name}</h1>
                <p className="text-xs text-slate-500 font-medium">Professional Beauty & Wellness Services</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6 text-sm font-semibold text-slate-600">
              <a href="#services" className="hover:text-pink-600 transition">Services</a>
              <a href="#booking" className="hover:text-pink-600 transition">Booking</a>
              <a href="#contact" className="hover:text-pink-600 transition">Contact</a>
              <a href="#hours" className="hover:text-pink-600 transition">Opening Hours</a>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden pt-4 pb-2 space-y-2 text-sm font-semibold text-slate-600">
              <a href="#services" className="block py-2 hover:text-pink-600 transition" onClick={() => setMobileMenuOpen(false)}>Services</a>
              <a href="#booking" className="block py-2 hover:text-pink-600 transition" onClick={() => setMobileMenuOpen(false)}>Booking</a>
              <a href="#contact" className="block py-2 hover:text-pink-600 transition" onClick={() => setMobileMenuOpen(false)}>Contact</a>
              <a href="#hours" className="block py-2 hover:text-pink-600 transition" onClick={() => setMobileMenuOpen(false)}>Opening Hours</a>
            </nav>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm mb-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-bold text-slate-600 ml-2">5.0 (120+ reviews)</span>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Premium Beauty Services at Your Fingertips
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Experience professional beauty treatments with our expert team. Book your appointment instantly using our {bookingType === "Token" ? "Token" : "Time Slot"} system.
              </p>
              <div className="flex flex-wrap gap-3">
                {fullAddress && (
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 text-pink-500" />
                    <span>{fullAddress}</span>
                  </div>
                )}
                {config.phone && (
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-pink-500" />
                    <span>{config.phone}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-6 rounded-2xl border border-pink-200">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-pink-600 text-white rounded-full flex items-center justify-center mx-auto">
                  <CalendarCheck2 className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600">Booking Mode</p>
                  <p className="text-2xl font-extrabold text-pink-600">
                    {bookingType === "Token" ? "Token System" : "Time Slots"}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {bookingType === "Token" 
                    ? "Get a queue token for minimal waiting" 
                    : "Schedule a specific appointment time"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Our Services</h2>
                <p className="text-sm text-slate-500 font-medium">Select services you'd like to book</p>
              </div>
              <span className="text-sm font-bold text-pink-600 bg-pink-50 px-4 py-2 rounded-full border border-pink-200">
                {selectedServiceIds.length} Selected
              </span>
            </div>

            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search treatments..."
                  className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-pink-500 transition font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${
                      selectedCategory === cat ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
              {filteredServices.length === 0 ? (
                <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-medium">
                  No services found matching your filter.
                </div>
              ) : (
                filteredServices.map((srv) => {
                  const isSelected = selectedServiceIds.includes(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => handleServiceToggle(srv.id)}
                      className={`p-5 rounded-2xl border transition cursor-pointer ${
                        isSelected ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20" : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-extrabold text-base text-slate-900">{srv.name}</span>
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">
                                {srv.category_name}
                              </span>
                            </div>
                            {srv.description && <p className="text-sm text-slate-500 font-medium line-clamp-2">{srv.description}</p>}
                          </div>
                          <div className={`w-6 h-6 rounded-lg border flex items-center justify-center ml-3 transition ${
                            isSelected ? "bg-pink-600 border-pink-600 text-white" : "border-slate-300 bg-slate-50"
                          }`}>
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="flex items-center space-x-2 text-sm font-semibold text-slate-500">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>{srv.duration_minutes} mins</span>
                          </div>
                          <div className="text-lg font-extrabold text-slate-900">{config.currency_symbol}{srv.price.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Booking Section */}
        <section id="booking" className="mb-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Book Your Appointment</h2>
              <p className="text-sm text-slate-500 font-medium">
                {bookingType === "Token" ? "Select your token and complete booking" : "Choose your preferred date and time"}
              </p>
            </div>

            {submitError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm font-semibold">
                {submitError}
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column: Date, Staff, Token/Slot */}
              <div className="space-y-6">
                {/* Date Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Appointment Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlotTime("");
                      setSelectedTokenNumber(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-pink-500 transition"
                  />
                </div>

                {/* Staff Selection (if enabled) */}
                {allowStaff && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-700">Select Staff Member (Optional)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setSelectedStaffId("")}
                        className={`p-4 rounded-xl border cursor-pointer transition flex items-center space-x-3 ${
                          selectedStaffId === "" ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20" : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">Any Available</div>
                          <div className="text-xs text-slate-500 font-medium">First available</div>
                        </div>
                      </div>

                      {staff.slice(0, 3).map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedStaffId(emp.id.toString())}
                          className={`p-4 rounded-xl border cursor-pointer transition flex items-center space-x-3 ${
                            selectedStaffId === emp.id.toString() ? "bg-pink-50/50 border-pink-400 ring-2 ring-pink-500/20" : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="h-10 w-10 bg-pink-100 text-pink-700 rounded-lg flex items-center justify-center font-bold">
                            <Scissors className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-extrabold text-slate-900">{emp.full_name}</div>
                            <div className="text-xs text-slate-500 font-medium">{emp.specialization}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Token or Slot Selection */}
                {bookingType === "Token" ? (
                  /* Token Selection */
                  <div className="space-y-4">
                    {/* Live Token Status */}
                    <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-2xl border border-pink-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-pink-600 text-white rounded-lg flex items-center justify-center">
                            <Ticket className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">Live Token Status</p>
                            <p className="text-xs text-slate-600">Real-time queue information</p>
                          </div>
                        </div>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium mb-1">Currently Serving</p>
                          <p className="text-xl font-extrabold text-pink-600">
                            {slotsData.current_token ? `Token #${slotsData.current_token}` : "Waiting..."}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500 font-medium mb-1">Available Tokens</p>
                          <p className="text-xl font-extrabold text-emerald-600">
                            {slotsData.tokens ? slotsData.tokens.filter(t => t.available).length : 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Token Grid */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Select Your Token</label>
                      {loadingSlots ? (
                        <div className="p-8 text-center space-y-2">
                          <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <p className="text-sm font-semibold text-slate-500">Loading tokens...</p>
                        </div>
                      ) : slotsError ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-semibold flex items-center space-x-2">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <span>{slotsError}</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto pr-1">
                          {slotsData.tokens && slotsData.tokens.map((tok) => {
                            const isSelected = selectedTokenNumber === tok.token_number;
                            const isCurrent = slotsData.current_token === tok.token_number;
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
                                  : isCurrent
                                  ? "bg-amber-100 border border-amber-400 text-amber-700"
                                  : "bg-slate-50 border border-slate-200 text-slate-800 hover:border-pink-400 hover:bg-pink-50/50"
                                }`}
                              >
                                <span className="text-[11px] font-extrabold">Token {tok.token_number}</span>
                                <span className="text-[9px] opacity-75">
                                  {isCurrent ? "Now Serving" : tok.available ? "Available" : "Booked"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Time Slot Selection */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Select Time Slot</label>
                      {loadingSlots ? (
                        <div className="p-8 text-center space-y-2">
                          <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <p className="text-sm font-semibold text-slate-500">Loading slots...</p>
                        </div>
                      ) : slotsError ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-semibold flex items-center space-x-2">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <span>{slotsError}</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
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
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Customer Details */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-3">Booking Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-700">
                      <span>Services:</span>
                      <span className="font-bold text-slate-900 text-right flex-1 ml-4">
                        {selectedObj.length > 0 ? selectedObj.map((s) => s.name).join(", ") : "None selected"}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Date:</span>
                      <span className="font-bold text-slate-900">{selectedDate}</span>
                    </div>
                    {bookingType === "Token" && selectedTokenNumber && (
                      <div className="flex justify-between text-slate-700">
                        <span>Token:</span>
                        <span className="font-bold text-pink-600">#{selectedTokenNumber}</span>
                      </div>
                    )}
                    {bookingType === "Slot" && selectedSlotTime && (
                      <div className="flex justify-between text-slate-700">
                        <span>Time:</span>
                        <span className="font-bold text-slate-900">{selectedSlotTime}</span>
                      </div>
                    )}
                    {allowStaff && selectedStaffId && (
                      <div className="flex justify-between text-slate-700">
                        <span>Staff:</span>
                        <span className="font-bold text-slate-900">{staff.find((e) => e.id.toString() === selectedStaffId)?.full_name || "Any"}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-extrabold pt-3 border-t border-slate-200 text-base">
                      <span>Total:</span>
                      <span className="text-pink-600">{config.currency_symbol}{totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mobile Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="Enter 10-digit mobile number"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        handlePhoneLookup(e.target.value);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                    />
                    {lookingUpPhone && <p className="text-xs text-pink-600 font-semibold mt-1">Looking up customer profile...</p>}
                    {phoneFound && <p className="text-xs text-emerald-600 font-semibold mt-1">Welcome back! Details fetched automatically.</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your full name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Gender</label>
                      <select
                        value={customerGender}
                        onFocus={(e) => {
                          try {
                            if (e.target.showPicker) e.target.showPicker();
                          } catch (err) {}
                        }}
                        onChange={(e) => setCustomerGender(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                      >
                        <option value="">Select Gender</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Special Requests (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Any specific requests..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-pink-500 transition"
                    />
                  </div>

                  <button
                    disabled={submitting || selectedServiceIds.length === 0}
                    onClick={handleBookingSubmit}
                    className="w-full px-8 py-4 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-pink-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Booking Appointment..." : "Confirm & Book Appointment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact & Hours Section */}
        <section id="contact" className="grid md:grid-cols-2 gap-6 mb-8">
          <div id="hours" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-4">Opening Hours</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Weekdays</span>
                <span className="text-sm font-bold text-slate-900">{config.opening_time} - {config.closing_time}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Saturday</span>
                <span className="text-sm font-bold text-slate-900">{config.opening_time} - {config.closing_time}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">Sunday</span>
                <span className="text-sm font-bold text-slate-900">Closed</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-4">Contact Information</h3>
            <div className="space-y-3">
              {fullAddress && (
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-pink-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Address</p>
                    <p className="text-sm text-slate-600">{fullAddress}</p>
                  </div>
                </div>
              )}
              {config.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-pink-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Phone</p>
                    <p className="text-sm text-slate-600">{config.phone}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-pink-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Booking Type</p>
                  <p className="text-sm text-slate-600">{bookingType === "Token" ? "Token System" : "Time Slot System"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-slate-500">
            <p>&copy; 2024 {config.parlour_name}. All rights reserved.</p>
            <p className="mt-1">Powered by SmartGoNext</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicBookingPage;