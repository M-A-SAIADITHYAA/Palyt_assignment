"""
Core inventory and recipe calculation logic for Palyt kitchen management.
Handles unit conversions, par level verification, dish availability, and stock deduction.
"""

from typing import Any, Dict, List, Optional, Tuple

# Unit conversion factors to a base unit (g for mass, ml for volume)
UNIT_FACTORS: Dict[str, Tuple[str, float]] = {
    "g": ("mass", 1.0),
    "kg": ("mass", 1000.0),
    "ml": ("volume", 1.0),
    "l": ("volume", 1000.0),
}


def normalize_unit(unit: str) -> str:
    """Normalize unit string to lowercase and strip whitespace."""
    return unit.strip().lower()


def convert_quantity(qty: float, from_unit: str, to_unit: str) -> float:
    """
    Convert a quantity from one unit to another.
    Supports mass (kg, g) and volume (l, ml).
    Raises ValueError on incompatible or unsupported units.
    """
    from_u = normalize_unit(from_unit)
    to_u = normalize_unit(to_unit)

    if from_u == to_u:
        return float(qty)

    if from_u not in UNIT_FACTORS:
        raise ValueError(f"Unsupported unit: '{from_unit}'")
    if to_u not in UNIT_FACTORS:
        raise ValueError(f"Unsupported unit: '{to_unit}'")

    from_type, from_mult = UNIT_FACTORS[from_u]
    to_type, to_mult = UNIT_FACTORS[to_u]

    if from_type != to_type:
        raise ValueError(
            f"Cannot convert between {from_type} ('{from_unit}') and {to_type} ('{to_unit}')"
        )

    # Convert to base unit, then to target unit
    base_qty = float(qty) * from_mult
    return base_qty / to_mult


def get_stock_item_by_name(stock: List[Dict[str, Any]], name: str) -> Optional[Dict[str, Any]]:
    """Look up an ingredient in stock by name (case-insensitive)."""
    target = name.strip().lower()
    for item in stock:
        if item["name"].strip().lower() == target:
            return item
    return None


def is_dish_available(dish: Dict[str, Any], stock: List[Dict[str, Any]]) -> Tuple[bool, Optional[str]]:
    """
    Check if a dish can be ordered right now.
    Rules:
    1. Every ingredient used in the recipe must exist in kitchen stock.
    2. According to Palyt rule: A dish is unavailable when any ingredient it uses
       has fallen below its par level (qty < par).
    3. Even if par is 0, stock must have at least enough quantity to make 1 portion.
    
    Returns (True, None) if available, or (False, reason) if unavailable.
    """
    for ing in dish.get("ingredients", []):
        name = ing["name"]
        needed_qty = ing["qty"]
        needed_unit = ing["unit"]

        stock_item = get_stock_item_by_name(stock, name)
        if stock_item is None:
            return False, f"Missing ingredient: '{name}' is not in kitchen stock"

        stock_qty = stock_item["qty"]
        par_qty = stock_item["par"]
        stock_unit = stock_item["unit"]

        # Rule 2: Kitchen stock has fallen below par level
        if stock_qty < par_qty:
            return (
                False,
                f"'{name}' is below par level ({stock_qty} {stock_unit} < {par_qty} {stock_unit})",
            )

        # Rule 3: Must have at least enough for one portion
        try:
            needed_in_stock_units = convert_quantity(needed_qty, needed_unit, stock_unit)
        except ValueError as e:
            return False, f"Unit error for '{name}': {str(e)}"

        if stock_qty < needed_in_stock_units:
            return (
                False,
                f"Insufficient '{name}' for one portion (need {needed_in_stock_units:.3f} {stock_unit}, have {stock_qty} {stock_unit})",
            )

    return True, None


def evaluate_all_dishes(
    recipes: List[Dict[str, Any]], stock: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Annotate each dish in recipes with its real-time availability and reason.
    """
    annotated = []
    for dish in recipes:
        available, reason = is_dish_available(dish, stock)
        annotated.append({
            "dish": dish["dish"],
            "price": dish["price"],
            "ingredients": dish["ingredients"],
            "available": available,
            "reason": reason,
        })
    return annotated


def deduct_dish_ingredients(
    dish: Dict[str, Any], stock: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Deduct the ingredients of one portion of the dish from stock.
    Returns a new deep-copied list of updated stock items with rounded quantities.
    Raises ValueError if the dish is not available to order.
    """
    available, reason = is_dish_available(dish, stock)
    if not available:
        raise ValueError(f"Cannot order '{dish.get('dish')}': {reason}")

    # Create a copy of the stock list with copied dicts
    updated_stock = [{k: v for k, v in item.items()} for item in stock]

    for ing in dish.get("ingredients", []):
        name = ing["name"]
        needed_qty = ing["qty"]
        needed_unit = ing["unit"]

        target_item = get_stock_item_by_name(updated_stock, name)
        if target_item is None:
            raise ValueError(f"Ingredient '{name}' not found in stock")

        stock_unit = target_item["unit"]
        deduct_qty = convert_quantity(needed_qty, needed_unit, stock_unit)

        new_qty = target_item["qty"] - deduct_qty
        # Clean rounding to avoid floating-point noise (e.g. 1.2199999999999998 -> 1.22)
        target_item["qty"] = round(new_qty, 4)

    return updated_stock
