import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from './roles.decorator.js';
import type { AccessClaims, AuthenticatedRequest } from './access-token.guard.js';
import { Role } from './role.enum.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: AccessClaims | undefined = request.user;

    if (!user) {
      throw new UnauthorizedException('Unauthenticated');
    }

    const allowed = requiredRoles.some((role) => user.roles.includes(role));
    if (!allowed) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
