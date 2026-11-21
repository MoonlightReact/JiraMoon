import type { RoleName } from "@shared/types/role.types.js";

export const requireAdmin: RoleName[] = ['admin'];
export const requireUser: RoleName[] = ['customer', 'admin'];
