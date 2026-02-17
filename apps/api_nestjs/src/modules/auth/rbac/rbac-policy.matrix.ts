import { Role } from './role.enum.js';

export const RBAC_POLICY_MATRIX = {
  'org.manage': [Role.Owner, Role.Manager],
  'shoot.execute': [Role.Owner, Role.Manager, Role.Shooter],
  'edit.execute': [Role.Owner, Role.Manager, Role.Editor],
  'rental.manage': [Role.Owner, Role.Manager, Role.Renter],
  'client.portal': [Role.Client]
} as const;

export type PolicyAction = keyof typeof RBAC_POLICY_MATRIX;
