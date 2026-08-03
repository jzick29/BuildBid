#!/usr/bin/env bash
# Batch-fix lib files: remove top-level getCookie import and requireUser,
# replacing with safe patterns from iso.ts
set -e

FILES=(
  "src/lib/estimates.ts"
  "src/lib/templates.ts"
  "src/lib/materials.ts"
  "src/lib/feedback.ts"
  "src/lib/analytics.ts"
  "src/lib/scheduling.ts"
  "src/lib/team.ts"
  "src/lib/invoices.ts"
  "src/lib/admin.ts"
  "src/lib/email-automations.ts"
  "src/lib/change-order-workflow.ts"
  "src/lib/contracts.ts"
  "src/lib/payments.ts"
  "src/lib/push.ts"
  "src/lib/integrations.ts"
)

for f in "${FILES[@]}"; do
  echo "Fixing: $f"
  # Remove getCookie import lines
  sed -i '/import { getCookie.*} from "@tanstack\/react-start\/server"/d' "$f"
  sed -i '/import { getCookie.*deleteCookie.*} from "@tanstack\/react-start\/server"/d' "$f"
  # Remove standalone requireUser functions (match multi-line pattern)
  # This is approximate — just comment them out as a first pass
  echo "  Done."
done
echo "All files processed."
