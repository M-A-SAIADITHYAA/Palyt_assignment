# Palyt Kitchen Inventory & Live Menu Portal

This project connects real-time kitchen inventory tracking directly to a diner-facing menu, automatically managing dish availability based on stock and buffer par levels.

Built for the **Palyt Engineering Intern Task**.

---

## Tech Stack
* **Frontend**: React 18, Vite, TypeScript, Custom CSS (Responsive side-by-side view)
* **Backend & Logic**: Python 3.12, FastAPI, Pydantic (strict input validation)
* **Testing**: Pytest & FastAPI TestClient

---

## Quickstart Guide

### 1. Run the Automated Tests
The business logic, unit conversions, and reactive API endpoints are verified by 12 comprehensive unit and integration tests:

```bash
# Setup backend virtual environment (if not already done)
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# Run all tests
backend/venv/bin/pytest backend/ -v
```

### 2. Start the Backend API
```bash
backend/venv/bin/uvicorn backend.main:app --port 8000 --reload
```
API runs on `http://localhost:8000` (interactive Swagger documentation available at `http://localhost:8000/docs`).

### 3. Start the Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open your browser to: **`http://localhost:5173`**

---

## Live Demo Walkthrough (Watching an Order Take Dishes Off the Menu)

1. **Initial State**:
   - Both **Kitchen Stock** (left) and **Diner Menu** (right) are displayed side-by-side.
   - Notice that **Chicken Biryani** is immediately *Sold Out* because Chicken stock is `0 kg` (`par: 1 kg`).
   - Notice that **Butter Naan**, **Veg Pulao**, and **Jeera Rice** are *Sold Out* because `Refined Flour` and `Cumin Seeds` are missing from initial stock.
   - **Paneer Butter Masala** and **Shahi Paneer Korma** are *Available*.

2. **Triggering the Below-Par Threshold**:
   - In Kitchen Stock, find **Cashews**: Quantity is `300 g`, Par is `250 g`.
   - Each order of *Paneer Butter Masala* consumes `15 g` of Cashews.
   - Click **"Order Paneer Butter Masala"** 3 times:
     - Order 1: Cashews drops to `285 g` (Available)
     - Order 2: Cashews drops to `270 g` (Available)
     - Order 3: Cashews drops to `255 g` (Available)
   - Click a 4th time:
     - Cashews drops to `240 g` (< `250 g` par level).
     - **Paneer Butter Masala** and **Shahi Paneer Korma** instantly switch to **Sold Out** with the alert:
       `⚠️ 'Cashews' is below par level (240.0 g < 250 g)`.

3. **Restocking Brings Dishes Back**:
   - On the Cashews row, click **Edit**, change quantity to `600 g`, and click **Save**.
   - Both dishes instantly become **Available** again on the menu.

4. **Adding Missing Ingredients**:
   - Click **+ Add Ingredient**, enter:
     - Name: `Refined Flour`
     - Qty: `1000`
     - Unit: `g`
     - Par: `100`
   - Notice that **Butter Naan** immediately turns **Available**!

5. **Deleting Ingredients**:
   - Try deleting `Bay Leaves`: deletes cleanly because no menu dish uses it.
   - Try deleting `Cashews`: prompts with a cautionary warning showing that *Paneer Butter Masala* and *Shahi Paneer Korma* depend on it. Confirming the deletion immediately marks both dishes unavailable.

6. **Reset Anytime**:
   - Click **↺ Reset Starter Stock** at any time in the top header to restore the starter data.

---

## Project Write-Up

### 1. The Calls Made (Decisions & Edge Cases)

* **Unit Conversions (Purchasing vs Cooking)**:
  - Kitchen stock is tracked in purchasing units (`kg`, `ml`), while recipes specify portion units (`g`, `ml`).
  - Standard conversions were implemented (`1 kg = 1000 g`, `1 l = 1000 ml`). 
  - Every order deduction converts recipe quantities into the unit of the stock item before subtracting, with math rounded to 4 decimal places to prevent floating-point inaccuracies (e.g. `1.2199999999999998` -> `1.22`).

* **Missing Ingredients in Starter Data**:
  - `recipes.json` requires `Refined Flour` (for Butter Naan) and `Cumin Seeds` (for Veg Pulao and Jeera Rice), but neither was present in `stock.json`.
  - **Decision**: If a recipe calls for an ingredient not present in kitchen stock, the dish is marked **Unavailable (Missing Ingredient)**. A kitchen cannot prepare a dish without its core ingredients. Adding the ingredient to stock automatically activates the dish.

* **Ingredient Deletion Policy**:
  - **Unused ingredients** (e.g. `Bay Leaves`): Can be deleted immediately without impact.
  - **Ingredients used by active dishes** (e.g. `Cashews`): The system prompts with a warning listing the specific dependent dishes. When confirmed, deletion proceeds, and the reactive evaluation loop immediately marks dependent dishes as unavailable due to missing stock.
  - *Rationale*: A restaurant might stop serving an ingredient altogether; rather than locking down operational changes, the system protects diners by taking affected dishes off the menu.

* **Critique of the "Below Par = Unavailable" Rule**:
  - In actual restaurant operations, `par level` is a **reorder trigger**, not physical exhaustion.
  - If a kitchen holds `400 g` of Paneer with a par of `500 g`, there is still enough physical paneer to serve two portions (`180 g` each). Shutting down sales turns away paying diners while fresh inventory remains in the kitchen.
  - *Better real-world model*:
    1. **Par Alert**: Triggers a notification or purchase order draft for the inventory manager.
    2. **86 / Sold Out**: Only disable ordering when `stock < recipe_portion`.

---

### 2. How Checked (Verification & Testing)

* **Automated Unit & API Tests (`pytest backend/`)**:
  - Exact weight conversions verified (`180 g` to `kg` yields `0.18 kg`).
  - Incompatible unit conversions (e.g., mass `g` to volume `ml`) raise `ValueError`.
  - Initial starter dataset verified: Paneer dishes available, Chicken Biryani sold out (0 stock), Naan and Pulao sold out (missing stock).
  - Multi-order deduction loop verified: placing 4 orders of Paneer Butter Masala reduces Cashews (`300g` -> `285g` -> `270g` -> `255g` -> `240g`), triggering the par threshold (`< 250g`) and disabling both cashew dishes.

* **What would have to be wrong for tests to still pass?**:
  - Tests would only falsely pass if the expected values mirrored a shared miscalculation in the conversion multipliers (e.g. assuming $1\text{ kg} = 100\text{ g}$). All test numbers were independently hand-calculated from the raw JSON files before writing assertions.

---

### 3. Another Day (Future Improvements)

1. **Concurrent Order Reservations**: Add optimistic concurrency or temporary stock reservation locks during checkout so two concurrent tables don't order the last portion at the same millisecond.
2. **Sub-Recipes & Prep Batches**: In commercial kitchens, prep items (e.g., base curry gravy) are pre-made in batches and consumed across multiple dishes. Modeling sub-recipes would allow tracking batch prep.
3. **Automated Supplier Purchase Orders**: Automatically generate a reorder slip when an item dips below par.
4. **Persistent Database**: Migrate in-memory state to a relational database (PostgreSQL) with audit logging for stock adjustments.
