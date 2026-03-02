import { IsString, IsEmail, MinLength, Matches, MaxLength, Length, IsNotEmpty } from 'class-validator';


export class UserLoginDto {
    
    @IsNotEmpty({ message: ' email is required' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Length(5, 100)
    email: string;


    @IsNotEmpty({ message: 'Password is required' })
    @IsString({ message: 'Password must be a string' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @MaxLength(15)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
        message: 'Password must contain at least 1 uppercase, 1 lowercase, 1 number and 1 special character',
    })
    password: string;
}