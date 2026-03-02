import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.services";

@Module({
    controllers : [AuthController],
    providers : [AuthService],
})
export class AuthModule{}