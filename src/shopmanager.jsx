const { useState, useEffect, useRef } = React;

// ─── Seed Data ───────────────────────────────────────────────────────────────
const SEED_PRODUCTS = [
  { id: 1, name: "Classic Sneaker", sku: "SNK-001", category: "Footwear", costPrice: 25, sellPrice: 59.99, stock: 42, lowStockAlert: 10 },
  { id: 2, name: "Running Shoe Pro", sku: "SNK-002", category: "Footwear", costPrice: 38, sellPrice: 89.99, stock: 18, lowStockAlert: 8 },
  { id: 3, name: "Leather Belt", sku: "ACC-001", category: "Accessories", costPrice: 8, sellPrice: 24.99, stock: 5, lowStockAlert: 6 },
  { id: 4, name: "Cotton T-Shirt", sku: "CLT-001", category: "Clothing", costPrice: 7, sellPrice: 19.99, stock: 60, lowStockAlert: 15 },
  { id: 5, name: "Denim Jeans", sku: "CLT-002", category: "Clothing", costPrice: 22, sellPrice: 54.99, stock: 3, lowStockAlert: 5 },
];

const SEED_SALES = [
  { id: 1, date: "2026-05-20", productId: 1, productName: "Classic Sneaker", qty: 3, unitPrice: 59.99, total: 179.97, customer: "Maria Santos" },
  { id: 2, date: "2026-05-21", productId: 2, productName: "Running Shoe Pro", qty: 1, unitPrice: 89.99, total: 89.99, customer: "João Silva" },
  { id: 3, date: "2026-05-22", productId: 4, productName: "Cotton T-Shirt", qty: 5, unitPrice: 19.99, total: 99.95, customer: "Ana Lima" },
  { id: 4, date: "2026-05-23", productId: 1, productName: "Classic Sneaker", qty: 2, unitPrice: 59.99, total: 119.98, customer: "Carlos Melo" },
  { id: 5, date: "2026-05-25", productId: 3, productName: "Leather Belt", qty: 2, unitPrice: 24.99, total: 49.98, customer: "Sofia Rocha" },
  { id: 6, date: "2026-05-26", productId: 5, productName: "Denim Jeans", qty: 1, unitPrice: 54.99, total: 54.99, customer: "Pedro Costa" },
];

const SEED_PURCHASES = [
  { id: 1, date: "2026-05-15", productId: 1, productName: "Classic Sneaker", qty: 20, unitCost: 25, total: 500, supplier: "Global Supply Co." },
  { id: 2, date: "2026-05-16", productId: 2, productName: "Running Shoe Pro", qty: 10, unitCost: 38, total: 380, supplier: "Sport Imports Ltd." },
  { id: 3, date: "2026-05-18", productId: 4, productName: "Cotton T-Shirt", qty: 30, unitCost: 7, total: 210, supplier: "Textile Hub" },
];

const CATEGORIES = ["Footwear", "Clothing", "Accessories", "Electronics", "Food & Beverage", "Home & Living", "Sports", "Beauty", "Other"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n).toFixed(2)}`;
const today = () => new Date().toISOString().split("T")[0];
const uid = () => Date.now() + Math.floor(Math.random() * 1000);

// ─── Mini Components ─────────────────────────────────────────────────────────
const Badge = ({ children, color = "indigo" }) => {
  const map = {
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${map[color]}`}>
      {children}
    </span>
  );
};

const StatCard = ({ icon, label, value, sub, accent }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 bg-white shadow-sm border border-slate-100`}>
    <div className={`absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-10 ${accent}`} />
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <span className={`text-2xl p-2 rounded-xl ${accent} bg-opacity-10`}>{icon}</span>
    </div>
  </div>
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
      <h2 className="text-lg font-bold text-slate-800 mb-5">{title}</h2>
      {children}
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>}
    <input
      {...props}
      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
    />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>}
    <select
      {...props}
      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
    >
      {children}
    </select>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", small, className = "" }) => {
  const base = "font-semibold rounded-xl transition-all duration-150 cursor-pointer";
  const size = small ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
    ghost: "bg-slate-100 text-slate-600 hover:bg-slate-200",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
  };
  return (
    <button onClick={onClick} className={`${base} ${size} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color = "#6366f1" }) => {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 30 - (v / max) * 28;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="w-full h-8" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
function ShopManager() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [sales, setSales] = useState(SEED_SALES);
  const [purchases, setPurchases] = useState(SEED_PURCHASES);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [storeName, setStoreName] = useState("My Shop");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Derived stats ──
  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
  const totalCost = purchases.reduce((s, x) => s + x.total, 0);
  const totalProfit = sales.reduce((s, x) => {
    const p = products.find(pr => pr.id === x.productId);
    return s + (p ? (x.unitPrice - p.costPrice) * x.qty : 0);
  }, 0);
  const lowStock = products.filter(p => p.stock <= p.lowStockAlert);
  const totalInventoryValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);

  // ── Weekly sales for sparkline ──
  const weeklyRevenue = [120, 190, 85, 240, 175, 310, totalRevenue % 300 + 50];

  // ─── ADD PRODUCT ──────────────────────────────────────────────────────────
  const ProductForm = ({ existing, onSave }) => {
    const [form, setForm] = useState(existing || { name: "", sku: "", category: "Footwear", costPrice: "", sellPrice: "", stock: "", lowStockAlert: 10 });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Product Name" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. White Sneaker" />
          <Input label="SKU" value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="e.g. SNK-001" />
        </div>
        <Select label="Category" value={form.category} onChange={e => set("category", e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Cost Price ($)" type="number" value={form.costPrice} onChange={e => set("costPrice", e.target.value)} />
          <Input label="Sell Price ($)" type="number" value={form.sellPrice} onChange={e => set("sellPrice", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Initial Stock" type="number" value={form.stock} onChange={e => set("stock", e.target.value)} />
          <Input label="Low Stock Alert" type="number" value={form.lowStockAlert} onChange={e => set("lowStockAlert", e.target.value)} />
        </div>
        <Btn onClick={() => {
          if (!form.name || !form.sku) return showToast("Name & SKU required", "error");
          onSave({ ...form, id: existing?.id || uid(), costPrice: +form.costPrice, sellPrice: +form.sellPrice, stock: +form.stock, lowStockAlert: +form.lowStockAlert });
        }}>
          {existing ? "Update Product" : "Add Product"}
        </Btn>
      </div>
    );
  };

  // ─── RECORD SALE ──────────────────────────────────────────────────────────
  const SaleForm = ({ onSave }) => {
    const [form, setForm] = useState({ productId: products[0]?.id || "", qty: 1, customer: "", date: today() });
    const prod = products.find(p => p.id === +form.productId);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
      <div className="space-y-3">
        <Select label="Product" value={form.productId} onChange={e => set("productId", e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} — Stock: {p.stock}</option>)}
        </Select>
        {prod && (
          <div className="bg-indigo-50 rounded-xl px-4 py-3 text-sm">
            <span className="text-slate-500">Unit Price: </span>
            <strong className="text-indigo-700">{fmt(prod.sellPrice)}</strong>
            <span className="mx-3 text-slate-300">|</span>
            <span className="text-slate-500">Available: </span>
            <strong className="text-slate-700">{prod.stock} units</strong>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" min="1" max={prod?.stock} value={form.qty} onChange={e => set("qty", e.target.value)} />
          <Input label="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
        <Input label="Customer Name (optional)" value={form.customer} onChange={e => set("customer", e.target.value)} placeholder="Walk-in Customer" />
        {prod && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-700">
            Total: {fmt(prod.sellPrice * +form.qty)}
          </div>
        )}
        <Btn variant="success" onClick={() => {
          if (!prod || +form.qty < 1) return showToast("Select product & quantity", "error");
          if (+form.qty > prod.stock) return showToast("Insufficient stock!", "error");
          onSave({ id: uid(), date: form.date, productId: prod.id, productName: prod.name, qty: +form.qty, unitPrice: prod.sellPrice, total: prod.sellPrice * +form.qty, customer: form.customer || "Walk-in" });
        }}>
          ✓ Record Sale
        </Btn>
      </div>
    );
  };

  // ─── RECORD PURCHASE ─────────────────────────────────────────────────────
  const PurchaseForm = ({ onSave }) => {
    const [form, setForm] = useState({ productId: products[0]?.id || "", qty: 1, unitCost: "", supplier: "", date: today() });
    const prod = products.find(p => p.id === +form.productId);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
      <div className="space-y-3">
        <Select label="Product" value={form.productId} onChange={e => {
          const p = products.find(pr => pr.id === +e.target.value);
          setForm(f => ({ ...f, productId: e.target.value, unitCost: p?.costPrice || "" }));
        }}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" min="1" value={form.qty} onChange={e => set("qty", e.target.value)} />
          <Input label="Unit Cost ($)" type="number" value={form.unitCost} onChange={e => set("unitCost", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Supplier" value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="Supplier name" />
          <Input label="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
        {form.qty && form.unitCost && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm font-semibold text-blue-700">
            Total Cost: {fmt(+form.qty * +form.unitCost)}
          </div>
        )}
        <Btn onClick={() => {
          if (!prod || !form.qty || !form.unitCost) return showToast("Fill all required fields", "error");
          onSave({ id: uid(), date: form.date, productId: prod.id, productName: prod.name, qty: +form.qty, unitCost: +form.unitCost, total: +form.qty * +form.unitCost, supplier: form.supplier || "Unknown" });
        }}>
          ✓ Record Purchase
        </Btn>
      </div>
    );
  };

  // ─── VIEWS ────────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="💰" label="Total Revenue" value={fmt(totalRevenue)} sub={`${sales.length} sales`} accent="bg-indigo-500" />
        <StatCard icon="📈" label="Net Profit" value={fmt(totalProfit)} sub="Estimated" accent="bg-emerald-500" />
        <StatCard icon="📦" label="Inventory Value" value={fmt(totalInventoryValue)} sub={`${products.length} products`} accent="bg-amber-500" />
        <StatCard icon="⚠️" label="Low Stock" value={lowStock.length} sub="items need restock" accent="bg-red-500" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-700 text-sm">Revenue Trend (7 days)</h3>
          <Badge color="indigo">{fmt(totalRevenue)} total</Badge>
        </div>
        <Sparkline data={weeklyRevenue} />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d}>{d}</span>)}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Recent Sales */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm mb-3">Recent Sales</h3>
          <div className="space-y-2">
            {sales.slice(-4).reverse().map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-slate-700 text-xs">{s.productName}</p>
                  <p className="text-[11px] text-slate-400">{s.customer} · {s.date}</p>
                </div>
                <span className="font-bold text-emerald-600 text-xs">{fmt(s.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm mb-3">⚠️ Low Stock Alerts</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-400">All products are well-stocked ✓</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700 text-xs">{p.name}</p>
                    <p className="text-[11px] text-slate-400">{p.sku}</p>
                  </div>
                  <Badge color={p.stock === 0 ? "red" : "amber"}>{p.stock} left</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-700 text-sm mb-4">Top Products by Revenue</h3>
        <div className="space-y-3">
          {products.map(p => {
            const rev = sales.filter(s => s.productId === p.id).reduce((a, s) => a + s.total, 0);
            const pct = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0;
            return (
              <div key={p.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">{p.name}</span>
                  <span className="text-slate-400">{fmt(rev)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const Inventory = () => {
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap items-center">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <Btn onClick={() => setModal("addProduct")}>+ Add Product</Btn>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Product", "SKU", "Category", "Cost", "Price", "Stock", "Margin", ""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const margin = ((p.sellPrice - p.costPrice) / p.sellPrice * 100).toFixed(0);
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{p.sku}</td>
                      <td className="px-4 py-3"><Badge color="slate">{p.category}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{fmt(p.costPrice)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{fmt(p.sellPrice)}</td>
                      <td className="px-4 py-3">
                        <Badge color={p.stock <= p.lowStockAlert ? "red" : "green"}>{p.stock}</Badge>
                      </td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">{margin}%</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Btn small variant="ghost" onClick={() => setModal({ type: "editProduct", product: p })}>Edit</Btn>
                          <Btn small variant="danger" onClick={() => {
                            setProducts(ps => ps.filter(x => x.id !== p.id));
                            showToast("Product deleted");
                          }}>Del</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const Sales = () => (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <h2 className="font-bold text-slate-700">Sales History</h2>
        <Btn variant="success" onClick={() => setModal("recordSale")}>+ Record Sale</Btn>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="🛒" label="Total Sales" value={sales.length} accent="bg-indigo-500" />
        <StatCard icon="💵" label="Revenue" value={fmt(totalRevenue)} accent="bg-emerald-500" />
        <StatCard icon="📊" label="Avg. Order" value={fmt(totalRevenue / (sales.length || 1))} accent="bg-amber-500" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Date", "Product", "Customer", "Qty", "Unit Price", "Total", ""].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...sales].reverse().map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-emerald-50/30">
                  <td className="px-4 py-3 text-slate-400 text-xs">{s.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.productName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{s.qty}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(s.unitPrice)}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{fmt(s.total)}</td>
                  <td className="px-4 py-3">
                    <Btn small variant="danger" onClick={() => {
                      setSales(ss => ss.filter(x => x.id !== s.id));
                      const p = products.find(pr => pr.id === s.productId);
                      if (p) setProducts(ps => ps.map(pr => pr.id === p.id ? { ...pr, stock: pr.stock + s.qty } : pr));
                      showToast("Sale removed, stock restored");
                    }}>✕</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const Purchases = () => (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <h2 className="font-bold text-slate-700">Purchase Orders</h2>
        <Btn onClick={() => setModal("recordPurchase")}>+ Record Purchase</Btn>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="📥" label="Total Orders" value={purchases.length} accent="bg-indigo-500" />
        <StatCard icon="💸" label="Total Spent" value={fmt(totalCost)} accent="bg-red-500" />
        <StatCard icon="📦" label="Items Received" value={purchases.reduce((s, p) => s + p.qty, 0)} accent="bg-amber-500" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Date", "Product", "Supplier", "Qty", "Unit Cost", "Total", ""].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...purchases].reverse().map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-indigo-50/30">
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.productName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.supplier}</td>
                  <td className="px-4 py-3 text-slate-600">{p.qty}</td>
                  <td className="px-4 py-3 text-slate-500">{fmt(p.unitCost)}</td>
                  <td className="px-4 py-3 font-bold text-indigo-600">{fmt(p.total)}</td>
                  <td className="px-4 py-3">
                    <Btn small variant="danger" onClick={() => {
                      setPurchases(ps => ps.filter(x => x.id !== p.id));
                      setProducts(prs => prs.map(pr => pr.id === p.productId ? { ...pr, stock: Math.max(0, pr.stock - p.qty) } : pr));
                      showToast("Purchase removed");
                    }}>✕</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const Reports = () => {
    const byCategory = CATEGORIES.map(cat => {
      const prods = products.filter(p => p.category === cat);
      const rev = sales.filter(s => prods.some(p => p.id === s.productId)).reduce((a, s) => a + s.total, 0);
      return { cat, count: prods.length, rev };
    }).filter(x => x.count > 0);

    return (
      <div className="space-y-5">
        <h2 className="font-bold text-slate-700">Business Reports</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="💰" label="Gross Revenue" value={fmt(totalRevenue)} accent="bg-emerald-500" />
          <StatCard icon="💸" label="Total COGS" value={fmt(totalCost)} accent="bg-red-500" />
          <StatCard icon="📈" label="Gross Profit" value={fmt(totalProfit)} accent="bg-indigo-500" />
          <StatCard icon="%" label="Profit Margin" value={`${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%`} accent="bg-amber-500" />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Revenue by Category</h3>
          <div className="space-y-4">
            {byCategory.sort((a, b) => b.rev - a.rev).map(({ cat, count, rev }) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">{cat} <span className="text-slate-400">({count} products)</span></span>
                  <span className="font-bold text-slate-700">{fmt(rev)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                    style={{ width: `${totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Product Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Product", "Units Sold", "Revenue", "Margin", "Stock Value"].map(h => (
                    <th key={h} className="text-left font-semibold text-slate-400 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const sold = sales.filter(s => s.productId === p.id);
                  const rev = sold.reduce((a, s) => a + s.total, 0);
                  const units = sold.reduce((a, s) => a + s.qty, 0);
                  const margin = ((p.sellPrice - p.costPrice) / p.sellPrice * 100).toFixed(0);
                  return (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="py-2 pr-4 font-medium text-slate-700">{p.name}</td>
                      <td className="py-2 pr-4 text-slate-500">{units}</td>
                      <td className="py-2 pr-4 font-semibold text-emerald-600">{fmt(rev)}</td>
                      <td className="py-2 pr-4 text-indigo-600">{margin}%</td>
                      <td className="py-2 text-slate-500">{fmt(p.stock * p.costPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const TABS = [
    { id: "dashboard", icon: "⬡", label: "Dashboard" },
    { id: "inventory", icon: "📦", label: "Inventory" },
    { id: "sales", icon: "🛒", label: "Sales" },
    { id: "purchases", icon: "📥", label: "Purchases" },
    { id: "reports", icon: "📊", label: "Reports" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm">S</div>
          <input
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            className="font-bold text-slate-800 text-base bg-transparent focus:outline-none focus:border-b-2 focus:border-indigo-500 max-w-[160px]"
          />
        </div>
        <div className="flex items-center gap-2">
          {lowStock.length > 0 && (
            <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-1 rounded-full">
              ⚠️ {lowStock.length} low
            </span>
          )}
        </div>
      </header>

      {/* ── Nav ── */}
      <nav className="bg-white border-b border-slate-100 px-2 flex overflow-x-auto gap-1 sticky top-[57px] z-30">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(""); }}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
              tab === t.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === "dashboard" && <Dashboard />}
        {tab === "inventory" && <Inventory />}
        {tab === "sales" && <Sales />}
        {tab === "purchases" && <Purchases />}
        {tab === "reports" && <Reports />}
      </main>

      {/* ── Modals ── */}
      {modal === "addProduct" && (
        <Modal title="Add New Product" onClose={() => setModal(null)}>
          <ProductForm onSave={(p) => {
            setProducts(ps => [...ps, p]);
            setModal(null);
            showToast("Product added!");
          }} />
        </Modal>
      )}
      {modal?.type === "editProduct" && (
        <Modal title="Edit Product" onClose={() => setModal(null)}>
          <ProductForm existing={modal.product} onSave={(p) => {
            setProducts(ps => ps.map(x => x.id === p.id ? p : x));
            setModal(null);
            showToast("Product updated!");
          }} />
        </Modal>
      )}
      {modal === "recordSale" && (
        <Modal title="Record New Sale" onClose={() => setModal(null)}>
          <SaleForm onSave={(s) => {
            setSales(ss => [...ss, s]);
            setProducts(ps => ps.map(p => p.id === s.productId ? { ...p, stock: p.stock - s.qty } : p));
            setModal(null);
            showToast("Sale recorded!");
          }} />
        </Modal>
      )}
      {modal === "recordPurchase" && (
        <Modal title="Record Purchase" onClose={() => setModal(null)}>
          <PurchaseForm onSave={(p) => {
            setPurchases(ps => [...ps, p]);
            setProducts(prs => prs.map(pr => pr.id === p.productId ? { ...pr, stock: pr.stock + p.qty } : pr));
            setModal(null);
            showToast("Purchase recorded, stock updated!");
          }} />
        </Modal>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-semibold shadow-lg z-50 transition-all ${
          toast.type === "error" ? "bg-red-500 text-white" : "bg-slate-800 text-white"
        }`}>
          {toast.type === "error" ? "⚠️ " : "✓ "}{toast.msg}
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ShopManager />);
