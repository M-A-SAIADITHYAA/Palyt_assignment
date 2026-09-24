export interface StockItem {
  name: string;
  qty: number;
  unit: string;
  par: number;
}

export interface RecipeIngredient {
  name: string;
  qty: number;
  unit: string;
}

export interface Dish {
  dish: string;
  price: number;
  ingredients: RecipeIngredient[];
  available: boolean;
  reason: string | null;
}

export interface OrderResponse {
  message: string;
  stock: StockItem[];
  menu: Dish[];
}

export interface AddIngredientPayload {
  name: string;
  qty: number;
  unit: string;
  par: number;
}

export interface UpdateIngredientPayload {
  qty: number;
  par?: number;
}
