import { createFileRoute } from "@tanstack/react-router";
import { AdminInventoryPage } from "./admin.inventory.lazy";

export const Route = createFileRoute("/admin/inventory/stock-intake")({
  component: AdminInventoryPage,
});
