import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout only: leaf routes own their metadata and page content.
export const Route = createFileRoute("/blog")({ component: () => <Outlet /> });
