// API route for /api/call — dispatches to registered isomorphic fn handlers
import { json } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { getHandler } from "~/lib/call-registry";

// Import all lib modules so they self-register their handlers
import "~/lib/analytics";
import "~/lib/auth";
import "~/lib/admin";
import "~/lib/bulk-import";
import "~/lib/change-orders";
import "~/lib/change-order-workflow";
import "~/lib/contracts";
import "~/lib/customers";
import "~/lib/blog";
import "~/lib/email-automations";
import "~/lib/email-proposals";
import "~/lib/estimates";
import "~/lib/subcontractors";
import "~/lib/branding";
import "~/lib/takeoff";
import "~/lib/feedback";
import "~/lib/integrations";
import "~/lib/invoices";
import "~/lib/iso";
import "~/lib/job-costing";
import "~/lib/materials";
import "~/lib/notifications";
import "~/lib/payments";
import "~/lib/photos";
import "~/lib/price-lists";
import "~/lib/profit-margin";
import "~/lib/proposals";
import "~/lib/push";
import "~/lib/sms";
import "~/lib/reports";
import "~/lib/quickbooks";
import "~/lib/xero";
import "~/lib/salesforce";
import "~/lib/scheduling";
import "~/lib/signatures";
import "~/lib/time-entries";
import "~/lib/expenses";
import "~/lib/subscriptions";
import "~/lib/team";
import "~/lib/templates";
import "~/lib/tracking";

export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const fnName = body?.function;
    const args = body?.args || {};

    if (!fnName) {
      return json({ error: "Missing function name" }, { status: 400 });
    }

    const handler = getHandler(fnName);
    if (!handler) {
      return json({ error: `Unknown function: ${fnName}` }, { status: 501 });
    }

    const token = getCookie("buildbid_session") || "";
    const result = await handler(args, token || undefined);
    return json(result);
  } catch (e: any) {
    const msg = e.message || "Internal error";
    const status = msg === "Not authenticated" ? 401 : 500;
    return json({ error: msg }, { status });
  }
}
