import React, { useState } from "react";
import { addIngredient } from "../api";

interface AddIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingNames: string[];
  onAdded: () => void;
  onNotify?: (msg: string, type: "success" | "warning" | "error") => void;
}

export const AddIngredientModal: React.FC<AddIngredientModalProps> = ({
  isOpen,
  onClose,
  existingNames,
  onAdded,
  onNotify,
}) => {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("g");
  const [par, setPar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation (Catching "Nonsense")
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Ingredient name cannot be empty or spaces.");
      return;
    }

    // Check duplicate
    if (
      existingNames.some(
        (existing) => existing.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      setError(`'${cleanName}' already exists in kitchen stock.`);
      return;
    }

    const numQty = parseFloat(qty);
    if (isNaN(numQty) || numQty < 0) {
      setError("Initial stock quantity must be a non-negative number.");
      return;
    }

    const numPar = parseFloat(par);
    if (isNaN(numPar) || numPar < 0) {
      setError("Par buffer level must be a non-negative number.");
      return;
    }

    try {
      setLoading(true);
      await addIngredient({
        name: cleanName,
        qty: numQty,
        unit,
        par: numPar,
      });

      onAdded();
      onNotify?.(`Added '${cleanName}' to stock!`, "success");
      // Reset form
      setName("");
      setQty("");
      setPar("");
      setUnit("g");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add ingredient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>Add New Ingredient</h3>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="form-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="ing-name">Ingredient Name</label>
            <input
              id="ing-name"
              type="text"
              placeholder="e.g. Cardamom, Paneer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ing-qty">Current Quantity</label>
              <input
                id="ing-qty"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 500"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="ing-unit">Unit</label>
              <select
                id="ing-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="g">grams (g)</option>
                <option value="kg">kilograms (kg)</option>
                <option value="ml">milliliters (ml)</option>
                <option value="l">liters (l)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ing-par">
              Par Buffer Level
              <span className="help-text"> (dishes go off menu below this)</span>
            </label>
            <input
              id="ing-par"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 100"
              value={par}
              onChange={(e) => setPar(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Ingredient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
