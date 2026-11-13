import type { RoleName } from "@modules/user/index.js";

export const requireAdmin: RoleName[] = ['admin'];
export const requireUser: RoleName[] = ['customer', 'admin'];
