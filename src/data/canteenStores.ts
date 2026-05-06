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
    name: "Ate Joy's Eatery",
    description: "Home-cooked rice meals, silog plates, and warm student favorites for a quick lunch.",
    location: "Main canteen area",
    foods: [
      { id: "s1", name: "Sisig Silog", price: 75, description: "Crispy pork sisig with egg and fried rice." },
      { id: "s2", name: "Tapsilog", price: 80, description: "Beef tapa, egg, and fried rice with vinegar." },
      { id: "s3", name: "Pork Sinigang", price: 60, description: "Sour soup with pork and vegetables." }
    ]
  },
  {
    id: "tup-coop",
    name: "TUP Cooperative",
    description: "Fast snacks, drinks, and basic supplies for students between classes.",
    location: "Cooperative counter",
    foods: [
      { id: "c1", name: "Pancit Canton", price: 20, description: "Instant noodles in Sweet & Spicy or Chilimansi." },
      { id: "c2", name: "Hotdog Sandwich", price: 35, description: "Classic hotdog in a bun with ketchup and mayo." },
      { id: "c3", name: "Bottled Water", price: 15, description: "500ml purified drinking water." }
    ]
  },
  {
    id: "siomai-house",
    name: "Siomai House",
    description: "Steamed dimsum, budget rice meals, and cold drinks for short breaks.",
    location: "Canteen stall row",
    foods: [
      { id: "sh1", name: "Siomai Rice", price: 55, description: "4 pcs pork siomai with chili garlic, served with rice." },
      { id: "sh2", name: "4pcs Siomai", price: 40, description: "4 pcs steamed pork and shrimp siomai." },
      { id: "sh3", name: "Gulaman", price: 15, description: "Ice-cold black gulaman drink." }
    ]
  },
  {
    id: "brew-corner",
    name: "Brew Corner",
    description: "Coffee, coolers, and light snacks for long vacant periods and study sessions.",
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
