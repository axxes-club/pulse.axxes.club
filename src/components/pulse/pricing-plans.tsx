"use client";
import Link from "next/link";
import { PlanPicker } from "./plan-picker";

/** The public price list. Buying happens in the workspace, where the organization is known. */
export function PricingPlans() {
  return (
    <PlanPicker
      action={() => (
        <Link href="/dashboard/billing" className="button secondary small">
          Start free trial
        </Link>
      )}
    />
  );
}
