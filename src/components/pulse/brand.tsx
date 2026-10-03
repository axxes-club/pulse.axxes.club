import Link from "next/link";
import { Icon } from "./icon";
export function PulseBrand() {
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
