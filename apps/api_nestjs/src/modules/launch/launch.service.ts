import { Injectable } from '@nestjs/common';

import { MetricsService } from '../../common/modules/metrics/metrics.service.js';
import { AppConfigService } from '../../config/app-config.service.js';

@Injectable()
export class LaunchService {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: AppConfigService
  ) {}

  getHealth() {
    const snapshot = this.metrics.snapshot();
    const totalRequests = snapshot.httpRequestsTotal;
    const totalErrors = snapshot.httpErrorsTotal;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    const availabilityTarget = 0.999;
    const allowedErrorRate = 1 - availabilityTarget;
    const burnRate =
      allowedErrorRate > 0
        ? Number((errorRate / allowedErrorRate).toFixed(4))
        : Number.POSITIVE_INFINITY;

    const webhookTotal = snapshot.webhookProcessedTotal + snapshot.webhookFailedTotal;
    const webhookFailureRate = webhookTotal > 0 ? snapshot.webhookFailedTotal / webhookTotal : 0;

    return {
      checkedAt: new Date().toISOString(),
      rollout: {
        publicLaunchEnabled: this.config.featurePublicLaunchEnabled,
        globalKillSwitch: this.config.publicModulesGlobalKillSwitch,
        rolloutPercentage: this.config.publicRolloutPercentage,
        allowlistOrgCount: this.config.publicRolloutAllowlistOrgIds.length,
        allowlistCohortCount: this.config.publicRolloutAllowlistCohortIds.length
      },
      serviceHealth: {
        api: 'ok'
      },
      errorBudget: {
        availabilityTarget,
        errorRate,
        burnRate
      },
      queue: {
        depth: snapshot.queueDepth,
        lagSeconds: snapshot.queueLagSeconds
      },
      webhook: {
        processed: snapshot.webhookProcessedTotal,
        failed: snapshot.webhookFailedTotal,
        failureRate: webhookFailureRate
      },
      workers: {
        success: snapshot.workerSuccessTotal,
        failure: snapshot.workerFailureTotal
      }
    };
  }
}
