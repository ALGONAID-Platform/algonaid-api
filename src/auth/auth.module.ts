import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.services";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { GoogleStrategy } from "./strategies/google.strategy";

@Module({
    imports: [
       
    ],
    controllers: [AuthController],
    providers: [AuthService, GoogleStrategy],
    exports: [AuthService],
})
export class AuthModule { }
