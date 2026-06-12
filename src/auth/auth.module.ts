import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.services";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { GoogleStrategy } from "./strategies/google.strategy";
import { PrismaModule } from "src/prisma/prisma.module";
import { MailService } from "src/utils/mail.service";

@Module({
    imports: [
       PrismaModule
    ],
    controllers: [AuthController],
    providers: [AuthService, GoogleStrategy, MailService],
    exports: [AuthService],
})
export class AuthModule { }
