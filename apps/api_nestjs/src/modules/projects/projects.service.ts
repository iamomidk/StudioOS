import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { AccessClaims } from '../auth/rbac/access-token.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import type { ProjectWorkflowStatus } from './dto/update-project-status.dto.js';

const STATUS_TRANSITIONS: Record<ProjectWorkflowStatus, ProjectWorkflowStatus[]> = {
  preprod: ['shoot'],
  shoot: ['edit'],
  edit: ['review'],
  review: ['edit', 'delivered'],
  delivered: ['closed'],
  closed: []
};

const CLIENT_REVIEW_STATUSES: ProjectWorkflowStatus[] = ['review', 'delivered'];

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProjects(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createProject(dto: CreateProjectDto, actor?: AccessClaims) {
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('Invalid project due date');
    }

    const [client, booking, owner] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: dto.clientId, organizationId: dto.organizationId },
        select: { id: true }
      }),
      dto.bookingId
        ? this.prisma.booking.findFirst({
            where: { id: dto.bookingId, organizationId: dto.organizationId },
            select: { id: true }
          })
        : Promise.resolve(null),
      dto.ownerUserId
        ? this.prisma.user.findUnique({
            where: { id: dto.ownerUserId },
            select: { id: true }
          })
        : Promise.resolve(null)
    ]);

    if (!client) {
      throw new NotFoundException('Client not found');
    }
    if (dto.bookingId && !booking) {
      throw new NotFoundException('Booking not found');
    }
    if (dto.ownerUserId && !owner) {
      throw new NotFoundException('Owner user not found');
    }

    const project = await this.prisma.project.create({
      data: {
        organizationId: dto.organizationId,
        clientId: dto.clientId,
        bookingId: dto.bookingId ?? null,
        ownerUserId: dto.ownerUserId ?? null,
        name: dto.name,
        dueAt
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: dto.organizationId,
        actorUserId: actor?.sub ?? null,
        entityType: 'Project',
        entityId: project.id,
        action: 'project.created',
        metadata: {
          status: project.status,
          name: project.name
        }
      }
    });

    return project;
  }

  async updateStatus(
    projectId: string,
    organizationId: string,
    nextStatus: ProjectWorkflowStatus,
    actor?: AccessClaims
  ) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, organizationId }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      if (project.status === nextStatus) {
        return project;
      }

      const allowed = STATUS_TRANSITIONS[project.status as ProjectWorkflowStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(
          `Invalid project status transition: ${project.status} -> ${nextStatus}`
        );
      }

      const updatedProject = await tx.project.update({
        where: { id: project.id },
        data: { status: nextStatus }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Project',
          entityId: project.id,
          action: 'project.status.updated',
          metadata: {
            from: project.status,
            to: nextStatus
          }
        }
      });

      return updatedProject;
    });
  }

  async getTimeline(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: 'Project',
        entityId: projectId
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async approveProject(projectId: string, organizationId: string, actor?: AccessClaims) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, organizationId }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }
      if (!CLIENT_REVIEW_STATUSES.includes(project.status as ProjectWorkflowStatus)) {
        throw new BadRequestException(
          'Project must be in review or delivered state for client approval'
        );
      }
      if (project.status === 'closed') {
        throw new BadRequestException('Closed projects cannot be client-approved');
      }

      const approvedAt = new Date();
      const nextStatus = project.status === 'review' ? 'delivered' : project.status;
      const updatedProject = await tx.project.update({
        where: { id: project.id },
        data: {
          status: nextStatus,
          clientApprovalState: 'approved',
          clientApprovedAt: approvedAt
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Project',
          entityId: project.id,
          action: 'project.client.approved',
          metadata: {
            fromStatus: project.status,
            toStatus: nextStatus,
            revisionCount: updatedProject.revisionCount
          }
        }
      });

      return updatedProject;
    });
  }

  async requestRevision(
    projectId: string,
    organizationId: string,
    comment: string,
    actor?: AccessClaims
  ) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, organizationId }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }
      if (project.status === 'closed') {
        throw new BadRequestException('Closed projects cannot accept revision requests');
      }
      if (!CLIENT_REVIEW_STATUSES.includes(project.status as ProjectWorkflowStatus)) {
        throw new BadRequestException(
          'Project must be in review or delivered state for revision requests'
        );
      }

      const updatedProject = await tx.project.update({
        where: { id: project.id },
        data: {
          status: 'edit',
          clientApprovalState: 'changes_requested',
          revisionCount: {
            increment: 1
          },
          lastRevisionComment: comment,
          clientApprovedAt: null
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: actor?.sub ?? null,
          entityType: 'Project',
          entityId: project.id,
          action: 'project.client.revision.requested',
          metadata: {
            fromStatus: project.status,
            toStatus: 'edit',
            revisionCount: updatedProject.revisionCount,
            comment
          }
        }
      });

      return updatedProject;
    });
  }
}
