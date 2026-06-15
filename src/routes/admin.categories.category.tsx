import { createFileRoute } from "@tanstack/react-router";
import { AdminCategoriesPage } from "./admin.categories.lazy";

export const Route = createFileRoute("/admin/categories/category")({
  component: AdminCategoriesPage,
});
