/**
 * DTO DE SAIDA POR QUERY
 */

export type AuthResponseDTO = {
    id_user: number,
    name: string,
    email: string,
    password?: string,
    cpf: string,
    // type: 'customer' | 'admin',
    role_version: number,
    token?: string,
    roles?: string[]
}
