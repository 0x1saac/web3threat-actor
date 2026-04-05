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
}

export interface ExploitDB {
  attack_types: AttackType[];
  exploits: Exploit[];
}