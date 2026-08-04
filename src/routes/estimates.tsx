import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/estimates")({
  component: EstimatesLayout,
});

function EstimatesLayout() {
  return <Outlet />;
}
