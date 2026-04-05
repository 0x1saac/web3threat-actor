# web3threat.actor

A comprehensive, open-source database of smart contract vulnerabilities, business logic flaws, and real-world exploits that have shaped the decentralized ecosystem — presented as an interactive web application.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![TailwindCSS](https://img.shields.io/badge/Tailwind-4-cyan) ![License](https://img.shields.io/badge/license-MIT-green)

<!-- TODO: Replace with an actual screenshot -->
<!-- ![Screenshot](docs/screenshot.png) -->

## What's Inside

The database currently tracks **7 real-world exploits** across **20+ attack types** including:

| Category | Examples |
|---|---|
| Smart Contract Bugs | Reentrancy, Integer Overflow, Delegatecall Injection, Access Control Missing |
| Business Logic | Flash Loan Attacks, Price Oracle Manipulation, Governance Attacks |
| MEV / Ordering | Sandwich Attacks, Frontrunning |
| Infrastructure | Cross-Chain Bridge Exploits |
| Operational | Private Key Compromise, Supply Chain Attacks |
| Cryptographic | Signature Replay |

Each exploit entry includes the affected protocol, chain, date, loss amount, severity, attacker transaction, reference links, and a detailed step-by-step narrative of how the attack unfolded.

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite 6** — Build tooling & dev server
- **Tailwind CSS 4** — Styling
- **Framer Motion** — Animations (Bento grid, expandable cards, spotlight effects)
- **Lucide React** — Icons

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (package manager)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/<your-username>/web3threat.git
cd web3threat

# Install dependencies
pnpm install

# Start the dev server (http://localhost:3000)
pnpm dev
```

### Other Commands

```bash
pnpm build    # Production build → dist/
pnpm preview  # Preview production build
pnpm lint     # Type-check with tsc --noEmit
pnpm clean    # Remove dist/
```

## Project Structure

```
web3threat/
├── public/
│   └── db.json              # The exploit database (attack types + exploits)
├── src/
│   ├── App.tsx              # Main app component (search, filters, grid)
│   ├── data.ts              # TypeScript interfaces (AttackType, Exploit, ExploitDB)
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles
│   ├── components/ui/       # UI components (bento-grid, expandable-card, spotlight, etc.)
│   ├── hooks/               # Custom React hooks
│   └── lib/                 # Utility functions
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
└── package.json
```

## Contributing

Contributions are welcome! Here's how you can help:

### Adding a New Exploit

The easiest way to contribute is by adding real-world exploit entries to the database.

1. **Fork** the repository and create a new branch:
   ```bash
   git checkout -b add/protocol-name-year
   ```

2. **Edit** `public/db.json` — add your exploit entry to the `exploits` array:
   ```json
   {
     "id": "protocol-year",
     "attack_type": "reentrancy",
     "affected_protocol": {
       "name": "Protocol Name",
       "version": "v1.0"
     },
     "date": "2026-01-15",
     "chain": "Ethereum",
     "loss_amount": "$5M",
     "severity": "Critical",
     "description": "Short one-line summary of the exploit",
     "attacker_tx": "0x...",
     "links": [
       "https://rekt.news/protocol-rekt"
     ],
     "detailed_narrative": "Step-by-step narrative. Use (1), (2), (3) numbering for attack steps."
   }
   ```

3. **Validate** your entry:
   - `id` — kebab-case, unique, format: `protocol-year`
   - `attack_type` — must match an existing `id` from the `attack_types` array in `db.json`
   - `severity` — one of: `Critical`, `High`, `Medium`, `Low`
   - `detailed_narrative` — use `(1)`, `(2)`, `(3)` step numbering for the attack flow; include `0x...` addresses where relevant
   - `links` — include at least one reference (rekt.news, post-mortem, etherscan tx)

4. **Run checks** before submitting:
   ```bash
   pnpm lint
   pnpm build
   ```

5. **Open a Pull Request** with a clear title like `Add: Bybit 2025 supply chain exploit`.

### Adding a New Attack Type

If the exploit uses an attack pattern not yet in the database:

1. Add a new object to the `attack_types` array in `public/db.json`:
   ```json
   {
     "id": "kebab-case-name",
     "name": "Human Readable Name",
     "category": "Smart Contract Bug | Business Logic | MEV / Ordering | Infrastructure | Operational | Cryptographic",
     "web2_equivalent": "Closest traditional security equivalent",
     "description": "One-line description of the attack pattern"
   }
   ```
2. Use that `id` as the `attack_type` in your exploit entry.

### Improving the UI

1. Fork and branch (`git checkout -b fix/description-of-change`).
2. Make your changes in `src/`.
3. Run `pnpm lint` and `pnpm build` to verify.
4. Open a PR describing what changed and why.

### Guidelines

- **Accuracy first** — only add exploits with verified public sources. Include links.
- **No speculation** — don't attribute attacks without published evidence.
- **Keep narratives factual** — describe *what happened*, not opinions on who's at fault.
- **One exploit per PR** makes review easier.
- Ensure `db.json` remains valid JSON (use a linter or `python -m json.tool public/db.json`).

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

[MIT](LICENSE)