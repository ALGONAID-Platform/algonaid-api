import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LiveStatus } from '@prisma/client';

export class UpdateLiveStatusDto {
  @ApiProperty({
    enum: LiveStatus,
    example: LiveStatus.LIVE_NOW,
    description: 'Current live streaming status (SCHEDULED, LIVE_NOW, COMPLETED)',
  })
  @IsEnum(LiveStatus)
  @IsNotEmpty()
  liveStatus: LiveStatus;

  @ApiProperty({
    example: 'https://example.com/recording.mp4',
    required: false,
    description: 'Optional recording URL when live stream is COMPLETED',
  })
  @IsOptional()
  @IsString()
  recordingVideoUrl?: string;
}
