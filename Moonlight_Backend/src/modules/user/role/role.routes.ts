import { Router } from 'express';
import type { RoleController } from '@modules/user/role/role.controller.js';
import type { Guards } from '@shared/types/guards.js';
import { requireAdmin } from '../../../config/allowedRoles.js';

export function createRoleRoutes(controller: RoleController, guards: Guards) {
  const router = Router();

  router.get('/', guards.authenticate, guards.authorize(requireAdmin), controller.getRoles);
  router.patch('/user/:id', guards.authenticate, guards.authorize(requireAdmin), controller.syncUserRoles);

  return router;
}
