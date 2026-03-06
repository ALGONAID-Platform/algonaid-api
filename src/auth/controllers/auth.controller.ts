import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { AuthService } from "../services/auth.services";
import { UserLoginDto } from "../dtos/user-login.dto";
import { SwaggerLogin, SwaggerRegister } from "../decorators/swagger.decorators";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";


@Controller("auth")
export class AuthController {

    constructor(
        private readonly authService: AuthService
    ) {

    }


    @SwaggerRegister()
    @Post('signup')
    async register(@Body() userDto: UserRegisterDto) {
        return await this.authService.register(userDto);

    }


    @HttpCode(HttpStatus.OK)
    @Post('signin')
    @SwaggerLogin()
    async signin(@Body() userDto: UserLoginDto) {
        return await this.authService.login(userDto);
    }

    @Get(":id")
    async getCureentUser(@Param("id", ParseIntPipe) id: number) {
        return await this.authService.getCurrentUser(id);
    }

}