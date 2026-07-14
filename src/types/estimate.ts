/** Core domain types for BuildBid estimating */

export type Trade = "electrical" | "plumbing" | "hvac" | "roofing" | "general" | "other";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: "each" | "hour" | "foot" | "sqft" | "lump";
  unitCost: number;
  markupPercent: number;
}

export interface Estimate {
  id: string;
  projectName: string;
  customerName: string;
  trade: Trade;
  status: "draft" | "sent" | "won" | "lost";
  lineItems: LineItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateSummary {
  id: string;
  projectName: string;
  customerName: string;
  trade: Trade;
  status: Estimate["status"];
  total: number;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "owner" | "estimator" | "admin";
}

export interface Team {
  id: string;
  name: string;
  trade: Trade;
  members: User[];
}

export interface Proposal {
  estimateId: string;
  businessName: string;
  businessLogo?: string;
  lineItems: LineItem[];
  total: number;
  validUntil: string;
  terms?: string;
}
