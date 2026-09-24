import copy
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
try:
    from .logic import (
        convert_quantity,
        deduct_dish_ingredients,
        evaluate_all_dishes,
        get_stock_item_by_name,
        normalize_unit,
    )
except ImportError:
    from logic import (
        convert_quantity,
        deduct_dish_ingredients,
        evaluate_all_dishes,
        get_stock_item_by_name,
        normalize_unit,
    )

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="Palyt Kitchen & Menu API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Data Models & Nonsense Validation ---

VALID_UNITS = {"g", "kg", "ml", "l"}


class StockItemCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Ingredient name")
    qty: float = Field(..., ge=0, description="Current stock quantity (must be non-negative)")
    unit: str = Field(..., description="Measurement unit (g, kg, ml, l)")
    par: float = Field(..., ge=0, description="Par buffer level (must be non-negative)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Ingredient name cannot be blank or whitespace only")
        return cleaned

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        norm = normalize_unit(v)
        if norm not in VALID_UNITS:
            raise ValueError(f"Unit must be one of: {', '.join(sorted(VALID_UNITS))}")
        return norm


class StockItemUpdate(BaseModel):
    qty: float = Field(..., ge=0, description="Updated stock quantity")
    par: Optional[float] = Field(None, ge=0, description="Updated par level (optional)")


class OrderRequest(BaseModel):
    dish: str = Field(..., min_length=1, description="Dish name to order")


# --- State Management (In-Memory from JSON files) ---

def load_initial_data():
    with open(BASE_DIR / "stock.json", "r") as f:
        stock = json.load(f)
    with open(BASE_DIR / "recipes.json", "r") as f:
        recipes = json.load(f)
    return stock, recipes


INITIAL_STOCK, INITIAL_RECIPES = load_initial_data()
current_stock: List[Dict[str, Any]] = copy.deepcopy(INITIAL_STOCK)
current_recipes: List[Dict[str, Any]] = copy.deepcopy(INITIAL_RECIPES)


# --- Endpoints ---

@app.get("/api/stock")
def get_stock():
    """Get all current stock items."""
    return current_stock


@app.post("/api/stock", status_code=201)
def add_ingredient(item: StockItemCreate):
    """
    Add a new ingredient to kitchen stock.
    Rejects duplicate ingredient names.
    """
    existing = get_stock_item_by_name(current_stock, item.name)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ingredient '{item.name}' already exists in stock.",
        )

    new_item = {
        "name": item.name,
        "qty": item.qty,
        "unit": item.unit,
        "par": item.par,
    }
    current_stock.append(new_item)
    return {"message": f"Added '{item.name}' to stock", "item": new_item}


@app.put("/api/stock/{name}")
def update_stock(name: str, update: StockItemUpdate):
    """
    Update quantity and/or par level of an existing ingredient.
    """
    item = get_stock_item_by_name(current_stock, name)
    if not item:
        raise HTTPException(status_code=404, detail=f"Ingredient '{name}' not found")

    item["qty"] = update.qty
    if update.par is not None:
        item["par"] = update.par

    return {"message": f"Updated '{item['name']}'", "item": item}


@app.delete("/api/stock/{name}")
def delete_stock(name: str):
    """
    Delete an ingredient from stock.
    Identifies which dishes in the menu are affected by this deletion.
    """
    item = get_stock_item_by_name(current_stock, name)
    if not item:
        raise HTTPException(status_code=404, detail=f"Ingredient '{name}' not found")

    target_name = item["name"].strip().lower()
    # Find all dishes that use this ingredient
    affected_dishes = [
        dish["dish"]
        for dish in current_recipes
        if any(ing["name"].strip().lower() == target_name for ing in dish.get("ingredients", []))
    ]

    current_stock.remove(item)
    return {
        "message": f"Deleted '{item['name']}' from stock",
        "affected_dishes": affected_dishes,
    }


@app.get("/api/menu")
def get_menu():
    """
    Get the menu with live availability and reasons based on current kitchen stock.
    """
    return evaluate_all_dishes(current_recipes, current_stock)


@app.post("/api/order")
def place_order(order: OrderRequest):
    """
    Order a dish:
    1. Validates dish exists and is currently available.
    2. Deducts required portion quantities from stock.
    3. Re-evaluates menu availability.
    """
    global current_stock
    target_dish_name = order.dish.strip().lower()
    recipe = next(
        (r for r in current_recipes if r["dish"].strip().lower() == target_dish_name),
        None,
    )

    if not recipe:
        raise HTTPException(status_code=404, detail=f"Dish '{order.dish}' not found on menu")

    try:
        updated_stock = deduct_dish_ingredients(recipe, current_stock)
        current_stock = updated_stock
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    updated_menu = evaluate_all_dishes(current_recipes, current_stock)
    return {
        "message": f"Successfully placed order for '{recipe['dish']}'",
        "stock": current_stock,
        "menu": updated_menu,
    }


@app.post("/api/reset")
def reset_to_initial():
    """Reset stock back to original stock.json for testing/demoing."""
    global current_stock
    current_stock = copy.deepcopy(INITIAL_STOCK)
    return {
        "message": "Stock reset to initial values",
        "stock": current_stock,
        "menu": evaluate_all_dishes(current_recipes, current_stock),
    }
