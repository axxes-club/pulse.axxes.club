"use client";
import Link from "next/link";
import { useBrand, CustomerLogo } from "@/components/brand";
import { Icon } from "./icon";
export function PulseBrand() {
  const brand=useBrand();
  if(brand)return <Link href="/dashboard" className="pulse-brand" aria-label={`${brand.name} Pulse home`}><CustomerLogo brand={brand} productName="Pulse"/></Link>;
  return (
    <Link href="/" className="pulse-brand" aria-label="AXXES Pulse home">
      <span className="pulse-brand-symbol">
        <Icon name="pulse" size={25} />
      </span>
      <span className="pulse-brand-word">
        pulse<span className="pulse-brand-by">by AXXES</span>
      </span>
    </Link>
  );
}
