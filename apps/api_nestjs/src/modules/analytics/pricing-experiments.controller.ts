import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { CreatePricingExperimentDto } from './dto/create-pricing-experiment.dto.js';
import { EvaluatePricingDto } from './dto/evaluate-pricing.dto.js';
import { ListPricingExperimentMetricsDto } from './dto/list-pricing-experiment-metrics.dto.js';
import { PricingExperimentsService } from './pricing-experiments.service.js';

@Controller('analytics/pricing-experiments')
@UseGuards(AccessTokenGuard)
export class PricingExperimentsController {
  constructor(private readonly pricingExperiments: PricingExperimentsService) {}

  @Post('evaluate')
  evaluate(@Body() dto: EvaluatePricingDto) {
    return this.pricingExperiments.evaluatePricing(dto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  create(@Body() dto: CreatePricingExperimentDto) {
    return this.pricingExperiments.createExperiment(dto);
  }

  @Patch(':experimentId/activate')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  activate(@Param('experimentId') experimentId: string) {
    return this.pricingExperiments.activateExperiment(experimentId);
  }

  @Patch(':experimentId/pause')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  pause(@Param('experimentId') experimentId: string) {
    return this.pricingExperiments.pauseExperiment(experimentId);
  }

  @Patch(':experimentId/stop')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  stop(@Param('experimentId') experimentId: string) {
    return this.pricingExperiments.stopExperiment(experimentId);
  }

  @Get(':experimentId/metrics')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  metrics(
    @Param('experimentId') experimentId: string,
    @Query() query: ListPricingExperimentMetricsDto
  ) {
    return this.pricingExperiments.getExperimentMetrics(experimentId, query.days ?? 30);
  }

  @Get('dashboard/summary')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  dashboard(@Query() query: ListPricingExperimentMetricsDto) {
    return this.pricingExperiments.getDashboard(query.days ?? 30);
  }
}
