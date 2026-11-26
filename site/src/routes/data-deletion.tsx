import { createFileRoute } from "@tanstack/react-router";
import { legalRoute } from "@/components/site/LegalPage";

export const Route = createFileRoute("/data-deletion")(
  legalRoute("data-deletion"),
);
