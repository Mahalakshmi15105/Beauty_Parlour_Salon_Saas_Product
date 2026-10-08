import React, { useState } from "react";
import Services from "./Services";
import Products from "./Products";
import { Scissors, Package } from "lucide-react";

function ServicesAndProducts() {
  const [activeTab, setActiveTab] = useState("services"); // "services" or "products"

  return (
    <div className="space-y-6">
      {/* Top Segmented Tab Switcher */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-surface border border-border-soft p-2 sm:p-3 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab("services")}
          className={`flex-1 sm:flex-none justify-center px-4 sm:px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            activeTab === "services"
              ? "bg-primary text-white shadow-md shadow-pink-500/20"
              : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Services Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab("products")}
          className={`flex-1 sm:flex-none justify-center px-4 sm:px-5 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
            activeTab === "products"
              ? "bg-primary text-white shadow-md shadow-pink-500/20"
              : "bg-background text-slate-700 border border-border-soft hover:bg-slate-100"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products Inventory</span>
        </button>
      </div>

      {/* Render Component View */}
      <div>
        {activeTab === "services" ? <Services /> : <Products />}
      </div>
    </div>
  );
}

export default ServicesAndProducts;
