import { makeAuthFn } from "./iso";

// ─── branding.get ─────────────────────────────────────────────────
export const getBranding = makeAuthFn("branding.get", async (_args: any, userId: string, pool: any) => {
  const r = await pool.query("SELECT * FROM branding WHERE user_id = $1", [userId]);
  if (r.rows.length === 0) {
    return { branding: null };
  }
  return { branding: r.rows[0] };
});

// ─── branding.save ────────────────────────────────────────────────
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const saveBranding = makeAuthFn(
  "branding.save",
  async (
    args: {
      data: {
        companyName?: string;
        logoUrl?: string;
        primaryColor?: string;
        accentColor?: string;
        customDomain?: string;
        whiteLabel?: boolean;
      };
    },
    userId: string,
    pool: any
  ) => {
    const d = args.data || {};
    const companyName = d.companyName !== undefined ? String(d.companyName).slice(0, 80) : "";
    const logoUrl = d.logoUrl !== undefined ? String(d.logoUrl).slice(0, 500) : "";
    const primaryColor = d.primaryColor !== undefined ? String(d.primaryColor) : "#4f46e5";
    const accentColor = d.accentColor !== undefined ? String(d.accentColor) : "#0ea5e9";
    const customDomain = d.customDomain !== undefined ? String(d.customDomain).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").slice(0, 120) : "";
    const whiteLabel = d.whiteLabel !== undefined ? (d.whiteLabel ? 1 : 0) : 0;
    if (!HEX_RE.test(primaryColor)) throw new Error("Primary color must be a hex color (e.g. #4f46e5)");
    if (!HEX_RE.test(accentColor)) throw new Error("Accent color must be a hex color (e.g. #0ea5e9)");
    await pool.query(
      `INSERT INTO branding (user_id, company_name, logo_url, primary_color, accent_color, custom_domain, white_label, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         logo_url = EXCLUDED.logo_url,
         primary_color = EXCLUDED.primary_color,
         accent_color = EXCLUDED.accent_color,
         custom_domain = EXCLUDED.custom_domain,
         white_label = EXCLUDED.white_label,
         updated_at = NOW()`,
      [userId, companyName, logoUrl, primaryColor, accentColor, customDomain, whiteLabel]
    );
    return { success: true };
  }
);
