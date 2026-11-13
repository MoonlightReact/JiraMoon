import type { Role } from "@modules/user/role/role.repository.types.js";
import type { RoleRow } from "@modules/user/role/role.row.js";
import pool from "@shared/config/database.js";


export class RoleRepository {

  async findAll(): Promise<Role[]>{
    const [rows] = await pool.query<RoleRow[]>(`
        SELECT id_role, name
        FROM role
        ORDER BY id_role
        `);

    return rows;
  }

}
