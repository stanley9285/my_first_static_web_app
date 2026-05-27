import "./global.css";
import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import Svg, { Polyline } from "react-native-svg";

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

// ─── Atoms ───────────────────────────────────────────────────────────────────
const BADGE_BG = {
  indigo: "bg-indigo-100",
  green: "bg-emerald-100",
  red: "bg-red-100",
  amber: "bg-amber-100",
  slate: "bg-slate-100",
};
const BADGE_FG = {
  indigo: "text-indigo-700",
  green: "text-emerald-700",
  red: "text-red-700",
  amber: "text-amber-700",
  slate: "text-slate-600",
};

const Badge = ({ children, color = "indigo" }) => (
  <View className={`self-start px-2 py-0.5 rounded-full ${BADGE_BG[color]}`}>
    <Text className={`text-xs font-semibold ${BADGE_FG[color]}`}>{children}</Text>
  </View>
);

const StatCard = ({ icon, label, value, sub }) => (
  <View className="bg-white rounded-2xl p-4 border border-slate-100 m-1 flex-grow basis-[140px]">
    <View className="flex-row items-start justify-between">
      <View className="flex-1 pr-2">
        <Text className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</Text>
        <Text className="text-xl font-bold text-slate-800 mt-1" numberOfLines={1}>{value}</Text>
        {sub ? <Text className="text-[10px] text-slate-400 mt-1">{sub}</Text> : null}
      </View>
      <Text className="text-xl">{icon}</Text>
    </View>
  </View>
);

const BTN = {
  primary: { bg: "bg-indigo-600", text: "text-white" },
  danger: { bg: "bg-red-500", text: "text-white" },
  ghost: { bg: "bg-slate-100", text: "text-slate-600" },
  success: { bg: "bg-emerald-500", text: "text-white" },
};

const Btn = ({ children, onPress, variant = "primary", small, className = "" }) => {
  const v = BTN[variant];
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl ${v.bg} ${small ? "px-3 py-1.5" : "px-4 py-2"} active:opacity-80 ${className}`}
    >
      <Text className={`font-semibold text-center ${v.text} ${small ? "text-xs" : "text-sm"}`}>{children}</Text>
    </Pressable>
  );
};

const Input = ({ label, ...props }) => (
  <View className="flex-1">
    {label ? <Text className="text-xs font-semibold text-slate-500 mb-1">{label}</Text> : null}
    <TextInput
      placeholderTextColor="#94a3b8"
      {...props}
      className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-slate-50"
    />
  </View>
);

// RN has no native <select> — open a modal list on tap.
const Picker = ({ label, value, options, onChange, formatLabel = (o) => String(o) }) => {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => (typeof o === "object" ? o.value : o) === value);
  return (
    <View className="flex-1">
      {label ? <Text className="text-xs font-semibold text-slate-500 mb-1">{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} className="border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
        <Text className="text-sm text-slate-700">{current ? formatLabel(current) : "Select..."}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40 items-center justify-center px-4" onPress={() => setOpen(false)}>
          <View className="bg-white rounded-2xl w-full max-w-md max-h-[70%] p-2">
            <ScrollView>
              {options.map((opt) => {
                const v = typeof opt === "object" ? opt.value : opt;
                const isSel = v === value;
                return (
                  <Pressable
                    key={String(v)}
                    onPress={() => { onChange(v); setOpen(false); }}
                    className={`px-4 py-3 rounded-xl ${isSel ? "bg-indigo-50" : ""}`}
                  >
                    <Text className={`text-sm ${isSel ? "text-indigo-700 font-semibold" : "text-slate-700"}`}>
                      {formatLabel(opt)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const Sparkline = ({ data, color = "#6366f1" }) => {
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 30 - (v / max) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <Svg viewBox="0 0 100 32" width="100%" height={32} preserveAspectRatio="none">
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

const Sheet = ({ visible, title, onClose, children }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View className="flex-1 bg-black/40 justify-end">
      <View className="bg-white rounded-t-3xl p-5 max-h-[90%]">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-slate-800">{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text className="text-slate-400 text-xl font-bold">✕</Text>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </View>
  </Modal>
);

// ─── Forms ───────────────────────────────────────────────────────────────────
const ProductForm = ({ existing, onSave, showToast }) => {
  const [form, setForm] = useState(
    existing
      ? {
          ...existing,
          costPrice: String(existing.costPrice),
          sellPrice: String(existing.sellPrice),
          stock: String(existing.stock),
          lowStockAlert: String(existing.lowStockAlert),
        }
      : { name: "", sku: "", category: "Footwear", costPrice: "", sellPrice: "", stock: "", lowStockAlert: "10" }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <Input label="Product Name" value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. White Sneaker" />
        <Input label="SKU" value={form.sku} onChangeText={(v) => set("sku", v)} placeholder="e.g. SNK-001" />
      </View>
      <Picker label="Category" value={form.category} options={CATEGORIES} onChange={(v) => set("category", v)} />
      <View className="flex-row gap-3">
        <Input label="Cost Price ($)" keyboardType="decimal-pad" value={form.costPrice} onChangeText={(v) => set("costPrice", v)} />
        <Input label="Sell Price ($)" keyboardType="decimal-pad" value={form.sellPrice} onChangeText={(v) => set("sellPrice", v)} />
      </View>
      <View className="flex-row gap-3">
        <Input label="Initial Stock" keyboardType="number-pad" value={form.stock} onChangeText={(v) => set("stock", v)} />
        <Input label="Low Stock Alert" keyboardType="number-pad" value={form.lowStockAlert} onChangeText={(v) => set("lowStockAlert", v)} />
      </View>
      <Btn
        onPress={() => {
          if (!form.name || !form.sku) return showToast("Name & SKU required", "error");
          onSave({
            ...form,
            id: existing?.id || uid(),
            costPrice: +form.costPrice,
            sellPrice: +form.sellPrice,
            stock: +form.stock,
            lowStockAlert: +form.lowStockAlert,
          });
        }}
      >
        {existing ? "Update Product" : "Add Product"}
      </Btn>
    </View>
  );
};

const SaleForm = ({ products, onSave, showToast }) => {
  const [form, setForm] = useState({ productId: products[0]?.id || "", qty: "1", customer: "", date: today() });
  const prod = products.find((p) => p.id === form.productId);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <View className="gap-3">
      <Picker
        label="Product"
        value={form.productId}
        options={products.map((p) => ({ value: p.id, label: `${p.name} — Stock: ${p.stock}` }))}
        formatLabel={(o) => o.label}
        onChange={(v) => set("productId", v)}
      />
      {prod ? (
        <View className="bg-indigo-50 rounded-xl px-4 py-3">
          <Text className="text-sm">
            <Text className="text-slate-500">Unit Price: </Text>
            <Text className="text-indigo-700 font-bold">{fmt(prod.sellPrice)}</Text>
            <Text className="text-slate-300">    |    </Text>
            <Text className="text-slate-500">Available: </Text>
            <Text className="text-slate-700 font-bold">{prod.stock} units</Text>
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <Input label="Quantity" keyboardType="number-pad" value={form.qty} onChangeText={(v) => set("qty", v)} />
        <Input label="Date" value={form.date} onChangeText={(v) => set("date", v)} placeholder="YYYY-MM-DD" />
      </View>
      <Input label="Customer Name (optional)" value={form.customer} onChangeText={(v) => set("customer", v)} placeholder="Walk-in Customer" />
      {prod ? (
        <View className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Text className="text-sm font-semibold text-emerald-700">Total: {fmt(prod.sellPrice * (+form.qty || 0))}</Text>
        </View>
      ) : null}
      <Btn
        variant="success"
        onPress={() => {
          const qty = +form.qty;
          if (!prod || qty < 1) return showToast("Select product & quantity", "error");
          if (qty > prod.stock) return showToast("Insufficient stock!", "error");
          onSave({
            id: uid(),
            date: form.date,
            productId: prod.id,
            productName: prod.name,
            qty,
            unitPrice: prod.sellPrice,
            total: prod.sellPrice * qty,
            customer: form.customer || "Walk-in",
          });
        }}
      >
        ✓ Record Sale
      </Btn>
    </View>
  );
};

const PurchaseForm = ({ products, onSave, showToast }) => {
  const [form, setForm] = useState({
    productId: products[0]?.id || "",
    qty: "1",
    unitCost: products[0] ? String(products[0].costPrice) : "",
    supplier: "",
    date: today(),
  });
  const prod = products.find((p) => p.id === form.productId);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <View className="gap-3">
      <Picker
        label="Product"
        value={form.productId}
        options={products.map((p) => ({ value: p.id, label: p.name }))}
        formatLabel={(o) => o.label}
        onChange={(v) => {
          const p = products.find((pr) => pr.id === v);
          setForm((f) => ({ ...f, productId: v, unitCost: p ? String(p.costPrice) : "" }));
        }}
      />
      <View className="flex-row gap-3">
        <Input label="Quantity" keyboardType="number-pad" value={form.qty} onChangeText={(v) => set("qty", v)} />
        <Input label="Unit Cost ($)" keyboardType="decimal-pad" value={form.unitCost} onChangeText={(v) => set("unitCost", v)} />
      </View>
      <View className="flex-row gap-3">
        <Input label="Supplier" value={form.supplier} onChangeText={(v) => set("supplier", v)} placeholder="Supplier name" />
        <Input label="Date" value={form.date} onChangeText={(v) => set("date", v)} placeholder="YYYY-MM-DD" />
      </View>
      {form.qty && form.unitCost ? (
        <View className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Text className="text-sm font-semibold text-blue-700">Total Cost: {fmt(+form.qty * +form.unitCost)}</Text>
        </View>
      ) : null}
      <Btn
        onPress={() => {
          if (!prod || !form.qty || !form.unitCost) return showToast("Fill all required fields", "error");
          onSave({
            id: uid(),
            date: form.date,
            productId: prod.id,
            productName: prod.name,
            qty: +form.qty,
            unitCost: +form.unitCost,
            total: +form.qty * +form.unitCost,
            supplier: form.supplier || "Unknown",
          });
        }}
      >
        ✓ Record Purchase
      </Btn>
    </View>
  );
};

// ─── Views ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", icon: "⬡", label: "Dashboard" },
  { id: "inventory", icon: "📦", label: "Inventory" },
  { id: "sales", icon: "🛒", label: "Sales" },
  { id: "purchases", icon: "📥", label: "Purchases" },
  { id: "reports", icon: "📊", label: "Reports" },
];

const Dashboard = ({ products, sales, totalRevenue, totalProfit, totalInventoryValue, lowStock, weeklyRevenue }) => (
  <View className="gap-4">
    <View className="flex-row flex-wrap -m-1">
      <StatCard icon="💰" label="Total Revenue" value={fmt(totalRevenue)} sub={`${sales.length} sales`} />
      <StatCard icon="📈" label="Net Profit" value={fmt(totalProfit)} sub="Estimated" />
      <StatCard icon="📦" label="Inventory" value={fmt(totalInventoryValue)} sub={`${products.length} products`} />
      <StatCard icon="⚠️" label="Low Stock" value={String(lowStock.length)} sub="need restock" />
    </View>

    <View className="bg-white rounded-2xl p-4 border border-slate-100">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-bold text-slate-700 text-sm">Revenue Trend (7 days)</Text>
        <Badge color="indigo">{fmt(totalRevenue)} total</Badge>
      </View>
      <Sparkline data={weeklyRevenue} />
      <View className="flex-row justify-between mt-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <Text key={d} className="text-[10px] text-slate-400">{d}</Text>
        ))}
      </View>
    </View>

    <View className="bg-white rounded-2xl p-4 border border-slate-100">
      <Text className="font-bold text-slate-700 text-sm mb-3">Recent Sales</Text>
      <View className="gap-2">
        {sales.slice(-4).reverse().map((s) => (
          <View key={s.id} className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="font-medium text-slate-700 text-xs">{s.productName}</Text>
              <Text className="text-[11px] text-slate-400">{s.customer} · {s.date}</Text>
            </View>
            <Text className="font-bold text-emerald-600 text-xs">{fmt(s.total)}</Text>
          </View>
        ))}
      </View>
    </View>

    <View className="bg-white rounded-2xl p-4 border border-slate-100">
      <Text className="font-bold text-slate-700 text-sm mb-3">⚠️ Low Stock Alerts</Text>
      {lowStock.length === 0 ? (
        <Text className="text-sm text-slate-400">All products are well-stocked ✓</Text>
      ) : (
        <View className="gap-2">
          {lowStock.map((p) => (
            <View key={p.id} className="flex-row items-center justify-between">
              <View>
                <Text className="font-medium text-slate-700 text-xs">{p.name}</Text>
                <Text className="text-[11px] text-slate-400">{p.sku}</Text>
              </View>
              <Badge color={p.stock === 0 ? "red" : "amber"}>{p.stock} left</Badge>
            </View>
          ))}
        </View>
      )}
    </View>

    <View className="bg-white rounded-2xl p-4 border border-slate-100">
      <Text className="font-bold text-slate-700 text-sm mb-3">Top Products by Revenue</Text>
      <View className="gap-3">
        {products.map((p) => {
          const rev = sales.filter((s) => s.productId === p.id).reduce((a, s) => a + s.total, 0);
          const pct = totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0;
          return (
            <View key={p.id}>
              <View className="flex-row justify-between mb-1">
                <Text className="font-medium text-slate-600 text-xs">{p.name}</Text>
                <Text className="text-slate-400 text-xs">{fmt(rev)}</Text>
              </View>
              <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <View className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  </View>
);

const Inventory = ({ products, search, setSearch, onAdd, onEdit, onDelete }) => {
  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <View className="gap-3">
      <View className="flex-row gap-2 items-center">
        <View className="flex-1">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products..."
            placeholderTextColor="#94a3b8"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 text-slate-700"
          />
        </View>
        <Btn onPress={onAdd}>+ Add</Btn>
      </View>
      <View className="gap-2">
        {filtered.map((p) => {
          const margin = ((p.sellPrice - p.costPrice) / p.sellPrice * 100).toFixed(0);
          return (
            <View key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text className="font-semibold text-slate-800">{p.name}</Text>
                  <Text className="text-xs text-slate-400 font-mono">{p.sku}</Text>
                </View>
                <Badge color="slate">{p.category}</Badge>
              </View>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-3">
                <Text className="text-xs text-slate-500">Cost: <Text className="text-slate-700">{fmt(p.costPrice)}</Text></Text>
                <Text className="text-xs text-slate-500">Price: <Text className="text-slate-700 font-semibold">{fmt(p.sellPrice)}</Text></Text>
                <Text className="text-xs text-slate-500">Margin: <Text className="text-emerald-600 font-semibold">{margin}%</Text></Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Badge color={p.stock <= p.lowStockAlert ? "red" : "green"}>{p.stock} in stock</Badge>
                <View className="flex-row gap-2">
                  <Btn small variant="ghost" onPress={() => onEdit(p)}>Edit</Btn>
                  <Btn small variant="danger" onPress={() => onDelete(p)}>Del</Btn>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const SalesView = ({ sales, totalRevenue, onAdd, onDelete }) => (
  <View className="gap-3">
    <View className="flex-row items-center justify-between">
      <Text className="font-bold text-slate-700 text-base">Sales History</Text>
      <Btn variant="success" onPress={onAdd}>+ Record Sale</Btn>
    </View>
    <View className="flex-row flex-wrap -m-1">
      <StatCard icon="🛒" label="Total Sales" value={String(sales.length)} />
      <StatCard icon="💵" label="Revenue" value={fmt(totalRevenue)} />
      <StatCard icon="📊" label="Avg. Order" value={fmt(totalRevenue / (sales.length || 1))} />
    </View>
    <View className="gap-2">
      {[...sales].reverse().map((s) => (
        <View key={s.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="font-semibold text-slate-800">{s.productName}</Text>
            <Text className="text-xs text-slate-400">{s.customer} · {s.date} · qty {s.qty}</Text>
          </View>
          <View className="items-end">
            <Text className="font-bold text-emerald-600 mb-1">{fmt(s.total)}</Text>
            <Btn small variant="danger" onPress={() => onDelete(s)}>✕</Btn>
          </View>
        </View>
      ))}
    </View>
  </View>
);

const PurchasesView = ({ purchases, totalCost, onAdd, onDelete }) => (
  <View className="gap-3">
    <View className="flex-row items-center justify-between">
      <Text className="font-bold text-slate-700 text-base">Purchase Orders</Text>
      <Btn onPress={onAdd}>+ Purchase</Btn>
    </View>
    <View className="flex-row flex-wrap -m-1">
      <StatCard icon="📥" label="Orders" value={String(purchases.length)} />
      <StatCard icon="💸" label="Total Spent" value={fmt(totalCost)} />
      <StatCard icon="📦" label="Items" value={String(purchases.reduce((s, p) => s + p.qty, 0))} />
    </View>
    <View className="gap-2">
      {[...purchases].reverse().map((p) => (
        <View key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="font-semibold text-slate-800">{p.productName}</Text>
            <Text className="text-xs text-slate-400">{p.supplier} · {p.date} · qty {p.qty}</Text>
          </View>
          <View className="items-end">
            <Text className="font-bold text-indigo-600 mb-1">{fmt(p.total)}</Text>
            <Btn small variant="danger" onPress={() => onDelete(p)}>✕</Btn>
          </View>
        </View>
      ))}
    </View>
  </View>
);

const Reports = ({ products, sales, totalRevenue, totalCost, totalProfit }) => {
  const byCategory = CATEGORIES.map((cat) => {
    const prods = products.filter((p) => p.category === cat);
    const rev = sales.filter((s) => prods.some((p) => p.id === s.productId)).reduce((a, s) => a + s.total, 0);
    return { cat, count: prods.length, rev };
  }).filter((x) => x.count > 0);

  return (
    <View className="gap-4">
      <Text className="font-bold text-slate-700 text-base">Business Reports</Text>
      <View className="flex-row flex-wrap -m-1">
        <StatCard icon="💰" label="Gross Revenue" value={fmt(totalRevenue)} />
        <StatCard icon="💸" label="Total COGS" value={fmt(totalCost)} />
        <StatCard icon="📈" label="Gross Profit" value={fmt(totalProfit)} />
        <StatCard icon="%" label="Profit Margin" value={`${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%`} />
      </View>
      <View className="bg-white rounded-2xl p-4 border border-slate-100">
        <Text className="font-bold text-slate-700 text-sm mb-3">Revenue by Category</Text>
        <View className="gap-3">
          {byCategory.sort((a, b) => b.rev - a.rev).map(({ cat, count, rev }) => (
            <View key={cat}>
              <View className="flex-row justify-between mb-1">
                <Text className="font-medium text-slate-600 text-xs">
                  {cat} <Text className="text-slate-400">({count} products)</Text>
                </Text>
                <Text className="font-bold text-slate-700 text-xs">{fmt(rev)}</Text>
              </View>
              <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <View className="h-full bg-indigo-500 rounded-full" style={{ width: `${totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0}%` }} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View className="bg-white rounded-2xl p-4 border border-slate-100">
        <Text className="font-bold text-slate-700 text-sm mb-3">Product Performance</Text>
        <View className="gap-2">
          {products.map((p) => {
            const sold = sales.filter((s) => s.productId === p.id);
            const rev = sold.reduce((a, s) => a + s.total, 0);
            const units = sold.reduce((a, s) => a + s.qty, 0);
            const margin = ((p.sellPrice - p.costPrice) / p.sellPrice * 100).toFixed(0);
            return (
              <View key={p.id} className="flex-row items-center justify-between border-b border-slate-50 pb-2">
                <View className="flex-1 pr-2">
                  <Text className="font-medium text-slate-700 text-xs">{p.name}</Text>
                  <Text className="text-[10px] text-slate-400">{units} sold · margin {margin}%</Text>
                </View>
                <Text className="font-bold text-emerald-600 text-xs">{fmt(rev)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [sales, setSales] = useState(SEED_SALES);
  const [purchases, setPurchases] = useState(SEED_PURCHASES);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [storeName, setStoreName] = useState("My Shop");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalRevenue = useMemo(() => sales.reduce((s, x) => s + x.total, 0), [sales]);
  const totalCost = useMemo(() => purchases.reduce((s, x) => s + x.total, 0), [purchases]);
  const totalProfit = useMemo(
    () =>
      sales.reduce((s, x) => {
        const p = products.find((pr) => pr.id === x.productId);
        return s + (p ? (x.unitPrice - p.costPrice) * x.qty : 0);
      }, 0),
    [sales, products]
  );
  const lowStock = useMemo(() => products.filter((p) => p.stock <= p.lowStockAlert), [products]);
  const totalInventoryValue = useMemo(
    () => products.reduce((s, p) => s + p.stock * p.costPrice, 0),
    [products]
  );
  const weeklyRevenue = [120, 190, 85, 240, 175, 310, (totalRevenue % 300) + 50];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <View
        className="bg-white border-b border-slate-100 px-4 py-3 flex-row items-center justify-between"
        style={Platform.OS === "android" ? { paddingTop: (StatusBar.currentHeight || 0) + 12 } : null}
      >
        <View className="flex-row items-center gap-3 flex-1">
          <View className="w-8 h-8 bg-indigo-600 rounded-xl items-center justify-center">
            <Text className="text-white font-black text-sm">S</Text>
          </View>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            className="font-bold text-slate-800 text-base flex-1"
          />
        </View>
        {lowStock.length > 0 ? (
          <View className="bg-red-100 px-2 py-1 rounded-full">
            <Text className="text-xs text-red-600 font-semibold">⚠️ {lowStock.length} low</Text>
          </View>
        ) : null}
      </View>

      <View className="bg-white border-b border-slate-100">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => { setTab(t.id); setSearch(""); }}
                className={`px-4 py-3 flex-row items-center gap-1.5 border-b-2 ${active ? "border-indigo-600" : "border-transparent"}`}
              >
                <Text className="text-xs">{t.icon}</Text>
                <Text className={`text-xs font-semibold ${active ? "text-indigo-600" : "text-slate-400"}`}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {tab === "dashboard" && (
          <Dashboard
            products={products}
            sales={sales}
            totalRevenue={totalRevenue}
            totalProfit={totalProfit}
            totalInventoryValue={totalInventoryValue}
            lowStock={lowStock}
            weeklyRevenue={weeklyRevenue}
          />
        )}
        {tab === "inventory" && (
          <Inventory
            products={products}
            search={search}
            setSearch={setSearch}
            onAdd={() => { setEditing(null); setModal("product"); }}
            onEdit={(p) => { setEditing(p); setModal("product"); }}
            onDelete={(p) => {
              setProducts((ps) => ps.filter((x) => x.id !== p.id));
              showToast("Product deleted");
            }}
          />
        )}
        {tab === "sales" && (
          <SalesView
            sales={sales}
            totalRevenue={totalRevenue}
            onAdd={() => setModal("sale")}
            onDelete={(s) => {
              setSales((ss) => ss.filter((x) => x.id !== s.id));
              setProducts((ps) => ps.map((pr) => pr.id === s.productId ? { ...pr, stock: pr.stock + s.qty } : pr));
              showToast("Sale removed, stock restored");
            }}
          />
        )}
        {tab === "purchases" && (
          <PurchasesView
            purchases={purchases}
            totalCost={totalCost}
            onAdd={() => setModal("purchase")}
            onDelete={(p) => {
              setPurchases((ps) => ps.filter((x) => x.id !== p.id));
              setProducts((prs) => prs.map((pr) => pr.id === p.productId ? { ...pr, stock: Math.max(0, pr.stock - p.qty) } : pr));
              showToast("Purchase removed");
            }}
          />
        )}
        {tab === "reports" && (
          <Reports
            products={products}
            sales={sales}
            totalRevenue={totalRevenue}
            totalCost={totalCost}
            totalProfit={totalProfit}
          />
        )}
      </ScrollView>

      <Sheet visible={modal === "product"} title={editing ? "Edit Product" : "Add New Product"} onClose={() => setModal(null)}>
        <ProductForm
          existing={editing}
          showToast={showToast}
          onSave={(p) => {
            if (editing) {
              setProducts((ps) => ps.map((x) => x.id === p.id ? p : x));
              showToast("Product updated!");
            } else {
              setProducts((ps) => [...ps, p]);
              showToast("Product added!");
            }
            setEditing(null);
            setModal(null);
          }}
        />
      </Sheet>
      <Sheet visible={modal === "sale"} title="Record New Sale" onClose={() => setModal(null)}>
        <SaleForm
          products={products}
          showToast={showToast}
          onSave={(s) => {
            setSales((ss) => [...ss, s]);
            setProducts((ps) => ps.map((p) => p.id === s.productId ? { ...p, stock: p.stock - s.qty } : p));
            setModal(null);
            showToast("Sale recorded!");
          }}
        />
      </Sheet>
      <Sheet visible={modal === "purchase"} title="Record Purchase" onClose={() => setModal(null)}>
        <PurchaseForm
          products={products}
          showToast={showToast}
          onSave={(p) => {
            setPurchases((ps) => [...ps, p]);
            setProducts((prs) => prs.map((pr) => pr.id === p.productId ? { ...pr, stock: pr.stock + p.qty } : pr));
            setModal(null);
            showToast("Purchase recorded, stock updated!");
          }}
        />
      </Sheet>

      {toast ? (
        <View className="absolute bottom-8 left-0 right-0 items-center px-4">
          <View className={`px-5 py-3 rounded-2xl ${toast.type === "error" ? "bg-red-500" : "bg-slate-800"}`}>
            <Text className="text-white font-semibold text-sm">
              {toast.type === "error" ? "⚠️ " : "✓ "}{toast.msg}
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
