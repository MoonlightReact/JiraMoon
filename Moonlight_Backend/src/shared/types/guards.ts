import type { RequestHandler } from "express";
import type { RoleName } from "@shared/types/role.types.js"

export interface Guards {
  authenticate: RequestHandler;
  authorize: (allowedRoles: RoleName[]) => RequestHandler;
}
