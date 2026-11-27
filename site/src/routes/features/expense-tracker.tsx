import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/features/expense-tracker")({
  beforeLoad: () => {
    throw redirect({ to: "/features", hash: "expenses", statusCode: 301 });
  },
});
