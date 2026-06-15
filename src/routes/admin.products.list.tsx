import { createFileRoute } from "@tanstack/react-router";
import { AdminProductsPage } from "./admin.products.lazy";

export const Route = createFileRoute("/admin/products/list")({
  component: AdminProductsPage,
});
