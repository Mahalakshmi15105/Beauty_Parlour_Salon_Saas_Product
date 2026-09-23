import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { ThermalReceipt, printThermalReceiptElement, downloadThermalReceiptPDF } from "../components/ThermalReceipt";
import { getFullImageUrl } from "../utils/imageUrl";
import TouchModeBilling from "../components/TouchModeBilling";
import {
  User,
  Scissors,
  ShoppingCart,
  Trash2,
  Plus,
  RefreshCw,
  FileText,
  CheckCircle,
  CreditCard,
  Printer,
  History,
  Search,
  MessageSquare,
  Share2,
  Bell,
  Star,
  DollarSign,
  Smartphone,
  Landmark,
  Wallet as WalletIcon,
  Eye,
  Calendar,
  Pencil,
  UserPlus,
  Download,
  ClipboardList,
  UserRoundX,
  Crown,
  BarChart3,
  Package,
  Clock,
  Check,
  X,
  Receipt,
  ChevronDown,
  Award,
  Gift,
  LayoutGrid,
  ListFilter
} from "lucide-react";

import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useModalFocusTrap, advanceToNextRef, isElementNavigable } from "../utils/keyboardNavigation";

const SUPPORTED_PAYMENT_METHODS = [
  { id: "Cash", label: "Cash", icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
  { id: "Card", label: "Card", icon: CreditCard, color: "text-blue-600 bg-blue-50" },
  { id: "Google Pay", label: "Google Pay", icon: Smartphone, color: "text-amber-600 bg-amber-50" },
  { id: "PhonePe", label: "PhonePe", icon: Smartphone, color: "text-violet-600 bg-violet-50" },
  { id: "Paytm", label: "Paytm", icon: Smartphone, color: "text-sky-600 bg-sky-50" },
];

import AddExpenseModal from "../components/AddExpenseModal";
import CashDenominationModal from "../components/CashDenominationModal";

function Billing() {
  const { showSuccess, showError } = useToast();
  const { formatCurrency, currencySymbol, t } = useLanguageCurrency();
  const [activeSubTab, setActiveSubTab] = useState("checkout");
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showCashDenominationModal, setShowCashDenominationModal] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState(() => {
    return localStorage.getItem("billing_mode") === "touch";
  });

  // Element Refs for POS Keyboard Workflow
  const customerSelectRef = useRef(null);
  const genderSelectRef = useRef(null);
  const categorySelectRef = useRef(null);
  const serviceSelectRef = useRef(null);
  const shouldFocusServiceRef = useRef(false);
  const addServiceBtnRef = useRef(null);
  const checkoutContainerRef = useRef(null);
  const paymentModalRef = useRef(null);
  const receiptModalRef = useRef(null);
  const settlementBtnRef = useRef(null);
  const submitInvoiceBtnRef = useRef(null);
  const productSelectRef = useRef(null);
  const addProductBtnRef = useRef(null);

  // Master Datasets
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Selection Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [activeMembership, setActiveMembership] = useState(null);
  const [useMembership, setUseMembership] = useState(true);
  const [visitMembershipStatus, setVisitMembershipStatus] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const activeBranchId = user.branch_id || null;
  // POS Cart State
  const [cart, setCart] = useState([]);

  // Regional & Tax Settings
  const [taxRate, setTaxRate] = useState(18.0);
  const [invoiceTaxAmount, setInvoiceTaxAmount] = useState(0);
  const [isTaxAmountOverridden, setIsTaxAmountOverridden] = useState(false);

  // Customer Combobox State
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(0);

  // Category Combobox State
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categoryHighlightedIndex, setCategoryHighlightedIndex] = useState(0);
  const categoryComboboxRef = useRef(null);

  // Service Combobox State
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [serviceHighlightedIndex, setServiceHighlightedIndex] = useState(0);
  const serviceComboboxRef = useRef(null);

  // Multi-Tab Billing State
  const [billingTabs, setBillingTabs] = useState([
    {
      id: "tab-1",
      name: "Bill #1",
      selectedCustomerId: "",
      customerSearchQuery: "",
      selectedGender: "",
      selectedCategoryId: "",
      selectedServiceId: "",
      cart: [],
      invoiceTaxAmount: 0,
      isTaxAmountOverridden: false,
      useMembership: true,
      activeMembership: null,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [tabCounter, setTabCounter] = useState(2);

  // Helper to sync current active state into billingTabs array
  const syncCurrentStateToTabs = (targetTabs = billingTabs, currentId = activeTabId) => {
    return targetTabs.map((tab) => {
      if (tab.id === currentId) {
        return {
          ...tab,
          selectedCustomerId,
          customerSearchQuery,
          selectedGender,
          selectedCategoryId,
          categorySearchQuery,
          selectedServiceId,
          serviceSearchQuery,
          cart,
          invoiceTaxAmount,
          isTaxAmountOverridden,
          useMembership,
          activeMembership,
        };
      }
      return tab;
    });
  };

  // Switch to another bill tab
  const handleSwitchTab = (targetTabId) => {
    if (targetTabId === activeTabId && activeSubTab === "checkout") return;

    // 1. Sync current active state to billingTabs
    const updatedTabs = syncCurrentStateToTabs();
    setBillingTabs(updatedTabs);

    // 2. Find target tab
    const targetTab = updatedTabs.find((t) => t.id === targetTabId);
    if (targetTab) {
      setSelectedCustomerId(targetTab.selectedCustomerId || "");
      setCustomerSearchQuery(targetTab.customerSearchQuery || "");
      setSelectedGender(targetTab.selectedGender || "");
      setSelectedCategoryId(targetTab.selectedCategoryId || "");
      setCategorySearchQuery(targetTab.categorySearchQuery || "");
      setSelectedServiceId(targetTab.selectedServiceId || "");
      setServiceSearchQuery(targetTab.serviceSearchQuery || "");
      setCart(targetTab.cart || []);
      setInvoiceTaxAmount(targetTab.invoiceTaxAmount || 0);
      setIsTaxAmountOverridden(targetTab.isTaxAmountOverridden || false);
      setUseMembership(targetTab.useMembership !== undefined ? targetTab.useMembership : true);
      setActiveMembership(targetTab.activeMembership || null);

      setActiveTabId(targetTabId);
      setActiveSubTab("checkout");
    }
  };

  // Create a new bill tab (+)
  const handleCreateNewTab = () => {
    // 1. Sync current active state
    const updatedTabs = syncCurrentStateToTabs();
    const newTabId = `tab-${Date.now()}`;
    const newTabName = `Bill #${tabCounter}`;

    const newTabObj = {
      id: newTabId,
      name: newTabName,
      selectedCustomerId: "",
      customerSearchQuery: "",
      selectedGender: "",
      selectedCategoryId: categories.length > 0 ? categories[0].id.toString() : "",
      selectedServiceId: "",
      cart: [],
      invoiceTaxAmount: 0,
      isTaxAmountOverridden: false,
      useMembership: true,
      activeMembership: null,
    };

    setBillingTabs([...updatedTabs, newTabObj]);
    setTabCounter((prev) => prev + 1);

    // 2. Load clean new tab state
    setSelectedCustomerId("");
    setCustomerSearchQuery("");
    setSelectedGender("");
    setSelectedCategoryId(categories.length > 0 ? categories[0].id.toString() : "");
    setSelectedServiceId("");
    setCart([]);
    setInvoiceTaxAmount(0);
    setIsTaxAmountOverridden(false);
    setUseMembership(true);
    setActiveMembership(null);

    setActiveTabId(newTabId);
    setActiveSubTab("checkout");
  };

  // Close a bill tab
  const handleCloseTab = (tabIdToClose) => {
    if (billingTabs.length <= 1) return;

    const remainingTabs = billingTabs.filter((t) => t.id !== tabIdToClose);
    setBillingTabs(remainingTabs);

    if (activeTabId === tabIdToClose) {
      const nextTab = remainingTabs[remainingTabs.length - 1];

      setSelectedCustomerId(nextTab.selectedCustomerId || "walkin");
      setCustomerSearchQuery(nextTab.customerSearchQuery || "Walk-in Customer");
      setSelectedGender(nextTab.selectedGender || "Female");
      setSelectedCategoryId(nextTab.selectedCategoryId || "");
      setSelectedServiceId(nextTab.selectedServiceId || "");
      setCart(nextTab.cart || []);
      setInvoiceTaxAmount(nextTab.invoiceTaxAmount || 0);
      setIsTaxAmountOverridden(nextTab.isTaxAmountOverridden || false);
      setUseMembership(nextTab.useMembership !== undefined ? nextTab.useMembership : true);
      setActiveMembership(nextTab.activeMembership || null);

      setActiveTabId(nextTab.id);
      setActiveSubTab("checkout");
    }
  };



  // Payment Settlement State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState(["Cash"]);
  const [paymentAmounts, setPaymentAmounts] = useState({ Cash: "" });

  // Receipt & Saved Bill Details State
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [activePopupButton, setActivePopupButton] = useState(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
  const [receiptSettings, setReceiptSettings] = useState({
    receipt_template: "Classic",
    paper_size: "80mm",
    show_logo: true,
    show_gst: true,
    show_address: true,
    show_phone: true,
    show_email: true,
    show_website: true,
    show_qr_code: false,
    show_qty: true,
    show_rate: true,
    show_mrp: true,
    show_tax: true,
    auto_print: false,
    thank_you_message: "Thank you for visiting. Please visit again.",
  });
  const [businessProfile, setBusinessProfile] = useState({});
  const isPrintingRef = useRef(false);
  const printReceiptRef = useRef(null);
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);

  // Billing History State
  const [invoicesHistory, setInvoicesHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sub-Modals for Bill Actions
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderType, setReminderType] = useState("Follow-up appointment");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [actionNotice, setActionNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);

  // Quick Add / Edit Customer Modal State
  const [newlyCreatedCustomerId, setNewlyCreatedCustomerId] = useState(null);
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [quickCustomerEditId, setQuickCustomerEditId] = useState(null);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    gender: "Female",
    date_of_birth: "",
    plan_id: "",
  });
  const [quickCustomerError, setQuickCustomerError] = useState(null);
  const [quickCustomerSaving, setQuickCustomerSaving] = useState(false);

  // New Customer + Membership Modal State
  const [showNewMembershipModal, setShowNewMembershipModal] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [membershipServices, setMembershipServices] = useState([]);
  const [newMembershipForm, setNewMembershipForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    gender: "Female",
    spot: "",
    plan_id: "",
    benefits: [],
  });
  const [newMembershipError, setNewMembershipError] = useState(null);
  const [newMembershipSaving, setNewMembershipSaving] = useState(false);
  const newMembershipModalRef = useRef(null);



  // Customer History Modal State
  const [showCustomerHistoryModal, setShowCustomerHistoryModal] = useState(false);
  const [customerHistoryTab, setCustomerHistoryTab] = useState("overview");
  const [customerHistoryData, setCustomerHistoryData] = useState(null);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [customerHistoryError, setCustomerHistoryError] = useState(null);
  const [readOnlyInvoiceDetail, setReadOnlyInvoiceDetail] = useState(null);

  // Assign Customer Membership Modal State (Inside Billing)
  const [showAssignMembershipModal, setShowAssignMembershipModal] = useState(false);
  const [assignMembershipForm, setAssignMembershipForm] = useState({
    customer_id: "",
    plan_id: "",
    payment_method: "Cash",
  });
  const [assignMembershipSaving, setAssignMembershipSaving] = useState(false);
  const [assignMembershipError, setAssignMembershipError] = useState(null);
  const assignMembershipModalRef = useRef(null);
  const assignCustomerSelectRef = useRef(null);
  const assignPlanSelectRef = useRef(null);
  const assignPaymentSelectRef = useRef(null);
  const assignSubmitBtnRef = useRef(null);

  const openAssignMembershipModal = (cust = null) => {
    let targetCustId = "";
    if (cust && cust.id) {
      targetCustId = String(cust.id);
    } else if (selectedCustomerId && selectedCustomerId !== "walkin") {
      targetCustId = selectedCustomerId;
    }
    setAssignMembershipForm({
      customer_id: targetCustId,
      plan_id: "",
      payment_method: "",
    });
    setAssignMembershipError(null);
    setShowAssignMembershipModal(true);

    setTimeout(() => {
      if (assignCustomerSelectRef.current) {
        assignCustomerSelectRef.current.focus();
        openNativeSelectDropdown(assignCustomerSelectRef.current);
      }
    }, 100);
  };

  const handleAssignMembershipSubmit = (e) => {
    if (e) e.preventDefault();
    setAssignMembershipError(null);

    const { customer_id, plan_id, payment_method } = assignMembershipForm;
    if (!customer_id) {
      setAssignMembershipError("Please select a customer.");
      return;
    }
    if (!plan_id) {
      setAssignMembershipError("Please select a membership plan.");
      return;
    }
    if (!payment_method) {
      setAssignMembershipError("Please select a payment method.");
      return;
    }

    const selectedPlan = membershipPlans.find((p) => String(p.id) === String(plan_id));
    if (!selectedPlan) {
      setAssignMembershipError("Invalid membership plan selected.");
      return;
    }

    // Auto-select customer in POS billing screen if not selected
    setSelectedCustomerId(String(customer_id));
    const cust = customers.find((c) => String(c.id) === String(customer_id));
    if (cust) {
      setCustomerSearchQuery(`${cust.first_name} ${cust.last_name || ""} (${cust.phone || ""})`);
      setSelectedGender(cust.gender || "Female");
    }

    const planPrice = parseFloat(selectedPlan.price || 0);

    // Add membership plan directly into POS Billing Cart Table
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((i) => i.type === "membership" && String(i.item_id) === String(plan_id));
      if (existingIdx >= 0) {
        showError(`Membership plan "${selectedPlan.name}" is already in the cart table.`);
        return prevCart;
      }
      const newItem = {
        type: "membership",
        item_id: selectedPlan.id,
        name: `Membership: ${selectedPlan.name}`,
        gross_amount: planPrice,
        mrp: planPrice,
        quantity: 1,
        discount_percent: 0,
        tax_rate: 0,
        employee_ids: [],
      };
      return [...prevCart, newItem];
    });

    setVisitMembershipStatus((prev) => ({
      ...(prev || {}),
      membership_mode: "paid_plan",
    }));

    // Instantly activate this membership in state so member discounts apply to services in cart
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = weekdays[new Date().getDay()];
    const isDayRestricted = (selectedPlan.day_restrictions || []).includes(todayName);

    setActiveMembership({
      ...selectedPlan,
      membership_plan_id: selectedPlan.id,
      plan_id: selectedPlan.id,
      plan_name: selectedPlan.name,
      service_discount_percentage: selectedPlan.service_discount_percentage || selectedPlan.discount_percentage || 0,
      eligible_services: selectedPlan.eligible_services || [],
      plan_services: selectedPlan.plan_services || selectedPlan.services || [],
      isDayRestricted,
    });
    setUseMembership(true);

    // Set payment method allocation default
    if (payment_method) {
      setSelectedPaymentMethods([payment_method]);
    }

    setShowAssignMembershipModal(false);
    showSuccess(`Membership plan "${selectedPlan.name}" assigned and added to bill! Member discount applied.`);
  };

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [modalProductCategoryId, setModalProductCategoryId] = useState("");
  const [modalProductCatSearchQuery, setModalProductCatSearchQuery] = useState("");
  const [isModalCatDropdownOpen, setIsModalCatDropdownOpen] = useState(false);
  const [modalCatHighlightedIndex, setModalCatHighlightedIndex] = useState(0);
  const modalCatComboboxRef = useRef(null);

  const [modalProductId, setModalProductId] = useState("");
  const [modalProductQty, setModalProductQty] = useState(1);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productQuantities, setProductQuantities] = useState({});
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [modalProdHighlightedIndex, setModalProdHighlightedIndex] = useState(0);
  const modalProdComboboxRef = useRef(null);

  const quickCustomerModalRef = useRef(null);
  const quickCustomerFormRef = useRef(null);
  const customerComboboxRef = useRef(null);
  const customerHistoryModalRef = useRef(null);
  const addProductModalRef = useRef(null);
  const productDropdownRef = useRef(null);
  const modalCatSelectRef = useRef(null);
  const modalProductSelectRef = useRef(null);
  const modalProductQtyRef = useRef(null);
  const modalAddProductBtnRef = useRef(null);
  const modalCancelBtnRef = useRef(null);

  const quickFirstNameRef = useRef(null);
  const quickLastNameRef = useRef(null);
  const quickPhoneRef = useRef(null);
  const quickGenderRef = useRef(null);
  const quickDobRef = useRef(null);
  const quickSubmitRef = useRef(null);

  const handleQuickInputKeyDown = (e, nextRef, prevRef) => {
    if (e.key === "ArrowRight") {
      if (
        e.target.selectionStart === undefined ||
        e.target.selectionStart === e.target.value.length ||
        (e.target.selectionStart === 0 && e.target.value === "")
      ) {
        e.preventDefault();
        if (nextRef && nextRef.current) {
          nextRef.current.focus();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (e.target.selectionStart === undefined || e.target.selectionStart === 0) {
        e.preventDefault();
        if (prevRef && prevRef.current) {
          prevRef.current.focus();
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  // Automatically open a native <select> dropdown when keyboard focus reaches it.
  // Uses the browser's native showPicker() when available (Chrome/Edge), with a
  // synthetic ArrowDown keydown fallback for browsers without it (e.g. Firefox).
  const openNativeSelectDropdown = (selectEl) => {
    if (!selectEl || selectEl.tagName !== "SELECT" || selectEl.disabled) return;
    try {
      if (typeof selectEl.showPicker === "function") {
        selectEl.showPicker();
        return;
      }
    } catch (e) {
      // Some browsers throw if called outside a user gesture; fall through.
    }
    try {
      selectEl.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          code: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    } catch (e) {
      // ignore
    }
  };

  // Advance focus to the next Billing field and, if that field is a native
  // select/dropdown, automatically open its options so the user can immediately
  // pick with ↑/↓/Enter without pressing an extra key.
  const advanceAndOpenSelect = (currentEl, nextRef) => {
    const moved = advanceToNextRef(currentEl, nextRef);
    if (moved && nextRef && nextRef.current) {
      openNativeSelectDropdown(nextRef.current);
    }
    return moved;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getProductInputValue = () => {
    if (isProductDropdownOpen && productSearchQuery !== "") {
      return productSearchQuery;
    }
    if (selectedProductIds.length > 0) {
      const names = selectedProductIds
        .map((id) => products.find((p) => p.id === id)?.name)
        .filter(Boolean);
      return names.join(", ");
    }
    return productSearchQuery;
  };

  useModalFocusTrap(showPaymentModal, paymentModalRef, () => setShowPaymentModal(false));
  useModalFocusTrap(showReceipt, receiptModalRef, () => setShowReceipt(false));
  useModalFocusTrap(showQuickCustomerModal, quickCustomerModalRef, () => setShowQuickCustomerModal(false));
  useModalFocusTrap(showCustomerHistoryModal, customerHistoryModalRef, () => setShowCustomerHistoryModal(false));
  useModalFocusTrap(showAddProductModal, addProductModalRef, () => setShowAddProductModal(false));
  useModalFocusTrap(showNewMembershipModal, newMembershipModalRef, () => setShowNewMembershipModal(false));

  const openCustomerHistory = () => {
    if (!selectedCustomerId || selectedCustomerId === "walkin") {
      showError("Walk-in customers do not have a stored history profile. Select a registered customer to view history.");
      return;
    }
    setCustomerHistoryData(null);
    setCustomerHistoryLoading(true);
    setCustomerHistoryError(null);
    setCustomerHistoryTab("overview");
    setShowCustomerHistoryModal(true);

    API.get(`/customers/${selectedCustomerId}/history`)
      .then((res) => {
        setCustomerHistoryData(res.data.data || res.data || {});
        setCustomerHistoryLoading(false);
      })
      .catch((err) => {
        setCustomerHistoryError(err.response?.data?.message || err.message || "Failed to load customer history.");
        setCustomerHistoryLoading(false);
      });
  };

  const handleExportCustomerHistory = () => {
    if (!customerHistoryData) return;
    const summary = customerHistoryData.summary || {};
    const visits = customerHistoryData.visit_history || [];
    
    let csvContent = `Customer Profile: ${summary.full_name} (${summary.phone})\n`;
    csvContent += `Total Visits: ${summary.total_visits}, Total Spent: ${summary.total_amount_spent}\n\n`;
    csvContent += `Invoice Number,Date,Services,Products,Amount,Status\n`;
    visits.forEach((v) => {
      const svcs = (v.services || []).join("; ");
      const prods = (v.products || []).join("; ");
      csvContent += `"${v.invoice_number}","${v.date}","${svcs}","${prods}",${v.total},"${v.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Customer_History_${summary.full_name ? summary.full_name.replace(/\s+/g, "_") : "Client"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auto-close customer dropdown when clicking or moving focus outside combobox container
  useEffect(() => {
    const handleOutsideInteraction = (e) => {
      if (customerComboboxRef.current && !customerComboboxRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideInteraction);
    document.addEventListener("focusin", handleOutsideInteraction);
    return () => {
      document.removeEventListener("mousedown", handleOutsideInteraction);
      document.removeEventListener("focusin", handleOutsideInteraction);
    };
  }, []);

  const fetchReceiptSettings = () => {
    API.get("/settings")
      .then((res) => {
        if (res.data) {
          if (res.data.receipt_settings) {
            setReceiptSettings(res.data.receipt_settings);
          }
          if (res.data.business_profile) {
            setBusinessProfile(res.data.business_profile);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchReceiptSettings();
  }, []);

  const openNewMembershipModal = () => {
    setNewMembershipError(null);
    setNewMembershipForm({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      gender: selectedGender || "Female",
      spot: "",
      plan_id: membershipPlans.length > 0 ? membershipPlans[0].id.toString() : "",
      benefits: [],
    });
    setShowNewMembershipModal(true);
    setIsCustomerDropdownOpen(false);

    // Fetch active membership plans and services if not already loaded
    if (membershipPlans.length === 0) {
      API.get("/membership-plans?status=active&limit=100")
        .then((res) => {
          const plans = res.data.items || [];
          setMembershipPlans(plans);
          setNewMembershipForm((prev) => ({
            ...prev,
            plan_id: plans.length > 0 ? plans[0].id.toString() : "",
          }));
        })
        .catch((err) => console.error("Failed to load membership plans:", err));
    }
    if (membershipServices.length === 0) {
      API.get("/services?status=active&limit=100")
        .then((res) => setMembershipServices(res.data.items || []))
        .catch((err) => console.error("Failed to load services:", err));
    }
  };

  const handleAddMembershipBenefitRow = () => {
    const defaultSvc = membershipServices.length > 0 ? membershipServices[0].id : "";
    setNewMembershipForm({
      ...newMembershipForm,
      benefits: [...newMembershipForm.benefits, { service_id: defaultSvc, quantity: 1 }],
    });
  };

  const handleMembershipBenefitChange = (index, field, val) => {
    const updated = [...newMembershipForm.benefits];
    updated[index][field] = field === "quantity" ? parseInt(val) || 1 : val;
    setNewMembershipForm({ ...newMembershipForm, benefits: updated });
  };

  const handleNewMembershipSubmit = (e) => {
    if (e) e.preventDefault();
    setNewMembershipError(null);

    const first_name = newMembershipForm.first_name.trim();
    const phone = newMembershipForm.phone.trim();

    if (!first_name || !phone) {
      setNewMembershipError("Customer First Name and Mobile Number are required.");
      return;
    }

    const phoneRegex = /^[0-9+\-\s]{7,15}$/;
    if (!phoneRegex.test(phone)) {
      setNewMembershipError("Please enter a valid mobile number (7-15 digits).");
      return;
    }

    if (!newMembershipForm.plan_id) {
      setNewMembershipError("Please select a membership plan.");
      return;
    }

    setNewMembershipSaving(true);

    // Step 1: Create the customer with spot assignment
    API.post("/customers", {
      first_name,
      last_name: newMembershipForm.last_name,
      phone,
      email: newMembershipForm.email,
      gender: newMembershipForm.gender,
      spot: newMembershipForm.spot,
    })
      .then((res) => {
        const savedCust = res.data?.data || res.data;
        const customerId = savedCust.id;

        // Step 2: Assign the membership plan to the new customer
        return API.post("/memberships/assign", {
          customer_id: customerId,
          plan_id: parseInt(newMembershipForm.plan_id),
          benefits: newMembershipForm.benefits.map((b) => ({
            service_id: parseInt(b.service_id),
            quantity: parseInt(b.quantity) || 1,
          })),
        }).then(() => savedCust);
      })
      .then((savedCust) => {
        // Refresh customer list
        return API.get("/customers?limit=10000").then((resList) => {
          setCustomers(resList.data.items || []);
          return savedCust;
        });
      })
      .then((savedCust) => {
        // Select the new customer in the billing screen
        setSelectedCustomerId(String(savedCust.id));
        setNewlyCreatedCustomerId(String(savedCust.id));
        setSelectedGender(savedCust.gender || "Female");
        setCustomerSearchQuery(`${savedCust.first_name} ${savedCust.last_name || ""} (${savedCust.phone})`);
        setShowNewMembershipModal(false);
        setNewMembershipSaving(false);
        setActionNotice(`New customer ${savedCust.first_name} created with membership assigned!`);
        setTimeout(() => setActionNotice(null), 4000);

        // Load the new customer's membership for discount application
        API.get(`/customers/${savedCust.id}/history`)
          .then((res) => {
            const memberships = res.data.memberships || [];
            const active = memberships.find((m) => m.status === "active");
            if (active) {
              const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              const todayName = weekdays[new Date().getDay()];
              const isDayRestricted = (active.day_restrictions || []).includes(todayName);
              setActiveMembership({
                ...active,
                isDayRestricted
              });
            }
          })
          .catch((err) => console.error("Failed to load new customer membership:", err));
      })
      .catch((err) => {
        setNewMembershipSaving(false);
        const dupData = err.response?.data?.details?.existing_customer;
        if (dupData && dupData.id) {
          showError(`Customer with mobile number ${phone} already exists (${dupData.first_name}). Automatically selecting existing customer.`);
          setSelectedCustomerId(String(dupData.id));
          setCustomerSearchQuery(`${dupData.first_name} ${dupData.last_name || ""} (${dupData.phone})`);
          setShowNewMembershipModal(false);
        } else {
          setNewMembershipError(err.response?.data?.message || err.message || "Failed to create customer and assign membership.");
        }
      });
  };

  const openQuickAddCustomer = (prefill = "") => {
    setQuickCustomerEditId(null);
    const trimmed = prefill.trim();
    const isPhone = /[0-9]/.test(trimmed);

    setQuickCustomerForm({
      first_name: isPhone ? "" : trimmed,
      last_name: "",
      phone: isPhone ? trimmed : "",
      gender: "",
      date_of_birth: "",
    });
    setQuickCustomerError(null);
    setShowQuickCustomerModal(true);
    setIsCustomerDropdownOpen(false);

    setTimeout(() => {
      if (quickFirstNameRef.current) {
        quickFirstNameRef.current.focus();
      }
    }, 100);
  };

  const openQuickEditCustomer = () => {
    if (!selectedCustomerId || selectedCustomerId === "walkin") return;
    const cust = customers.find((c) => c.id === parseInt(selectedCustomerId));
    if (!cust) return;

    setQuickCustomerEditId(cust.id);
    setQuickCustomerForm({
      first_name: cust.first_name || "",
      last_name: cust.last_name || "",
      phone: cust.phone || "",
      gender: cust.gender || "",
      date_of_birth: cust.date_of_birth || "",
    });
    setQuickCustomerError(null);
    setShowQuickCustomerModal(true);
    setIsCustomerDropdownOpen(false);

    setTimeout(() => {
      if (quickFirstNameRef.current) {
        quickFirstNameRef.current.focus();
      }
    }, 100);
  };

  const handleQuickCustomerSubmit = (e) => {
    if (e) e.preventDefault();
    setQuickCustomerError(null);

    const first_name = quickCustomerForm.first_name.trim();
    const phone = quickCustomerForm.phone.trim();
    const gender = quickCustomerForm.gender;

    if (!first_name || !phone) {
      setQuickCustomerError("Customer First Name and Mobile Number are required.");
      return;
    }

    if (!gender) {
      setQuickCustomerError("Please choose gender.");
      return;
    }

    const phoneRegex = /^[0-9+\-\s]{7,15}$/;
    if (!phoneRegex.test(phone)) {
      setQuickCustomerError("Please enter a valid mobile number (7-15 digits).");
      return;
    }

    // Check duplicate phone in local customer array
    const dupLoc = customers.find(
      (c) => c.phone && c.phone.trim() === phone && c.id !== quickCustomerEditId
    );
    if (dupLoc) {
      showError(`Customer with mobile number ${phone} already exists (${dupLoc.first_name} ${dupLoc.last_name || ""}). Automatically selecting existing customer.`);
      setSelectedCustomerId(String(dupLoc.id));
      setSelectedGender(dupLoc.gender || "Female");
      setCustomerSearchQuery(`${dupLoc.first_name} ${dupLoc.last_name || ""} (${dupLoc.phone})`);
      setShowQuickCustomerModal(false);
      setTimeout(() => advanceToNextRef(customerSelectRef.current, genderSelectRef), 100);
      return;
    }

    setQuickCustomerSaving(true);
    
    const payload = {
      first_name,
      last_name: quickCustomerForm.last_name ? quickCustomerForm.last_name.trim() : "",
      phone,
      gender,
      date_of_birth: quickCustomerForm.date_of_birth || null,
    };
    const apiCall = quickCustomerEditId
      ? API.put(`/customers/${quickCustomerEditId}`, payload)
      : API.post("/customers", payload);

    apiCall
      .then((res) => res.data?.data || res.data)
      .then((savedCust) => {
        // Refresh customer list
        return API.get("/customers?limit=10000").then((resList) => {
          setCustomers(resList.data.items || []);
          return savedCust;
        });
      })
      .then((savedCust) => {
        if (savedCust && savedCust.id) {
          setSelectedCustomerId(String(savedCust.id));
          if (!quickCustomerEditId) {
            setNewlyCreatedCustomerId(String(savedCust.id));
          }
          setSelectedGender(savedCust.gender || "Female");
          setCustomerSearchQuery(`${savedCust.first_name} ${savedCust.last_name || ""} (${savedCust.phone})`);

          // Load active membership for discount application
          API.get(`/customers/${savedCust.id}/history`)
            .then((res) => {
              const memberships = res.data.memberships || [];
              const active = memberships.find((m) => m.status === "active");
              if (active) {
                const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const todayName = weekdays[new Date().getDay()];
                const isDayRestricted = (active.day_restrictions || []).includes(todayName);
                setActiveMembership({
                  ...active,
                  isDayRestricted
                });
                setUseMembership(true);
              } else {
                setActiveMembership(null);
              }
            })
            .catch((err) => console.error("Failed to load customer membership detail:", err));
        }
        setShowQuickCustomerModal(false);
        setQuickCustomerSaving(false);
        setTimeout(() => advanceToNextRef(customerSelectRef.current, genderSelectRef), 100);
      })
      .catch((err) => {
        setQuickCustomerSaving(false);
        const dupData = err.response?.data?.details?.existing_customer;
        if (dupData && dupData.id) {
          showError(`Customer with mobile number ${phone} already exists (${dupData.first_name}). Automatically selecting existing customer.`);
          setSelectedCustomerId(String(dupData.id));
          setCustomerSearchQuery(`${dupData.first_name} ${dupData.last_name || ""} (${dupData.phone})`);
          setShowQuickCustomerModal(false);
          setTimeout(() => advanceToNextRef(customerSelectRef.current, genderSelectRef), 100);
        } else {
          setQuickCustomerError(err.response?.data?.message || err.message || "Failed to save customer.");
        }
      });
  };

  // Initial Load: Fetch Categories, Employees, Customers, Products, All Services, Settings, Membership Plans
  useEffect(() => {
    setLoading(true);
    Promise.all([
      API.get("/service-categories"),
      API.get("/employees?limit=100"),
      API.get("/customers?limit=10000"),
      API.get("/products?limit=10000"),
      API.get("/services?limit=10000"),
      API.get("/settings"),
      API.get("/membership-plans?status=active&limit=100"),
    ])
      .then(([catRes, empRes, custRes, prodRes, allSvcRes, setRes, plansRes]) => {
        const catList = catRes.data || [];
        setCategories(catList);
        setEmployees(empRes.data.items || []);
        setCustomers(custRes.data.items || []);
        setProducts(prodRes.data.items || prodRes.data || []);
        setAllServices(allSvcRes.data.items || []);
        setMembershipPlans(plansRes.data.items || []);

        const settingsData = setRes?.data || setRes;
        const invSet = settingsData?.invoice_settings || {};
        const regSet = settingsData?.regional_settings || {};
        const bilSet = settingsData?.billing_settings || {};

        if (bilSet.billing_mode) {
          localStorage.setItem("billing_mode", bilSet.billing_mode);
          setIsTouchMode(bilSet.billing_mode === "touch");
        } else {
          setIsTouchMode(false);
        }

        if (invSet.tax_rate !== undefined && invSet.tax_rate !== null) {
          setTaxRate(parseFloat(invSet.tax_rate));
        }
        if (regSet.currency_symbol) {
          setCurrencySymbol(regSet.currency_symbol);
        }

        if (catList.length > 0) {
          setSelectedCategoryId(catList[0].id.toString());
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load billing configurations.");
        setLoading(false);
      });
  }, []);

  // Auto-focus category field when Add Product modal opens
  useEffect(() => {
    if (showAddProductModal) {
      setModalProductCategoryId("");
      setModalProductCatSearchQuery("");
      setIsModalCatDropdownOpen(false);
      setModalProductId("");
      setProductSearchQuery("");
      setIsProductDropdownOpen(false);
      setModalProductQty(1);
      setTimeout(() => {
        if (modalCatSelectRef.current) {
          modalCatSelectRef.current.focus();
        } else if (modalProductSelectRef.current) {
          modalProductSelectRef.current.focus();
        }
      }, 100);
    }
  }, [showAddProductModal]);

  // Fetch Category Services
  useEffect(() => {
    if (!selectedCategoryId) {
      setServices([]);
      setSelectedServiceId("");
      return;
    }

    API.get(`/services?category_id=${selectedCategoryId}&limit=100`)
      .then((res) => {
        const svcs = res.data.items || [];
        setServices(svcs);
        setSelectedServiceId("");
        if (shouldFocusServiceRef.current) {
          shouldFocusServiceRef.current = false;
          setTimeout(() => {
            if (serviceSelectRef.current) {
              serviceSelectRef.current.focus();
              openNativeSelectDropdown(serviceSelectRef.current);
            }
          }, 60);
        }
      })
      .catch((err) => console.error("Error fetching category services:", err));
  }, [selectedCategoryId]);

  // Fetch Billing History
  const fetchBillingHistory = () => {
    setHistoryLoading(true);
    API.get("/invoices?limit=50")
      .then((res) => {
        setInvoicesHistory(res.data.items || []);
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  };

  useEffect(() => {
    if (activeSubTab === "history") {
      fetchBillingHistory();
    }
  }, [activeSubTab]);

  const fetchCustomerMemberships = (customerIdStr) => {
    if (!customerIdStr || customerIdStr === "walkin") {
      setActiveMembership(null);
      setVisitMembershipStatus(null);
      return;
    }

    // Fetch Type A % discount active membership
    API.get(`/customers/${customerIdStr}/history`)
      .then((res) => {
        const membershipsData = res.memberships || res.data?.memberships || (Array.isArray(res.data) ? res.data : []);
        const active = membershipsData.find((m) => m.status === "active");
        if (active) {
          const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const todayName = weekdays[new Date().getDay()];
          const isDayRestricted = (active.day_restrictions || []).includes(todayName);
          setActiveMembership({
            ...active,
            isDayRestricted
          });
        } else {
          setActiveMembership(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load customer membership detail:", err);
        setActiveMembership(null);
      });

    // Fetch Type B Visit-Based membership status for active branch
    API.get(`/visit-membership/customer-status/${customerIdStr}`, {
      params: { branch_id: activeBranchId }
    })
      .then((res) => {
        if (res.data) {
          setVisitMembershipStatus(res.data);
        }
      })
      .catch((err) => console.error("Failed to load visit membership status:", err));
  };

  useEffect(() => {
    fetchCustomerMemberships(selectedCustomerId);
  }, [selectedCustomerId, activeBranchId]);

  const handleCustomerChange = (customerIdStr) => {
    setSelectedCustomerId(customerIdStr);
    if (!customerIdStr) {
      setSelectedGender("");
      return;
    }
    if (customerIdStr === "walkin") {
      setSelectedGender("Walk-in");
      return;
    }
    const cust = customers.find((c) => c.id === parseInt(customerIdStr));
    if (cust && cust.gender) {
      setSelectedGender(cust.gender);
    } else {
      setSelectedGender("Unspecified");
    }
  };

  // Helper to determine discount percentage for a service given active customer membership
  const getMembershipDiscountForService = (serviceObj, activeMem) => {
    if (visitMembershipStatus?.membership_mode === "visit_based" || visitMembershipStatus?.membership_mode === "disabled") return 0;
    if (!useMembership || !activeMem || activeMem.isDayRestricted) return 0;
    const planId = activeMem.membership_plan_id || activeMem.plan_id;
    const targetServiceId = parseInt(serviceObj.id || serviceObj.item_id);

    // 1. Check if serviceObj has specific mapped membership discounts
    const discounts = serviceObj?.membership_discounts || [];
    if (planId && Array.isArray(discounts) && discounts.length > 0) {
      const match = discounts.find((d) => String(d.plan_id) === String(planId));
      if (match) {
        if (match.percentage !== undefined && match.percentage !== null) {
          const pVal = parseFloat(match.percentage);
          if (pVal > 0) return pVal;
        }
        if (match.amount !== undefined && match.amount !== null && (serviceObj.price || serviceObj.rate)) {
          const aVal = parseFloat(match.amount);
          if (aVal > 0) {
            const price = parseFloat(serviceObj.price || serviceObj.rate || 1);
            return (aVal / price) * 100;
          }
        }
      }
    }

    // 2. Check if activeMem has service-level discounts array (e.g. from customer history)
    if (activeMem.plan_services && Array.isArray(activeMem.plan_services)) {
      const match = activeMem.plan_services.find((ps) => parseInt(ps.service_id) === targetServiceId);
      if (match) {
        if (match.discount_percentage && parseFloat(match.discount_percentage) > 0) {
          return parseFloat(match.discount_percentage);
        }
        if (match.discount_amount && parseFloat(match.discount_amount) > 0 && (serviceObj.price || serviceObj.rate)) {
          const price = parseFloat(serviceObj.price || serviceObj.rate || 1);
          return (parseFloat(match.discount_amount) / price) * 100;
        }
      }
    }

    // 3. Check activeMem plan-level service_discount_percentage (e.g. 10%, 20%, 50%)
    if (activeMem.service_discount_percentage !== undefined && activeMem.service_discount_percentage !== null) {
      const planPercent = parseFloat(activeMem.service_discount_percentage);
      if (planPercent > 0) {
        const eligibleList = activeMem.eligible_services || activeMem.plan?.eligible_services || [];
        const isEligible = !eligibleList.length || eligibleList.includes(targetServiceId) || eligibleList.includes(String(targetServiceId));
        if (isEligible) {
          return planPercent;
        }
      }
    }

    // 4. Fallback check on activeMem.discount_percentage
    if (activeMem.discount_percentage && parseFloat(activeMem.discount_percentage) > 0) {
      return parseFloat(activeMem.discount_percentage);
    }

    return 0;
  };

  const getMembershipDiscountForProduct = (productObj, activeMem) => {
    if (visitMembershipStatus?.membership_mode === "visit_based" || visitMembershipStatus?.membership_mode === "disabled") return 0;
    if (!useMembership || !activeMem || activeMem.isDayRestricted) return 0;
    if (activeMem.product_discount_percentage !== undefined && activeMem.product_discount_percentage !== null) {
      return parseFloat(activeMem.product_discount_percentage) || 0;
    }
    return 0;
  };

  // Auto-recalculate cart item discounts when useMembership, activeMembership, services, products, or visitMembershipStatus change
  useEffect(() => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        let calcDiscount = 0;
        if (visitMembershipStatus?.membership_mode === "visit_based" || visitMembershipStatus?.membership_mode === "disabled") {
          calcDiscount = item.discount_percent || 0;
        } else if (item.type === "service") {
          const serviceList = allServices.length > 0 ? allServices : services;
          const svcObj = serviceList.find((s) => s.id === parseInt(item.item_id || item.id));
          calcDiscount = svcObj ? getMembershipDiscountForService(svcObj, activeMembership) : (useMembership && activeMembership ? parseFloat(activeMembership.service_discount_percentage || 0) : 0);
        } else if (item.type === "product") {
          const prodObj = products.find((p) => p.id === parseInt(item.item_id || item.id));
          calcDiscount = prodObj ? getMembershipDiscountForProduct(prodObj, activeMembership) : (useMembership && activeMembership ? parseFloat(activeMembership.product_discount_percentage || 0) : 0);
        }
        return {
          ...item,
          discount_percent: calcDiscount,
        };
      })
    );
  }, [useMembership, activeMembership, visitMembershipStatus, services, allServices, products]);

  const handleAddServiceToCart = (serviceIdToUse) => {
    const targetId = serviceIdToUse || selectedServiceId;
    if (!targetId) return;

    const serviceList = allServices.length > 0 ? allServices : services;
    const serviceObj = serviceList.find((s) => s.id === parseInt(targetId));
    if (!serviceObj) return;

    const isVisitBasedOrDisabled = visitMembershipStatus?.membership_mode === "visit_based" || visitMembershipStatus?.membership_mode === "disabled";
    const initialDiscount = isVisitBasedOrDisabled ? 0 : getMembershipDiscountForService(serviceObj, activeMembership);

    if (!isVisitBasedOrDisabled && useMembership && activeMembership && initialDiscount === 0) {
      const custName = customerSearchQuery && customerSearchQuery !== "Walk-in Customer" ? customerSearchQuery.split("(")[0].trim() : "Customer";
      const planName = activeMembership.plan_name || activeMembership.name || "Membership";
      showError(`"${serviceObj.name}" is not included in ${custName}'s ${planName} plan.`);
    }

    setCart((prevCart) => {
      // Always add as a new separate line item row
      const newItem = {
        type: "service",
        item_id: serviceObj.id,
        name: serviceObj.name,
        gross_amount: parseFloat(serviceObj.price),
        quantity: 1,
        discount_percent: initialDiscount,
        tax_rate: taxRate,
        employee_ids: [],
      };

      return [...prevCart, newItem];
    });
  };

  const handleAddProductToCart = (productIdToUse, qtyToAdd = 1) => {
    const targetId = productIdToUse || selectedProductId;
    if (!targetId) return;

    const prodObj = products.find((p) => p.id === parseInt(targetId));
    if (!prodObj) return;

    if (prodObj.stock_quantity !== undefined && prodObj.stock_quantity <= 0) {
      showError(`Product "${prodObj.name}" is out of stock (Available: 0). Unable to add.`);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.type === "product" && item.item_id === prodObj.id
      );

      if (existingIndex >= 0) {
        const currentQty = prevCart[existingIndex].quantity;
        if (prodObj.stock_quantity !== undefined && currentQty + qtyToAdd > prodObj.stock_quantity) {
          showError(`Cannot add ${qtyToAdd} more "${prodObj.name}". Total quantity (${currentQty + qtyToAdd}) exceeds available stock (${prodObj.stock_quantity}).`);
          return prevCart;
        }
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: currentQty + qtyToAdd,
        };
        return updated;
      }

      if (prodObj.stock_quantity !== undefined && qtyToAdd > prodObj.stock_quantity) {
        showError(`Quantity (${qtyToAdd}) exceeds available stock (${prodObj.stock_quantity}) for "${prodObj.name}".`);
        return prevCart;
      }

      const newItem = {
        type: "product",
        item_id: prodObj.id,
        name: prodObj.name,
        gross_amount: parseFloat(prodObj.selling_price || prodObj.price || 0),
        mrp: parseFloat(prodObj.mrp || prodObj.selling_price || prodObj.price || 0),
        quantity: qtyToAdd,
        discount_percent: 0,
        tax_rate: 0, // BUSINESS RULE #6: Products DO NOT have GST/Tax
        employee_ids: [], // Products do not require employee selection
        stock_quantity: prodObj.stock_quantity,
      };

      return [...prevCart, newItem];
    });
  };

  // Cart Updaters with e.target.select() onFocus
  const handleUpdateGrossAmount = (index, val) => {
    const updated = [...cart];
    const item = updated[index];
    const parsed = val === "" ? 0 : Math.max(0, parseFloat(val) || 0);
    item.gross_amount = parsed;
    const lineGross = item.gross_amount * item.quantity;
    if (item.discount_amount_override !== undefined && item.discount_amount_override !== null) {
      if (lineGross > 0) {
        item.discount_percent = Math.min(100, Math.max(0, (item.discount_amount_override / lineGross) * 100));
      } else {
        item.discount_percent = 0;
      }
    }
    setCart(updated);
  };

  const handleUpdateQty = (index, val) => {
    const updated = [...cart];
    const item = updated[index];
    const parsed = val === "" ? 1 : Math.max(1, parseInt(val, 10) || 1);

    if (item.type === "product" && item.stock_quantity !== undefined && parsed > item.stock_quantity) {
      showError(`Quantity (${parsed}) exceeds available stock (${item.stock_quantity}) for "${item.name}". Quantity set to stock limit.`);
      item.quantity = item.stock_quantity;
    } else {
      item.quantity = parsed;
    }
    const lineGross = item.gross_amount * item.quantity;
    if (item.discount_amount_override !== undefined && item.discount_amount_override !== null) {
      if (lineGross > 0) {
        item.discount_percent = Math.min(100, Math.max(0, (item.discount_amount_override / lineGross) * 100));
      } else {
        item.discount_percent = 0;
      }
    }
    setCart(updated);
  };

  const handleUpdateDiscountPercent = (index, val) => {
    const updated = [...cart];
    const item = updated[index];
    const parsed = val === "" ? 0 : Math.max(0, Math.min(100, parseFloat(val) || 0));
    item.discount_percent = parsed;
    const lineGross = item.gross_amount * item.quantity;
    item.discount_amount_override = (lineGross * parsed) / 100;
    setCart(updated);
  };

  const handleUpdateDiscountAmount = (index, val) => {
    const updated = [...cart];
    const item = updated[index];
    const lineGross = item.gross_amount * item.quantity;
    const parsed = val === "" ? 0 : Math.max(0, parseFloat(val) || 0);
    item.discount_amount_override = parsed;
    if (lineGross > 0) {
      item.discount_percent = Math.min(100, Math.max(0, (parsed / lineGross) * 100));
    } else {
      item.discount_percent = 0;
    }
    setCart(updated);
  };

  const handleUpdateTaxRate = (index, val) => {
    const updated = [...cart];
    const parsed = val === "" ? 0 : Math.max(0, parseFloat(val) || 0);
    updated[index].tax_rate = parsed;
    setCart(updated);
  };

  const handleSelectEmployee = (index, empIdStr) => {
    const updated = [...cart];
    const empId = parseInt(empIdStr);
    if (!empId) return;
    const currentList = updated[index].employee_ids || [];
    if (!currentList.includes(empId)) {
      updated[index].employee_ids = [...currentList, empId];
    }
    setCart(updated);
  };

  const handleRemoveEmployeeTag = (index, empId) => {
    const updated = [...cart];
    const currentList = updated[index].employee_ids || [];
    updated[index].employee_ids = currentList.filter((id) => id !== empId);
    setCart(updated);
  };

  const handleRemoveItem = (index) => {
    setCart(cart.filter((_, idx) => idx !== index));
  };

  const handleLineItemKeyDown = (e, rowIdx, fieldName) => {
    if (e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      const fieldOrder = ["gross_amount", "qty", "discount_percent", "discount_amount", "employee"];
      const currentPos = fieldOrder.indexOf(fieldName);

      if (currentPos < fieldOrder.length - 1) {
        const nextFieldName = fieldOrder[currentPos + 1];
        const targetEl = document.querySelector(`[data-row="${rowIdx}"][data-field="${nextFieldName}"]`);
        if (targetEl) {
          targetEl.focus();
          if (typeof targetEl.select === "function" && targetEl.tagName === "INPUT") {
            targetEl.select();
          }
        }
      } else {
        const nextRowEl = document.querySelector(`[data-row="${rowIdx + 1}"][data-field="gross_amount"]`);
        if (nextRowEl) {
          nextRowEl.focus();
          if (typeof nextRowEl.select === "function") {
            nextRowEl.select();
          }
        } else if (settlementBtnRef.current) {
          settlementBtnRef.current.focus();
        }
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const fieldOrder = ["gross_amount", "qty", "discount_percent", "discount_amount", "employee"];
      const currentPos = fieldOrder.indexOf(fieldName);

      if (currentPos > 0) {
        const prevFieldName = fieldOrder[currentPos - 1];
        const targetEl = document.querySelector(`[data-row="${rowIdx}"][data-field="${prevFieldName}"]`);
        if (targetEl) {
          targetEl.focus();
          if (typeof targetEl.select === "function" && targetEl.tagName === "INPUT") {
            targetEl.select();
          }
        }
      } else if (rowIdx > 0) {
        const prevRowEl = document.querySelector(`[data-row="${rowIdx - 1}"][data-field="employee"]`);
        if (prevRowEl) prevRowEl.focus();
      } else {
        if (addProductBtnRef.current) addProductBtnRef.current.focus();
      }
    }
  };

  // Computations
  const getEffectiveDiscountPercent = (item) => {
    if (visitMembershipStatus?.membership_mode === "visit_based" || visitMembershipStatus?.membership_mode === "disabled") {
      return item.discount_percent || 0;
    }
    if (useMembership && activeMembership && !activeMembership.isDayRestricted) {
      if (item.type === "service") {
        const serviceList = allServices.length > 0 ? allServices : services;
        const svcObj = serviceList.find((s) => s.id === (item.item_id || item.id));
        const mappedDisc = svcObj ? getMembershipDiscountForService(svcObj, activeMembership) : 0;
        if (mappedDisc > 0) {
          return mappedDisc;
        }
        // If eligible_services is empty/null, it applies to all services.
        const isEligible = !activeMembership.eligible_services || 
                          activeMembership.eligible_services.length === 0 || 
                          activeMembership.eligible_services.includes(item.item_id || item.id);
        if (isEligible && parseFloat(activeMembership.service_discount_percentage || 0) > 0) {
          return parseFloat(activeMembership.service_discount_percentage);
        }
      } else if (item.type === "product") {
        const prodObj = products.find((p) => p.id === (item.item_id || item.id));
        const mappedDisc = prodObj ? getMembershipDiscountForProduct(prodObj, activeMembership) : 0;
        if (mappedDisc > 0) {
          return mappedDisc;
        }
        if (parseFloat(activeMembership.product_discount_percentage || 0) > 0) {
          return parseFloat(activeMembership.product_discount_percentage);
        }
      }
    }
    return item.discount_percent || 0;
  };

  const calculateRowDiscountAmount = (item) => {
    const lineGross = item.gross_amount * item.quantity;
    if (item.is_free_visit_reward) {
      return lineGross;
    }
    if (item.discount_amount_override !== undefined && item.discount_amount_override !== null) {
      return Math.min(lineGross, Math.max(0, parseFloat(item.discount_amount_override) || 0));
    }
    const effPercent = getEffectiveDiscountPercent(item);
    return (lineGross * effPercent) / 100;
  };

  const calculateRowNet = (item) => {
    const lineGross = item.gross_amount * item.quantity;
    const disc = calculateRowDiscountAmount(item);
    return Math.max(0, lineGross - disc);
  };

  const calculateRowTaxAmount = (item) => {
    // BUSINESS RULE #6: Products DO NOT have GST or Tax applied.
    if (item.type === "product") return 0;
    const rowNet = calculateRowNet(item);
    return rowNet * ((item.tax_rate || 0) / 100);
  };

  const grossTotal = cart.reduce((sum, item) => sum + item.gross_amount * item.quantity, 0);
  const totalDiscount = cart.reduce((sum, item) => sum + calculateRowDiscountAmount(item), 0);
  const netTotal = Math.max(0, grossTotal - totalDiscount);
  const defaultTaxAmountFromSettings = (netTotal * (taxRate || 0)) / 100;
  const totalTaxAmount = isTaxAmountOverridden
    ? (parseFloat(invoiceTaxAmount) || 0)
    : defaultTaxAmountFromSettings;
  const netPayable = netTotal + totalTaxAmount;

  // Touch Mode alias bindings
  const subtotal = grossTotal;
  const totalDiscountAmount = totalDiscount;
  const grandTotal = netPayable;

  const handleTogglePaymentMethod = (methodId) => {
    if (selectedPaymentMethods.includes(methodId)) {
      if (selectedPaymentMethods.length === 1) {
        showError("At least one payment method must remain selected.");
        return;
      }
      const updatedMethods = selectedPaymentMethods.filter((m) => m !== methodId);
      setSelectedPaymentMethods(updatedMethods);
      const updatedAmounts = { ...paymentAmounts };
      delete updatedAmounts[methodId];

      if (updatedMethods.length === 1) {
        updatedAmounts[updatedMethods[0]] = netPayable.toFixed(2);
      }
      setPaymentAmounts(updatedAmounts);
    } else {
      const updatedMethods = [...selectedPaymentMethods, methodId];
      setSelectedPaymentMethods(updatedMethods);
      
      if (updatedMethods.length === 2) {
        const firstMethod = updatedMethods[0];
        const firstAmt = parseFloat(paymentAmounts[firstMethod]) || netPayable;
        const remaining = Math.max(0, netPayable - firstAmt);
        setPaymentAmounts({
          ...paymentAmounts,
          [firstMethod]: firstAmt.toFixed(2),
          [methodId]: remaining.toFixed(2),
        });
      } else {
        const currentAllocated = Object.values(paymentAmounts).reduce(
          (sum, v) => sum + (parseFloat(v) || 0),
          0
        );
        const remaining = Math.max(0, netPayable - currentAllocated);
        setPaymentAmounts({ ...paymentAmounts, [methodId]: remaining.toFixed(2) });
      }
    }
  };

  const handleUpdatePaymentAmount = (changedMethodId, val) => {
    const newAmounts = { ...paymentAmounts, [changedMethodId]: val };
    const numVal = parseFloat(val) || 0;

    if (selectedPaymentMethods.length === 2) {
      const firstMethod = selectedPaymentMethods[0];
      const secondMethod = selectedPaymentMethods[1];

      if (changedMethodId === secondMethod) {
        const remainingForFirst = Math.max(0, netPayable - numVal);
        newAmounts[firstMethod] = remainingForFirst.toFixed(2);
      } else if (changedMethodId === firstMethod) {
        const remainingForSecond = Math.max(0, netPayable - numVal);
        newAmounts[secondMethod] = remainingForSecond.toFixed(2);
      }
    } else if (selectedPaymentMethods.length > 2) {
      const otherMethods = selectedPaymentMethods.filter((m) => m !== changedMethodId);
      const targetMethod = otherMethods[otherMethods.length - 1];
      const sumOthers = selectedPaymentMethods
        .filter((m) => m !== targetMethod)
        .reduce((sum, m) => sum + (parseFloat(m === changedMethodId ? val : newAmounts[m]) || 0), 0);

      const remainingForTarget = Math.max(0, netPayable - sumOthers);
      newAmounts[targetMethod] = remainingForTarget.toFixed(2);
    }

    setPaymentAmounts(newAmounts);
  };

  const totalAllocatedPayment = Object.values(paymentAmounts).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );

  const handleProceedToPayment = () => {
    if (!selectedCustomerId) {
      showError("Please select a customer first before proceeding to payment.");
      if (customerSelectRef.current) {
        customerSelectRef.current.focus();
        setIsCustomerDropdownOpen(true);
        setCustomerHighlightedIndex(0);
      }
      return;
    }
    if (cart.length === 0) {
      showError("Your cart is empty. Please add services or products first.");
      if (!selectedCategoryId) {
        if (categorySelectRef.current) {
          categorySelectRef.current.focus();
          openNativeSelectDropdown(categorySelectRef.current);
        }
      } else {
        if (serviceSelectRef.current) {
          serviceSelectRef.current.focus();
          openNativeSelectDropdown(serviceSelectRef.current);
        }
      }
      return;
    }
    const missingEmpIdx = cart.findIndex(
      (item) => item.type === "service" && (!item.employee_ids || item.employee_ids.length === 0)
    );
    if (missingEmpIdx !== -1) {
      const missingService = cart[missingEmpIdx];
      showError(`Please select an employee/staff member for '${missingService.name || 'Service'}'.`);
      const empSelect = document.querySelector(`[data-row="${missingEmpIdx}"][data-field="employee"]`);
      if (empSelect) {
        empSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        empSelect.focus();
        openNativeSelectDropdown(empSelect);
      }
      return;
    }

    setSelectedPaymentMethods(["Cash"]);
    setPaymentAmounts({ Cash: netPayable.toFixed(2) });
    setShowPaymentModal(true);
  };

  const handleProceedToPaymentRef = useRef(handleProceedToPayment);
  handleProceedToPaymentRef.current = handleProceedToPayment;

  const handleCheckoutSubmitRef = useRef(null);

  // Submit Save Bill
  const handleCheckoutSubmit = () => {
    if (Math.abs(totalAllocatedPayment - netPayable) > 0.5) {
      alert(
        `Total payment allocated (${currencySymbol} ${totalAllocatedPayment.toFixed(
          2
        )}) does not match the Net Payable amount (${currencySymbol} ${netPayable.toFixed(
          2
        )}). Please adjust payments.`
      );
      return;
    }

    const payload = {
      customer_id: selectedCustomerId === "walkin" || !selectedCustomerId ? "walkin" : parseInt(selectedCustomerId),
      line_items: cart
        .filter((x) => x.type === "service" || x.type === "product" || x.type === "membership")
        .map((x) => ({
          type: x.type,
          item_id: x.item_id,
          quantity: x.quantity,
          employee_ids: x.employee_ids || [],
          employee_id: x.employee_ids && x.employee_ids.length > 0 ? x.employee_ids[0] : null,
          discount: calculateRowDiscountAmount(x),
          customer_membership_id: null,
        })),
      payments: Object.entries(paymentAmounts)
        .map(([method, val]) => ({
          method,
          amount: parseFloat(val) || 0,
        }))
        .filter((p) => p.amount > 0),
      membership_name: useMembership && activeMembership && !activeMembership.isDayRestricted ? activeMembership.plan_name : null,
      membership_discount: useMembership && activeMembership && !activeMembership.isDayRestricted ? totalDiscount : 0,
    };

    setLoading(true);
    API.post("/billing/checkout", payload)
      .then((res) => {
        const fullInvoice = res.data;
        setInvoiceResult(fullInvoice);
        setActivePrintInvoice(fullInvoice);
        setShowPaymentModal(false);
        setShowReceipt(true);
        setCart([]);
        setLoading(false);
        fetchBillingHistory();

        if (receiptSettings.auto_print) {
          setTimeout(() => {
            handlePrintThermalReceipt(fullInvoice);
          }, 400);
        }
      })
      .catch((err) => {
        showError(err.message || "Checkout transaction failed.");
        setLoading(false);
      });
  };

  handleCheckoutSubmitRef.current = handleCheckoutSubmit;

  // Single Key: F2 (Primary POS key), F4, F5 (Safeguarded against page reload)
  // Backup Combo: Ctrl+Enter / Cmd+Enter / Alt+S
  useEffect(() => {
    const handlePaymentShortcut = (e) => {
      if (activeSubTab !== "checkout") return;
      if (showReceipt) return;

      const isF2 = e.key === "F2" || e.code === "F2" || e.keyCode === 113;
      const isF4 = e.key === "F4" || e.code === "F4" || e.keyCode === 115;
      const isF5 = e.key === "F5" || e.code === "F5" || e.keyCode === 116;
      const isF9 = e.key === "F9" || e.code === "F9" || e.keyCode === 120;
      const isCtrlEnter = (e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.code === "Enter" || e.keyCode === 13);
      const isAltS = e.altKey && (e.key === "s" || e.key === "S" || e.code === "KeyS");

      if (isF2 || isF4 || isF5 || isF9 || isCtrlEnter || isAltS) {
        // ALWAYS block browser defaults (prevents F5 page refresh & losing bill data)
        e.preventDefault();
        e.stopPropagation();

        console.log("[Billing Shortcut Triggered]", {
          key: e.key,
          code: e.code,
          showPaymentModal,
          target: e.target?.tagName
        });

        if (showPaymentModal) {
          // Payment modal is open -> submit Save Bill
          if (handleCheckoutSubmitRef.current) {
            handleCheckoutSubmitRef.current();
          }
        } else {
          // Payment modal is closed -> validate form and open Payment modal
          if (handleProceedToPaymentRef.current) {
            handleProceedToPaymentRef.current();
          }
        }
      }
    };

    window.addEventListener("keydown", handlePaymentShortcut, true);
    return () => window.removeEventListener("keydown", handlePaymentShortcut, true);
  }, [activeSubTab, showPaymentModal, showReceipt]);

  const handlePrintThermalReceipt = (inv = null) => {
    if (isPrintingRef.current) return;
    
    const targetCustomer = customers.find(c => String(c.id) === String(selectedCustomerId));
    const draftFromCart = cart.length > 0 ? {
      invoice_number: `INV-DRAFT-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString(),
      cashier: "Admin",
      customer_name: targetCustomer ? `${targetCustomer.first_name || ''} ${targetCustomer.last_name || ''}`.trim() : "Walk-in Customer",
      customer_phone: targetCustomer?.phone || "",
      line_items: cart.map(item => ({
        item_name: item.name,
        quantity: item.qty,
        unit_price: item.price,
        line_total: item.price * item.qty,
        staff_name: employees.find(e => String(e.id) === String(item.employee_id))?.first_name || ""
      })),
      subtotal: totalAmount,
      discount: totalDiscount,
      tax: taxAmount,
      total: netPayable,
      payments: selectedPaymentMethods.map(m => ({ method: m, amount: paymentAmounts[m] || netPayable }))
    } : null;

    const targetInvoice = inv || invoiceResult || selectedInvoiceDetail || draftFromCart;

    if (!targetInvoice) {
      showError("No invoice data available to print.");
      return;
    }

    isPrintingRef.current = true;
    setActivePrintInvoice(targetInvoice);
    setActivePopupButton("print");

    setTimeout(() => {
      printThermalReceiptElement(printReceiptRef, receiptSettings?.paper_size || "80mm");
      setTimeout(() => {
        isPrintingRef.current = false;
      }, 1000);
    }, 150);
  };

  const handleDownloadPDF = (inv = null) => {
    setActivePopupButton("pdf");
    const targetInvoice = inv || invoiceResult || selectedInvoiceDetail || activePrintInvoice;
    const invNumber = targetInvoice?.invoice_number || targetInvoice?.id || "INV-0001";

    if (targetInvoice) {
      setActivePrintInvoice(targetInvoice);
    }

    setTimeout(() => {
      downloadThermalReceiptPDF(printReceiptRef, invNumber, receiptSettings?.paper_size || "80mm");
    }, 150);
  };

  const handleReset = () => {
    setCart([]);
    setSelectedCustomerId("");
    setSelectedGender("Female");
    setSelectedPaymentMethods(["Cash"]);
    setPaymentAmounts({ Cash: "" });
    setDraftSaved(false);
    setError(null);
  };

  const handleSaveDraft = () => {
    if (cart.length === 0) {
      showError("Cart is empty. Add services or products before saving draft.");
      return;
    }
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 3000);
  };

  const handleViewInvoiceDetail = (invId) => {
    API.get(`/invoices/${invId}`)
      .then((res) => {
        setSelectedInvoiceDetail(res.data);
      })
      .catch((err) => showError(err.message || "Failed to load invoice details."));
  };

  // --- BILL ACTIONS IMPLEMENTATIONS ---
  const triggerSMSBill = (inv = null) => {
    const targetInv = inv || invoiceResult || selectedInvoiceDetail || activePrintInvoice;
    const targetCust = customers.find((c) => String(c.id) === String(selectedCustomerId));
    const phone = targetInv?.customer_phone || targetInv?.customer?.phone || targetCust?.phone || "";

    if (!phone || phone.trim() === "" || phone === "0000000000") {
      showError("Customer mobile number not available or Walk-in customer.");
      return;
    }

    const parlourName = businessProfile?.name || "Beauty Parlour";
    const customerName = targetInv?.customer_name || targetInv?.customer?.first_name || targetCust?.first_name || "Customer";
    const billNo = targetInv?.invoice_number || targetInv?.id || "N/A";
    const totalVal = targetInv?.total || targetInv?.net_payable || 0;
    const amountStr = formatCurrency(totalVal);
    const smsMsg = `Hello ${customerName}, thank you for visiting ${parlourName}! Bill No: ${billNo}, Amount Paid: ${amountStr}. Thank you!`;

    // Trigger SMS dispatch alert / Web SMS link
    showError(`SMS Bill Notification:\n\nTo: ${phone}\nMessage: ${smsMsg}`);
  };

  const triggerWhatsAppWeb = (inv = null) => {
    const targetInv = inv || invoiceResult || selectedInvoiceDetail || activePrintInvoice;
    const targetCust = customers.find((c) => String(c.id) === String(selectedCustomerId));
    const rawPhone = targetInv?.customer_phone || targetInv?.customer?.phone || targetCust?.phone || "";
    let cleanPhone = rawPhone.replace(/[^0-9]/g, "");

    if (!cleanPhone || cleanPhone.length < 5 || cleanPhone === "0000000000") {
      showError("Customer mobile number not available or Walk-in customer.");
      return;
    }

    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
      // Valid 12-digit Indian number with 91
    }

    const parlourName = businessProfile?.name || "Beauty Parlour";
    const customerName = targetInv?.customer_name || targetInv?.customer?.first_name || targetCust?.first_name || "Customer";
    const billNo = targetInv?.invoice_number || targetInv?.id || "N/A";
    const totalVal = targetInv?.total || targetInv?.net_payable || 0;
    const amountStr = formatCurrency(totalVal);
    const thankYouMsg = receiptSettings?.thank_you_message || "Thank you for visiting. Please visit again!";

    const text = encodeURIComponent(
      `Hello ${customerName}, thank you for visiting ${parlourName}!\n\n` +
        `🧾 Bill No: ${billNo}\n` +
        `💰 Amount Paid: ${amountStr}\n\n` +
        `${thankYouMsg}`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
  };

  const handleSaveReminderSubmit = () => {
    if (!reminderDate) {
      showError("Please select a valid reminder date.");
      return;
    }
    API.post("/reminders", {
      customer_id: selectedInvoiceDetail?.customer?.id || selectedInvoiceDetail?.customer_id,
      invoice_id: selectedInvoiceDetail.id,
      reminder_type: reminderType,
      reminder_date: reminderDate,
      notes: reminderNotes,
    })
      .then(() => {
        setShowReminderModal(false);
        setActionNotice(`Reminder saved for ${selectedInvoiceDetail?.customer?.first_name || "Guest"} on ${reminderDate}!`);
        setTimeout(() => setActionNotice(null), 4000);
      })
      .catch((err) => showError(err.message || "Failed to save reminder."));
  };

  const handleSaveFeedbackSubmit = () => {
    API.post("/feedback", {
      customer_id: selectedInvoiceDetail?.customer?.id || selectedInvoiceDetail?.customer_id,
      invoice_id: selectedInvoiceDetail.id,
      rating: feedbackRating,
      comments: feedbackComments,
    })
      .then(() => {
        setShowFeedbackModal(false);
        setActionNotice(`Feedback rating of ${feedbackRating}⭐ recorded in database!`);
        setTimeout(() => setActionNotice(null), 4000);
      })
      .catch((err) => showError(err.message || "Failed to record feedback."));
  };

  const filteredHistory = invoicesHistory.filter(
    (inv) =>
      inv.invoice_number.toLowerCase().includes(historySearch.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="space-y-3 pb-12 font-sans text-slate-800">
      {/* Toast Notification */}
      {actionNotice && (
        <div className="fixed top-5 right-5 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold z-50 flex items-center space-x-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Mode Navigation Tabs (Multi-Tab POS Billing) */}
      <div className="flex justify-between items-center bg-surface border border-border-soft p-2.5 rounded-2xl shadow-xs overflow-x-auto">
        <div className="flex items-center space-x-2">
          {/* Active Bill Tabs */}
          {billingTabs.map((tab) => {
            const isTabActive = activeSubTab === "checkout" && activeTabId === tab.id;
            const tabCartCount = tab.id === activeTabId ? cart.length : (tab.cart ? tab.cart.length : 0);

            return (
              <div key={tab.id} className="flex items-center space-x-1">
                <button
                  onClick={() => handleSwitchTab(tab.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
                    isTabActive
                      ? "bg-primary text-white shadow-md shadow-pink-500/20"
                      : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{tab.name}</span>
                  {tabCartCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isTabActive ? "bg-white text-primary" : "bg-pink-100 text-pink-700"
                      }`}
                    >
                      {tabCartCount}
                    </span>
                  )}
                </button>

                {billingTabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Close Bill Tab"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Plus (+) Button to Open Another Billing Page Tab */}
          <button
            type="button"
            onClick={handleCreateNewTab}
            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-extrabold transition flex items-center space-x-1 shadow-xs ml-1"
            title="Open New Bill Tab (+)"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs">New Bill</span>
          </button>

          <div className="h-6 w-px bg-border-soft mx-2" />

          {/* Billing History Tab */}
          <button
            onClick={() => setActiveSubTab("history")}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
              activeSubTab === "history"
                ? "bg-primary text-white shadow-md shadow-pink-500/20"
                : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Billing History</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowAddExpenseModal(true)}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold transition flex items-center space-x-1.5 shadow-xs"
            title="Add Daily Expense"
          >
            <Receipt className="w-4 h-4 text-rose-600" />
            <span>Add Expense</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCashDenominationModal(true)}
            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-extrabold transition flex items-center space-x-1.5 shadow-xs"
            title="Day Close Cash Denominations"
          >
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span>Cash Denomination</span>
          </button>

          {draftSaved && (
            <div className="bg-success/15 border border-success/30 px-4 py-2 rounded-xl text-xs font-bold text-success flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-success" />
              <span>Draft Invoice Saved!</span>
            </div>
          )}
        </div>
      </div>

      {/* MODE 1: CHECKOUT SCREEN */}
      {activeSubTab === "checkout" && (
        isTouchMode ? (
          <TouchModeBilling
            categories={categories}
            services={allServices}
            products={products}
            cart={cart}
            setCart={setCart}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            customerSearchQuery={customerSearchQuery}
            setCustomerSearchQuery={setCustomerSearchQuery}
            isCustomerDropdownOpen={isCustomerDropdownOpen}
            setIsCustomerDropdownOpen={setIsCustomerDropdownOpen}
            customerHighlightedIndex={customerHighlightedIndex}
            setCustomerHighlightedIndex={setCustomerHighlightedIndex}
            customers={customers}
            selectedGender={selectedGender}
            setSelectedGender={setSelectedGender}
            activeMembership={activeMembership}
            visitMembershipStatus={visitMembershipStatus}
            useMembership={useMembership}
            setUseMembership={setUseMembership}
            handleAddServiceToCart={handleAddServiceToCart}
            handleAddProductToCart={handleAddProductToCart}
            handleRemoveCartItem={handleRemoveItem}
            handleQuantityChange={handleUpdateQty}
            handleDiscountChange={handleUpdateDiscountPercent}
            handleEmployeeToggle={handleSelectEmployee}
            employees={employees}
            taxRate={taxRate}
            invoiceTaxAmount={invoiceTaxAmount}
            setInvoiceTaxAmount={setInvoiceTaxAmount}
            isTaxAmountOverridden={isTaxAmountOverridden}
            setIsTaxAmountOverridden={setIsTaxAmountOverridden}
            subtotal={subtotal}
            totalDiscountAmount={totalDiscountAmount}
            totalTaxAmount={totalTaxAmount}
            grandTotal={grandTotal}
            handleOpenPaymentModal={handleProceedToPayment}
            openQuickAddCustomer={openQuickAddCustomer}
            openQuickEditCustomer={openQuickEditCustomer}
            openCustomerHistory={openCustomerHistory}
            openAssignMembershipModal={openAssignMembershipModal}
            newlyCreatedCustomerId={newlyCreatedCustomerId}
            customerComboboxRef={customerComboboxRef}
            currencySymbol={currencySymbol}
            formatCurrency={formatCurrency}
            getEffectiveDiscountPercent={getEffectiveDiscountPercent}
          />
        ) : (
        <div className="space-y-3">
          {/* Step 1 & 2: Customer & Gender Selection */}
          <div className="relative z-40 bg-surface border border-border-soft p-4 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-primary uppercase tracking-wider">
              <User className="w-4 h-4 text-primary" />
              <span>Step 1 & 2: Customer & Gender Selection</span>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div ref={customerComboboxRef} className="relative">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">Type or Select Customer *</label>
                  {selectedCustomerId && selectedCustomerId !== "walkin" && (
                    <div className="flex items-center space-x-2">
                      {selectedCustomerId && newlyCreatedCustomerId && String(selectedCustomerId) === String(newlyCreatedCustomerId) && (
                        <button
                          type="button"
                          onClick={() => openAssignMembershipModal()}
                          className="text-xs bg-pink-600 hover:bg-pink-700 text-white px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition shadow-xs"
                          title="Assign a new membership plan to this customer"
                        >
                          <Crown className="w-3.5 h-3.5 text-white" />
                          <span>+ Assign Membership</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openCustomerHistory}
                        className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition shadow-2xs"
                        title="View complete customer history, visits, notes & preferences"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Customer History</span>
                      </button>
                      <button
                        type="button"
                        onClick={openQuickEditCustomer}
                        className="text-xs text-primary hover:underline flex items-center space-x-1 font-semibold"
                        title="Edit selected customer details"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                  {selectedCustomerId === "walkin" && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => openQuickAddCustomer()}
                        className="text-xs text-primary hover:underline flex items-center space-x-1 font-semibold"
                        title="Convert Walk-in to Registered Customer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>+ Convert to Customer</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <input
                    ref={customerSelectRef}
                    type="text"
                    placeholder="Search by Name or Phone..."
                    value={customerSearchQuery}
                    onFocus={() => {
                      setIsCustomerDropdownOpen(true);
                      setCustomerHighlightedIndex(0);
                    }}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                      setCustomerHighlightedIndex(0);
                    }}
                    onKeyDown={(e) => {
                      const filteredCustomerList = customers.filter((c) => {
                        if (!customerSearchQuery || customerSearchQuery === "Walk-in Customer") return true;
                        const q = customerSearchQuery.toLowerCase().trim();
                        const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
                        const phone = (c.phone || "").toLowerCase();
                        return name.includes(q) || phone.includes(q);
                      });

                      const options = [
                        { type: "walkin", id: "walkin" },
                        ...filteredCustomerList.map((c) => ({ type: "customer", id: c.id, data: c })),
                        { type: "add_new", id: "add_new" },
                      ];

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setIsCustomerDropdownOpen(true);
                        setCustomerHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setIsCustomerDropdownOpen(true);
                        setCustomerHighlightedIndex((prev) => Math.max(prev - 1, 0));
                      } else if (e.key === "Enter" || e.key === "ArrowRight") {
                        e.preventDefault();
                        if (isCustomerDropdownOpen && options.length > 0) {
                          const targetOpt = options[customerHighlightedIndex] || options[0];
                          if (targetOpt.type === "walkin") {
                            handleCustomerChange("walkin");
                            setCustomerSearchQuery("Walk-in Customer");
                            setIsCustomerDropdownOpen(false);
                            advanceAndOpenSelect(e.target, categorySelectRef);
                          } else if (targetOpt.type === "customer") {
                            const c = targetOpt.data;
                            handleCustomerChange(String(c.id));
                            setCustomerSearchQuery(`${c.first_name} ${c.last_name || ""} (${c.phone || "No Phone"})`);
                            setIsCustomerDropdownOpen(false);
                            advanceAndOpenSelect(e.target, categorySelectRef);
                          } else if (targetOpt.type === "add_new") {
                            openQuickAddCustomer(customerSearchQuery !== "Walk-in Customer" ? customerSearchQuery : "");
                            setIsCustomerDropdownOpen(false);
                          }
                        } else {
                          advanceAndOpenSelect(e.target, categorySelectRef);
                        }
                      } else if (e.key === "Escape") {
                        setIsCustomerDropdownOpen(false);
                      }
                    }}
                    className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary pr-8"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />

                  {/* Dropdown Options List */}
                  {isCustomerDropdownOpen && (() => {
                    const filteredCustomerList = customers.filter((c) => {
                      if (!customerSearchQuery || customerSearchQuery === "Walk-in Customer") return true;
                      const q = customerSearchQuery.toLowerCase().trim();
                      const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
                      const phone = (c.phone || "").toLowerCase();
                      return name.includes(q) || phone.includes(q);
                    });

                    const options = [
                      { type: "walkin", id: "walkin" },
                      ...filteredCustomerList.map((c) => ({ type: "customer", id: c.id, data: c })),
                      { type: "add_new", id: "add_new" },
                    ];

                    return (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-pink-200 rounded-2xl shadow-2xl z-[9999] max-h-64 overflow-y-auto text-xs p-2 space-y-1">
                        {options.map((opt, idx) => {
                          const isHighlighted = idx === customerHighlightedIndex;

                          if (opt.type === "walkin") {
                            return (
                              <button
                                key="walkin"
                                type="button"
                                onClick={() => {
                                  handleCustomerChange("walkin");
                                  setCustomerSearchQuery("Walk-in Customer");
                                  setIsCustomerDropdownOpen(false);
                                  setTimeout(() => advanceAndOpenSelect(customerSelectRef.current, categorySelectRef), 50);
                                }}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between rounded-xl font-extrabold transition ${
                                  isHighlighted ? "bg-pink-100 text-pink-900 border border-pink-300 shadow-xs" : "bg-pink-50 text-pink-800 border border-pink-100 hover:bg-pink-100"
                                }`}
                              >
                                <span className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-pink-600" />
                                  <span className="text-slate-900 font-black">Walk-In Customer</span>
                                </span>
                                <span className="text-[10px] bg-white text-pink-700 border border-pink-200 px-2.5 py-0.5 rounded-full font-bold">Default</span>
                              </button>
                            );
                          }

                          if (opt.type === "customer") {
                            const c = opt.data;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  handleCustomerChange(String(c.id));
                                  setCustomerSearchQuery(`${c.first_name} ${c.last_name || ""} (${c.phone || "No Phone"})`);
                                  setIsCustomerDropdownOpen(false);
                                  setTimeout(() => advanceAndOpenSelect(customerSelectRef.current, categorySelectRef), 50);
                                }}
                                className={`w-full text-left px-4 py-2.5 flex items-center justify-between rounded-xl transition border ${
                                  isHighlighted ? "bg-pink-50 border-pink-300 text-slate-900 font-bold shadow-xs" : "bg-white border-slate-100 hover:bg-slate-50 text-slate-800"
                                }`}
                              >
                                <div>
                                  <span className="font-black text-slate-900 block text-xs">{c.first_name} {c.last_name || ""}</span>
                                  <span className="text-slate-700 font-bold text-[11px] block mt-0.5">{c.phone || "No Mobile"}</span>
                                </div>
                                {selectedCustomerId === String(c.id) && (
                                  <span className="text-pink-700 font-bold text-[11px] flex items-center space-x-1 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                                    <Check className="w-3.5 h-3.5 text-pink-600" />
                                    <span>Selected</span>
                                  </span>
                                )}
                              </button>
                            );
                          }

                          if (opt.type === "add_new") {
                            return (
                              <button
                                key="add_new"
                                type="button"
                                onClick={() => openQuickAddCustomer(customerSearchQuery !== "Walk-in Customer" ? customerSearchQuery : "")}
                                className={`w-full text-left px-4 py-3 text-pink-800 font-extrabold flex items-center space-x-2 rounded-xl transition border border-pink-200 ${
                                  isHighlighted ? "bg-pink-100 shadow-xs" : "bg-pink-50 hover:bg-pink-100"
                                }`}
                              >
                                <Plus className="w-4 h-4 text-pink-600" />
                                <span>
                                  Add New Customer {customerSearchQuery && customerSearchQuery !== "Walk-in Customer" ? `"${customerSearchQuery}"` : ""}
                                </span>
                              </button>
                            );
                          }

                          return null;
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gender (Auto-fetched)</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  placeholder="Auto-fetched on customer selection"
                  value={selectedGender || ""}
                  className="w-full bg-slate-100 border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 cursor-not-allowed focus:outline-none"
                />
              </div>

              <div className="bg-primary-light border border-primary/20 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-[10px] uppercase font-bold text-primary">Active Client</p>
                    {selectedCustomerId && selectedCustomerId !== "walkin" && (() => {
                      const selectedCust = customers.find((c) => c.id === parseInt(selectedCustomerId));
                      if (selectedCust?.days_since_last_visit && selectedCust.days_since_last_visit >= 60) {
                        return (
                          <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <UserRoundX className="w-3 h-3 text-indigo-600" />
                            <span>Inactive • {selectedCust.days_since_last_visit} Days</span>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <p className="text-xs font-extrabold text-slate-900">
                    {selectedCustomerId && selectedCustomerId !== "walkin"
                      ? (customers.find((c) => c.id === parseInt(selectedCustomerId))?.first_name || "") +
                        " " +
                        (customers.find((c) => c.id === parseInt(selectedCustomerId))?.last_name || "")
                      : selectedCustomerId === "walkin"
                      ? "Walk-in Customer"
                      : "No Customer Selected"}
                  </p>
                </div>
                <span className="text-xs font-bold bg-white text-primary px-3 py-1 rounded-full border border-primary/20">
                  {selectedGender || "No Customer Selected"}
                </span>
              </div>
            </div>

            {/* Membership Info & Decision Section (Type A % Discount Plan - Only when mode is not visit_based/disabled) */}
            {activeMembership && visitMembershipStatus?.membership_mode !== "visit_based" && visitMembershipStatus?.membership_mode !== "disabled" && (
              <div className="mt-4 border-t border-border-soft/60 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 md:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-pink-100 text-pink-700 rounded-lg">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">{activeMembership.plan_name}</h4>
                      {activeMembership.isDayRestricted ? (
                        <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          Restricted Today
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Benefits: {activeMembership.service_discount_percentage && parseFloat(activeMembership.service_discount_percentage) > 0 ? `${activeMembership.service_discount_percentage}% Service Discount` : `${activeMembership.plan_name || 'Membership'} Discounts Applicable`} • Expires: {activeMembership.expiry_date}
                    </p>
                    {activeMembership.isDayRestricted && (
                      <p className="text-[10px] text-red-500 font-medium mt-0.5">
                        ⚠️ Not applicable on {new Date().toLocaleDateString('en-US', { weekday: 'long' })}s.
                      </p>
                    )}
                  </div>
                </div>

                {!activeMembership.isDayRestricted && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setUseMembership(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        useMembership
                          ? "bg-pink-600 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-border-soft hover:bg-slate-50"
                      }`}
                    >
                      Use Membership
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseMembership(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        !useMembership
                          ? "bg-slate-700 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-border-soft hover:bg-slate-50"
                      }`}
                    >
                      Don't Use
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Visit-Based Membership Status Banner (Type B - Branch Scoped) */}
            {visitMembershipStatus && visitMembershipStatus.membership_mode === "visit_based" && (
              <div className="mt-4 border-t border-border-soft/60 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3 md:space-y-0 animate-fade-in shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                        Visit Loyalty Status:
                      </h4>
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                        Visit {visitMembershipStatus.current_visit_count} of {visitMembershipStatus.required_visits}
                      </span>
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                        Renewed {visitMembershipStatus.total_free_services_claimed || 0} times
                      </span>
                      {visitMembershipStatus.is_eligible && (
                        <span className="bg-amber-500 text-white text-[10px] px-2.5 py-0.5 rounded-full font-extrabold shadow-xs animate-pulse flex items-center space-x-1">
                          <span>🎁 Reward Ready - Free service available</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium mt-1">
                      {visitMembershipStatus.is_eligible
                        ? `Customer completed ${visitMembershipStatus.current_visit_count} qualifying visits! Select an eligible service below to claim for FREE.`
                        : `Customer needs ${Math.max(0, visitMembershipStatus.required_visits - visitMembershipStatus.current_visit_count)} more qualifying visit(s) to unlock next free reward.`}
                    </p>
                  </div>
                </div>

                {visitMembershipStatus.is_eligible && visitMembershipStatus.free_services && visitMembershipStatus.free_services.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const freeSvc = visitMembershipStatus.free_services[0];
                        if (freeSvc) {
                          setCart((prevCart) => {
                            const exists = prevCart.some((i) => i.is_free_visit_reward);
                            if (exists) {
                              showError("Free reward service is already added to cart.");
                              return prevCart;
                            }
                            return [
                              ...prevCart,
                              {
                                type: "service",
                                item_id: freeSvc.id,
                                name: `${freeSvc.name} (100% FREE REWARD)`,
                                gross_amount: parseFloat(freeSvc.price),
                                quantity: 1,
                                discount_percent: 100,
                                is_free_visit_reward: true,
                                tax_rate: taxRate,
                                employee_ids: [],
                              },
                            ];
                          });
                        }
                      }}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold rounded-lg shadow-xs transition flex items-center space-x-1"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      <span>Claim Free Reward ({visitMembershipStatus.free_services[0]?.name || "Free Service"})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3 & 4: Category & Service Selection */}
          <div className="relative z-30 bg-surface border border-border-soft p-4 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center space-x-2 text-xs font-extrabold text-primary uppercase tracking-wider">
              <Scissors className="w-4 h-4 text-primary" />
              <span>Step 3 & 4: Category & Service Selection</span>
            </div>

            <div className="grid md:grid-cols-3 gap-6 items-end">
              {/* Category Searchable Combobox */}
              <div ref={categoryComboboxRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                <div className="relative">
                  <input
                    ref={categorySelectRef}
                    type="text"
                    placeholder="Search Category..."
                    value={categorySearchQuery || (categories.find((c) => String(c.id) === String(selectedCategoryId))?.name || "")}
                    onFocus={() => {
                      setIsCategoryDropdownOpen(true);
                      setCategoryHighlightedIndex(0);
                    }}
                    onChange={(e) => {
                      setCategorySearchQuery(e.target.value);
                      setIsCategoryDropdownOpen(true);
                      setCategoryHighlightedIndex(0);
                    }}
                    onKeyDown={(e) => {
                      const filtered = categories.filter((cat) => {
                        if (!categorySearchQuery) return true;
                        return cat.name?.toLowerCase().includes(categorySearchQuery.toLowerCase().trim());
                      });

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setIsCategoryDropdownOpen(true);
                        setCategoryHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setIsCategoryDropdownOpen(true);
                        setCategoryHighlightedIndex((prev) => Math.max(prev - 1, 0));
                      } else if (e.key === "Enter" || e.key === "ArrowRight") {
                        e.preventDefault();
                        if (isCategoryDropdownOpen && filtered.length > 0) {
                          const targetCat = filtered[categoryHighlightedIndex] || filtered[0];
                          setSelectedCategoryId(String(targetCat.id));
                          setCategorySearchQuery(targetCat.name);
                          setIsCategoryDropdownOpen(false);
                          setSelectedServiceId("");
                          setServiceSearchQuery("");
                          setTimeout(() => {
                            if (serviceSelectRef.current) {
                              serviceSelectRef.current.focus();
                              setIsServiceDropdownOpen(true);
                            }
                          }, 50);
                        }
                      } else if (e.key === "Escape") {
                        setIsCategoryDropdownOpen(false);
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        if (customerSelectRef.current) {
                          customerSelectRef.current.focus();
                          setIsCustomerDropdownOpen(true);
                          setCustomerHighlightedIndex(0);
                        }
                      }
                    }}
                    className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary pr-8"
                  />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />

                  {/* Category Dropdown List */}
                  {isCategoryDropdownOpen && (() => {
                    const filtered = categories.filter((cat) => {
                      if (!categorySearchQuery) return true;
                      return cat.name?.toLowerCase().includes(categorySearchQuery.toLowerCase().trim());
                    });

                    return (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-border-soft rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto p-1.5 space-y-1">
                        {filtered.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 font-medium text-center">No categories match</div>
                        ) : (
                          filtered.map((cat, idx) => {
                            const isHighlighted = idx === categoryHighlightedIndex;
                            const isSelected = String(cat.id) === String(selectedCategoryId);
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategoryId(String(cat.id));
                                  setCategorySearchQuery(cat.name);
                                  setIsCategoryDropdownOpen(false);
                                  setSelectedServiceId("");
                                  setServiceSearchQuery("");
                                  setTimeout(() => {
                                    if (serviceSelectRef.current) {
                                      serviceSelectRef.current.focus();
                                      setIsServiceDropdownOpen(true);
                                    }
                                  }, 50);
                                }}
                                className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between ${
                                  isHighlighted ? "bg-primary-light text-primary" : "text-slate-800 hover:bg-slate-100"
                                }`}
                              >
                                <span>{cat.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Service Searchable Combobox (Search by Name or Price) */}
              <div ref={serviceComboboxRef} className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">Service *</label>
                <div className="relative">
                  <input
                    ref={serviceSelectRef}
                    type="text"
                    disabled={!selectedCategoryId}
                    placeholder={selectedCategoryId ? "Search Service by Name or Price..." : "-- Select Category First --"}
                    value={serviceSearchQuery || (services.find((s) => String(s.id) === String(selectedServiceId)) ? `${services.find((s) => String(s.id) === String(selectedServiceId)).name} - ${currencySymbol} ${parseFloat(services.find((s) => String(s.id) === String(selectedServiceId)).price).toFixed(2)}` : "")}
                    onFocus={() => {
                      if (selectedCategoryId) {
                        setIsServiceDropdownOpen(true);
                        setServiceHighlightedIndex(0);
                      }
                    }}
                    onChange={(e) => {
                      setServiceSearchQuery(e.target.value);
                      setIsServiceDropdownOpen(true);
                      setServiceHighlightedIndex(0);
                    }}
                    onKeyDown={(e) => {
                      const filtered = services.filter((svc) => {
                        if (!serviceSearchQuery) return true;
                        const q = serviceSearchQuery.toLowerCase().trim();
                        const nameMatch = svc.name?.toLowerCase().includes(q);
                        const priceMatch = (svc.price !== undefined && svc.price !== null) ? String(svc.price).includes(q) : false;
                        return nameMatch || priceMatch;
                      });

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setIsServiceDropdownOpen(true);
                        setServiceHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setIsServiceDropdownOpen(true);
                        setServiceHighlightedIndex((prev) => Math.max(prev - 1, 0));
                      } else if (e.key === "Enter" || e.key === "ArrowRight") {
                        e.preventDefault();
                        if (isServiceDropdownOpen && filtered.length > 0) {
                          const targetSvc = filtered[serviceHighlightedIndex] || filtered[0];
                          setSelectedServiceId(String(targetSvc.id));
                          setServiceSearchQuery(`${targetSvc.name} - ${currencySymbol} ${parseFloat(targetSvc.price).toFixed(2)}`);
                          setIsServiceDropdownOpen(false);
                          handleAddServiceToCart(targetSvc.id);
                          setTimeout(() => {
                            const empSelects = document.querySelectorAll('[data-field="employee"]');
                            if (empSelects.length > 0) {
                              const lastEmpSelect = empSelects[empSelects.length - 1];
                              lastEmpSelect.focus();
                              openNativeSelectDropdown(lastEmpSelect);
                            }
                          }, 100);
                        }
                      } else if (e.key === "Escape") {
                        setIsServiceDropdownOpen(false);
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        if (categorySelectRef.current) {
                          categorySelectRef.current.focus();
                          setIsCategoryDropdownOpen(true);
                        }
                      }
                    }}
                    className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary disabled:opacity-50 pr-8"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />

                  {/* Service Dropdown List */}
                  {isServiceDropdownOpen && selectedCategoryId && (() => {
                    const filtered = services.filter((svc) => {
                      if (!serviceSearchQuery) return true;
                      const q = serviceSearchQuery.toLowerCase().trim();
                      const nameMatch = svc.name?.toLowerCase().includes(q);
                      const priceMatch = (svc.price !== undefined && svc.price !== null) ? String(svc.price).includes(q) : false;
                      return nameMatch || priceMatch;
                    });

                    return (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-border-soft rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto p-1.5 space-y-1">
                        {filtered.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 font-medium text-center">No services match query</div>
                        ) : (
                          filtered.map((svc, idx) => {
                            const isHighlighted = idx === serviceHighlightedIndex;
                            const isSelected = String(svc.id) === String(selectedServiceId);
                            return (
                              <button
                                key={svc.id}
                                type="button"
                                onClick={() => {
                                  setSelectedServiceId(String(svc.id));
                                  setServiceSearchQuery(`${svc.name} - ${currencySymbol} ${parseFloat(svc.price).toFixed(2)}`);
                                  setIsServiceDropdownOpen(false);
                                  handleAddServiceToCart(svc.id);
                                  setTimeout(() => {
                                    const empSelects = document.querySelectorAll('[data-field="employee"]');
                                    if (empSelects.length > 0) {
                                      const lastEmpSelect = empSelects[empSelects.length - 1];
                                      lastEmpSelect.focus();
                                      openNativeSelectDropdown(lastEmpSelect);
                                    }
                                  }, 100);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-between ${
                                  isHighlighted ? "bg-primary-light text-primary" : "text-slate-800 hover:bg-slate-100"
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900 block">{svc.name}</span>
                                  <span className="text-[11px] text-primary font-bold block">{currencySymbol} {parseFloat(svc.price).toFixed(2)}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  ref={addProductBtnRef}
                  type="button"
                  onClick={() => {
                    setProductSearchQuery("");
                    setSelectedProductIds([]);
                    setProductQuantities({});
                    setIsProductDropdownOpen(false);
                    setShowAddProductModal(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      if (cart.length > 0) {
                        const firstRowGross = document.querySelector('[data-row="0"][data-field="gross_amount"]');
                        if (firstRowGross) {
                          firstRowGross.focus();
                          if (typeof firstRowGross.select === "function") firstRowGross.select();
                        }
                      }
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      advanceToNextRef(e.target, serviceSelectRef);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
                >
                  <Package className="w-4 h-4" />
                  <span>+ Add Product</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 5: Billing Line Items Table */}
          <div className="bg-surface border border-border-soft rounded-2xl shadow-xs overflow-hidden">
            <div className="py-3 px-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Billing Line Items Table (Services & Products)</span>
              </h3>
              <span className="text-xs font-bold text-text-secondary">
                {cart.length} line item(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-primary-light border-b border-border-soft text-slate-700">
                    <th className="px-3 py-3 font-extrabold w-12 text-center">S.No</th>
                    <th className="px-4 py-3 font-extrabold">Item Description (Service / Product)</th>
                    <th className="px-3 py-3 font-extrabold w-20">QTY</th>
                    <th className="px-4 py-3 font-extrabold">RATE (Unit Price)</th>
                    <th className="px-4 py-3 font-extrabold">MRP</th>
                    <th className="px-4 py-3 font-extrabold">Gross × Qty</th>
                    <th className="px-3 py-3 font-extrabold w-24">Discount (%)</th>
                    <th className="px-4 py-3 font-extrabold">Discount Amount</th>
                    <th className="px-4 py-3 font-extrabold">Tax</th>
                    <th className="px-4 py-3 font-extrabold">Net Amount</th>
                    <th className="px-4 py-3 font-extrabold min-w-[200px]">Employee (Stylist / Seller) Multi-Select *</th>
                    <th className="px-4 py-3 font-extrabold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-text-secondary font-medium">
                        Table is empty. Select a <strong>Service</strong> or <strong>Product</strong> above, then click <strong>"Add to Table"</strong>.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => {
                      const lineGross = item.gross_amount * item.quantity;
                      const discAmt = calculateRowDiscountAmount(item);
                      const rowTax = calculateRowTaxAmount(item);
                      const rowNet = calculateRowNet(item);

                      return (
                        <tr key={idx} className="hover:bg-background/60 transition">
                          <td className="px-3 py-3 font-bold text-slate-500 text-center">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                                item.type === "product"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : item.type === "membership"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-pink-50 text-primary border border-pink-200"
                              }`}>
                                {item.type === "product" ? "Product" : item.type === "membership" ? "Membership" : "Service"}
                              </span>
                              <span className="font-extrabold text-slate-900">{item.name}</span>
                            </div>
                          </td>

                          {/* Qty Input */}
                          <td className="px-3 py-3 text-center">
                            {item.type === "membership" ? (
                              <span className="text-xs font-bold text-slate-500">1</span>
                            ) : (
                              <input
                                type="number"
                                min="1"
                                data-row={idx}
                                data-field="qty"
                                value={item.quantity}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleUpdateQty(idx, e.target.value)}
                                onKeyDown={(e) => handleLineItemKeyDown(e, idx, "qty")}
                                className="w-16 bg-background border border-border-soft px-2 py-1 rounded-lg text-sm font-bold text-slate-900 text-center focus:border-primary focus:outline-none"
                              />
                            )}
                          </td>

                          {/* Editable Gross Amount / Selling RATE Input */}
                          <td className="px-3 py-3">
                            {item.type === "membership" ? (
                              <span className="text-xs font-extrabold text-slate-900">{currencySymbol} {parseFloat(item.gross_amount || 0).toFixed(2)}</span>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <span className="text-sm text-slate-400 font-bold">{currencySymbol}</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  data-row={idx}
                                  data-field="gross_amount"
                                  value={item.gross_amount}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => handleUpdateGrossAmount(idx, e.target.value)}
                                  onKeyDown={(e) => handleLineItemKeyDown(e, idx, "gross_amount")}
                                  className="w-20 bg-background border border-border-soft px-2 py-1 rounded-lg text-sm font-bold text-slate-900 text-center focus:border-primary focus:outline-none"
                                />
                              </div>
                            )}
                          </td>

                          {/* MRP Column */}
                          <td className="px-4 py-3 font-medium text-slate-500">
                            {item.type === "product" ? `${currencySymbol} ${parseFloat(item.mrp || item.gross_amount || 0).toFixed(2)}` : "—"}
                          </td>

                          <td className="px-4 py-3 font-bold text-slate-900">
                            {currencySymbol} {lineGross.toFixed(2)}
                          </td>

                          {/* Discount (%) Input */}
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              data-row={idx}
                              data-field="discount_percent"
                              value={getEffectiveDiscountPercent(item) !== undefined ? (Math.round(getEffectiveDiscountPercent(item) * 100) / 100) : 0}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleUpdateDiscountPercent(idx, e.target.value)}
                              onKeyDown={(e) => handleLineItemKeyDown(e, idx, "discount_percent")}
                              className="w-16 bg-background border border-border-soft px-2 py-1 rounded-lg text-sm font-bold text-slate-900 text-center focus:border-primary focus:outline-none"
                            />
                          </td>

                          {/* Editable Discount Amount Input */}
                          <td className="px-3 py-3">
                            <div className="flex items-center space-x-1">
                              <span className="text-sm text-danger font-bold">-</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                data-row={idx}
                                data-field="discount_amount"
                                value={item.discount_amount_override !== undefined && item.discount_amount_override !== null ? item.discount_amount_override : (Math.round(discAmt * 100) / 100)}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleUpdateDiscountAmount(idx, e.target.value)}
                                onKeyDown={(e) => handleLineItemKeyDown(e, idx, "discount_amount")}
                                className="w-20 bg-background border border-border-soft px-2 py-1 rounded-lg text-sm font-bold text-danger text-center focus:border-primary focus:outline-none"
                              />
                            </div>
                          </td>

                          {/* Tax Column */}
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {item.type === "product" ? "—" : `${currencySymbol} ${rowTax.toFixed(2)}`}
                          </td>

                          <td className="px-4 py-3 font-extrabold text-slate-900">
                            {currencySymbol} {rowNet.toFixed(2)}
                          </td>

                          {/* Employee Select Dropdown + Selected Employee Name Tags below (For both Services & Products) */}
                          <td className="px-4 py-3">
                            <div className="space-y-1.5 min-w-[180px]">
                              <select
                                data-row={idx}
                                data-field="employee"
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    handleSelectEmployee(idx, val);
                                    setSelectedServiceId("");
                                    setTimeout(() => {
                                      if (categorySelectRef.current) {
                                        categorySelectRef.current.focus();
                                        openNativeSelectDropdown(categorySelectRef.current);
                                      }
                                    }, 100);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.target.value) {
                                    handleSelectEmployee(idx, e.target.value);
                                    setSelectedServiceId("");
                                    setTimeout(() => {
                                      if (categorySelectRef.current) {
                                        categorySelectRef.current.focus();
                                        openNativeSelectDropdown(categorySelectRef.current);
                                      }
                                    }, 100);
                                  } else {
                                    handleLineItemKeyDown(e, idx, "employee");
                                  }
                                }}
                                className="w-full bg-background border border-border-soft px-2.5 py-1.5 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary"
                              >
                                <option value="" disabled hidden>Choose Employee</option>
                                {employees.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.first_name} {emp.last_name || ""}
                                  </option>
                                ))}
                              </select>

                              {/* Selected Employee Name Chips */}
                              <div className="flex flex-wrap gap-1">
                                {(item.employee_ids || []).map((empId) => {
                                  const empObj = employees.find((e) => e.id === empId);
                                  if (!empObj) return null;
                                  return (
                                    <span
                                      key={empId}
                                      className="inline-flex items-center space-x-1 text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full"
                                    >
                                      <span>{empObj.first_name} {empObj.last_name || ""}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveEmployeeTag(idx, empId)}
                                        className="text-pink-500 hover:text-pink-900 ml-1 font-black"
                                        title="Remove employee"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-danger hover:text-rose-700 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Summary Card */}
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-surface border border-border-soft p-6 rounded-2xl shadow-xs space-y-4">
              <h4 className="text-xs font-extrabold text-slate-900 uppercase border-b border-border-soft pb-2">
                Invoice Summary
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Gross Total:</span>
                  <span className="font-bold text-slate-900">{currencySymbol} {grossTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-danger">
                  <span>Total Discount:</span>
                  <span className="font-bold">-{currencySymbol} {totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-border-soft pt-2">
                  <span>Net Total (after discount):</span>
                  <span>{currencySymbol} {netTotal.toFixed(2)}</span>
                </div>
                
                {/* Editable Tax Amount Input */}
                <div className="flex justify-between items-center text-text-secondary pt-1">
                  <span className="font-bold text-slate-700">Tax Amount ({taxRate}%):</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-slate-400 font-bold">{currencySymbol}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={isTaxAmountOverridden ? invoiceTaxAmount : totalTaxAmount.toFixed(2)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        setIsTaxAmountOverridden(true);
                        setInvoiceTaxAmount(e.target.value);
                      }}
                      className="w-28 bg-background border border-border-soft px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-900 text-right focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-base font-extrabold text-primary border-t-2 border-primary/20 pt-3">
                  <span>Net Payable Amount:</span>
                  <span>{currencySymbol} {netPayable.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border-soft">
                <button
                  ref={settlementBtnRef}
                  onClick={handleProceedToPayment}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Space") {
                      e.preventDefault();
                      handleProceedToPayment();
                    }
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl text-xs font-extrabold shadow-md shadow-pink-500/20 transition flex items-center justify-center space-x-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Proceed to Payment (F2 / Ctrl + Enter)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      )}

      {/* MODE 2: BILLING HISTORY TAB */}
      {activeSubTab === "history" && (
        <div className="bg-surface border border-border-soft rounded-2xl shadow-xs overflow-hidden p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <History className="w-5 h-5 text-primary" />
                <span>Parlour Invoices & Billing History</span>
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                View saved invoices, reprint receipts, send WhatsApp/SMS links, and track payment breakdown.
              </p>
            </div>

            <div className="w-72 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by Invoice # or Client Name..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-background border border-border-soft pl-9 pr-4 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-primary-light border-b border-border-soft text-slate-700">
                  <th className="px-4 py-3 font-extrabold">Bill #</th>
                  <th className="px-4 py-3 font-extrabold">Date & Time</th>
                  <th className="px-4 py-3 font-extrabold">Customer Name</th>
                  <th className="px-4 py-3 font-extrabold">Membership Plan Price</th>
                  <th className="px-4 py-3 font-extrabold">Subtotal</th>
                  <th className="px-4 py-3 font-extrabold">Discount</th>
                  <th className="px-4 py-3 font-extrabold">Tax</th>
                  <th className="px-4 py-3 font-extrabold">Final Total</th>
                  <th className="px-4 py-3 font-extrabold">Status</th>
                  <th className="px-4 py-3 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {historyLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-text-secondary font-medium">
                      Loading invoice history...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-text-secondary font-medium">
                      No invoices found in billing history.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((inv) => (
                    <tr key={inv.id} className="hover:bg-background/60 transition">
                      <td className="px-4 py-3 font-extrabold text-primary">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(inv.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{inv.customer_name}</td>
                      <td className="px-4 py-3 font-bold text-purple-700">
                        {inv.membership_price > 0 ? (
                          <span>
                            {currencySymbol} {inv.membership_price.toFixed(2)}
                            {inv.membership_name ? <span className="block text-[10px] text-slate-500 font-semibold">{inv.membership_name}</span> : null}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{currencySymbol} {inv.subtotal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-danger">-{currencySymbol} {inv.discount.toFixed(2)}</td>
                      <td className="px-4 py-3">{currencySymbol} {inv.tax.toFixed(2)}</td>
                      <td className="px-4 py-3 font-extrabold text-slate-900">
                        {currencySymbol} {inv.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            inv.status === "Paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.status === "Partial"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => handleViewInvoiceDetail(inv.id)}
                          className="bg-primary/10 hover:bg-primary/20 text-primary p-1.5 rounded-lg transition"
                          title="View Receipt Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            handleViewInvoiceDetail(inv.id);
                            setTimeout(() => handlePrintThermalReceipt(inv), 300);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg transition"
                          title="Print Thermal Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            handleViewInvoiceDetail(inv.id);
                            setTimeout(() => handleDownloadPDF(inv), 300);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg transition"
                          title="Download PDF Invoice"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Split Multi-Payment Settlement Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={paymentModalRef} className="bg-surface max-w-xl w-full rounded-2xl shadow-2xl border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center bg-primary-light">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Split Multi-Payment Settlement</h3>
                <p className="text-[10px] text-text-secondary">Select one or multiple payment channels & enter amounts</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="bg-background border border-border-soft p-4 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-text-secondary block">Net Payable Due:</span>
                  <span className="text-lg font-extrabold text-primary">{currencySymbol} {netPayable.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-text-secondary block">Total Allocated:</span>
                  <span
                    className={`text-lg font-extrabold ${
                      Math.abs(totalAllocatedPayment - netPayable) < 0.01 ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {currencySymbol} {totalAllocatedPayment.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Select Payment Methods:</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {SUPPORTED_PAYMENT_METHODS.map((pm) => {
                    const isSelected = selectedPaymentMethods.includes(pm.id);
                    const Icon = pm.icon;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => handleTogglePaymentMethod(pm.id)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20 ${
                          isSelected
                            ? "border-primary bg-primary-light/50 ring-1 ring-primary"
                            : "border-border-soft bg-background hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className={`p-1.5 rounded-lg ${pm.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-900">{pm.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border-soft">
                <label className="block text-xs font-bold text-slate-700">Enter Allocated Payment Amounts:</label>
                {selectedPaymentMethods.map((mId) => (
                  <div key={mId} className="flex items-center justify-between bg-background border border-border-soft p-3 rounded-xl">
                    <span className="text-xs font-bold text-slate-800">{mId} Amount ({currencySymbol}):</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmounts[mId] || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleUpdatePaymentAmount(mId, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowRight") {
                          e.preventDefault();
                          if (submitInvoiceBtnRef.current) submitInvoiceBtnRef.current.focus();
                        }
                      }}
                      placeholder="0.00"
                      className="w-32 bg-white border border-border-soft px-3 py-1.5 rounded-lg text-xs font-extrabold text-slate-900 text-right focus:outline-none focus:border-primary focus:ring-2 focus:ring-pink-500/20"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 border border-border-soft rounded-xl text-xs font-bold text-slate-600 hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  ref={submitInvoiceBtnRef}
                  type="button"
                  onClick={handleCheckoutSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Space") {
                      e.preventDefault();
                      handleCheckoutSubmit();
                    }
                  }}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md shadow-pink-500/20"
                >
                  Save Bill (F2 / Ctrl + Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview & Save Bill Success Popup */}
      {showReceipt && invoiceResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-lg w-full rounded-2xl shadow-2xl border border-border-soft overflow-hidden p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border-soft pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-extrabold text-slate-900">Bill Saved Successfully!</h2>
              </div>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setActivePopupButton(null);
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Thermal Receipt Component */}
            <div className="py-2 bg-slate-900/5 rounded-xl flex justify-center border border-border-soft overflow-x-auto">
              <ThermalReceipt
                ref={printReceiptRef}
                invoice={invoiceResult}
                settings={receiptSettings}
                businessProfile={businessProfile}
              />
            </div>

            {/* Complete Bill Quick Actions */}
            <div className="pt-2 border-t border-border-soft space-y-2">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Receipt & Distribution Actions:</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {/* 1. Print Thermal Receipt */}
                <button
                  onClick={handlePrintThermalReceipt}
                  className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition ${
                    activePopupButton === "print"
                      ? "bg-primary text-white shadow-md shadow-pink-500/20"
                      : "bg-background hover:bg-slate-100 border border-border-soft text-slate-700"
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                {/* 2. Download PDF */}
                <button
                  onClick={handleDownloadPDF}
                  className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition ${
                    activePopupButton === "pdf"
                      ? "bg-primary text-white shadow-md shadow-pink-500/20"
                      : "bg-background hover:bg-slate-100 border border-border-soft text-slate-700"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                {/* 3. SMS Bill */}
                <button
                  onClick={() => {
                    setActivePopupButton("sms");
                    triggerSMSBill(invoiceResult);
                  }}
                  className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition ${
                    activePopupButton === "sms"
                      ? "bg-primary text-white shadow-md shadow-pink-500/20"
                      : "bg-background hover:bg-slate-100 border border-border-soft text-slate-700"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>SMS</span>
                </button>

                {/* 4. WhatsApp Web */}
                <button
                  onClick={() => {
                    setActivePopupButton("whatsapp");
                    triggerWhatsAppWeb(invoiceResult);
                  }}
                  className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center space-x-1 transition ${
                    activePopupButton === "whatsapp"
                      ? "bg-primary text-white shadow-md shadow-pink-500/20"
                      : "bg-background hover:bg-slate-100 border border-border-soft text-slate-700"
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setActivePopupButton(null);
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold"
              >
                Close & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Bill Detail Modal with Functional Actions */}
      {selectedInvoiceDetail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-lg w-full rounded-2xl shadow-2xl border border-border-soft overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-border-soft pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Invoice Details #{selectedInvoiceDetail.invoice_number || ""}
                </h3>
                <p className="text-[10px] text-text-secondary">
                  Customer: {selectedInvoiceDetail.customer?.first_name || "Guest"} {selectedInvoiceDetail.customer?.last_name || ""} ({selectedInvoiceDetail.customer?.phone || "N/A"})
                </p>
              </div>
              <button onClick={() => setSelectedInvoiceDetail(null)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Line Items List */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 uppercase">Treatment Line Items:</p>
              <div className="bg-background border border-border-soft rounded-xl p-3 space-y-2 max-h-36 overflow-y-auto text-xs">
                {(selectedInvoiceDetail.line_items || []).map((li) => (
                  <div key={li.id} className="flex justify-between items-center border-b border-border-soft/50 pb-1">
                    <div>
                      <span className="font-bold text-slate-900">{li.name}</span>
                      <span className="text-[10px] text-text-secondary block">
                        Qty: {li.quantity} × {currencySymbol}{li.unit_price} (Stylist: {li.employee_name || "N/A"})
                      </span>
                    </div>
                    <span className="font-extrabold text-slate-900">{currencySymbol} {(li.line_total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Breakdown */}
            <div className="bg-primary-light/50 border border-primary/20 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-bold">{currencySymbol} {(selectedInvoiceDetail.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-danger">
                <span>Discount:</span>
                <span className="font-bold">-{currencySymbol} {(selectedInvoiceDetail.discount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span className="font-bold">{currencySymbol} {(selectedInvoiceDetail.tax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-primary border-t border-border-soft pt-1">
                <span>Grand Total:</span>
                <span>{currencySymbol} {(selectedInvoiceDetail.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Functional Bill Action Buttons */}
            <div className="pt-3 border-t border-border-soft space-y-2">
              <p className="text-xs font-bold text-slate-700 uppercase">Bill Actions:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* 1. Print Bill */}
                <button
                  onClick={handlePrintThermalReceipt}
                  className="bg-primary hover:bg-primary-hover text-white py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Bill</span>
                </button>

                {/* 2. SMS Bill */}
                <button
                  onClick={() => triggerSMSBill(selectedInvoiceDetail)}
                  className="bg-background hover:bg-slate-100 border border-border-soft text-slate-700 py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>SMS Bill</span>
                </button>

                {/* 3. WhatsApp Web */}
                <button
                  onClick={() => triggerWhatsAppWeb(selectedInvoiceDetail)}
                  className="bg-background hover:bg-slate-100 border border-border-soft text-slate-700 py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp Web</span>
                </button>

                {/* 4. Set Reminder */}
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="bg-background hover:bg-slate-100 border border-border-soft text-slate-700 py-2 rounded-xl font-bold flex items-center justify-center space-x-1.5"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span>Set Reminder</span>
                </button>
              </div>

              {/* 5. Collect Feedback */}
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="w-full bg-background hover:bg-slate-100 border border-border-soft text-slate-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5"
              >
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span>Collect Client Feedback</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Reminder Sub-Modal */}
      {showReminderModal && selectedInvoiceDetail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-md w-full rounded-2xl shadow-2xl border border-border-soft p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-soft pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <span>Schedule Customer Reminder</span>
              </h3>
              <button onClick={() => setShowReminderModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reminder Purpose</label>
              <select
                value={reminderType}
                onChange={(e) => setReminderType(e.target.value)}
                className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="Next visit">Next Visit</option>
                <option value="Membership renewal">Membership Renewal</option>
                <option value="Follow-up appointment">Follow-up Appointment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reminder Date *</label>
              <input
                type="date"
                required
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Special Notes</label>
              <textarea
                rows={2}
                value={reminderNotes}
                onChange={(e) => setReminderNotes(e.target.value)}
                placeholder="Recommended facial touch-up or hair treatment date..."
                className="w-full bg-background border border-border-soft p-3 rounded-xl text-xs font-medium text-slate-900"
              />
            </div>

            <div className="pt-3 border-t border-border-soft flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="px-4 py-2 border border-border-soft rounded-xl text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReminderSubmit}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                Save Reminder to Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Feedback Sub-Modal */}
      {showFeedbackModal && selectedInvoiceDetail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface max-w-md w-full rounded-2xl shadow-2xl border border-border-soft p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-soft pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span>Record Customer Rating & Feedback</span>
              </h3>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Client Rating (1 to 5 Stars)</label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className={`p-2 rounded-xl transition ${
                      star <= feedbackRating ? "bg-amber-100 text-amber-500" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Star className="w-5 h-5 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer Comments / Review</label>
              <textarea
                rows={3}
                value={feedbackComments}
                onChange={(e) => setFeedbackComments(e.target.value)}
                placeholder="Loved the hair spa treatment and friendly stylist service..."
                className="w-full bg-background border border-border-soft p-3 rounded-xl text-xs font-medium text-slate-900"
              />
            </div>

            <div className="pt-3 border-t border-border-soft flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 border border-border-soft rounded-xl text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFeedbackSubmit}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md"
              >
                Record Feedback to Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add / Edit Customer Modal */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={quickCustomerModalRef} className="bg-surface max-w-md w-full rounded-2xl shadow-2xl border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center bg-background">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <User className="w-4 h-4 text-primary" />
                <span>{quickCustomerEditId ? "Quick Edit Customer Details" : "Quick Add New Customer"}</span>
              </h3>
              <button onClick={() => setShowQuickCustomerModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form ref={quickCustomerFormRef} onSubmit={handleQuickCustomerSubmit} className="p-6 space-y-4">
              {quickCustomerError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs font-bold text-danger">
                  {quickCustomerError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                  <input
                    ref={quickFirstNameRef}
                    type="text"
                    required
                    placeholder="e.g. Mahalakshmi"
                    value={quickCustomerForm.first_name}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, first_name: e.target.value })}
                    onKeyDown={(e) => handleQuickInputKeyDown(e, quickLastNameRef, null)}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                  <input
                    ref={quickLastNameRef}
                    type="text"
                    placeholder="e.g. S"
                    value={quickCustomerForm.last_name}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, last_name: e.target.value })}
                    onKeyDown={(e) => handleQuickInputKeyDown(e, quickPhoneRef, quickFirstNameRef)}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  ref={quickPhoneRef}
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={quickCustomerForm.phone}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                  onKeyDown={(e) => handleQuickInputKeyDown(e, quickGenderRef, quickLastNameRef)}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gender *</label>
                  <select
                    ref={quickGenderRef}
                    required
                    value={quickCustomerForm.gender}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, gender: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "Enter") {
                        e.preventDefault();
                        quickDobRef.current?.focus();
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        quickPhoneRef.current?.focus();
                      }
                    }}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                  >
                    <option value="" disabled hidden>Choose Gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date of Birth (Optional)</label>
                  <input
                    ref={quickDobRef}
                    type="date"
                    value={quickCustomerForm.date_of_birth}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, date_of_birth: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "Enter") {
                        e.preventDefault();
                        quickSubmitRef.current?.focus();
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        quickGenderRef.current?.focus();
                      }
                    }}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-xl text-xs font-bold text-slate-600 hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  ref={quickSubmitRef}
                  type="submit"
                  disabled={quickCustomerSaving}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50"
                >
                  {quickCustomerSaving ? "Saving Customer..." : quickCustomerEditId ? "Update Details" : "Save & Select Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CUSTOMER HISTORY MODAL */}
      {showCustomerHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            ref={customerHistoryModalRef}
            className="bg-surface border border-border-soft rounded-3xl shadow-2xl max-w-5xl w-full p-6 space-y-6 my-8 max-h-[90vh] flex flex-col"
          >
            {(() => {
              const summary = customerHistoryData?.summary || {};
              const financialSummary = customerHistoryData?.financial_summary || {};
              const visitHistory = customerHistoryData?.visit_history || [];
              const purchasedServices = customerHistoryData?.purchased_services || [];
              const purchasedProducts = customerHistoryData?.purchased_products || [];
              const memberships = customerHistoryData?.memberships || [];
              const timelineEvents = customerHistoryData?.timeline || [];

              return (
                <>
                  {/* Modal Header */}
                  <div className="flex justify-between items-start border-b border-border-soft pb-4 flex-wrap gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                          <History className="w-5 h-5 text-primary" />
                          <span>Customer History & Client Profile</span>
                          {summary.membership_status === "Active" && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider flex items-center space-x-1">
                              <Crown className="w-3.5 h-3.5 text-amber-700" />
                              <span>{summary.membership_plan || "Active"} Member</span>
                            </span>
                          )}
                        </h3>
                      </div>
                      <p className="text-xs font-semibold text-slate-500 mt-1">
                        {summary.full_name || "Client"} • Phone: {summary.phone || "N/A"} • Joined: {summary.date_joined || "N/A"}
                      </p>
                    </div>

                    {/* Quick Action Header Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomerHistoryModal(false)}
                        className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow-xs"
                        title="Return to current POS billing screen"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Create Bill</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomerHistoryModal(false);
                          openQuickEditCustomer();
                        }}
                        className="px-3 py-1.5 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1"
                        title="Edit customer details"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1"
                        title="Print customer profile & visit history"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Print</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportCustomerHistory}
                        className="px-3 py-1.5 border border-border-soft hover:bg-background text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1"
                        title="Export customer history CSV"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Export</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCustomerHistoryModal(false)}
                        className="w-8 h-8 text-slate-400 hover:text-slate-600 rounded-full hover:bg-background flex items-center justify-center font-bold text-lg"
                        title="Close History Popup (Esc)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Modal Body & Tab Navigator */}
                  {customerHistoryLoading ? (
                    <div className="py-16 text-center text-xs font-bold text-slate-500 flex flex-col items-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Loading Customer History & Analytics...</span>
                    </div>
                  ) : customerHistoryError ? (
                    <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold space-y-2">
                      <p className="font-extrabold text-sm text-rose-800">Unable to load customer history.</p>
                      <p>{customerHistoryError}</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                      {/* Tabs Row */}
                      <div className="flex border-b border-border-soft overflow-x-auto space-x-2 scrollbar-none text-xs font-extrabold">
                        {[
                          { id: "overview", label: "Overview", icon: BarChart3 },
                          { id: "visits", label: `Visit History (${visitHistory.length})`, icon: Receipt },
                          { id: "services", label: `Services (${purchasedServices.length})`, icon: Scissors },
                          { id: "products", label: `Products (${purchasedProducts.length})`, icon: Package },
                          { id: "membership", label: "Membership", icon: Crown },
                          { id: "notes", label: "Notes & Preferences", icon: FileText },
                          { id: "timeline", label: "Timeline", icon: Clock },
                        ].map((tab) => {
                          const TabIcon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setCustomerHistoryTab(tab.id)}
                              className={`px-4 py-2 border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
                                customerHistoryTab === tab.id
                                  ? "border-primary text-primary"
                                  : "border-transparent text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <TabIcon className="w-3.5 h-3.5" />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Tab Content Container */}
                      <div className="flex-1 overflow-y-auto pr-1 text-xs space-y-4">
                        {/* TAB 1: OVERVIEW */}
                        {customerHistoryTab === "overview" && (
                          <div className="space-y-6">
                            {/* Metric Cards Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                                <p className="text-[10px] font-bold uppercase text-slate-500">Total Visits</p>
                                <p className="text-xl font-black text-slate-900 mt-1">{summary.total_visits || 0}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Completed bills</p>
                              </div>
                              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                <p className="text-[10px] font-bold uppercase text-slate-500">Total Spent</p>
                                <p className="text-xl font-black text-emerald-700 mt-1">{formatCurrency(summary.total_amount_spent || 0)}</p>
                                <p className="text-[10px] text-emerald-600 mt-0.5">Lifetime revenue</p>
                              </div>
                              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                <p className="text-[10px] font-bold uppercase text-slate-500">Loyalty Points</p>
                                <p className="text-xl font-black text-amber-700 mt-1 flex items-center space-x-1">
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                  <span>{summary.loyalty_points || 0}</span>
                                </p>
                                <p className="text-[10px] text-amber-600 mt-0.5">Available balance</p>
                              </div>
                              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                                <p className="text-[10px] font-bold uppercase text-slate-500">Last Visit</p>
                                <p className="text-sm font-black text-purple-900 mt-1">{summary.last_visit_date || "No visits yet"}</p>
                                <p className="text-[10px] text-purple-600 mt-0.5">Stylist: {summary.preferred_stylist || "None"}</p>
                              </div>
                            </div>

                            {/* Preferences & Favorites Banner */}
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="p-4 bg-background border border-border-soft rounded-2xl space-y-2">
                                <div className="flex items-center space-x-2 font-bold text-slate-800">
                                  <Scissors className="w-4 h-4 text-primary" />
                                  <span>Preferred Services</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {summary.preferred_services?.length > 0 ? (
                                    summary.preferred_services.map((svc, i) => (
                                      <span key={i} className="bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-lg text-[11px]">
                                        {svc}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 font-normal">No preference data yet</span>
                                  )}
                                </div>
                              </div>

                              <div className="p-4 bg-background border border-border-soft rounded-2xl space-y-2">
                                <div className="flex items-center space-x-2 font-bold text-slate-800">
                                  <User className="w-4 h-4 text-primary" />
                                  <span>Preferred Stylist</span>
                                </div>
                                <p className="text-sm font-extrabold text-slate-900 pt-1">
                                  {summary.preferred_stylist || "None assigned"}
                                </p>
                              </div>
                            </div>

                            {/* Financial Breakdown Table */}
                            <div className="p-5 bg-surface border border-border-soft rounded-2xl space-y-3">
                              <h4 className="font-extrabold text-slate-900 uppercase text-[11px] tracking-wider">Financial Breakdown</h4>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                                <div className="p-3 bg-background rounded-xl border border-border-soft">
                                  <span className="text-[10px] text-slate-500 block font-bold">Services Total</span>
                                  <span className="text-xs font-black text-slate-800">{formatCurrency(financialSummary.total_services_amount || 0)}</span>
                                </div>
                                <div className="p-3 bg-background rounded-xl border border-border-soft">
                                  <span className="text-[10px] text-slate-500 block font-bold">Products Total</span>
                                  <span className="text-xs font-black text-slate-800">{formatCurrency(financialSummary.total_products_amount || 0)}</span>
                                </div>
                                <div className="p-3 bg-background rounded-xl border border-border-soft">
                                  <span className="text-[10px] text-slate-500 block font-bold">Discounts Received</span>
                                  <span className="text-xs font-black text-emerald-600">-{formatCurrency(financialSummary.total_discounts_given || 0)}</span>
                                </div>
                                <div className="p-3 bg-background rounded-xl border border-border-soft">
                                  <span className="text-[10px] text-slate-500 block font-bold">Tax Paid</span>
                                  <span className="text-xs font-black text-slate-800">{formatCurrency(financialSummary.total_tax_paid || 0)}</span>
                                </div>
                                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                                  <span className="text-[10px] text-primary block font-bold">Grand Total</span>
                                  <span className="text-xs font-black text-primary">{formatCurrency(financialSummary.grand_total_spent || 0)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 2: VISIT HISTORY */}
                        {customerHistoryTab === "visits" && (
                          <div className="space-y-4">
                            <div className="border border-border-soft rounded-2xl overflow-hidden shadow-2xs">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-background border-b border-border-soft font-extrabold text-slate-600 uppercase text-xs">
                                  <tr>
                                    <th className="p-3">Bill No</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Services</th>
                                    <th className="p-3">Products</th>
                                    <th className="p-3">Stylists</th>
                                    <th className="p-3 text-right">Amount</th>
                                    <th className="p-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-soft font-semibold">
                                  {visitHistory.length > 0 ? (
                                    visitHistory.map((v) => (
                                      <tr
                                        key={v.id}
                                        onClick={() => setReadOnlyInvoiceDetail(v)}
                                        className="hover:bg-primary-light/40 cursor-pointer transition"
                                        title="Click to view full invoice breakdown"
                                      >
                                        <td className="p-3 font-extrabold text-primary">{v.invoice_number}</td>
                                        <td className="p-3 text-slate-600">{v.date}</td>
                                        <td className="p-3 text-slate-900">{v.services?.length > 0 ? v.services.join(", ") : "-"}</td>
                                        <td className="p-3 text-slate-900">{v.products?.length > 0 ? v.products.join(", ") : "-"}</td>
                                        <td className="p-3 text-slate-600">{v.employees?.length > 0 ? v.employees.join(", ") : "N/A"}</td>
                                        <td className="p-3 text-right font-black text-slate-900">{formatCurrency(v.total)}</td>
                                        <td className="p-3 text-center">
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                              v.status === "Paid"
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-amber-100 text-amber-800"
                                            }`}
                                          >
                                            {v.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan="7" className="p-8 text-center text-slate-400 font-bold">
                                        No previous visits recorded for this customer.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* TAB 3: SERVICES */}
                        {customerHistoryTab === "services" && (
                          <div className="border border-border-soft rounded-2xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-background border-b border-border-soft font-extrabold text-slate-600 uppercase text-xs">
                                <tr>
                                  <th className="p-3">Service Name</th>
                                  <th className="p-3 text-center">Times Taken</th>
                                  <th className="p-3 text-right">Total Amount</th>
                                  <th className="p-3 text-right">Last Service Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-soft font-semibold">
                                {purchasedServices.length > 0 ? (
                                  purchasedServices.map((s, idx) => (
                                    <tr key={idx} className="hover:bg-background">
                                      <td className="p-3 font-extrabold text-slate-900">{s.name}</td>
                                      <td className="p-3 text-center font-black text-primary">{s.times_taken}</td>
                                      <td className="p-3 text-right font-extrabold text-slate-800">{formatCurrency(s.total_spent)}</td>
                                      <td className="p-3 text-right text-slate-600">{s.last_taken_date}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400 font-bold">
                                      No services purchased yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* TAB 4: PRODUCTS */}
                        {customerHistoryTab === "products" && (
                          <div className="border border-border-soft rounded-2xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-background border-b border-border-soft font-extrabold text-slate-600 uppercase text-xs">
                                <tr>
                                  <th className="p-3">Product Name</th>
                                  <th className="p-3 text-center">Quantity Purchased</th>
                                  <th className="p-3 text-right">Total Spent</th>
                                  <th className="p-3 text-right">Last Purchased Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-soft font-semibold">
                                {purchasedProducts.length > 0 ? (
                                  purchasedProducts.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-background">
                                      <td className="p-3 font-extrabold text-slate-900">{p.name}</td>
                                      <td className="p-3 text-center font-black text-primary">{p.quantity_purchased}</td>
                                      <td className="p-3 text-right font-extrabold text-slate-800">{formatCurrency(p.total_spent)}</td>
                                      <td className="p-3 text-right text-slate-600">{p.last_purchased_date}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400 font-bold">
                                      No products purchased yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* TAB 5: MEMBERSHIP */}
                        {customerHistoryTab === "membership" && (
                          <div className="space-y-4">
                            {memberships.length > 0 ? (
                              memberships.map((m) => (
                                <div key={m.id} className="p-5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <h4 className="text-sm font-black text-amber-900 flex items-center space-x-1">
                                        <Crown className="w-4 h-4 text-amber-800" />
                                        <span>{m.plan_name}</span>
                                      </h4>
                                      <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                                        Valid: {m.start_date} to {m.expiry_date}
                                      </p>
                                    </div>
                                    <span className="px-3 py-1 bg-amber-200 text-amber-900 rounded-full text-xs font-black uppercase">
                                      {m.status}
                                    </span>
                                  </div>

                                  <div className="pt-2 border-t border-amber-200">
                                    <h5 className="font-bold text-slate-800 mb-2">Remaining Benefit Balance</h5>
                                    <div className="grid md:grid-cols-2 gap-2">
                                      {m.benefits?.map((b, idx) => (
                                        <div key={idx} className="p-2.5 bg-surface border border-border-soft rounded-xl flex justify-between items-center">
                                          <span className="font-semibold text-slate-900">{b.service_name}</span>
                                          <span className="font-black text-primary">{b.remaining_quantity} / {b.total_quantity} left</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-8 text-center bg-background border border-border-soft rounded-2xl text-slate-400 font-bold">
                                No active or past memberships assigned.
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB 6: NOTES & PREFERENCES */}
                        {customerHistoryTab === "notes" && (
                          <div className="space-y-4">
                            <div className="p-5 bg-background border border-border-soft rounded-2xl space-y-3">
                              <h4 className="font-extrabold text-slate-900 flex items-center space-x-2">
                                <MessageSquare className="w-4 h-4 text-primary" />
                                <span>Staff Remarks & Client Notes</span>
                              </h4>
                              <p className="text-xs font-medium text-slate-700 bg-surface p-4 rounded-xl border border-border-soft leading-relaxed">
                                {summary.notes || "No custom notes recorded."}
                              </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                                <span className="text-[11px] font-bold text-rose-800 uppercase block">Allergies & Sensitivities</span>
                                <p className="text-xs font-bold text-rose-900">{summary.allergies || "None specified"}</p>
                              </div>
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-1">
                                <span className="text-[11px] font-bold text-blue-800 uppercase block">Preferred Hairdresser / Stylist</span>
                                <p className="text-xs font-bold text-blue-900">{summary.preferred_stylist || "None specified"}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB 7: TIMELINE */}
                        {customerHistoryTab === "timeline" && (
                          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-soft">
                            {timelineEvents.length > 0 ? (
                              timelineEvents.map((event, idx) => (
                                <div key={idx} className="relative space-y-1">
                                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 bg-primary rounded-full ring-4 ring-primary/20" />
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="font-black text-slate-900">{event.date} • {event.time}</span>
                                    <span className="font-bold text-primary">{event.invoice_number}</span>
                                  </div>
                                  <p className="text-xs font-bold text-slate-800">{event.title}</p>
                                  <p className="text-xs text-slate-500">{event.details}</p>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center text-slate-400 font-bold">
                                No timeline activity recorded.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* READ-ONLY INVOICE DETAIL MODAL */}
      {readOnlyInvoiceDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-surface border border-border-soft rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border-soft pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Invoice Breakdown: {readOnlyInvoiceDetail.invoice_number || "Invoice"}
                </h4>
                <p className="text-[11px] font-semibold text-slate-500">Date: {readOnlyInvoiceDetail.created_at || readOnlyInvoiceDetail.date || "N/A"}</p>
              </div>
              <button
                type="button"
                onClick={() => setReadOnlyInvoiceDetail(null)}
                className="w-8 h-8 rounded-full hover:bg-background text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-border-soft rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-background border-b border-border-soft font-extrabold text-slate-600">
                  <tr>
                    <th className="p-2.5">Item</th>
                    <th className="p-2.5 text-center">Type</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right font-black">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft font-semibold">
                  {readOnlyInvoiceDetail.line_items?.length > 0 ? (
                    readOnlyInvoiceDetail.line_items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2.5 font-bold text-slate-900">{item.name}</td>
                        <td className="p-2.5 text-center text-slate-500">{item.type}</td>
                        <td className="p-2.5 text-center">{item.quantity}</td>
                        <td className="p-2.5 text-right font-black text-slate-900">{formatCurrency(item.line_total || item.unit_price)}</td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {readOnlyInvoiceDetail.services?.map((svc, idx) => (
                        <tr key={`svc-${idx}`}>
                          <td className="p-2.5 font-bold text-slate-900">{svc}</td>
                          <td className="p-2.5 text-center text-slate-500">Service</td>
                          <td className="p-2.5 text-center">1</td>
                          <td className="p-2.5 text-right font-black text-slate-900">-</td>
                        </tr>
                      ))}
                      {readOnlyInvoiceDetail.products?.map((prod, idx) => (
                        <tr key={`prod-${idx}`}>
                          <td className="p-2.5 font-bold text-slate-900">{prod}</td>
                          <td className="p-2.5 text-center text-slate-500">Product</td>
                          <td className="p-2.5 text-center">1</td>
                          <td className="p-2.5 text-right font-black text-slate-900">-</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-border-soft flex justify-between items-center text-xs font-black text-slate-900">
              <span>Status: <span className="text-emerald-600">{readOnlyInvoiceDetail.status || "Paid"}</span></span>
              <span className="text-base text-primary font-black">Total: {formatCurrency(readOnlyInvoiceDetail.total || readOnlyInvoiceDetail.grand_total || 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ADD SALON RETAIL PRODUCT MODAL */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            ref={addProductModalRef}
            className="bg-surface max-w-2xl w-full rounded-2xl shadow-2xl border border-border-soft overflow-hidden p-6 space-y-5"
          >
            <div className="flex justify-between items-center border-b border-border-soft pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Add Salon Retail Product to Bill</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="w-8 h-8 rounded-full hover:bg-background text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Row 1: Product Category & Product Name side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Category Searchable Combobox */}
                <div ref={modalCatComboboxRef} className="relative">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Product Category (Optional Filter)</label>
                  <div className="relative">
                    <input
                      ref={modalCatSelectRef}
                      type="text"
                      placeholder="Search Product Category (e.g. Hair Care, Skin Care)..."
                      value={modalProductCatSearchQuery || (categories.find((c) => String(c.id) === String(modalProductCategoryId))?.name || "")}
                      onFocus={() => {
                        setIsModalCatDropdownOpen(true);
                        setModalCatHighlightedIndex(0);
                      }}
                      onChange={(e) => {
                        setModalProductCatSearchQuery(e.target.value);
                        setIsModalCatDropdownOpen(true);
                        setModalCatHighlightedIndex(0);
                        setModalProductCategoryId("");
                      }}
                      onKeyDown={(e) => {
                        const filteredCats = [
                          { id: "", name: "All Categories" },
                          ...categories.filter((cat) => {
                            if (!modalProductCatSearchQuery) return true;
                            return cat.name?.toLowerCase().includes(modalProductCatSearchQuery.toLowerCase().trim());
                          })
                        ];

                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setIsModalCatDropdownOpen(true);
                          setModalCatHighlightedIndex((prev) => Math.min(prev + 1, filteredCats.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setIsModalCatDropdownOpen(true);
                          setModalCatHighlightedIndex((prev) => Math.max(prev - 1, 0));
                        } else if (e.key === "Enter" || e.key === "ArrowRight") {
                          e.preventDefault();
                          if (isModalCatDropdownOpen && filteredCats.length > 0) {
                            const targetCat = filteredCats[modalCatHighlightedIndex] || filteredCats[0];
                            setModalProductCategoryId(String(targetCat.id));
                            setModalProductCatSearchQuery(targetCat.name === "All Categories" ? "" : targetCat.name);
                            setIsModalCatDropdownOpen(false);
                            setModalProductId("");
                            setProductSearchQuery("");
                            setTimeout(() => {
                              if (modalProductSelectRef.current) {
                                modalProductSelectRef.current.focus();
                                setIsProductDropdownOpen(true);
                              }
                            }, 50);
                          } else {
                            if (modalProductSelectRef.current) {
                              modalProductSelectRef.current.focus();
                              setIsProductDropdownOpen(true);
                            }
                          }
                        } else if (e.key === "Escape") {
                          setShowAddProductModal(false);
                        }
                      }}
                      className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary pr-8"
                    />
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />

                    {/* Category Dropdown List */}
                    {isModalCatDropdownOpen && (() => {
                      const filteredCats = [
                        { id: "", name: "All Categories" },
                        ...categories.filter((cat) => {
                          if (!modalProductCatSearchQuery) return true;
                          return cat.name?.toLowerCase().includes(modalProductCatSearchQuery.toLowerCase().trim());
                        })
                      ];

                      return (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-border-soft rounded-xl shadow-2xl z-[100] max-h-52 overflow-y-auto p-1.5 space-y-1">
                          {filteredCats.map((cat, idx) => {
                            const isHighlighted = idx === modalCatHighlightedIndex;
                            const isSelected = String(cat.id) === String(modalProductCategoryId);
                            return (
                              <button
                                key={cat.id || "all"}
                                type="button"
                                onClick={() => {
                                  setModalProductCategoryId(String(cat.id));
                                  setModalProductCatSearchQuery(cat.name === "All Categories" ? "" : cat.name);
                                  setIsModalCatDropdownOpen(false);
                                  setModalProductId("");
                                  setProductSearchQuery("");
                                  setTimeout(() => {
                                    if (modalProductSelectRef.current) {
                                      modalProductSelectRef.current.focus();
                                      setIsProductDropdownOpen(true);
                                    }
                                  }, 50);
                                }}
                                className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between ${
                                  isHighlighted ? "bg-primary-light text-primary" : "text-slate-800 hover:bg-slate-100"
                                }`}
                              >
                                <span>{cat.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Product Searchable Combobox (Search by Name or Price) */}
                <div ref={modalProdComboboxRef} className="relative">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Product *</label>
                  <div className="relative">
                    <input
                      ref={modalProductSelectRef}
                      type="text"
                      placeholder="Search Product by Name or Price..."
                      value={productSearchQuery || (products.find((p) => String(p.id) === String(modalProductId)) ? `${products.find((p) => String(p.id) === String(modalProductId)).name} - ${currencySymbol} ${parseFloat(products.find((p) => String(p.id) === String(modalProductId)).selling_price || products.find((p) => String(p.id) === String(modalProductId)).price || 0).toFixed(2)}` : "")}
                      onFocus={() => {
                        setIsProductDropdownOpen(true);
                        setModalProdHighlightedIndex(0);
                      }}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setIsProductDropdownOpen(true);
                        setModalProdHighlightedIndex(0);
                        setModalProductId("");
                      }}
                      onKeyDown={(e) => {
                        const filteredProds = products.filter((prod) => {
                          if (modalProductCategoryId && String(prod.category_id) !== String(modalProductCategoryId) && String(prod.category) !== String(modalProductCategoryId)) {
                            return false;
                          }
                          if (!productSearchQuery) return true;
                          const q = productSearchQuery.toLowerCase().trim();
                          const nameMatch = prod.name?.toLowerCase().includes(q);
                          const priceVal = prod.selling_price || prod.price;
                          const priceMatch = (priceVal !== undefined && priceVal !== null) ? String(priceVal).includes(q) : false;
                          return nameMatch || priceMatch;
                        });

                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setIsProductDropdownOpen(true);
                          setModalProdHighlightedIndex((prev) => Math.min(prev + 1, filteredProds.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setIsProductDropdownOpen(true);
                          setModalProdHighlightedIndex((prev) => Math.max(prev - 1, 0));
                        } else if (e.key === "Enter" || e.key === "ArrowRight") {
                          e.preventDefault();
                          if (isProductDropdownOpen && filteredProds.length > 0) {
                            const targetProd = filteredProds[modalProdHighlightedIndex] || filteredProds[0];
                            setModalProductId(String(targetProd.id));
                            setProductSearchQuery(`${targetProd.name} - ${currencySymbol} ${parseFloat(targetProd.selling_price || targetProd.price || 0).toFixed(2)}`);
                            setIsProductDropdownOpen(false);
                            setTimeout(() => {
                              if (modalProductQtyRef.current) {
                                modalProductQtyRef.current.focus();
                                if (typeof modalProductQtyRef.current.select === "function") modalProductQtyRef.current.select();
                              }
                            }, 50);
                          } else if (modalProductQtyRef.current) {
                            modalProductQtyRef.current.focus();
                            if (typeof modalProductQtyRef.current.select === "function") modalProductQtyRef.current.select();
                          }
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          if (modalCatSelectRef.current) {
                            modalCatSelectRef.current.focus();
                            setIsModalCatDropdownOpen(true);
                          }
                        } else if (e.key === "Escape") {
                          setShowAddProductModal(false);
                        }
                      }}
                      className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary pr-8"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />

                    {/* Product Dropdown List */}
                    {isProductDropdownOpen && (() => {
                      const filteredProds = products.filter((prod) => {
                        if (modalProductCategoryId && String(prod.category_id) !== String(modalProductCategoryId) && String(prod.category) !== String(modalProductCategoryId)) {
                          return false;
                        }
                        if (!productSearchQuery) return true;
                        const q = productSearchQuery.toLowerCase().trim();
                        const nameMatch = prod.name?.toLowerCase().includes(q);
                        const priceVal = prod.selling_price || prod.price;
                        const priceMatch = (priceVal !== undefined && priceVal !== null) ? String(priceVal).includes(q) : false;
                        return nameMatch || priceMatch;
                      });

                      return (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-border-soft rounded-xl shadow-2xl z-[100] max-h-56 overflow-y-auto p-1.5 space-y-1">
                          {filteredProds.length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 font-medium text-center">No products match query</div>
                          ) : (
                            filteredProds.map((prod, idx) => {
                              const isHighlighted = idx === modalProdHighlightedIndex;
                              const isSelected = String(prod.id) === String(modalProductId);
                              return (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() => {
                                    setModalProductId(String(prod.id));
                                    setProductSearchQuery(`${prod.name} - ${currencySymbol} ${parseFloat(prod.selling_price || prod.price || 0).toFixed(2)}`);
                                    setIsProductDropdownOpen(false);
                                    setTimeout(() => {
                                      if (modalProductQtyRef.current) {
                                        modalProductQtyRef.current.focus();
                                        if (typeof modalProductQtyRef.current.select === "function") modalProductQtyRef.current.select();
                                      }
                                    }, 50);
                                  }}
                                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-between ${
                                    isHighlighted ? "bg-primary-light text-primary" : "text-slate-800 hover:bg-slate-100"
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-slate-900 block">{prod.name}</span>
                                    <span className="text-[11px] text-emerald-600 font-bold block">
                                      {currencySymbol} {parseFloat(prod.selling_price || prod.price || 0).toFixed(2)} • Stock: {prod.stock_quantity !== undefined ? prod.stock_quantity : "Avail"}
                                    </span>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Quantity Field (Row 2, cleanly positioned below without divider lines) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity *</label>
                <input
                  ref={modalProductQtyRef}
                  type="number"
                  min="1"
                  value={modalProductQty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setModalProductQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "ArrowRight") {
                      e.preventDefault();
                      if (modalAddProductBtnRef.current) modalAddProductBtnRef.current.focus();
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      if (modalProductSelectRef.current) modalProductSelectRef.current.focus();
                    } else if (e.key === "Escape") {
                      setShowAddProductModal(false);
                    }
                  }}
                  className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="pt-3 border-t border-border-soft flex justify-end space-x-3">
              <button
                ref={modalCancelBtnRef}
                type="button"
                onClick={() => setShowAddProductModal(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Space") {
                    e.preventDefault();
                    setShowAddProductModal(false);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    if (modalProductQtyRef.current) {
                      modalProductQtyRef.current.focus();
                      if (typeof modalProductQtyRef.current.select === "function") modalProductQtyRef.current.select();
                    }
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    if (modalAddProductBtnRef.current) modalAddProductBtnRef.current.focus();
                  } else if (e.key === "Escape") {
                    setShowAddProductModal(false);
                  }
                }}
                className="px-4 py-2 bg-background hover:bg-slate-100 border border-border-soft rounded-xl font-bold text-slate-700 focus:outline-none focus:border-primary"
              >
                Cancel
              </button>

              <button
                ref={modalAddProductBtnRef}
                type="button"
                disabled={!modalProductId}
                onClick={() => {
                  if (!modalProductId) return;
                  handleAddProductToCart(modalProductId, modalProductQty);
                  setShowAddProductModal(false);
                  setTimeout(() => {
                    const firstRowGross = document.querySelector('[data-row="0"][data-field="gross_amount"]');
                    if (firstRowGross) {
                      firstRowGross.focus();
                      if (typeof firstRowGross.select === "function") firstRowGross.select();
                    }
                  }, 50);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Space") {
                    e.preventDefault();
                    if (modalProductId) {
                      handleAddProductToCart(modalProductId, modalProductQty);
                      setShowAddProductModal(false);
                      setTimeout(() => {
                        const firstRowGross = document.querySelector('[data-row="0"][data-field="gross_amount"]');
                        if (firstRowGross) {
                          firstRowGross.focus();
                          if (typeof firstRowGross.select === "function") firstRowGross.select();
                        }
                      }, 50);
                    }
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    if (modalCancelBtnRef.current) modalCancelBtnRef.current.focus();
                  } else if (e.key === "Escape") {
                    setShowAddProductModal(false);
                  }
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold shadow-md shadow-emerald-600/20 disabled:opacity-50 focus:outline-none focus:border-primary"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW CUSTOMER + MEMBERSHIP MODAL */}
      {showNewMembershipModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={newMembershipModalRef} className="bg-surface max-w-2xl w-full rounded-2xl shadow-2xl border border-border-soft overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center bg-amber-50">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">New Customer + Membership Enrollment</h3>
                  <p className="text-[10px] text-slate-500">Create a new customer, assign a spot, and enroll them in a membership plan</p>
                </div>
              </div>
              <button onClick={() => setShowNewMembershipModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNewMembershipSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              {newMembershipError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs font-bold text-danger">
                  {newMembershipError}
                </div>
              )}

              {/* Customer Details Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-border-soft pb-2 flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Customer Details</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priya"
                      value={newMembershipForm.first_name}
                      onChange={(e) => setNewMembershipForm({ ...newMembershipForm, first_name: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sharma"
                      value={newMembershipForm.last_name}
                      onChange={(e) => setNewMembershipForm({ ...newMembershipForm, last_name: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={newMembershipForm.phone}
                      onChange={(e) => setNewMembershipForm({ ...newMembershipForm, phone: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
                    <select
                      value={newMembershipForm.gender}
                      onChange={(e) => setNewMembershipForm({ ...newMembershipForm, gender: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="client@gmail.com"
                      value={newMembershipForm.email}
                      onChange={(e) => setNewMembershipForm({ ...newMembershipForm, email: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Assign Spot / Chair</label>
                    <input
                      type="text"
                      placeholder="e.g. Spot 1, Chair 3, Station B..."
                      value={newMembershipForm.spot}
                      onChange={(e) => setNewMembershipForm({ ...newMembershipForm, spot: e.target.value })}
                      className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Membership Plan Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-border-soft pb-2 flex items-center space-x-2">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>Membership Plan</span>
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Membership Plan *</label>
                  <select
                    required
                    value={newMembershipForm.plan_id}
                    onChange={(e) => setNewMembershipForm({ ...newMembershipForm, plan_id: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary"
                  >
                    <option value="">[ Select Membership Plan ]</option>
                    {membershipPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {formatCurrency(p.price)} ({p.duration_days} Days)
                      </option>
                    ))}
                  </select>
                  {membershipPlans.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-semibold mt-1">
                      No active membership plans found. Create plans in the Membership section first.
                    </p>
                  )}
                </div>

                {/* Free Service Perks */}
                <div className="space-y-2 border-t border-border-soft pt-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">Free Service Perks</label>
                    <button
                      type="button"
                      onClick={handleAddMembershipBenefitRow}
                      className="text-xs text-primary font-bold hover:underline flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Free Service</span>
                    </button>
                  </div>
                  {newMembershipForm.benefits.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-medium">No free service perks added. You can add them after selecting a plan.</p>
                  ) : (
                    newMembershipForm.benefits.map((row, idx) => (
                      <div key={idx} className="flex space-x-2 items-center">
                        <select
                          value={row.service_id}
                          onChange={(e) => handleMembershipBenefitChange(idx, "service_id", e.target.value)}
                          className="flex-1 bg-background border border-border-soft px-2 py-1.5 rounded text-xs focus:outline-none"
                        >
                          {membershipServices.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => handleMembershipBenefitChange(idx, "quantity", e.target.value)}
                          className="w-20 bg-background border border-border-soft px-2 py-1.5 rounded text-xs focus:outline-none"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowNewMembershipModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-xl text-xs font-bold text-slate-600 hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newMembershipSaving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {newMembershipSaving ? "Creating Customer & Assigning..." : "Create Customer & Assign Membership"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN CUSTOMER MEMBERSHIP MODAL (INSIDE BILLING) */}
      {showAssignMembershipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            ref={assignMembershipModalRef}
            className="bg-white border border-border-soft w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="py-4 px-6 border-b border-border-soft flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
                <Crown className="w-4 h-4 text-pink-600" />
                <span>Assign Customer Membership</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignMembershipModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignMembershipSubmit} className="p-6 space-y-4">
              {assignMembershipError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-xs font-bold text-danger">
                  {assignMembershipError}
                </div>
              )}

              {/* Field 1: Customer Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer *</label>
                <select
                  ref={assignCustomerSelectRef}
                  value={assignMembershipForm.customer_id}
                  onChange={(e) => setAssignMembershipForm({ ...assignMembershipForm, customer_id: e.target.value })}
                  onFocus={(e) => openNativeSelectDropdown(e.target)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "ArrowRight") {
                      e.preventDefault();
                      if (assignPlanSelectRef.current) {
                        assignPlanSelectRef.current.focus();
                        openNativeSelectDropdown(assignPlanSelectRef.current);
                      }
                    }
                  }}
                  required
                  className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition shadow-2xs"
                >
                  <option value="">Search customer by Name or Mobile...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name || ""} ({c.phone || "No Mobile"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 2: Select Membership Plan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Membership Plan *</label>
                <select
                  ref={assignPlanSelectRef}
                  value={assignMembershipForm.plan_id}
                  onChange={(e) => setAssignMembershipForm({ ...assignMembershipForm, plan_id: e.target.value })}
                  onFocus={(e) => openNativeSelectDropdown(e.target)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "ArrowRight") {
                      e.preventDefault();
                      if (assignPaymentSelectRef.current) {
                        assignPaymentSelectRef.current.focus();
                        openNativeSelectDropdown(assignPaymentSelectRef.current);
                      }
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      if (assignCustomerSelectRef.current) {
                        assignCustomerSelectRef.current.focus();
                        openNativeSelectDropdown(assignCustomerSelectRef.current);
                      }
                    }
                  }}
                  required
                  className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition shadow-2xs"
                >
                  <option value="">[ Select Membership Plan ]</option>
                  {membershipPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name || plan.plan_name} - {currencySymbol} {parseFloat(plan.price || plan.cost || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 3: Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method *</label>
                <select
                  ref={assignPaymentSelectRef}
                  value={assignMembershipForm.payment_method}
                  onChange={(e) => setAssignMembershipForm({ ...assignMembershipForm, payment_method: e.target.value })}
                  onFocus={(e) => openNativeSelectDropdown(e.target)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "ArrowRight") {
                      e.preventDefault();
                      if (assignSubmitBtnRef.current) {
                        assignSubmitBtnRef.current.focus();
                      }
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      if (assignPlanSelectRef.current) {
                        assignPlanSelectRef.current.focus();
                        openNativeSelectDropdown(assignPlanSelectRef.current);
                      }
                    }
                  }}
                  required
                  className="w-full bg-background border border-border-soft px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition shadow-2xs"
                >
                  <option value="">[ Select Payment Method ]</option>
                  {SUPPORTED_PAYMENT_METHODS.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAssignMembershipModal(false)}
                  className="px-5 py-2.5 border border-border-soft rounded-xl text-xs font-bold text-slate-600 hover:bg-background transition"
                >
                  Cancel
                </button>
                <button
                  ref={assignSubmitBtnRef}
                  type="submit"
                  disabled={assignMembershipSaving}
                  className="px-6 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-pink-600/20 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
                >
                  {assignMembershipSaving ? "Assigning..." : "Pay & Assign Membership"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERSISTENT OFF-SCREEN THERMAL RECEIPT MOUNT FOR 100% RELIABLE PRINTING */}
      <div className="printable-receipt-wrapper">
        <style>{`
          @media screen {
            .printable-receipt-wrapper {
              position: fixed;
              left: -9999px;
              top: 0;
              opacity: 0;
              pointer-events: none;
              z-index: -9999;
            }
          }
          @media print {
            .printable-receipt-wrapper {
              position: static !important;
              left: auto !important;
              top: auto !important;
              opacity: 1 !important;
              z-index: 9999 !important;
              display: block !important;
            }
          }
        `}</style>
        <ThermalReceipt
          ref={printReceiptRef}
          invoice={activePrintInvoice || invoiceResult || selectedInvoiceDetail}
          settings={receiptSettings}
          businessProfile={businessProfile}
        />
      </div>

      <AddExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
      />

      <CashDenominationModal
        isOpen={showCashDenominationModal}
        onClose={() => setShowCashDenominationModal(false)}
      />
    </div>
  );
}

export default Billing;
