import { createFileRoute } from "@tanstack/react-router";
import { AdminOrdersPage } from "./admin.orders.lazy";

export const Route = createFileRoute("/admin/orders/create")({
  component: AdminOrdersPage,
});
