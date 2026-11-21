/**
 * ROWs respectivos pro que vai sair de select
 */

import type { RowDataPacket } from "mysql2";
import type { UserResponseCountRowsDTO} from "@modules/user/dto/user.output.dto.js";
import type { RoleName } from "@shared/types/role.types.js";

export type UserRow = RowDataPacket & {
  id_user: number;
  name: string;
  email: string;
  cpf: string;
  roles: string | null;
};

export type UserRowWithPassword = RowDataPacket &{
    id_user: number,
    name: string,
    email: string,
    password: string,
    cpf: string,
    roles: RoleName[]
    role_version: number;
};

export type UserCountRows = RowDataPacket & UserResponseCountRowsDTO;

export type UserRoleVersionRow = RowDataPacket & {
  role_version: number
}
