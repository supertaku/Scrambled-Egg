/**
 * @file canteenStores.ts
 * @description List of canteen stalls and their menus available on campus.
 *
 * HOW TO REPLACE WITH REAL DATA
 * ─────────────────────────────
 * 1. Keep the `FoodItem` and `CanteenStore` interfaces to ensure the UI renders correctly.
 * 2. Replace the `canteenStores` array with verified stall and menu data.
 * 3. `id` for each store must be unique and used as the slug for navigation.
 * 4. This data is currently bundled with the app; to make it dynamic, fetch it from
 *    a remote API and update the Canteen screen to use a loading state.
 */

export interface FoodItem {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface CanteenStore {
  id: string;
  name: string;
  description: string;
  location: string;
  foods: FoodItem[];
}

export const canteenStores: CanteenStore[] = [
  {
    id: "ate-joy",
    name: "Rice Meal Stall",
    description: "Campus food note for common rice meals and quick lunch options.",
    location: "Main canteen area",
    foods: [
      { id: "s1", name: "Sisig Silog", price: 75, description: "Crispy pork sisig with egg and fried rice." },
      { id: "s2", name: "Tapsilog", price: 80, description: "Beef tapa, egg, and fried rice with vinegar." },
      { id: "s3", name: "Pork Sinigang", price: 60, description: "Sour soup with pork and vegetables." }
    ]
  },
  {
    id: "tup-coop",
    name: "Cooperative Counter",
    description: "Campus food note for fast snacks, drinks, and basic student supplies.",
    location: "Cooperative counter",
    foods: [
      { id: "c1", name: "Pancit Canton", price: 20, description: "Instant noodles in Sweet & Spicy or Chilimansi." },
      { id: "c2", name: "Hotdog Sandwich", price: 35, description: "Classic hotdog in a bun with ketchup and mayo." },
      { id: "c3", name: "Bottled Water", price: 15, description: "500ml purified drinking water." }
    ]
  },
  {
    id: "siomai-house",
    name: "Dimsum Stall",
    description: "Campus food note for budget rice meals and short-break snacks.",
    location: "Canteen stall row",
    foods: [
      { id: "sh1", name: "Siomai Rice", price: 55, description: "4 pcs pork siomai with chili garlic, served with rice." },
      { id: "sh2", name: "4pcs Siomai", price: 40, description: "4 pcs steamed pork and shrimp siomai." },
      { id: "sh3", name: "Gulaman", price: 15, description: "Ice-cold black gulaman drink." }
    ]
  },
  {
    id: "brew-corner",
    name: "Drink and Snack Stall",
    description: "Campus food note for drinks and light snacks during vacant periods.",
    location: "Near study tables",
    foods: [
      { id: "b1", name: "Iced Coffee", price: 45, description: "Cold coffee with milk and light sweetness." },
      { id: "b2", name: "Cheese Sandwich", price: 38, description: "Toasted sandwich with cheese filling." },
      { id: "b3", name: "Choco Cooler", price: 50, description: "Cold chocolate drink with ice." }
    ]
  }
];

export function getCanteenStoreById(storeId: string | string[] | undefined): CanteenStore | undefined {
  const id = Array.isArray(storeId) ? storeId[0] : storeId;
  return canteenStores.find((store) => store.id === id);
}
