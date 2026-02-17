# Contributing

## Commit policy

StudioOS follows Conventional Commits for all commits.

### Required format

`<type>(optional-scope): <description>`

Examples:

- `feat(auth): add refresh token rotation`
- `fix(api): validate required env vars at startup`
- `chore(repo): enable husky commit hooks`

### Hook enforcement

- `pre-commit`: runs `pnpm lint:all`
- `commit-msg`: runs commitlint using `@commitlint/config-conventional`

### Common commit types

- `feat`
- `fix`
- `docs`
- `chore`
- `refactor`
- `test`
- `ci`

