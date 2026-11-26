import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/features/import-bank-statement")({
  beforeLoad: ({ location }) => {
    throw redirect({ to: "/features", hash: location.hash === "#banks" ? "banks" : "import", statusCode: 301 });
  },
});
