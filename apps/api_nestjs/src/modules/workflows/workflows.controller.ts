import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { AccessTokenGuard } from '../auth/rbac/access-token.guard.js';
import { Role } from '../auth/rbac/role.enum.js';
import { Roles } from '../auth/rbac/roles.decorator.js';
import { RolesGuard } from '../auth/rbac/roles.guard.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import { ListWorkflowExecutionsDto } from './dto/list-workflow-executions.dto.js';
import { WorkflowControlDto } from './dto/workflow-control.dto.js';
import { WorkflowDryRunDto } from './dto/workflow-dry-run.dto.js';
import { WorkflowEventDto } from './dto/workflow-event.dto.js';
import { WorkflowsService } from './workflows.service.js';

@Controller('automation/workflows')
@UseGuards(AccessTokenGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get('schema')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  getBuilderSchema() {
    return this.workflows.getBuilderSchema();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  create(@Body() dto: CreateWorkflowDto, @Req() request: AuthenticatedRequest) {
    return this.workflows.createWorkflow(dto, request.user);
  }

  @Post(':workflowId/validate')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  validate(@Param('workflowId') workflowId: string, @Body() dto: WorkflowControlDto) {
    return this.workflows.validateWorkflow(workflowId, dto.organizationId);
  }

  @Post(':workflowId/publish')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  publish(
    @Param('workflowId') workflowId: string,
    @Body() dto: WorkflowControlDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.workflows.publishWorkflow(workflowId, dto.organizationId, request.user);
  }

  @Patch(':workflowId/pause')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  pause(
    @Param('workflowId') workflowId: string,
    @Body() dto: WorkflowControlDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.workflows.pauseWorkflow(workflowId, dto.organizationId, request.user);
  }

  @Post(':workflowId/dry-run')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  dryRun(@Param('workflowId') workflowId: string, @Body() dto: WorkflowDryRunDto) {
    return this.workflows.dryRun(workflowId, dto);
  }

  @Get(':workflowId/executions')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  listExecutionHistory(
    @Param('workflowId') workflowId: string,
    @Query() query: ListWorkflowExecutionsDto
  ) {
    return this.workflows.listExecutionHistory(workflowId, query.organizationId, query.limit ?? 50);
  }

  @Post('events/trigger')
  @UseGuards(RolesGuard)
  @Roles(Role.Owner, Role.Manager)
  triggerEvent(@Body() dto: WorkflowEventDto, @Req() request: AuthenticatedRequest) {
    return this.workflows.executeEvent(dto, request.user);
  }
}
