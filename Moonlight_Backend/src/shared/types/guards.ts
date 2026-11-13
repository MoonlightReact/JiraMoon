import type { RequestHandler } from "express";
import type { RoleName } from "@modules/user/index.js"

export interface Guards {
  authenticate: RequestHandler;
  authorize: (allowedRoles: RoleName[]) => RequestHandler;
}
