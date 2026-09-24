import { Smartphone, CreditCard, KeyRound, GlassWater, Backpack, FileText, Shirt, HelpCircle } from "lucide-react";

// Keep the `value` list in sync with backend/src/utils/itemCategories.js
// — icons live only here since the backend never renders anything.
export const ITEM_CATEGORIES = [
  { value: "electronics", label: "Electronics", icon: Smartphone },
  { value: "id_card", label: "ID card", icon: CreditCard },
  { value: "keys", label: "Keys", icon: KeyRound },
  { value: "bottle", label: "Bottle", icon: GlassWater },
  { value: "bag", label: "Bag", icon: Backpack },
  { value: "document", label: "Document", icon: FileText },
  { value: "clothing", label: "Clothing", icon: Shirt },
  { value: "other", label: "Other", icon: HelpCircle },
];

export function getCategoryIcon(value) {
  return ITEM_CATEGORIES.find((c) => c.value === value)?.icon || HelpCircle;
}

export function getCategoryLabel(value) {
  return ITEM_CATEGORIES.find((c) => c.value === value)?.label || null;
}

// Quick-pick locations for the common spots items actually turn up —
// still a free-text field underneath, this just makes the common case
// one tap instead of typing the same handful of places over and over.
export const CAMPUS_LOCATIONS = [
  "Library",
  "Cafeteria",
  "Hostel Block A",
  "Hostel Block B",
  "Lecture Halls",
  "Sports Complex",
  "Admin Block",
];
