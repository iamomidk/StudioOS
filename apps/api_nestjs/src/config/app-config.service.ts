import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { AppEnv } from './env.schema.js';

export const APP_ENV = Symbol('APP_ENV');

@Injectable()
export class AppConfigService {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  get port(): number {
    return this.env.PORT;
  }

  get nodeEnv(): AppEnv['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get jwtAccessTokenSecret(): string {
    return this.env.JWT_ACCESS_TOKEN_SECRET;
  }

  get jwtRefreshTokenSecret(): string {
    return this.env.JWT_REFRESH_TOKEN_SECRET;
  }

  get awsRegion(): string {
    return this.env.AWS_REGION;
  }

  get s3Bucket(): string {
    return this.env.S3_BUCKET;
  }

  get s3PresignTtlSeconds(): number {
    return this.env.S3_PRESIGN_TTL_SECONDS;
  }

  get s3MaxUploadBytes(): number {
    return this.env.S3_MAX_UPLOAD_BYTES;
  }

  get s3AllowedContentTypes(): string[] {
    return this.env.S3_ALLOWED_CONTENT_TYPES.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get paymentWebhookDemoSecret(): string {
    return this.env.PAYMENT_WEBHOOK_DEMO_SECRET;
  }

  get reconciliationDailyToken(): string {
    return this.env.RECONCILIATION_DAILY_TOKEN;
  }

  get corsAllowedOrigins(): string[] {
    return this.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get rateLimitTtlSeconds(): number {
    return this.env.RATE_LIMIT_TTL_SECONDS;
  }

  get rateLimitMaxRequests(): number {
    return this.env.RATE_LIMIT_MAX_REQUESTS;
  }

  get sentryDsn(): string {
    return this.env.SENTRY_DSN;
  }

  get otelEnabled(): boolean {
    return this.env.OTEL_ENABLED;
  }

  get smokeOpsEnabled(): boolean {
    return this.env.SMOKE_OPS_ENABLED;
  }

  get smokeCheckToken(): string {
    return this.env.SMOKE_CHECK_TOKEN;
  }

  get featureMarketplaceEnabled(): boolean {
    return this.env.FEATURE_MARKETPLACE_ENABLED;
  }

  get featureDisputesEnabled(): boolean {
    return this.env.FEATURE_DISPUTES_ENABLED;
  }

  get disputePolicyVersion(): string {
    return this.env.DISPUTE_POLICY_VERSION;
  }

  get featurePublicLaunchEnabled(): boolean {
    return this.env.FEATURE_PUBLIC_LAUNCH_ENABLED;
  }

  get publicModulesGlobalKillSwitch(): boolean {
    return this.env.PUBLIC_MODULES_GLOBAL_KILL_SWITCH;
  }

  get publicRolloutAllowlistOrgIds(): string[] {
    return this.env.PUBLIC_ROLLOUT_ALLOWLIST_ORG_IDS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get publicRolloutAllowlistCohortIds(): string[] {
    return this.env.PUBLIC_ROLLOUT_ALLOWLIST_COHORT_IDS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get publicRolloutPercentage(): number {
    return this.env.PUBLIC_ROLLOUT_PERCENTAGE;
  }

  get featurePricingExperimentsEnabled(): boolean {
    return this.env.FEATURE_PRICING_EXPERIMENTS_ENABLED;
  }

  get riskScoringMode(): AppEnv['RISK_SCORING_MODE'] {
    return this.env.RISK_SCORING_MODE;
  }

  get riskScoringGlobalKillSwitch(): boolean {
    return this.env.RISK_SCORING_GLOBAL_KILL_SWITCH;
  }

  get riskScoringBypassOrgIds(): string[] {
    return this.env.RISK_SCORING_BYPASS_ORG_IDS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get riskScoringEnforceCohortIds(): string[] {
    return this.env.RISK_SCORING_ENFORCE_COHORT_IDS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get pricingExperimentsGlobalKillSwitch(): boolean {
    return this.env.PRICING_EXPERIMENTS_GLOBAL_KILL_SWITCH;
  }

  get onboardingSteps(): string[] {
    return this.env.ONBOARDING_STEPS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get activationRequiredSteps(): string[] {
    return this.env.ACTIVATION_REQUIRED_STEPS.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get featureSupportAdminActionsEnabled(): boolean {
    return this.env.FEATURE_SUPPORT_ADMIN_ACTIONS_ENABLED;
  }

  get supportAlertWebhookUrl(): string {
    return this.env.SUPPORT_ALERT_WEBHOOK_URL;
  }

  get supportAllowedAttachmentTypes(): string[] {
    return this.env.SUPPORT_ALLOWED_ATTACHMENT_TYPES.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  get supportMaxAttachmentBytes(): number {
    return this.env.SUPPORT_MAX_ATTACHMENT_BYTES;
  }

  get supportMaxSubmissionsPerMinute(): number {
    return this.env.SUPPORT_MAX_SUBMISSIONS_PER_MINUTE;
  }

  get slaPolicyVersion(): string {
    return this.env.SLA_POLICY_VERSION;
  }

  get slaBusinessHoursOnly(): boolean {
    return this.env.SLA_BUSINESS_HOURS_ONLY;
  }

  get slaBusinessHourStart(): number {
    return this.env.SLA_BUSINESS_HOUR_START;
  }

  get slaBusinessHourEnd(): number {
    return this.env.SLA_BUSINESS_HOUR_END;
  }

  get slaAlertWebhookUrl(): string {
    return this.env.SLA_ALERT_WEBHOOK_URL;
  }

  get slaQuoteResponseMinutes(): number {
    return this.env.SLA_QUOTE_RESPONSE_MINUTES;
  }

  get slaBookingConfirmationMinutes(): number {
    return this.env.SLA_BOOKING_CONFIRMATION_MINUTES;
  }

  get enterpriseDeprovisionGraceSeconds(): number {
    return this.env.ENTERPRISE_DEPROVISION_GRACE_SECONDS;
  }

  get breakGlassAdminEmail(): string {
    return this.env.BREAK_GLASS_ADMIN_EMAIL;
  }

  isPublicRolloutEnabledFor(organizationId: string, pilotCohortId: string | null): boolean {
    if (!this.featurePublicLaunchEnabled || this.publicModulesGlobalKillSwitch) {
      return false;
    }

    if (this.publicRolloutAllowlistOrgIds.includes(organizationId)) {
      return true;
    }

    if (
      pilotCohortId &&
      pilotCohortId.length > 0 &&
      this.publicRolloutAllowlistCohortIds.includes(pilotCohortId)
    ) {
      return true;
    }

    if (this.publicRolloutPercentage >= 100) {
      return true;
    }

    if (this.publicRolloutPercentage <= 0) {
      return false;
    }

    const digest = createHash('sha256')
      .update(`${this.env.PUBLIC_ROLLOUT_HASH_SALT}:${organizationId}`)
      .digest('hex');
    const bucket = Number.parseInt(digest.slice(0, 8), 16) % 100;
    return bucket < this.publicRolloutPercentage;
  }

  getSupportFirstResponseTargetMinutes(severity: 'p0' | 'p1' | 'p2' | 'p3'): number {
    switch (severity) {
      case 'p0':
        return this.env.SLA_P0_FIRST_RESPONSE_MINUTES;
      case 'p1':
        return this.env.SLA_P1_FIRST_RESPONSE_MINUTES;
      case 'p2':
        return this.env.SLA_P2_FIRST_RESPONSE_MINUTES;
      case 'p3':
        return this.env.SLA_P3_FIRST_RESPONSE_MINUTES;
      default:
        return this.env.SLA_P2_FIRST_RESPONSE_MINUTES;
    }
  }

  getSupportResolutionTargetMinutes(severity: 'p0' | 'p1' | 'p2' | 'p3'): number {
    switch (severity) {
      case 'p0':
        return this.env.SLA_P0_RESOLUTION_MINUTES;
      case 'p1':
        return this.env.SLA_P1_RESOLUTION_MINUTES;
      case 'p2':
        return this.env.SLA_P2_RESOLUTION_MINUTES;
      case 'p3':
        return this.env.SLA_P3_RESOLUTION_MINUTES;
      default:
        return this.env.SLA_P2_RESOLUTION_MINUTES;
    }
  }
}
