import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard, type AuthenticatedRequest } from '../auth/rbac/access-token.guard.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ListProjectsDto } from './dto/list-projects.dto.js';
import { RequestProjectRevisionDto } from './dto/request-project-revision.dto.js';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@UseGuards(AccessTokenGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  listProjects(@Query() query: ListProjectsDto) {
    return this.projectsService.listProjects(query.organizationId);
  }

  @Post()
  createProject(@Body() dto: CreateProjectDto, @Req() request: AuthenticatedRequest) {
    return this.projectsService.createProject(dto, request.user);
  }

  @Patch(':projectId/status')
  updateProjectStatus(
    @Param('projectId') projectId: string,
    @Query() query: ListProjectsDto,
    @Body() dto: UpdateProjectStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectsService.updateStatus(
      projectId,
      query.organizationId,
      dto.status,
      request.user
    );
  }

  @Get(':projectId/timeline')
  getProjectTimeline(@Param('projectId') projectId: string, @Query() query: ListProjectsDto) {
    return this.projectsService.getTimeline(projectId, query.organizationId);
  }

  @Post(':projectId/client-approve')
  approveProject(
    @Param('projectId') projectId: string,
    @Query() query: ListProjectsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectsService.approveProject(projectId, query.organizationId, request.user);
  }

  @Post(':projectId/client-revision')
  requestProjectRevision(
    @Param('projectId') projectId: string,
    @Query() query: ListProjectsDto,
    @Body() dto: RequestProjectRevisionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.projectsService.requestRevision(
      projectId,
      query.organizationId,
      dto.comment,
      request.user
    );
  }
}
