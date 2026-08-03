export function UpgradeBanner({ subscriptionTier, trialEndsAt }: { subscriptionTier: string; trialEndsAt?: string }) {
  if (subscriptionTier !== "trial" && subscriptionTier !== "free") return null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white">
      {subscriptionTier === "trial"
        ? `Your free trial ends in ${daysLeft} days. `
        : "You're on the free plan. "}
      <a href="/#pricing" className="underline hover:no-underline">
        Upgrade now
      </a>{" "}
      to unlock all features.
    </div>
  );
}

export function UpgradeGate({ children, requiredTier, currentTier }: { children: React.ReactNode; requiredTier?: string; currentTier?: string }) {
  if (!requiredTier || !currentTier) return <>{children}</>;
  const tiers = ["free", "trial", "starter", "pro", "shop"];
  const hasAccess = tiers.indexOf(currentTier) >= tiers.indexOf(requiredTier);
  if (hasAccess) return <>{children}</>;
  return (
    <div className="rounded-lg border border-gray-200 p-8 text-center dark:border-gray-800">
      <p className="text-gray-500 dark:text-gray-400">Upgrade to {requiredTier} to access this feature.</p>
      <a href="/#pricing" className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">View Plans</a>
    </div>
  );
}
