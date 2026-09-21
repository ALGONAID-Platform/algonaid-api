import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { CURRENT_USER_KEY } from "src/utils/conistants";
import { JwtPayloadType } from "src/utils/types";
import { MESSAGES } from "src/utils/messages";
import { PrismaService } from "src/prisma/prisma.service";


@Injectable()
export class AuthGuard implements CanActivate {

    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly prisma: PrismaService
    ) { }
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const [type, token] = request.headers.authorization?.split(" ") ?? [];
        if (token && type == "Bearer") {
            
            // Check if token is blacklisted
            const blacklisted = await this.prisma.tokenBlacklist.findUnique({
                where: { token }
            });

            if (blacklisted) {
                throw new UnauthorizedException(MESSAGES.AUTH.INVALID_TOKEN);
            }

            try {
                const payload = await this.jwtService.verifyAsync(token, { secret: this.config.getOrThrow<string>('JWT_SECRET') }) as JwtPayloadType
                request[CURRENT_USER_KEY] = payload;

                if (!payload) {
                    return false
                }

            } catch (e) {
                throw new UnauthorizedException(MESSAGES.AUTH.INVALID_TOKEN)
            }
            return true
        } else {
            throw new UnauthorizedException(MESSAGES.AUTH.INVALID_TOKEN)
        }
    }

}