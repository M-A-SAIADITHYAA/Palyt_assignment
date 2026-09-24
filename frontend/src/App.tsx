import { useEffect, useState } from "react";
import type { Dish, StockItem } from "./types";
import { fetchMenu, fetchStock, resetData } from "./api";
import { StockTable } from "./components/StockTable";
import { MenuView } from "./components/MenuView";
import { AddIngredientModal } from "./components/AddIngredientModal";
import "./App.css";

interface ToastNotification {
  message: string;
  type: "success" | "warning" | "error";
}

export function App() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const showNotification = (
    message: string,
    type: "success" | "warning" | "error" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4500);
  };

  const loadAllData = async () => {
    try {
      setError(null);
      const [stockData, menuData] = await Promise.all([
        fetchStock(),
        fetchMenu(),
      ]);
      setStock(stockData);
      setDishes(menuData);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to backend server. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleResetData = async () => {
    if (!window.confirm("Reset all kitchen stock back to original starter data?")) {
      return;
    }
    try {
      setLoading(true);
      const res = await resetData();
      setStock(res.stock);
      setDishes(res.menu);
      showNotification("Kitchen stock restored to original starter levels!", "success");
    } catch (err: unknown) {
      showNotification(
        err instanceof Error ? err.message : "Failed to reset data",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand">
          <h1>Palyt Kitchen & Diner Portal</h1>
          <span className="brand-tag">Real-Time Stock to Menu Sync</span>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={handleResetData}
            title="Reset stock to initial values"
          >
            ↺ Reset Starter Stock
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add Ingredient
          </button>
        </div>
      </header>

      {/* Toast Feedback Banner */}
      {toast && (
        <div className={`toast-banner toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Backend connection error banner */}
      {error && (
        <div className="error-banner">
          <strong>Backend Connection Error:</strong> {error}
          <div style={{ marginTop: "0.5rem" }}>
            <button className="btn btn-secondary" onClick={loadAllData}>
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Main Side-by-Side Views */}
      <main className="main-content">
        {loading && stock.length === 0 ? (
          <div className="loading-state">Loading kitchen inventory and menu...</div>
        ) : (
          <div className="split-view">
            {/* Left Panel: Kitchen Stock Management */}
            <section className="panel panel-left">
              <StockTable
                stock={stock}
                dishes={dishes}
                onRefresh={loadAllData}
                onNotify={showNotification}
              />
            </section>

            {/* Right Panel: Diner Menu & Live Ordering */}
            <section className="panel panel-right">
              <MenuView
                dishes={dishes}
                onRefresh={loadAllData}
                onNotify={showNotification}
              />
            </section>
          </div>
        )}
      </main>

      {/* Add Ingredient Modal */}
      <AddIngredientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        existingNames={stock.map((s) => s.name)}
        onAdded={loadAllData}
        onNotify={showNotification}
      />
    </div>
  );
}

export default App;
