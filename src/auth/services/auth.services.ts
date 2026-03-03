import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { UserLoginDto } from "../dtos/user-login.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from 'bcrypt';
import { UserRole } from "../enums/userRole";
import { Role } from "@prisma/client";


@Injectable()
export class AuthService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) { }

    async register(userDto: UserRegisterDto) {
        const { email, password, name, role } = userDto;

        
        const existingUser = await this.prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        
        const hashedPassword = await bcrypt.hash(password, 10);

        
        let prismaRole: Role = Role.STUDENT;
        if (role === UserRole.ADMIN) prismaRole = Role.ADMIN;
        if (role === UserRole.OWNER) prismaRole = Role.OWNER;

        
        const user = await this.prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: prismaRole,
                
                ...(prismaRole === Role.STUDENT ? {
                    studentProfile: {
                        create: {
                            academicId: `STU-${Date.now()}` 
                        }
                    }
                } : prismaRole === Role.ADMIN ? {
                    teacherProfile: {
                        create: {
                            specialization: 'General' 
                        }
                    }
                } : {})
            }
        });

        
        const token = await this.generateToken(user.id, user.email, user.role);

        return {
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            access_token: token
        };
    }

    async login(userDto: UserLoginDto) {
        const { email, password } = userDto;

    
        const user = await this.prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        
        const token = await this.generateToken(user.id, user.email, user.role);

        return {
            message: 'Logged in successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            access_token: token
        };
    }

    private async generateToken(userId: number, email: string, role: Role) {
        
        let userRole: UserRole = UserRole.STUDENT;
        if (role === Role.ADMIN) userRole = UserRole.ADMIN;
        if (role === Role.OWNER) userRole = UserRole.OWNER;

        const payload = { id: userId, email, role: userRole };
        return await this.jwtService.signAsync(payload);
    }

}
