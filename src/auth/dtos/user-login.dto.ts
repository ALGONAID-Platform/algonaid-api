import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, Matches, MaxLength, Length, IsNotEmpty } from 'class-validator';
<<<<<<< HEAD
import { MESSAGES } from 'src/utils/messages';
=======
>>>>>>> 4ae83ac602a041b0b1661e7929717ff6a7b6cad0


export class UserLoginDto {

    @ApiProperty({
        example: 'KhaledAlshibani@gmail.com',
        description: 'البريد الإلكتروني المسجل للمستخدم',
        format: 'email',
<<<<<<< HEAD
    })
    @IsNotEmpty({ message: MESSAGES.VALIDATION.EMAIL_REQUIRED })
    @IsEmail({}, { message: MESSAGES.VALIDATION.EMAIL_INVALID })
=======
    }) 
    @IsNotEmpty({ message: ' email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
>>>>>>> 4ae83ac602a041b0b1661e7929717ff6a7b6cad0
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
<<<<<<< HEAD
    @IsNotEmpty({ message: MESSAGES.VALIDATION.PASSWORD_REQUIRED })
    @IsString({ message: MESSAGES.VALIDATION.PASSWORD_STRING })
    @MinLength(8, { message: MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH })
    @MaxLength(15)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
        message: MESSAGES.VALIDATION.PASSWORD_COMPLEXITY,
=======
    @IsNotEmpty({ message: 'Password is required' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(15)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
        message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number and 1 special character',
>>>>>>> 4ae83ac602a041b0b1661e7929717ff6a7b6cad0
    })
    //==================
    password: string;
    //==================

}