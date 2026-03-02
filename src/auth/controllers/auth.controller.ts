import { Body, Controller, Post } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { AuthService } from "../services/auth.services";
import { UserLoginDto } from "../dtos/user-login.dto";

@Controller("auth")
export class AuthController {

    constructor(
        private readonly authService: AuthService
    ) {

    }

    @Post('signup')
    async register(@Body() userDto: UserRegisterDto) {
        return await this.authService.register(userDto);

    }

    @Post('signin')
    async signin(@Body() userDto: UserLoginDto) {
        return await this.authService.login(userDto);
    }

}