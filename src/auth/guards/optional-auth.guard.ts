import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { CURRENT_USER_KEY } from "src/utils/conistants";
import { JwtPayloadType } from "src/utils/types";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class OptionalAuthGuard implements CanActivate {

    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly prisma: PrismaService
    ) { }
    
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const [type, token] = request.headers.authorization?.split(" ") ?? [];
        if (token && type == "Bearer") {
            try {
                // Check if token is blacklisted — if so, treat request as unauthenticated
                const blacklisted = await this.prisma.tokenBlacklist.findUnique({
                    where: { token }
                });

                if (blacklisted) {
                    // Don't set user in request — proceed as unauthenticated
                    return true;
                }

                const payload = await this.jwtService.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET') }) as JwtPayloadType;
                request[CURRENT_USER_KEY] = payload;
            } catch (e) {
                // Ignore invalid token, proceed as unauthenticated
            }
        }
        return true;
    }
}
