# Runbook: Key Rotation

Owner: Security Lead

1. Create new key/secret in AWS Secrets Manager.
2. Deploy services with dual-read support where applicable.
3. Rotate JWT/webhook/API keys in this order:
- non-customer facing workers
- API
- web/mobile clients
4. Revoke old keys after verification window.
5. Audit logs for unauthorized signature or token failures.
