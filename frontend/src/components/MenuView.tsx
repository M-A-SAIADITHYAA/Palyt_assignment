import React, { useState } from "react";
import type { Dish } from "../types";
import { placeOrder } from "../api";

interface MenuViewProps {
  dishes: Dish[];
  onRefresh: () => void;
  onNotify?: (msg: string, type: "success" | "warning" | "error") => void;
}

export const MenuView: React.FC<MenuViewProps> = ({
  dishes,
  onRefresh,
  onNotify,
}) => {
  const [orderingDish, setOrderingDish] = useState<string | null>(null);

  const handleOrder = async (dishName: string) => {
    try {
      setOrderingDish(dishName);
      const res = await placeOrder(dishName);
      onRefresh();
      onNotify?.(res.message, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place order";
      alert(msg);
      onNotify?.(msg, "error");
    } finally {
      setOrderingDish(null);
    }
  };

  const availableCount = dishes.filter((d) => d.available).length;

  return (
    <div className="menu-container">
      <div className="menu-header">
        <div>
          <h2>Diner Menu</h2>
          <p className="subtitle">
            {availableCount} of {dishes.length} dishes available to order
          </p>
        </div>
      </div>

      <div className="menu-grid">
        {dishes.map((dish) => {
          const isOrdering = orderingDish === dish.dish;

          return (
            <div
              key={dish.dish}
              className={`menu-card ${
                dish.available ? "card-available" : "card-unavailable"
              }`}
            >
              <div className="card-top">
                <div className="card-title-group">
                  <h3 className="dish-name">{dish.dish}</h3>
                  <span className="dish-price">₹{dish.price}</span>
                </div>
                <div>
                  {dish.available ? (
                    <span className="badge badge-healthy">Available</span>
                  ) : (
                    <span className="badge badge-alert">Sold Out</span>
                  )}
                </div>
              </div>

              {/* Reason why dish is unavailable */}
              {!dish.available && dish.reason && (
                <div className="unavailable-reason" title={dish.reason}>
                  ⚠️ {dish.reason}
                </div>
              )}

              {/* Recipe Ingredients Preview */}
              <div className="recipe-ingredients">
                <span className="ingredients-label">Uses: </span>
                {dish.ingredients.map((ing, i) => (
                  <span key={ing.name} className="ing-chip">
                    {ing.name} ({ing.qty}
                    {ing.unit})
                    {i < dish.ingredients.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>

              {/* Order Action Button */}
              <div className="card-actions">
                <button
                  onClick={() => handleOrder(dish.dish)}
                  disabled={!dish.available || isOrdering}
                  className={`btn btn-order ${
                    dish.available ? "btn-order-active" : "btn-order-disabled"
                  }`}
                >
                  {isOrdering
                    ? "Placing Order..."
                    : dish.available
                    ? `Order ${dish.dish}`
                    : "Unavailable"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
