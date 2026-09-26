import React, { useState } from "react";
import { Search, Tag, Sparkles, Check, Crown, Award, Plus, Trash2, Scissors, Package, Gift } from "lucide-react";
import { getFullImageUrl } from "../utils/imageUrl";

export default function TouchModeBilling({
  categories,
  services,
  products,
  cart,
  setCart,
  selectedCustomerId,
  setSelectedCustomerId,
  customerSearchQuery,
  setCustomerSearchQuery,
  isCustomerDropdownOpen,
  setIsCustomerDropdownOpen,
  customerHighlightedIndex,
  setCustomerHighlightedIndex,
  customers,
  selectedGender,
  setSelectedGender,
  activeMembership,
  visitMembershipStatus,
  useMembership,
  setUseMembership,
  handleAddServiceToCart,
  handleAddProductToCart,
  handleRemoveCartItem,
  handleQuantityChange,
  handleDiscountChange,
  handleEmployeeToggle,
  employees,
  taxRate,
  isTaxEnabled = true,
  setIsTaxEnabled = () => {},
  invoiceTaxAmount,
  setInvoiceTaxAmount,
  isTaxAmountOverridden,
  setIsTaxAmountOverridden,
  subtotal,
  totalDiscountAmount,
  totalTaxAmount,
  grandTotal,
  handleOpenPaymentModal,
  openQuickAddCustomer,
  openQuickEditCustomer,
  openCustomerHistory,
  openAssignMembershipModal,
  newlyCreatedCustomerId,
  customerComboboxRef,
  currencySymbol,
  formatCurrency,
  getEffectiveDiscountPercent = () => 0
}) {
  const [selectedTab, setSelectedTab] = useState("all");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [discountChecked, setDiscountChecked] = useState({});

  // Combine actual categories from tenant
  const categoryTabs = [
    { id: "all", name: "All Items" },
    ...categories.map((c) => ({ id: String(c.id), name: c.name })),
    { id: "products", name: "Products" }
  ];

  // Filter items based on category tab and search query
  const getFilteredItems = () => {
    let items = [];

    if (selectedTab === "products") {
      items = products.map((p) => ({
        ...p,
        itemType: "product",
        displayName: p.name,
        displayPrice: parseFloat(p.selling_price || p.price || 0),
        img: p.image_url || p.image || null,
        badge: "Product"
      }));
    } else if (selectedTab === "all") {
      const svcs = services.map((s) => ({
        ...s,
        itemType: "service",
        displayName: s.name,
        displayPrice: parseFloat(s.price || 0),
        img: s.image_url || null,
        badge: s.category_name || "Service"
      }));
      const prods = products.map((p) => ({
        ...p,
        itemType: "product",
        displayName: p.name,
        displayPrice: parseFloat(p.selling_price || p.price || 0),
        img: p.image_url || p.image || null,
        badge: "Product"
      }));
      items = [...svcs, ...prods];
    } else {
      // Filter services by category id or category name (case-insensitive)
      const catObj = categories.find((c) => String(c.id) === String(selectedTab));
      const targetCatName = catObj ? catObj.name.toLowerCase().trim() : "";

      const catServices = services.filter((s) => {
        if (String(s.category_id) === String(selectedTab)) return true;
        if (targetCatName && s.category_name && s.category_name.toLowerCase().trim() === targetCatName) return true;
        return false;
      });

      items = catServices.map((s) => ({
        ...s,
        itemType: "service",
        displayName: s.name,
        displayPrice: parseFloat(s.price || 0),
        img: s.image_url || null,
        badge: s.category_name || "Service"
      }));
    }

    if (itemSearchQuery.trim()) {
      const q = itemSearchQuery.toLowerCase().trim();
      items = items.filter((item) => {
        const nameMatch = item.displayName?.toLowerCase().includes(q);
        const priceMatch = item.displayPrice ? String(item.displayPrice).includes(q) : false;
        const badgeMatch = item.badge?.toLowerCase().includes(q);
        return nameMatch || priceMatch || badgeMatch;
      });
    }

    return items;
  };

  const filteredItems = getFilteredItems();

  const handleCardClick = (item) => {
    if (item.itemType === "product") {
      handleAddProductToCart(item.id);
    } else {
      handleAddServiceToCart(item.id);
    }
  };

  const toggleDiscountCheckbox = (itemIndex) => {
    setDiscountChecked((prev) => {
      const isChecked = !!prev[itemIndex];
      if (isChecked) {
        // Unchecked -> reset discount to 0
        handleDiscountChange(itemIndex, 0);
      }
      return { ...prev, [itemIndex]: !isChecked };
    });
  };

  // Default placeholder icon SVG data URL
  const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23ec4899' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><path d='M8 14s1.5 2 4 2 4-2 4-2'/><line x1='9' y1='9' x2='9.01' y2='9'/><line x1='15' y1='9' x2='15.01' y2='9'/></svg>";

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-140px)] min-h-[600px] overflow-hidden">
      {/* 1. LARGER PANEL (LEFT, ~65% width / col-span-8) — CATEGORY & SERVICE BROWSER */}
      <div className="col-span-12 lg:col-span-8 flex flex-col glowe-glass-card rounded-3xl p-4 border border-white/60 shadow-xl overflow-hidden bg-white/40 backdrop-blur-md">
        {/* Top Search Bar & Category Tabs Row */}
        <div className="mb-4 shrink-0 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-pink-500 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search services or products by name, price..."
              value={itemSearchQuery}
              onChange={(e) => setItemSearchQuery(e.target.value)}
              className="w-full bg-white/90 border border-pink-200/90 pl-10 pr-9 py-2 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500 shadow-xs placeholder:text-slate-400"
            />
            {itemSearchQuery && (
              <button
                type="button"
                onClick={() => setItemSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center transition"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none w-full">
            {categoryTabs.map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 flex items-center space-x-1.5 shrink-0 ${
                    isActive
                      ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/25 scale-105"
                      : "bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 shadow-xs"
                  }`}
                >
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Services & Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Sparkles className="w-12 h-12 mb-2 text-pink-300 animate-pulse" />
              <p className="text-sm font-bold">No services or products found</p>
              <p className="text-xs">Try selecting a different category tab or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={`${item.itemType}-${item.id}`}
                  onClick={() => handleCardClick(item)}
                  className="group relative flex flex-col bg-white/90 hover:bg-white rounded-2xl p-3 border border-pink-100/80 hover:border-pink-400/80 shadow-xs hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-200 text-left cursor-pointer active:scale-95 overflow-hidden"
                >
                  {/* Card Image */}
                  <div className="w-full h-24 rounded-xl overflow-hidden bg-pink-50/50 mb-2.5 relative flex items-center justify-center">
                    <img
                      src={getFullImageUrl(item.img) || DEFAULT_PLACEHOLDER}
                      alt={item.displayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = DEFAULT_PLACEHOLDER;
                      }}
                    />
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold bg-slate-900/70 backdrop-blur-md text-white px-2 py-0.5 rounded-md shadow-xs">
                      {item.badge}
                    </span>
                  </div>

                  {/* Card Name & Price */}
                  <div className="flex-1 flex flex-col justify-between">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-pink-600 transition-colors leading-snug">
                      {item.displayName}
                    </h4>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                      <span className="text-xs font-extrabold text-pink-600">
                        {formatCurrency(item.displayPrice)}
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. SMALL PANEL (RIGHT, ~35% width / col-span-4, Pinned) — CUSTOMER, SELECTIONS & BILL */}
      <div className="col-span-12 lg:col-span-4 flex flex-col glowe-glass-card rounded-3xl p-4 border border-white/80 shadow-xl overflow-hidden bg-white/70 backdrop-blur-lg">
        {/* Customer Selection Section */}
        <div className="space-y-2 mb-3 shrink-0">
          <div ref={customerComboboxRef} className="relative">
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
              <span>Select Customer</span>
              {selectedCustomerId && selectedCustomerId !== "walkin" && (
                <button
                  type="button"
                  onClick={openQuickEditCustomer}
                  className="text-[10px] text-pink-600 font-bold hover:underline"
                >
                  Edit Profile
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerSearchQuery}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value);
                  setIsCustomerDropdownOpen(true);
                  setCustomerHighlightedIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = (customerSearchQuery || "").trim().toLowerCase();
                    if (!q || q === "walk-in customer") return;
                    const filtered = customers.filter((c) => {
                      return (
                        c.first_name?.toLowerCase().includes(q) ||
                        c.last_name?.toLowerCase().includes(q) ||
                        c.phone?.includes(q)
                      );
                    });
                    if (filtered.length === 1) {
                      const c = filtered[0];
                      setSelectedCustomerId(String(c.id));
                      setCustomerSearchQuery(`${c.first_name} ${c.last_name || ""} (${c.phone})`);
                      setSelectedGender(c.gender || "");
                      setIsCustomerDropdownOpen(false);
                    } else {
                      openQuickAddCustomer(customerSearchQuery !== "Walk-in Customer" ? customerSearchQuery : "");
                      setIsCustomerDropdownOpen(false);
                    }
                  }
                }}
                placeholder="Search phone or name..."
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-pink-500 shadow-xs"
              />
              {isCustomerDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  <div
                    onClick={() => {
                      setSelectedCustomerId("walkin");
                      setCustomerSearchQuery("Walk-in Customer");
                      setIsCustomerDropdownOpen(false);
                    }}
                    className="p-2.5 text-xs font-bold text-slate-700 hover:bg-pink-50 cursor-pointer border-b border-slate-100"
                  >
                    🚶‍♂️ Walk-in Customer
                  </div>
                  {customers
                    .filter((c) => {
                      const q = customerSearchQuery.toLowerCase();
                      return (
                        c.first_name?.toLowerCase().includes(q) ||
                        c.last_name?.toLowerCase().includes(q) ||
                        c.phone?.includes(q)
                      );
                    })
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(String(c.id));
                          setCustomerSearchQuery(`${c.first_name} ${c.last_name || ""} (${c.phone})`);
                          setSelectedGender(c.gender || "");
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="p-2.5 text-xs font-medium text-slate-800 hover:bg-pink-50 cursor-pointer flex justify-between items-center"
                      >
                        <span className="font-bold">{c.first_name} {c.last_name}</span>
                        <span className="text-[10px] text-slate-500">{c.phone}</span>
                      </div>
                    ))}
                  <div
                    onClick={() => {
                      openQuickAddCustomer(customerSearchQuery !== "Walk-in Customer" ? customerSearchQuery : "");
                      setIsCustomerDropdownOpen(false);
                    }}
                    className="p-2.5 text-xs font-bold text-pink-600 hover:bg-pink-50 cursor-pointer text-center bg-pink-50/50"
                  >
                    + Add New Customer
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gender & Membership Status */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-slate-500">Gender:</span>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="">Auto / Select</option>
                <option value="Female">Female 👩</option>
                <option value="Male">Male 👨</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {selectedCustomerId && selectedCustomerId !== "walkin" && (
              <button
                type="button"
                onClick={openCustomerHistory}
                className="text-[10px] font-extrabold text-slate-600 hover:text-pink-600 underline"
              >
                View History
              </button>
            )}
          </div>

          {/* Add Membership Button (Shown ONLY when a new customer was added in this billing session) */}
          {selectedCustomerId && newlyCreatedCustomerId && String(selectedCustomerId) === String(newlyCreatedCustomerId) && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => openAssignMembershipModal && openAssignMembershipModal()}
                className="w-full text-xs bg-pink-600 hover:bg-pink-700 text-white py-1.5 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <Crown className="w-3.5 h-3.5 text-white" />
                <span>+ Add Membership</span>
              </button>
            </div>
          )}

          {/* Active Membership Status Banner (Type A % Discount - Only when mode is not visit_based/disabled) */}
          {activeMembership && visitMembershipStatus?.membership_mode !== "visit_based" && visitMembershipStatus?.membership_mode !== "disabled" && (
            <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-300/60 rounded-xl p-2 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5">
                <Crown className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-amber-900 text-[11px]">
                  {activeMembership.plan_name || activeMembership.name || "Active Membership"}
                </span>
              </div>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMembership}
                  onChange={(e) => setUseMembership(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-[10px] font-bold text-amber-900">Use</span>
              </label>
            </div>
          )}

          {/* Visit-Based Loyalty Membership Banner (Type B - Free Service Progress) */}
          {visitMembershipStatus && visitMembershipStatus.membership_mode === "visit_based" && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300/80 rounded-2xl p-2.5 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <div className="p-1 bg-emerald-600 text-white rounded-lg shadow-2xs">
                    <Gift className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-black text-emerald-950 text-xs block leading-tight">
                      Visit Loyalty: {visitMembershipStatus.current_visit_count} / {visitMembershipStatus.required_visits} Visits
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {visitMembershipStatus.is_eligible
                        ? "100% FREE Service Unlocked!"
                        : `${visitMembershipStatus.required_visits - visitMembershipStatus.current_visit_count} more visit(s) needed for FREE service`}
                    </span>
                  </div>
                </div>
                {visitMembershipStatus.is_eligible ? (
                  <span className="bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full font-extrabold shadow-xs animate-pulse">
                    🎁 FREE SERVICE ELIGIBLE!
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                    {Math.round((visitMembershipStatus.current_visit_count / visitMembershipStatus.required_visits) * 100)}%
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-emerald-200/70 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (visitMembershipStatus.current_visit_count / visitMembershipStatus.required_visits) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* BILLING LINE ITEMS TABLE (Scrollable panel) */}
        <div className="flex-1 overflow-y-auto border border-slate-200/80 rounded-2xl bg-white/80 p-2 mb-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <Scissors className="w-8 h-8 mb-1 opacity-40 text-pink-500" />
              <p className="text-xs font-bold">Cart is empty</p>
              <p className="text-[10px]">Tap services or products on the left panel to add.</p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const isDiscountEnabled = !!discountChecked[idx];

              return (
                <div
                  key={`${item.type}-${item.item_id}-${idx}`}
                  className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-2xs space-y-2"
                >
                  {/* Line 1: Item Name, Price & Delete */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 overflow-hidden">
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        item.type === "product" ? "bg-amber-100 text-amber-800" : "bg-pink-100 text-pink-800"
                      }`}>
                        {item.type === "product" ? "Product" : "Service"}
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs font-extrabold text-slate-900">
                        {formatCurrency(item.gross_amount * item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(idx)}
                        className="text-slate-400 hover:text-rose-500 transition p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Line 2: Quantity Controls & Employee Dropdown */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                    {/* Quantity controls */}
                    <div className="flex items-center space-x-1.5 border border-slate-200 rounded-lg bg-slate-50 px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, Math.max(1, item.quantity - 1))}
                        className="text-slate-600 font-bold px-1 hover:text-pink-600"
                      >
                        -
                      </button>
                      <span className="font-extrabold text-slate-800 text-xs w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, item.quantity + 1)}
                        className="text-slate-600 font-bold px-1 hover:text-pink-600"
                      >
                        +
                      </button>
                    </div>

                    {/* Employee Selection Dropdown */}
                    <select
                      data-row={idx}
                      data-field="employee"
                      value={item.employee_ids && item.employee_ids.length > 0 ? item.employee_ids[0] : ""}
                      onChange={(e) => handleEmployeeToggle(idx, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-pink-500 max-w-[150px]"
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name || emp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Line 3: Discount Checkbox & Conditional Input */}
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <label className="flex items-center space-x-1.5 cursor-pointer text-slate-600 font-bold">
                      <input
                        type="checkbox"
                        checked={isDiscountEnabled}
                        onChange={() => toggleDiscountCheckbox(idx)}
                        className="rounded text-pink-600 focus:ring-pink-500 w-3.5 h-3.5"
                      />
                      <span>Add Discount</span>
                    </label>

                    {isDiscountEnabled ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={item.discount_percent || ""}
                          onChange={(e) => handleDiscountChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-14 bg-white border border-slate-300 px-1.5 py-0.5 rounded text-xs font-bold text-center focus:outline-none focus:border-pink-500"
                        />
                        <span className="font-bold text-slate-500">%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {getEffectiveDiscountPercent(item) > 0 ? `(${getEffectiveDiscountPercent(item)}% membership)` : "0% discount"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bill Summary Totals & Proceed to Payment Button */}
        <div className="space-y-2 pt-2 border-t border-slate-200/80 shrink-0">
          <div className="space-y-1 text-xs font-bold text-slate-600 px-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-slate-800">{formatCurrency(subtotal)}</span>
            </div>
            {totalDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-{formatCurrency(totalDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-500 text-[11px]">
              <label className="flex items-center space-x-1.5 font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isTaxEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsTaxEnabled(checked);
                    if (!checked) {
                      setIsTaxAmountOverridden(false);
                      setInvoiceTaxAmount(0);
                    }
                  }}
                  className="w-3.5 h-3.5 rounded text-pink-600 focus:ring-pink-500 border-slate-300 cursor-pointer"
                />
                <span>Tax ({taxRate}%)</span>
              </label>
              <span className={`font-extrabold ${isTaxEnabled ? "text-slate-800" : "text-slate-400 line-through"}`}>
                {formatCurrency(totalTaxAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-pink-600">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Pinned Proceed to Payment Button */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={handleOpenPaymentModal}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 text-white rounded-2xl font-extrabold text-sm shadow-lg shadow-pink-500/25 transition-all duration-200 flex items-center justify-center space-x-2 active:scale-98"
          >
            <span>Proceed to Payment</span>
            <span className="text-xs opacity-80">(Ctrl+Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
