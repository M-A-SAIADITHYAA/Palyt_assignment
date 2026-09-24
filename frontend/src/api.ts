import type {
  AddIngredientPayload,
  Dish,
  OrderResponse,
  StockItem,
  UpdateIngredientPayload,
} from "./types";

const API_BASE = "http://localhost:8000/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchStock(): Promise<StockItem[]> {
  const res = await fetch(`${API_BASE}/stock`);
  return handleResponse<StockItem[]>(res);
}

export async function fetchMenu(): Promise<Dish[]> {
  const res = await fetch(`${API_BASE}/menu`);
  return handleResponse<Dish[]>(res);
}

export async function addIngredient(
  payload: AddIngredientPayload
): Promise<{ message: string; item: StockItem }> {
  const res = await fetch(`${API_BASE}/stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string; item: StockItem }>(res);
}

export async function updateIngredient(
  name: string,
  payload: UpdateIngredientPayload
): Promise<{ message: string; item: StockItem }> {
  const res = await fetch(`${API_BASE}/stock/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string; item: StockItem }>(res);
}

export async function deleteIngredient(
  name: string
): Promise<{ message: string; affected_dishes: string[] }> {
  const res = await fetch(`${API_BASE}/stock/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  return handleResponse<{ message: string; affected_dishes: string[] }>(res);
}

export async function placeOrder(dishName: string): Promise<OrderResponse> {
  const res = await fetch(`${API_BASE}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dish: dishName }),
  });
  return handleResponse<OrderResponse>(res);
}

export async function resetData(): Promise<{ message: string; stock: StockItem[]; menu: Dish[] }> {
  const res = await fetch(`${API_BASE}/reset`, {
    method: "POST",
  });
  return handleResponse<{ message: string; stock: StockItem[]; menu: Dish[] }>(res);
}
