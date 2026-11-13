import type { RowDataPacket } from "mysql2";
import type { RoleResponseDTO } from "@modules/user/role/role.dto.js";

export type RoleRow = RowDataPacket & RoleResponseDTO;
