export interface AttackType {
  id: string;
  name: string;
  category: string;
  web2_equivalent: string;
  description: string;
}

export interface Exploit {
  id: string;
  attack_type: string;
  affected_protocol: {
    name: string;
    version: string | null;
  };
  date: string;
  chain: string;
  loss_amount: string | null;
  severity: string;
  description: string;
  attacker_tx: string | null;
  links: string[];
  detailed_narrative: string | null;
  /** Optional URL or path (e.g. /thumbnails/curve.png) to a real protocol logo.
   *  When omitted the UI falls back to a generated initials thumbnail. */
  thumbnail?: string | null;
}

export interface ExploitDB {
  attack_types: AttackType[];
  exploits: Exploit[];
}