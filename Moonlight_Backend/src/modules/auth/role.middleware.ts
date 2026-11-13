import { AppError } from "@shared/errors/AppError.js";
import type { NextFunction, Request, Response } from "express";
import type { RoleName } from "@modules/user/index.js";

export function createRoleMiddleware(deps:
  { getRoleVersion: (id_user: number) => Promise<number> }
) {
  return (allowedRoles: RoleName[]) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new AppError('Não autenticado', 401, 'UNAUTHENTICATED');

      const currentRoleVersion = await deps.getRoleVersion(user.id_user);
      if (currentRoleVersion !== user.role_version) throw new AppError('Sessão expirada, faça login novamente', 401, 'STALE_TOKEN');

      if (allowedRoles.some(role => user.roles.includes(role))) return next();

      throw new AppError('Você não tem permissão para essa ação', 403, 'FORBIDDEN');
    } catch (error) {
      next(error);
    }
  }
}
