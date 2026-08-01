import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useLanguageCurrency } from "../context/LanguageCurrencyContext";
import { useModalFocusTrap, useFormKeyboardNavigation } from "../utils/keyboardNavigation";
import { AlertTriangle, X, Printer, FileSpreadsheet, FileText, Boxes, Users, ClipboardList, Plus, Trash2, Edit, CheckCircle } from "lucide-react";
import { exportToCSV, printDataList, exportToPDF } from "../utils/exportUtils";

function Products() {
  const { formatCurrency, currencySymbol } = useLanguageCurrency();
  const modalRef = useRef(null);
  const formRef = useRef(null);
  const reorderModalRef = useRef(null);
  const supplierModalRef = useRef(null);
  const supplierFormRef = useRef(null);

  // Tabs: "catalog", "reorders", "suppliers"
  const [activeTab, setActiveTab] = useState("catalog");

  // Products State
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Reorder Transaction History State
  const [reorderLogs, setReorderLogs] = useState([]);
  const [reorderLogsLoading, setReorderLogsLoading] = useState(false);

  // Product Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    sku: "",
    barcode: "",
    cost_price: "",
    selling_price: "",
    mrp: "",
    stock_quantity: "",
    low_stock_threshold: "5",
    status: "active",
  });

  // Reorder Modal State
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderProduct, setReorderProduct] = useState(null);
  const [reorderQty, setReorderQty] = useState(30);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Suppliers Directory State
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);
  const [supplierFormData, setSupplierFormData] = useState({
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    status: "active",
  });

  // Focus traps and form keyboard nav
  useModalFocusTrap(showModal, modalRef, () => setShowModal(false));
  useModalFocusTrap(showReorderModal, reorderModalRef, () => setShowReorderModal(false));
  useModalFocusTrap(showSupplierModal, supplierModalRef, () => setShowSupplierModal(false));

  useFormKeyboardNavigation(formRef, () => {
    const submitBtn = modalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  useFormKeyboardNavigation(supplierFormRef, () => {
    const submitBtn = supplierModalRef.current?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  // Fetch functions
  const fetchProducts = (currentCursor = null) => {
    setLoading(true);
    let url = `/products?limit=25`;
    if (currentCursor) url += `&cursor=${currentCursor}`;
    if (search) url += `&q=${search}`;
    if (category) url += `&category=${category}`;
    // Show only low stock if checkbox is ticked or if showLowStockOnly is active
    if (showLowStockOnly) url += `&low_stock=true`;

    API.get(url)
      .then((res) => {
        setProducts(res.data?.items || []);
        setNextCursor(res.data?.next_cursor || null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load products.");
        setLoading(false);
      });
  };

  const fetchSuppliers = () => {
    setSuppliersLoading(true);
    API.get("/suppliers")
      .then((res) => {
        setSuppliers(res.data || []);
        setSuppliersLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load suppliers:", err);
        setSuppliersLoading(false);
      });
  };

  const fetchReorderLogs = () => {
    setReorderLogsLoading(true);
    API.get("/reorders")
      .then((res) => {
        setReorderLogs(res.data || []);
        setReorderLogsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load reorder logs:", err);
        setReorderLogsLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, [search, category, showLowStockOnly, activeTab]);

  useEffect(() => {
    fetchSuppliers();
    fetchReorderLogs();
  }, []);

  // Pagination Handlers
  const handleNextPage = () => {
    if (nextCursor) {
      setCursorHistory([...cursorHistory, cursor]);
      setCursor(nextCursor);
      fetchProducts(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prev = cursorHistory[cursorHistory.length - 1];
      const newHistory = cursorHistory.slice(0, -1);
      setCursorHistory(newHistory);
      setCursor(prev);
      fetchProducts(prev);
    }
  };

  // Product CRUD
  const openAddModal = () => {
    setEditId(null);
    setFormData({
      name: "",
      category: "",
      sku: "",
      barcode: "",
      cost_price: "",
      selling_price: "",
      mrp: "",
      stock_quantity: "",
      low_stock_threshold: "5",
      status: "active",
    });
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditId(p.id);
    setFormData({
      name: p.name || "",
      category: p.category || "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      cost_price: p.cost_price || "",
      selling_price: p.selling_price || "",
      mrp: p.mrp || "",
      stock_quantity: p.stock_quantity || "",
      low_stock_threshold: p.low_stock_threshold || "5",
      status: p.status || "active",
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const action = editId ? API.put(`/products/${editId}`, formData) : API.post("/products", formData);
    action
      .then(() => {
        setShowModal(false);
        fetchProducts(cursor);
      })
      .catch((err) => {
        alert(err.message || "Operation failed.");
      });
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      API.delete(`/products/${id}`)
        .then(() => {
          fetchProducts(cursor);
        })
        .catch((err) => {
          alert(err.message || "Failed to delete.");
        });
    }
  };

  // Suppliers CRUD
  const openAddSupplierModal = () => {
    setEditSupplierId(null);
    setSupplierFormData({
      name: "",
      contact_name: "",
      phone: "",
      email: "",
      address: "",
      status: "active",
    });
    setShowSupplierModal(true);
  };

  const openEditSupplierModal = (sup) => {
    setEditSupplierId(sup.id);
    setSupplierFormData({
      name: sup.name || "",
      contact_name: sup.contact_name || "",
      phone: sup.phone || "",
      email: sup.email || "",
      address: sup.address || "",
      status: sup.status || "active",
    });
    setShowSupplierModal(true);
  };

  const handleSupplierSubmit = (e) => {
    e.preventDefault();
    const action = editSupplierId ? API.put(`/suppliers/${editSupplierId}`, supplierFormData) : API.post("/suppliers", supplierFormData);
    action
      .then(() => {
        setShowSupplierModal(false);
        fetchSuppliers();
      })
      .catch((err) => {
        alert(err.response?.data?.message || err.message || "Failed to save supplier.");
      });
  };

  const handleSupplierDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      API.delete(`/suppliers/${id}`)
        .then(() => {
          fetchSuppliers();
        })
        .catch((err) => {
          alert(err.message || "Failed to delete.");
        });
    }
  };

  // Restock Order WhatsApp Link & Record Logger
  const handleOpenReorder = (p) => {
    setReorderProduct(p);
    setReorderQty(30);
    setCopiedMessage(false);
    
    // Default to the first active supplier if available
    if (suppliers.length > 0) {
      setSelectedSupplierId(suppliers[0].id.toString());
      setSupplierPhone(suppliers[0].phone);
    } else {
      setSelectedSupplierId("");
      setSupplierPhone("");
    }
    
    setShowReorderModal(true);
  };

  const handleSupplierChange = (id) => {
    setSelectedSupplierId(id);
    if (id === "") {
      setSupplierPhone("");
    } else {
      const s = suppliers.find(sup => sup.id.toString() === id);
      if (s) {
        setSupplierPhone(s.phone);
      }
    }
  };

  const handleSavePurchaseRecord = (whatsAppSent = false) => {
    if (!reorderProduct) return;

    API.post("/reorders", {
      product_id: reorderProduct.id,
      quantity: reorderQty,
      supplier_id: selectedSupplierId || null,
      notes: whatsAppSent ? "Restock ordered and notified via WhatsApp." : "Manual restock catalog update."
    })
      .then((res) => {
        setShowReorderModal(false);
        // Refresh products list to show new stock level
        fetchProducts(cursor);
        // Refresh reorders log ledger
        fetchReorderLogs();
      })
      .catch((err) => {
        alert(err.response?.data?.message || err.message || "Failed to save restock transaction.");
      });
  };

  // Export handlers for Products (Catalog / Reorders)
  const handlePrint = () => {
    const columns = [
      { header: "Product Name", accessor: "name" },
      { header: "Category", accessor: "category" },
      { header: "SKU", accessor: "sku" },
      { header: "Barcode", accessor: "barcode" },
      { header: "Purchase Price", accessor: (row) => `${currencySymbol}${parseFloat(row.cost_price || 0).toFixed(2)}` },
      { header: "Selling Price", accessor: (row) => `${currencySymbol}${parseFloat(row.selling_price || 0).toFixed(2)}` },
      { header: "MRP", accessor: (row) => `${currencySymbol}${parseFloat(row.mrp || 0).toFixed(2)}` },
      { header: "Stock", accessor: "stock_quantity" },
      { header: "Threshold", accessor: "low_stock_threshold" },
      { header: "Status", accessor: "status" }
    ];
    printDataList(activeTab === "reorders" ? "Low Stock & Reorders Report" : "Products & Inventory Catalog", products, columns);
  };

  const handleExportExcel = () => {
    const columns = [
      { header: "Product Name", accessor: "name" },
      { header: "Category", accessor: "category" },
      { header: "SKU", accessor: "sku" },
      { header: "Barcode", accessor: "barcode" },
      { header: "Purchase Price", accessor: (row) => `${currencySymbol}${parseFloat(row.cost_price || 0).toFixed(2)}` },
      { header: "Selling Price", accessor: (row) => `${currencySymbol}${parseFloat(row.selling_price || 0).toFixed(2)}` },
      { header: "MRP", accessor: (row) => `${currencySymbol}${parseFloat(row.mrp || 0).toFixed(2)}` },
      { header: "Stock", accessor: "stock_quantity" },
      { header: "Threshold", accessor: "low_stock_threshold" },
      { header: "Status", accessor: "status" }
    ];
    exportToCSV(products, columns, activeTab === "reorders" ? "reorders_report" : "products_catalog");
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "Product Name", accessor: "name", width: 40 },
      { header: "Category", accessor: "category", width: 25 },
      { header: "SKU", accessor: "sku", width: 20 },
      { header: "Purchase Price", accessor: (row) => `${currencySymbol}${parseFloat(row.cost_price || 0).toFixed(2)}`, width: 20 },
      { header: "Selling Price", accessor: (row) => `${currencySymbol}${parseFloat(row.selling_price || 0).toFixed(2)}`, width: 20 },
      { header: "MRP", accessor: (row) => `${currencySymbol}${parseFloat(row.mrp || 0).toFixed(2)}`, width: 20 },
      { header: "Stock", accessor: (row) => String(row.stock_quantity || 0), width: 15 },
      { header: "Threshold", accessor: (row) => String(row.low_stock_threshold || 5), width: 15 },
      { header: "Status", accessor: "status", width: 15 }
    ];
    exportToPDF(activeTab === "reorders" ? "Low Stock & Reorders Report" : "Products & Inventory Catalog", products, columns, activeTab === "reorders" ? "reorders_report" : "products_catalog");
  };

  // Export handlers for Reorder History Logs
  const handlePrintReorderHistory = () => {
    const columns = [
      { header: "Date", accessor: (row) => new Date(row.created_at).toLocaleDateString() },
      { header: "Product", accessor: "product_name" },
      { header: "Supplier", accessor: "supplier_name" },
      { header: "Qty Added", accessor: "quantity" },
      { header: "Cost Price", accessor: (row) => `${currencySymbol}${parseFloat(row.cost_price || 0).toFixed(2)}` },
      { header: "Total Cost", accessor: (row) => `${currencySymbol}${parseFloat(row.total_price || 0).toFixed(2)}` },
      { header: "Status", accessor: "status" }
    ];
    printDataList("Restock Procurement History Log", reorderLogs, columns);
  };

  const handleExportExcelReorderHistory = () => {
    const columns = [
      { header: "Date", accessor: (row) => new Date(row.created_at).toLocaleDateString() },
      { header: "Product", accessor: "product_name" },
      { header: "Supplier", accessor: "supplier_name" },
      { header: "Qty Added", accessor: "quantity" },
      { header: "Cost Price", accessor: (row) => `${currencySymbol}${parseFloat(row.cost_price || 0).toFixed(2)}` },
      { header: "Total Cost", accessor: (row) => `${currencySymbol}${parseFloat(row.total_price || 0).toFixed(2)}` },
      { header: "Status", accessor: "status" }
    ];
    exportToCSV(reorderLogs, columns, "restock_history");
  };

  // Export handlers for Suppliers Directory
  const handlePrintSuppliers = () => {
    const columns = [
      { header: "Supplier Name", accessor: "name" },
      { header: "Contact Person", accessor: "contact_name" },
      { header: "Phone/WhatsApp", accessor: "phone" },
      { header: "Email Address", accessor: "email" },
      { header: "Office Address", accessor: "address" },
      { header: "Status", accessor: "status" }
    ];
    printDataList("Suppliers Directory", suppliers, columns);
  };

  const handleExportExcelSuppliers = () => {
    const columns = [
      { header: "Supplier Name", accessor: "name" },
      { header: "Contact Person", accessor: "contact_name" },
      { header: "Phone/WhatsApp", accessor: "phone" },
      { header: "Email Address", accessor: "email" },
      { header: "Office Address", accessor: "address" },
      { header: "Status", accessor: "status" }
    ];
    exportToCSV(suppliers, columns, "suppliers_directory");
  };

  const handleExportPDFSuppliers = () => {
    const columns = [
      { header: "Supplier Name", accessor: "name", width: 40 },
      { header: "Contact Person", accessor: "contact_name", width: 35 },
      { header: "Phone", accessor: "phone", width: 30 },
      { header: "Email Address", accessor: "email", width: 45 },
      { header: "Address", accessor: "address", width: 35 }
    ];
    exportToPDF("Suppliers Directory", suppliers, columns, "suppliers_directory");
  };

  // Compute unique categories from current items for filtering list
  const categoriesList = [...new Set(products.map((p) => p.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Inventory & Supplier Module</h1>
          <p className="text-xs text-text-secondary">Track retail stock levels, purchase history ledger, and coordinate supplier order transactions.</p>
        </div>
        <div className="flex space-x-3">
          {activeTab === "suppliers" ? (
            <button
              onClick={openAddSupplierModal}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          ) : (
            <button
              onClick={openAddModal}
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Segmented Tab Switcher */}
      <div className="flex space-x-2 bg-surface border border-border-soft p-3 rounded-2xl shadow-xs">
        <button
          onClick={() => {
            setActiveTab("catalog");
            setShowLowStockOnly(false);
          }}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            activeTab === "catalog"
              ? "bg-primary text-white shadow-md shadow-pink-500/20"
              : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Inventory Catalog</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("reorders");
            setShowLowStockOnly(false);
          }}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            activeTab === "reorders"
              ? "bg-primary text-white shadow-md shadow-pink-500/20"
              : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Stock Alerts & Reorders</span>
        </button>

        <button
          onClick={() => setActiveTab("suppliers")}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            activeTab === "suppliers"
              ? "bg-primary text-white shadow-md shadow-pink-500/20"
              : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Supplier Directory</span>
        </button>
      </div>

      {activeTab === "suppliers" ? (
        // Suppliers Directory Tab
        <>
          <div className="bg-surface border border-border-soft p-4 rounded-lg flex justify-between items-center">
            <span className="text-sm font-semibold text-text-primary">Suppliers List ({suppliers.length})</span>
            <div className="flex space-x-2">
              <button
                onClick={handlePrintSuppliers}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-200"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={handleExportExcelSuppliers}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-emerald-200"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                onClick={handleExportPDFSuppliers}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-rose-200"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          <div className="bg-surface border border-border-soft rounded-lg overflow-hidden">
            {suppliersLoading ? (
              <div className="p-8 space-y-4">
                <div className="h-6 bg-border-soft rounded animate-pulse w-1/4"></div>
                <div className="h-10 bg-border-soft rounded animate-pulse"></div>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="p-16 text-center text-xs text-text-secondary">
                No active suppliers found in directory. Click "+ Add Supplier" to create one.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary-light border-b border-border-soft">
                    <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Supplier Name</th>
                    <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Contact Name</th>
                    <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Phone/WhatsApp</th>
                    <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Email</th>
                    <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Address</th>
                    <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-background/50 transition">
                      <td className="px-6 py-4 text-sm font-semibold text-text-primary">{s.name}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{s.contact_name || "—"}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{s.phone}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{s.email || "—"}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary truncate max-w-xs">{s.address || "—"}</td>
                      <td className="px-6 py-4 text-sm space-x-3 text-right">
                        <button onClick={() => openEditSupplierModal(s)} className="text-primary hover:underline">
                          <Edit className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleSupplierDelete(s.id)} className="text-danger hover:underline">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        // Inventory Catalog or Stock Alerts & Reorders Tab
        <>
          {/* Filter / Search Bar */}
          <div className="bg-surface border border-border-soft p-4 rounded-lg flex space-x-4 items-center">
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-background border border-border-soft px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-background border border-border-soft px-4 py-2 rounded-lg text-sm text-text-secondary focus:outline-none"
            >
              <option value="">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <label className="flex items-center space-x-2 bg-background border border-border-soft px-4 py-2 rounded-lg text-sm text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
                className="w-4 h-4 text-primary focus:ring-primary border-border-soft rounded"
              />
              <span className="font-semibold text-xs text-rose-600 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock Only</span>
              </span>
            </label>

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
            ) : products.length === 0 ? (
              activeTab === "reorders" ? (
                <div className="p-16 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/15 text-success mb-3">
                    <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-text-primary mb-1">All Products Fully Stocked!</h4>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    No items have fallen below their minimum stock thresholds. Your inventory is healthy and no reorders are currently required.
                  </p>
                  <p className="text-[10px] text-primary mt-2 font-semibold">
                    Tip: Uncheck the "Low Stock Only" filter above to see all items and log manual restock records!
                  </p>
                </div>
              ) : (
                <div className="p-16 text-center text-xs text-text-secondary">
                  No products found matching criteria.
                </div>
              )
            ) : (
              <>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-primary-light border-b border-border-soft">
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Product Details</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">SKU / Barcode</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Purchase Price</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-center">MRP</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-center">Selling Price</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-center">Stock Level</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {products.map((p) => {
                      const isLowStock = p.stock_quantity <= p.low_stock_threshold;
                      return (
                        <tr key={p.id} className={`hover:bg-background/50 transition ${isLowStock ? "bg-rose-50/20" : ""}`}>
                          <td className="px-6 py-4 text-sm font-medium text-text-primary">
                            <div>
                              <p className="font-semibold">{p.name}</p>
                              <p className="text-xs text-text-secondary mt-0.5">{p.category || "Uncategorized"}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-text-secondary">
                            <p>SKU: {p.sku || "—"}</p>
                            <p className="mt-0.5">Barcode: {p.barcode || "—"}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary">
                            {formatCurrency(p.cost_price)}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-primary font-bold text-center">
                            {formatCurrency(p.mrp)}
                          </td>
                          <td className="px-6 py-4 text-sm text-text-secondary text-center">
                            {formatCurrency(p.selling_price)}
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                isLowStock ? "bg-danger/15 text-danger animate-pulse" : "bg-success/15 text-success"
                              }`}>
                                {p.stock_quantity} units
                              </span>
                              <span className="text-[10px] text-text-secondary mt-0.5">Limit: {p.low_stock_threshold}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-right space-x-3">
                            <button
                              onClick={() => handleOpenReorder(p)}
                              className={`px-3 py-1 rounded text-xs font-bold transition inline-flex items-center space-x-1 ${
                                isLowStock ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                              }`}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Restock</span>
                            </button>
                            <button onClick={() => openEditModal(p)} className="text-primary hover:underline font-medium text-xs">Edit</button>
                            <button onClick={() => handleDelete(p.id)} className="text-danger hover:underline font-medium text-xs">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
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

          {/* Reorders history ledger table (only show in the reorders tab) */}
          {activeTab === "reorders" && (
            <div className="bg-surface border border-border-soft rounded-lg overflow-hidden mt-8 shadow-xs">
              <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Procurement & Restock Transaction History Ledger</h3>
                  <p className="text-[11px] text-text-secondary">Audit history logs of stock entries, WhatsApp purchase orders, and warehouse shipments.</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handlePrintReorderHistory}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-200"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Ledger</span>
                  </button>
                  <button
                    onClick={handleExportExcelReorderHistory}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-emerald-200"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel Ledger</span>
                  </button>
                </div>
              </div>
              
              {reorderLogsLoading ? (
                <div className="p-8 text-center text-xs text-text-secondary">Loading history logs...</div>
              ) : reorderLogs.length === 0 ? (
                <div className="p-12 text-center text-xs text-text-secondary">
                  No restock transactions have been recorded yet. Click the "Restock" button above on any product to register one.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-border-soft">
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Date & Time</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Product Details</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Supplier</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-center">Qty Added</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Cost Price</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Total Outlay</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {reorderLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-background/30 transition">
                        <td className="px-6 py-4 text-xs text-text-secondary">
                          {new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-text-primary">{log.product_name}</td>
                        <td className="px-6 py-4 text-xs text-text-secondary">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200/50">
                            {log.supplier_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-center text-primary">+{log.quantity}</td>
                        <td className="px-6 py-4 text-sm text-text-secondary text-right">{formatCurrency(log.cost_price)}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-text-primary text-right">{formatCurrency(log.total_price)}</td>
                        <td className="px-6 py-4 text-xs text-center">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-extrabold uppercase tracking-wider text-[10px]">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Product Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={modalRef} className="bg-surface max-w-lg w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">
                {editId ? "Edit Product Details" : "Create New Product"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Shampoos"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Purchase Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">MRP ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Selling Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    required
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
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
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Add/Edit Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={supplierModalRef} className="bg-surface max-w-lg w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary">
                {editSupplierId ? "Edit Supplier Settings" : "Register New Supplier"}
              </h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={supplierFormRef} onSubmit={handleSupplierSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Loreal India Pvt Ltd"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={supplierFormData.contact_name}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_name: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Phone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 919876543210"
                    value={supplierFormData.phone}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. sales@loreal.in"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
                  <select
                    value={supplierFormData.status}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, status: e.target.value })}
                    className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Office / Warehouse Address</label>
                <textarea
                  rows="2"
                  placeholder="Street details, City, Pin Code"
                  value={supplierFormData.address}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-border-soft flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 border border-border-soft rounded-lg text-sm text-text-secondary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock/Reorder Modal */}
      {showReorderModal && reorderProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div ref={reorderModalRef} className="bg-surface max-w-md w-full rounded-lg shadow-lg border border-border-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border-soft flex justify-between items-center">
              <h3 className="text-md font-semibold text-text-primary flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Procurement Purchase Order</span>
              </h3>
              <button onClick={() => setShowReorderModal(false)} className="text-text-secondary hover:text-text-primary p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs space-y-1">
                <p className="font-bold text-amber-900">Product: {reorderProduct.name}</p>
                <p className="text-amber-800">SKU Code: {reorderProduct.sku || "N/A"}</p>
                <p className="text-amber-800">Current Stock: <span className="font-bold text-rose-600">{reorderProduct.stock_quantity}</span> (Threshold: {reorderProduct.low_stock_threshold})</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Select Supplier from Directory</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                >
                  <option value="">[ Custom WhatsApp Number ]</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id.toString()}>{s.name} ({s.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Restock Order Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={reorderQty}
                  onChange={(e) => setReorderQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">WhatsApp / Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 919876543210"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="w-full bg-background border border-border-soft px-3 py-2 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Purchase Order Message Preview</label>
                <textarea
                  readOnly
                  rows={6}
                  value={`Hello Supplier,\n\nWe need to place a restock order for the following item:\n- Product: ${reorderProduct.name}\n- SKU: ${reorderProduct.sku || "N/A"}\n- Current Stock: ${reorderProduct.stock_quantity}\n- Order Quantity: ${reorderQty} units\n\nPlease confirm availability and billing details.\n\nBest regards,\nSalon Official`}
                  className="w-full bg-background/50 border border-border-soft p-3 rounded-lg text-xs font-mono text-slate-700 focus:outline-none"
                />
              </div>

              {copiedMessage && (
                <p className="text-xs font-semibold text-success text-center">✓ Message copied to clipboard!</p>
              )}

              <div className="pt-4 border-t border-border-soft flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleSavePurchaseRecord(false)}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Confirm Restock (Save Entry)
                </button>
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Hello Supplier,\n\nWe need to place a restock order for the following item:\n- Product: ${reorderProduct.name}\n- SKU: ${reorderProduct.sku || "N/A"}\n- Current Stock: ${reorderProduct.stock_quantity}\n- Order Quantity: ${reorderQty} units\n\nPlease confirm availability and billing details.\n\nBest regards,\nSalon Official`;
                      navigator.clipboard.writeText(text);
                      setCopiedMessage(true);
                      setTimeout(() => setCopiedMessage(false), 3000);
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                  >
                    Copy Note
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Hello Supplier,\n\nWe need to place a restock order for the following item:\n- Product: ${reorderProduct.name}\n- SKU: ${reorderProduct.sku || "N/A"}\n- Current Stock: ${reorderProduct.stock_quantity}\n- Order Quantity: ${reorderQty} units\n\nPlease confirm availability and billing details.\n\nBest regards,\nSalon Official`;
                      const cleanPhone = supplierPhone.replace(/[^0-9]/g, "");
                      const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                      window.open(`https://wa.me/${targetPhone || ""}?text=${encodeURIComponent(text)}`, "_blank");
                      
                      // Also save the transaction log record
                      handleSavePurchaseRecord(true);
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"
                  >
                    Order on WA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
