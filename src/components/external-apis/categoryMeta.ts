import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  ChartLine,
  Clapperboard,
  Cloud,
  CloudSun,
  Leaf,
  MapPin,
  MessagesSquare,
  Mic,
  Music2,
  Rocket,
  Search,
  ShoppingCart,
  Sparkles,
  Ticket,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface CategoryMeta {
  icon: LucideIcon;
  color: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  "AI / LLM": { icon: Sparkles, color: "#ec4899" },
  "Maps & Location": { icon: MapPin, color: "#6366f1" },
  Environmental: { icon: Leaf, color: "#10b981" },
  Search: { icon: Search, color: "#f59e0b" },
  Media: { icon: Clapperboard, color: "#ef4444" },
  Productivity: { icon: CalendarDays, color: "#3b82f6" },
  Analytics: { icon: ChartColumn, color: "#8b5cf6" },
  Voice: { icon: Mic, color: "#d946ef" },
  Commerce: { icon: ShoppingCart, color: "#f97316" },
  Music: { icon: Music2, color: "#22c55e" },
  Social: { icon: MessagesSquare, color: "#0ea5e9" },
  Finance: { icon: ChartLine, color: "#84cc16" },
  Events: { icon: Ticket, color: "#eab308" },
  Knowledge: { icon: BookOpen, color: "#a855f7" },
  Weather: { icon: CloudSun, color: "#38bdf8" },
  Space: { icon: Rocket, color: "#f43f5e" },
  Utility: { icon: Wrench, color: "#64748b" },
};

const DEFAULT_CATEGORY_META: CategoryMeta = { icon: Cloud, color: "#14b8a6" };

export function getCategoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] || DEFAULT_CATEGORY_META;
}
