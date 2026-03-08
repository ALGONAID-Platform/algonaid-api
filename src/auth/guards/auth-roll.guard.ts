import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { JwtPayloadType } from "src/utils/types";
import { AuthService } from "../services/auth.services";
import { UserRole } from "../enums/userRole";
import { CURRENT_USER_KEY } from "src/utils/conistants";
import { Role } from "src/prisma/client/enums";


@Injectable()
export class AuthRollGuard implements CanActivate {

    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly reflector: Reflector,
        private readonly authService: AuthService,
    ) { }
    async canActivate(context: ExecutionContext): Promise<boolean> {

        const rolls: Role[] = this.reflector.getAllAndOverride<Role[]>('roles', [context.getHandler(), context.getClass()])
        console.group(rolls);
        if (!rolls || rolls.length == 0) {
            return false
        }

        const request = context.switchToHttp().getRequest();
        const [type, token] = request.headers.authorization?.split(" ") ?? [];
        if (token && type == "Bearer") {
            try {

                const payload = await this.jwtService.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET') }) as JwtPayloadType
                const user = await this.authService.getCurrentUser(payload.id);
                if (!user) return false;
                if (rolls.includes(user.user.role)) {
                    request[CURRENT_USER_KEY] = payload;

                    return true;
                }
            } catch (e) {
                throw new UnauthorizedException("access denied , invalid token")
            }
            throw new UnauthorizedException("access denied , invalid token")
        } else {
            throw new UnauthorizedException("access denied , invalid token")
        }
    }

}