# CI VM Deploy

Workflow: `.github/workflows/deploy-vm.yml`

## Trigger
- Manual `workflow_dispatch`
- Optional push trigger on `main` (kept manual for safer MVP operations)

## Required GitHub Secrets
- `VM_HOST`
- `VM_SSH_PORT`
- `VM_DEPLOY_USER`
- `VM_SSH_PRIVATE_KEY`
- optional `VM_KNOWN_HOSTS`

## Manual Run Input
- `deploy_ref`: git SHA/ref to deploy (defaults to workflow SHA)

## CI Behavior
1. SSH to VM as deploy user
2. `git fetch --all --prune`
3. run `scripts/deploy/vm/deploy.sh <deploy_ref>`
4. print smoke summary and deploy report
5. upload `smoke-latest.json` and `vm-deploy-report.*` as workflow artifacts
