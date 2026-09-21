import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, Matches, MaxLength, Length, IsNotEmpty } from 'class-validator';
import { MESSAGES } from 'src/utils/messages';


export class UserLoginDto {

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
    @MinLength(6, { message: MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH })
    @MaxLength(30)
    @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
        message: MESSAGES.VALIDATION.PASSWORD_COMPLEXITY,
    })
    //==================
    password: string;
    //==================

}