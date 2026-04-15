import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "../enums/userRole";
import { IsString, IsEmail, MinLength, Matches, MaxLength, Length, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { MESSAGES } from 'src/utils/messages';

export class UserRegisterDto {
    @IsNotEmpty({ message: MESSAGES.VALIDATION.NAME_REQUIRED })
    @IsString({ message: MESSAGES.VALIDATION.NAME_STRING })
    @MinLength(2, { message: MESSAGES.VALIDATION.NAME_MIN_LENGTH })
    @MaxLength(50)
    //==================
    name: string;
    //==================



    @ApiProperty({
        example: 'KhaledAlshibani@gmail.com',
        description: 'البريد الإلكتروني المسجل للمستخدم',
        format: 'email',
    })
    @IsNotEmpty({ message: MESSAGES.VALIDATION.EMAIL_REQUIRED })
    @IsEmail({}, { message: MESSAGES.VALIDATION.EMAIL_INVALID })
    @Length(5, 100)
    //==================
    email: string;
    //==================



    @ApiProperty({
        example: 'Password123!',
        description: 'كلمة مرور المستخدم',
        minLength: 6,
        type: String,
    })
    @IsNotEmpty({ message: MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    @IsString({ message: MESSAGES.VALIDATION.PASSWORD_STRING })
    @MinLength(8, { message: MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH })
    @MaxLength(20)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,20}$/, {
        message: MESSAGES.VALIDATION.PASSWORD_COMPLEXITY,
    })
    //==================
    password: string;
    //==================



    @ApiProperty({
        example: UserRole.STUDENT,
        enum: UserRole,
        description: 'نوع الحساب: طالب أو معلم',
        required: true,
    })
    @IsEnum(UserRole, { message: MESSAGES.VALIDATION.ROLE_INVALID })
    @IsNotEmpty({ message: MESSAGES.VALIDATION.ROLE_REQUIRED })
    //==================
    role: UserRole
    //==================

}


