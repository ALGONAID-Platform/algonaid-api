import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "../enums/userRole";
import { IsString, IsEmail, MinLength, Matches, MaxLength, Length, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class UserRegisterDto {
    @IsNotEmpty({ message: 'Name is required' })
    @IsString({ message: 'Name must be a string' })
    @MinLength(2, { message: 'Name must be at least 2 characters long' })
    @MaxLength(50)
    //==================
    name: string;
    //==================



    @ApiProperty({
        example: 'KhaledAlshibani@gmail.com',
        description: 'البريد الإلكتروني المسجل للمستخدم',
        format: 'email',
    })
    @IsNotEmpty({ message: ' email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
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
    @IsNotEmpty({ message: 'Password is required' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(20)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,20}$/, {
        message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number and 1 special character (@$!%*?&#)',
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
    @IsEnum(UserRole, { message: 'role must be student or admin' })
    @IsNotEmpty({ message: "please , fill the role" })
    //==================
    role: UserRole
     //==================

}


