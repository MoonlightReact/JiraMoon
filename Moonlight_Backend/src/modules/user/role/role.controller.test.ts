import request from 'supertest';
import app from '../../../server.js';

// ATENÇÃO: não vi o role.routes.ts, então estas duas URLs são palpite. Ajuste se necessário.
const ROLES_URL = '/api/roles';
const userRolesUrl = (id: number | string) => `/api/roles/user/${id}`;

const VALID_CPF = '744.846.070-69';
const VALID_PASSWORD = 'Abc12345';

type RoleItem = { id_role: number; name: string };

let adminToken: string;
let roles: RoleItem[];
let customerRole: RoleItem;
let adminRole: RoleItem;
let createdUserId: number;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'dominic@familia.com', password: 'Familia123' });
  adminToken = loginRes.body.token;

  const rolesRes = await request(app)
    .get(ROLES_URL)
    .set('Authorization', `Bearer ${adminToken}`);
  roles = rolesRes.body;
  customerRole = roles.find(r => r.name === 'customer')!;
  adminRole = roles.find(r => r.name === 'admin')!;

  // usuário descartável: os testes de sync nunca mexem nos roles de um usuário real
  const uniqueEmail = `role-teste${Date.now()}@email.com`;
  await request(app)
    .post('/api/users/')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Teste Role',
      email: uniqueEmail,
      password: VALID_PASSWORD,
      cpf: VALID_CPF,
      id_roles: [customerRole.id_role],
    });

  const listRes = await request(app)
    .get(`/api/users/pag?email=${encodeURIComponent(uniqueEmail)}`)
    .set('Authorization', `Bearer ${adminToken}`);
  createdUserId = listRes.body.data[0].id_user;
});

describe('Role Controller', () => {

  afterAll(async () => {
    if (createdUserId) {
      await request(app)
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe(`GET /api/roles`, () => {
    it('deve retornar a lista de roles', async () => {
      const res = await request(app)
        .get(ROLES_URL)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('cada role deve ter id_role e name', async () => {
      const res = await request(app)
        .get(ROLES_URL)
        .set('Authorization', `Bearer ${adminToken}`);
      for (const role of res.body) {
        expect(role).toHaveProperty('id_role');
        expect(role).toHaveProperty('name');
      }
    });

    it('deve incluir as roles admin e customer', async () => {
      const names = roles.map(r => r.name);
      expect(names).toContain('admin');
      expect(names).toContain('customer');
    });

    it('deve retornar 401 sem autenticação', async () => {
      const res = await request(app).get(ROLES_URL);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/roles/user/:id/ (syncUserRoles)', () => {
    it('deve atualizar os cargos do usuário com sucesso', async () => {
      const res = await request(app)
        .patch(userRolesUrl(createdUserId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id_roles: [customerRole.id_role, adminRole.id_role] });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Cargos atualizados com sucesso!');
    });

    it('deve refletir os novos cargos ao buscar o usuário', async () => {
      const res = await request(app)
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.roles).toEqual(
        expect.arrayContaining(['customer', 'admin']),
      );
    });

    it('deve substituir (e não somar) os cargos anteriores', async () => {
      await request(app)
        .patch(userRolesUrl(createdUserId))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id_roles: [customerRole.id_role] });

      const res = await request(app)
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.roles).toEqual(['customer']);
    });

    it('deve retornar 401 sem autenticação', async () => {
      const res = await request(app)
        .patch(userRolesUrl(createdUserId))
        .send({ id_roles: [customerRole.id_role] });
      expect(res.statusCode).toBe(401);
    });
  });
});
