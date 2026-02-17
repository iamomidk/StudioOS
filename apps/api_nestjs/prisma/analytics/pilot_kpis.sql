-- Reference analytics queries/materializations for pilot KPIs.

-- lead -> booking conversion
SELECT
  "organizationId" AS organization_id,
  SUM(CASE WHEN "eventName" = 'lead_created' THEN 1 ELSE 0 END) AS leads_created,
  SUM(CASE WHEN "eventName" = 'booking_created' THEN 1 ELSE 0 END) AS bookings_created
FROM "AnalyticsEvent"
GROUP BY "organizationId";

-- booking conflict rate
SELECT
  "organizationId" AS organization_id,
  SUM(CASE WHEN "eventName" = 'booking_conflict_detected' THEN 1 ELSE 0 END) AS conflicts,
  SUM(CASE WHEN "eventName" = 'booking_created' THEN 1 ELSE 0 END) AS bookings
FROM "AnalyticsEvent"
GROUP BY "organizationId";

-- DSO reference (invoice_issued -> invoice_paid)
SELECT
  issued."organizationId" AS organization_id,
  AVG(EXTRACT(EPOCH FROM (paid."occurredAt" - issued."occurredAt")) / 86400.0) AS dso_days
FROM "AnalyticsEvent" issued
JOIN "AnalyticsEvent" paid
  ON paid."entityId" = issued."entityId"
 AND paid."eventName" = 'invoice_paid'
WHERE issued."eventName" = 'invoice_issued'
GROUP BY issued."organizationId";
