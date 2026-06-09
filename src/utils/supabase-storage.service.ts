import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') as string;
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadFile(file: Express.Multer.File, bucket: string, folder: string = 'uploads'): Promise<string> {
    const fileName = `${folder}/${Date.now()}-${file.originalname}`;
    
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase storage upload error: ${error.message}`);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  }

  async deleteFile(fileUrl: string, bucket: string): Promise<void> {
    if (!fileUrl) return;
    
    try {
      const fileName = fileUrl.split(`${bucket}/`)[1];
      if (!fileName) return;

      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([fileName]);

      if (error) {
        console.error('Error deleting file from Supabase:', error.message);
      }
    } catch (error) {
      console.error('Error parsing Supabase file URL for deletion:', error);
    }
  }
}
