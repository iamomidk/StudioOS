# Routing and TLS (Caddy)

## Default Routes
Configured in `deploy/proxy/Caddyfile`:
- `app.<domain>` -> `web:3000`
- `api.<domain>` -> `api:3000`

Caddy handles automatic certificate issuance and HTTPS renewals.

## DNS Requirements
Create A/AAAA records that point to the VM:
- `app.<domain>`
- `api.<domain>`

## Validation
- `curl -I https://app.<domain>/`
- `curl -I https://api.<domain>/health`

## Temporary IP Fallback
A commented fallback block is present in `Caddyfile` for IP-based HTTP smoke testing. Keep disabled for normal domain deployments.
