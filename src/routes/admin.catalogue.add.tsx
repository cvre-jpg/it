import { createFileRoute } from "@tanstack/react-router";
import { AdminCataloguePage } from "./admin.catalogue";

export const Route = createFileRoute("/admin/catalogue/add")({
  component: AdminCataloguePage,
});
