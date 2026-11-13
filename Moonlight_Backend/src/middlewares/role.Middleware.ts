import type { Request, NextFunction, Response } from 'express';
import { AppError } from "@shared/errors/AppError.js";
import { userRepository } from '../config/container.js';
import type { RoleName } from '@modules/user/index.js';

export function roleMiddleware(allowedRoles: RoleName[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) throw new AppError('Não autenticado', 401, 'UNAUTHENTICATED');

      const currentRoleVersion = await userRepository.getRoleVersion(user.id_user);
      if (currentRoleVersion !== user.role_version) throw new AppError('Sessão expirada, faça login novamente', 401, 'STALE_TOKEN');

      if (allowedRoles.some(role => user.roles.includes(role))) return next();

      throw new AppError('Você não tem permissão para essa ação', 403, 'FORBIDDEN');
    } catch (error) {
      next(error);
    }
  };
}
