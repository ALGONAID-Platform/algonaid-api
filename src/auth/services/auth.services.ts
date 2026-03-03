import { Injectable } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { UserLoginDto } from "../dtos/user-login.dto";

@Injectable()
export class AuthService {

    constructor(
    ) { }

    async register(userDto: UserRegisterDto) {

    }
    async login(userDto: UserLoginDto) {

    }
    
}