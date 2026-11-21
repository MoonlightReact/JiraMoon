import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from '@modules/auth/auth.service.js';
import type { LoginAuthDTO } from '@modules/auth/dto/auth.input.dto.js';

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
