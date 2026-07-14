import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { logout } from "~/lib/auth";

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});

function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    logout().then(() => {
      router.navigate({ to: "/" });
    });
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-gray-600 dark:text-gray-400">Signing out...</p>
    </div>
  );
}
