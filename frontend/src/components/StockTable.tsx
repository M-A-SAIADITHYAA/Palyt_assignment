import React, { useState } from "react";
import type { Dish, StockItem } from "../types";
import { deleteIngredient, updateIngredient } from "../api";

interface StockTableProps {
  stock: StockItem[];
  dishes: Dish[];
  onRefresh: () => void;
  onNotify?: (msg: string, type: "success" | "warning" | "error") => void;
}

export const StockTable: React.FC<StockTableProps> = ({
  stock,
  dishes,
  onRefresh,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editPar, setEditPar] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Filter ingredients live as user types
  const filteredStock = stock.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const startEditing = (item: StockItem) => {
    setEditingItem(item.name);
    setEditQty(item.qty);
    setEditPar(item.par);
  };

  const cancelEditing = () => {
    setEditingItem(null);
  };

  const handleSave = async (name: string) => {
    if (editQty < 0 || editPar < 0) {
      alert("Quantity and Par level cannot be negative.");
      return;
    }

    try {
      setLoading(true);
      await updateIngredient(name, { qty: editQty, par: editPar });
      setEditingItem(null);
      onRefresh();
      onNotify?.(`Updated ${name} successfully`, "success");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    // Find dishes dependent on this ingredient
    const target = name.toLowerCase();
    const dependentDishes = dishes
      .filter((d) =>
        d.ingredients.some((i) => i.name.toLowerCase() === target)
      )
      .map((d) => d.dish);

    let confirmMsg = `Are you sure you want to delete '${name}' from stock?`;
    if (dependentDishes.length > 0) {
      confirmMsg =
        `⚠️ CAUTION: '${name}' is required by:\n- ${dependentDishes.join(
          "\n- "
        )}\n\nDeleting it will immediately mark these dishes as UNAVAILABLE on the menu.\n\nDo you want to proceed?`;
    }

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setLoading(true);
      const res = await deleteIngredient(name);
      onRefresh();
      if (res.affected_dishes.length > 0) {
        onNotify?.(
          `Deleted ${name}. Affected dishes now unavailable: ${res.affected_dishes.join(", ")}`,
          "warning"
        );
      } else {
        onNotify?.(`Deleted ${name} from stock`, "success");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stock-container">
      <div className="stock-header">
        <div>
          <h2>Kitchen Stock</h2>
          <p className="subtitle">
            Showing {filteredStock.length} of {stock.length} ingredients
          </p>
        </div>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchTerm("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="table-responsive">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Current Qty</th>
              <th>Par Buffer</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No ingredients match "{searchTerm}"
                </td>
              </tr>
            ) : (
              filteredStock.map((item) => {
                const isEditing = editingItem === item.name;
                const isBelowPar = item.qty < item.par;

                return (
                  <tr
                    key={item.name}
                    className={isBelowPar ? "row-below-par" : "row-ok"}
                  >
                    <td className="item-name">
                      <strong>{item.name}</strong>
                    </td>

                    {isEditing ? (
                      <>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editQty}
                            onChange={(e) =>
                              setEditQty(parseFloat(e.target.value) || 0)
                            }
                            className="edit-input"
                            autoFocus
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editPar}
                            onChange={(e) =>
                              setEditPar(parseFloat(e.target.value) || 0)
                            }
                            className="edit-input"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="qty-cell">
                          {item.qty} <span className="unit-label">{item.unit}</span>
                        </td>
                        <td className="par-cell">
                          {item.par} <span className="unit-label">{item.unit}</span>
                        </td>
                      </>
                    )}

                    <td>
                      <span className="unit-badge">{item.unit}</span>
                    </td>

                    <td>
                      {isBelowPar ? (
                        <span className="badge badge-alert" title="Below par level">
                          ⚠️ Below Par
                        </span>
                      ) : (
                        <span className="badge badge-healthy" title="Sufficient stock">
                          ✓ Healthy
                        </span>
                      )}
                    </td>

                    <td className="actions-cell">
                      {isEditing ? (
                        <div className="btn-group">
                          <button
                            onClick={() => handleSave(item.name)}
                            disabled={loading}
                            className="btn btn-save"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={loading}
                            className="btn btn-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="btn-group">
                          <button
                            onClick={() => startEditing(item)}
                            className="btn btn-edit"
                            title="Edit stock or par level"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.name)}
                            className="btn btn-delete"
                            title="Delete ingredient"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
