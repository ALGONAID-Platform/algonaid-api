import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { JwtPayloadType } from "src/utils/types";
import { AuthService } from "../services/auth.services";
import { UserRole } from "../enums/userRole";
import { CURRENT_USER_KEY } from "src/utils/conistants";
import { Role } from "@prisma/client";
import { MESSAGES } from "src/utils/messages";


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

        if (!rolls || rolls.length == 0) {
            return true; // If no roles are specified, allow access (or change to false if you want strict default)
        }

        const request = context.switchToHttp().getRequest();
        const [type, token] = request.headers.authorization?.split(" ") ?? [];

        if (!token || type !== "Bearer") {
            throw new UnauthorizedException(MESSAGES.AUTH.NO_TOKEN_PROVIDED);
        }

        let payload: JwtPayloadType;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: this.config.get<string>('JWT_SECRET') || 'defaultSecret'
            }) as JwtPayloadType;
        } catch (e) {
            throw new UnauthorizedException(MESSAGES.AUTH.INVALID_TOKEN);
        }

        const user = await this.authService.getCurrentUser(payload.id);
        if (!user) {
            throw new UnauthorizedException(MESSAGES.AUTH.ACCESS_DENIED_USER_NOT_FOUND);
        }

        if (rolls.includes(user.user.role)) {
            request[CURRENT_USER_KEY] = payload;
            return true;
        }

        throw new ForbiddenException(MESSAGES.AUTH.INSUFFICIENT_PERMISSIONS);
    }

}