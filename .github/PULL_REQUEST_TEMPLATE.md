## What does this PR do?

<!-- Brief summary of the change -->

## Type

- [ ] New exploit entry
- [ ] New attack type
- [ ] Bug fix
- [ ] UI improvement
- [ ] Documentation

## For exploit entries

- [ ] `id` is kebab-case and unique
- [ ] `attack_type` matches an existing entry in `db.json`
- [ ] `severity` is one of: Critical, High, Medium, Low
- [ ] At least one public source in `links`
- [ ] `detailed_narrative` uses `(1)`, `(2)`, `(3)` step numbering
- [ ] `db.json` is valid JSON

## Verification

- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
- [ ] Tested locally with `pnpm dev`
