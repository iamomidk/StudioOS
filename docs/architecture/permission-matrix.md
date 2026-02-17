# RBAC Permission Matrix

Roles supported in API authorization:

- `owner`
- `manager`
- `shooter`
- `editor`
- `renter`
- `client`

| Action | owner | manager | shooter | editor | renter | client |
| --- | --- | --- | --- | --- | --- | --- |
| `org.manage` | allow | allow | deny | deny | deny | deny |
| `shoot.execute` | allow | allow | allow | deny | deny | deny |
| `edit.execute` | allow | allow | deny | allow | deny | deny |
| `rental.manage` | allow | allow | deny | deny | allow | deny |
| `pricing.experiments.manage` | allow | allow | deny | deny | deny | deny |
| `analytics.onboarding.view` | allow | allow | deny | deny | deny | deny |
| `support.console.manage` | allow | allow | deny | deny | deny | deny |
| `sla.report.view` | allow | allow | deny | deny | deny | deny |
| `launch.health.view` | allow | allow | deny | deny | deny | deny |
| `client.portal` | deny | deny | deny | deny | deny | allow |
