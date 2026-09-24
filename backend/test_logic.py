import json
from pathlib import Path
import pytest

try:
    from backend.logic import (
        convert_quantity,
        is_dish_available,
        evaluate_all_dishes,
        deduct_dish_ingredients,
        get_stock_item_by_name,
    )
except ImportError:
    from logic import (
        convert_quantity,
        is_dish_available,
        evaluate_all_dishes,
        deduct_dish_ingredients,
        get_stock_item_by_name,
    )

BASE_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture
def starter_stock():
    with open(BASE_DIR / "stock.json", "r") as f:
        return json.load(f)


@pytest.fixture
def starter_recipes():
    with open(BASE_DIR / "recipes.json", "r") as f:
        return json.load(f)


# --- Unit Conversion Tests ---

def test_unit_conversion_mass():
    # 180 grams to kg: 180 / 1000 = 0.18
    assert convert_quantity(180, "g", "kg") == pytest.approx(0.18)
    # 1.4 kg to grams: 1.4 * 1000 = 1400
    assert convert_quantity(1.4, "kg", "g") == pytest.approx(1400.0)


def test_unit_conversion_volume():
    # 500 ml to liters
    assert convert_quantity(500, "ml", "l") == pytest.approx(0.5)
    # 1.5 liters to ml
    assert convert_quantity(1.5, "l", "ml") == pytest.approx(1500.0)


def test_incompatible_unit_conversion_raises():
    with pytest.raises(ValueError, match=r"Cannot convert between mass .* and volume"):
        convert_quantity(100, "g", "ml")


def test_invalid_unit_raises():
    with pytest.raises(ValueError, match="Unsupported unit"):
        convert_quantity(100, "handful", "g")


# --- Availability Tests ---

def test_initial_availability_with_starter_data(starter_recipes, starter_stock):
    results = {
        d["dish"]: d
        for d in evaluate_all_dishes(starter_recipes, starter_stock)
    }

    # Paneer Butter Masala has all ingredients in stock and above par
    assert results["Paneer Butter Masala"]["available"] is True

    # Chicken Biryani requires Chicken (qty: 0, par: 1 kg) -> below par and out of stock
    assert results["Chicken Biryani"]["available"] is False
    assert "Chicken" in results["Chicken Biryani"]["reason"]

    # Butter Naan requires Refined Flour, not in stock.json
    assert results["Butter Naan"]["available"] is False
    assert "Refined Flour" in results["Butter Naan"]["reason"]

    # Jeera Rice & Veg Pulao require Cumin Seeds, not in stock.json
    assert results["Jeera Rice"]["available"] is False
    assert "Cumin Seeds" in results["Jeera Rice"]["reason"]
    assert results["Veg Pulao"]["available"] is False
    assert "Cumin Seeds" in results["Veg Pulao"]["reason"]


# --- Stock Deduction & The Reactive Loop Tests ---

def test_deduction_exact_numbers(starter_recipes, starter_stock):
    pbm_recipe = next(r for r in starter_recipes if r["dish"] == "Paneer Butter Masala")
    updated_stock = deduct_dish_ingredients(pbm_recipe, starter_stock)

    # 1. Paneer: initial 1.4 kg, recipe uses 180g (0.18 kg) -> 1.4 - 0.18 = 1.22 kg
    paneer = get_stock_item_by_name(updated_stock, "Paneer")
    assert paneer["qty"] == 1.22

    # 2. Cashews: initial 300g, recipe uses 15g -> 300 - 15 = 285g
    cashews = get_stock_item_by_name(updated_stock, "Cashews")
    assert cashews["qty"] == 285.0

    # 3. Tomatoes: initial 6 kg, recipe uses 150g (0.15 kg) -> 6 - 0.15 = 5.85 kg
    tomatoes = get_stock_item_by_name(updated_stock, "Tomatoes")
    assert tomatoes["qty"] == 5.85

    # 4. Cream: initial 900 ml, recipe uses 40ml -> 900 - 40 = 860 ml
    cream = get_stock_item_by_name(updated_stock, "Cream")
    assert cream["qty"] == 860.0

    # 5. Butter: initial 900g, recipe uses 30g -> 900 - 30 = 870g
    butter = get_stock_item_by_name(updated_stock, "Butter")
    assert butter["qty"] == 870.0


def test_order_drives_dish_below_par_and_removes_from_menu(starter_recipes, starter_stock):
    """
    Demonstrates the core requirement:
    Watching orders drive stock below par, which immediately takes the dish off the menu.
    Cashews start at 300g, par is 250g.
    Paneer Butter Masala uses 15g cashews per order.
    Order 1: 285g
    Order 2: 270g
    Order 3: 255g
    Order 4: 240g -> below par (250g)!
    """
    pbm_recipe = next(r for r in starter_recipes if r["dish"] == "Paneer Butter Masala")
    current_stock = starter_stock

    for _ in range(3):
        current_stock = deduct_dish_ingredients(pbm_recipe, current_stock)

    cashews = get_stock_item_by_name(current_stock, "Cashews")
    assert cashews["qty"] == 255.0
    # Still available because 255 >= 250
    avail, _ = is_dish_available(pbm_recipe, current_stock)
    assert avail is True

    # 4th order: 255 - 15 = 240g
    current_stock = deduct_dish_ingredients(pbm_recipe, current_stock)
    cashews = get_stock_item_by_name(current_stock, "Cashews")
    assert cashews["qty"] == 240.0

    # Now 240 < 250 (par)! Dish must now be UNAVAILABLE!
    avail, reason = is_dish_available(pbm_recipe, current_stock)
    assert avail is False
    assert "below par level" in reason
    assert "Cashews" in reason

    # Attempting to order again should raise an error
    with pytest.raises(ValueError, match="below par level"):
        deduct_dish_ingredients(pbm_recipe, current_stock)
