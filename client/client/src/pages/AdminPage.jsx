import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { getPrices, updatePrice, addBrand, deleteBrand } from "../services/adminApi";
import ThemeToggle from "../components/ThemeToggle";
import "./AdminPage.css";

const MATERIAL_LABELS = {
  cement_bag:  "Cement (per bag)",
  sand_m3:     "Sand (per m³)",
  metal_m3:    "Metal / Aggregate (per m³)",
  steel_kg:    "Tor Steel (per kg)",
  rubble_m3:   "Rubble (per m³)",
  labour_day:  "Labour (per day)",
  brick_each:  "Bricks / Blocks (each)",
  plaster_m2:  "Plastering (per m²)",
  paint_m2:    "Painting (per m²)",
  floor_m2:    "Flooring (per m²)",
  roof_m2:     "Roofing (per m²)",
  lintel_each: "Lintels (each)",
};

export default function AdminPage({ onGoHome }) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [newBrand, setNewBrand] = useState({ material: "", brand: "", price: "" });

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    try {
      const data = await getPrices();
      setPrices(data);
    } catch (err) {
      showToast(err.message || "Failed to load prices", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (materialKey, brand) => {
    const val = parseFloat(editVal);
    if (isNaN(val) || val <= 0) {
      showToast("Price must be a positive number", "warning");
      return;
    }
    try {
      await updatePrice(materialKey, brand, val);
      setPrices((prev) => ({
        ...prev,
        [materialKey]: { ...prev[materialKey], [brand]: val },
      }));
      setEditCell(null);
      showToast("Price updated", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = async (materialKey, brand) => {
    try {
      await deleteBrand(materialKey, brand);
      setPrices((prev) => {
        const copy = { ...prev, [materialKey]: { ...prev[materialKey] } };
        delete copy[materialKey][brand];
        return copy;
      });
      showToast("Brand removed", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleAddBrand = async () => {
    const { material, brand, price } = newBrand;
    if (!material || !brand || !price) {
      showToast("Fill in all fields", "warning");
      return;
    }
    try {
      await addBrand(material, brand.toLowerCase().replace(/\s+/g, "_"), parseFloat(price));
      await loadPrices();
      setNewBrand({ material: "", brand: "", price: "" });
      showToast("Brand added", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="admin-loading"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <nav className="dash-nav">
        <button className="dash-nav-logo" onClick={onGoHome}>
          <img src="/logo.jpg" alt="TheConstructor AI" className="dash-nav-logo-img" />
        </button>
        <div className="dash-nav-right">
          <span className="dash-nav-user">
            <span className="dash-nav-user-dot" />
            Admin: {user?.name || user?.email}
          </span>
          <button className="dash-nav-new" onClick={onGoHome}>← Dashboard</button>
          <ThemeToggle />
          <button className="dash-nav-logout" onClick={logout}>Logout</button>
        </div>
      </nav>

      <main className="admin-body">
        <h1 className="admin-title">Material Price Management</h1>
        <p className="admin-sub">Update market prices for all materials and brands</p>

        {prices && Object.entries(prices).map(([materialKey, brands]) => (
          <div className="admin-material" key={materialKey}>
            <h3 className="admin-material-title">{MATERIAL_LABELS[materialKey] || materialKey}</h3>
            <div className="admin-brands">
              {Object.entries(brands).map(([brand, price]) => {
                const isEditing = editCell === `${materialKey}.${brand}`;
                return (
                  <div className="admin-brand-row" key={brand}>
                    <span className="admin-brand-name">{brand}</span>
                    {isEditing ? (
                      <div className="admin-edit-row">
                        <input
                          className="admin-price-input"
                          type="number"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSave(materialKey, brand)}
                        />
                        <button className="admin-btn-save" onClick={() => handleSave(materialKey, brand)}>Save</button>
                        <button className="admin-btn-cancel" onClick={() => setEditCell(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="admin-price-row">
                        <span className="admin-price">Rs. {price.toLocaleString()}</span>
                        <button className="admin-btn-edit" onClick={() => { setEditCell(`${materialKey}.${brand}`); setEditVal(String(price)); }}>Edit</button>
                        <button className="admin-btn-delete" onClick={() => handleDelete(materialKey, brand)}>×</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="admin-add-section">
          <h3>Add New Brand</h3>
          <div className="admin-add-row">
            <select
              className="admin-add-select"
              value={newBrand.material}
              onChange={(e) => setNewBrand((p) => ({ ...p, material: e.target.value }))}
            >
              <option value="">Select material...</option>
              {Object.keys(MATERIAL_LABELS).map((k) => (
                <option key={k} value={k}>{MATERIAL_LABELS[k]}</option>
              ))}
            </select>
            <input
              className="admin-add-input"
              placeholder="Brand name"
              value={newBrand.brand}
              onChange={(e) => setNewBrand((p) => ({ ...p, brand: e.target.value }))}
            />
            <input
              className="admin-add-input"
              placeholder="Price (LKR)"
              type="number"
              value={newBrand.price}
              onChange={(e) => setNewBrand((p) => ({ ...p, price: e.target.value }))}
            />
            <button className="btn-amber" onClick={handleAddBrand}>Add</button>
          </div>
        </div>
      </main>
    </div>
  );
}
