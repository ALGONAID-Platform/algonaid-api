import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { UserLoginDto } from "../dtos/user-login.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from 'bcrypt';
import { UserRole } from "../enums/userRole";
import { Role } from "../../prisma/client/enums";
import { MESSAGES } from "src/utils/messages";


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
            throw new ConflictException(MESSAGES.AUTH.EMAIL_ALREADY_REGISTERED);
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
            message: MESSAGES.AUTH.USER_REGISTERED,
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

        if (!user || !user.password) {
            throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
        }


        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException(MESSAGES.AUTH.INVALID_CREDENTIALS);
        }


        const token = await this.generateToken(user.id, user.email, user.role);

        return {
            message: MESSAGES.AUTH.LOGGED_IN,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            access_token: token
        };
    }

    async validateGoogleUser(googleUser: any) {
        const { email, name, googleId } = googleUser;

        let user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            // Update user with googleId if they signed up with email before
            if (!user.googleId) {
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { googleId },
                });
            }
        } else {
            // Create new user (default role is STUDENT)
            user = await this.prisma.user.create({
                data: {
                    email,
                    name,
                    googleId,
                    role: Role.STUDENT,
                    studentProfile: {
                        create: {
                            academicId: `STU-G-${Date.now()}`
                        }
                    }
                },
            });
        }

        const token = await this.generateToken(user.id, user.email, user.role);

        return {
            message: 'Google login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            access_token: token
        };
    }

    async getCurrentUser(id: number) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException(MESSAGES.AUTH.USER_NOT_EXIST(id));
        }
        else {
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
            }
        }
    }

    async logout(token: string) {
        const decoded = this.jwtService.decode(token) as any;
        const expiresAt = new Date(decoded.exp * 1000);

        await this.prisma.tokenBlacklist.create({
            data: {
                token,
                expiresAt,
            },
        });

        return { message: 'Logged out successfully' };
    }

    private async generateToken(userId: number, email: string, role: Role) {

        let userRole: UserRole = UserRole.STUDENT;
        if (role === Role.ADMIN) userRole = UserRole.ADMIN;
        if (role === Role.OWNER) userRole = UserRole.OWNER;

        const payload = { id: userId, email, role: userRole };
        return await this.jwtService.signAsync(payload);
    }

}
