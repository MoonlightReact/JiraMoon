
export async function loginMock(data: {
  email: string;
  password: string;
}) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const validEmail = "teste@email.com"
  const validPassword = "Qwert678";

  if(data.email !== validEmail || data.password !== validPassword){
      throw new Error("Usuario ou senha inválidos.");
  }

  return {message: "Usuário autenticado", token: "mock-token-fake-12345", user: { id: 4, name: "carlos", email: "teste@email.com", cpf: "80160571014", type: "admin"} };
}
