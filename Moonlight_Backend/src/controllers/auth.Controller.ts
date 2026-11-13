import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from '../services/auth.Service.js';
import type { LoginAuthDTO } from '../@types/auth/auth.input.dto.js';

export class AuthController {

    constructor(private authService: AuthService){
    }

    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const dto = req.body as LoginAuthDTO;

        const user = await this.authService.login(dto);

        res.status(200).json({
            message: 'Login realizado com sucesso!',
            token: user.token,
            user: {id_user: user.id_user, name: user.name, email: user.email, cpf: user.cpf, roles: user.roles}
          });
      } catch (error) {
          next(error);
      }
    };
}
