import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/features/money-flow")({
  beforeLoad: () => {
    throw redirect({ to: "/features", hash: "flow", statusCode: 301 });
  },
});
