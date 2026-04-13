# Contributing

Thank you for contributing to Mangou.

## Before You Submit

Run the following checks locally before opening a pull request:

```bash
bun run typecheck
bun test
bun run build
bun run build:dashboard:package
```

## Development Principles

- Do not introduce implicit dependencies on paths outside the repository
- Keep `tasks.jsonl` as the single source of truth for task state
- Prefer fixing scripts and data structures instead of piling on edge-case patches
- Preserve backward compatibility for workspace layout and YAML conventions
- Product-runtime regression tests should land in `mangou-ai-motion-comics`; keep this repo focused on dashboard, spec, and genuinely shared core behavior

## Pull Request Process

1. Fork the repository and create a feature branch
2. Add or update tests
3. Update relevant documentation
4. Make sure CI passes
5. Open a pull request with the motivation, scope, and validation steps

## Issue Reports

Please include as much of the following as possible:

- Bun version
- Operating system
- Reproduction steps
- Expected behavior
- Actual behavior
- Relevant logs or screenshots

## Contact

- General contact: `mangou@mangou.art`
- Business inquiries: `business@mangou.art`
