import { Controller, Get, Patch, Body, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayloadType } from 'src/utils/types';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SupabaseStorageService } from 'src/utils/supabase-storage.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @Get('profile/badges')
  @UseGuards(AuthGuard)
  async getBadges(@CurrentUser() user: JwtPayloadType) {
    return this.usersService.getBadges(user.id);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: JwtPayloadType) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'avatar', maxCount: 1 },
    { name: 'background', maxCount: 1 },
  ]))
  async updateProfile(
    @CurrentUser() user: JwtPayloadType,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFiles() files?: { avatar?: Express.Multer.File[], background?: Express.Multer.File[] },
  ) {
    if (files?.avatar?.[0]) {
      updateProfileDto.avatar = await this.supabaseStorageService.uploadFile(files.avatar[0], 'algonaid', 'avatars');
    }
    if (files?.background?.[0]) {
      updateProfileDto.background = await this.supabaseStorageService.uploadFile(files.background[0], 'algonaid', 'backgrounds');
    }
    return this.usersService.updateProfile(user.id, updateProfileDto, user.role);
  }
}
