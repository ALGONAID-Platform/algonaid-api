// import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
// import { ConfigService } from "@nestjs/config";
// import { JwtService } from "@nestjs/jwt";
// import { Request } from "express";
// import { Observable } from "rxjs";
// import { CURRENT_USER_KEY } from "src/utils/conistants";
// import { JwtPayloadType } from "src/utils/types";


// @Injectable()
// export class AuthGuard implements CanActivate {

//     constructor(
//         private readonly jwtService: JwtService,
//         private readonly config: ConfigService
//     ) { }
//     async canActivate(context: ExecutionContext):Promise<boolean> {
//         const request: Request = context.switchToHttp().getRequest();
//         const [type, token] = request.headers.authorization?.split(" ") ?? [];
//         if (token && type == "Bearer") {
//             try {

//                 const payload = await this.jwtService.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRET') }) as JwtPayloadType
//                 request[CURRENT_USER_KEY] = payload;

//                 if (!payload) {
//                     return false
//                 }

//             } catch (e) {
//                 throw new UnauthorizedException("access denied , invalid token")
//             }
//             return true
//         } else {
//             throw new UnauthorizedException("access denied , invalid token")
//         }
//     }

// }