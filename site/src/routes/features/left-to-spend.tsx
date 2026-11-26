import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/features/left-to-spend")({
  beforeLoad: () => {
    throw redirect({ to: "/features", hash: "left-to-spend", statusCode: 301 });
  },
});
