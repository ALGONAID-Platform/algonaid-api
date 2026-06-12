import { Controller, Get, Patch, Body, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayloadType } from 'src/utils/types';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadcareStorageService } from 'src/utils/uploadcare-storage.service';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadcareStorageService: UploadcareStorageService,
  ) {}

  @ApiOperation({ summary: 'Get user badges (achievements)' })
  @ApiResponse({ status: 200, description: 'Return the list of badges earned by the user.' })
  @Get('profile/badges')
  @UseGuards(AuthGuard)
  async getBadges(@CurrentUser() user: JwtPayloadType) {
    return this.usersService.getBadges(user.id);
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Return the detailed profile of the current user.' })
  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: JwtPayloadType) {
    return this.usersService.getProfile(user.id);
  }

  @ApiOperation({ summary: 'Update user profile and upload images' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
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
      updateProfileDto.avatar = await this.uploadcareStorageService.upload(files.avatar[0]);
    }
    if (files?.background?.[0]) {
      updateProfileDto.background = await this.uploadcareStorageService.upload(files.background[0]);
    }
    return this.usersService.updateProfile(user.id, updateProfileDto, user.role);
  }
}
