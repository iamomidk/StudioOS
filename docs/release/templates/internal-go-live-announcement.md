# Internal Go-Live Announcement Template

Subject: StudioOS Public Launch Go-Live - [DATE]

Team,

Public launch is approved for [DATE/TIME UTC].

- Release version: [VERSION]
- Rollout scope: [ALLOWLIST / COHORT / PERCENTAGE]
- Kill switch owner: [OWNER]
- On-call rotation: [PRIMARY], [SECONDARY]
- Launch health command: `pnpm launch:health`

Please monitor:
- API health and error budget burn
- Queue lag and worker failures
- Payment webhook success/failure rate

If rollback is required, execute `docs/release/public-launch.md` rollback steps.
