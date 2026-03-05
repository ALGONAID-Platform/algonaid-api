// import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
// import { ConfigService } from "@nestjs/config";
// import { Reflector } from "@nestjs/core";
// import { JwtService } from "@nestjs/jwt";
// import { Request } from "express";
// import { JwtPayloadType } from "src/utils/types";


// @Injectable()
// export class AuthRollGuard implements CanActivate {

//     constructor(
//         private readonly jwtService: JwtService,
//         private readonly config: ConfigService,
//         private readonly reflector: Reflector,
//         private readonly userService: UserService,
//     ) { }
//     async canActivate(context: ExecutionContext): Promise<boolean> {
//         const rolls: UserType[] = this.reflector.getAllAndOverride<UserType[]>('roles', [context.getHandler(), context.getClass()])
//         console.group(rolls);
//         if (!rolls || rolls.length == 0) {
//             return false
//         }

//         const request: Request = context.switchToHttp().getRequest();
//         const [type, token] = request.headers.authorization?.split(" ") ?? [];
//         if (token && type == "Bearer") {
//             try {

//                 const payload = await this.jwtService.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET') }) as JwtPayloadType

//                 const user = await this.userService.getCurrentUser(payload.id);
//                 if (!user) return false;
//                 if (rolls.includes(user.userType)) {
//                     request[CURRENT_USER_KEY] = payload;

//                     return true;
//                 }
//             } catch (e) {
//                 throw new UnauthorizedException("access denied , invalid token")
//             }
//             throw new UnauthorizedException("access denied , invalid token")
//         } else {
//             throw new UnauthorizedException("access denied , invalid token")
//         }
//     }

// }