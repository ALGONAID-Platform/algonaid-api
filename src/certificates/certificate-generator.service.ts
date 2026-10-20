import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCanvas,
  loadImage,
  GlobalFonts,
  SKRSContext2D,
} from '@napi-rs/canvas';
import * as path from 'path';
import * as fs from 'fs';

export interface CertificateOffsets {
  studentName?: { x?: number; y?: number };
  courseName?: { x?: number; y?: number };
  lecturesCount?: { x?: number; y?: number };
  courseDuration?: { x?: number; y?: number };
  courseType?: { x?: number; y?: number };
  issueDate?: { x?: number; y?: number };
  certificateId?: { x?: number; y?: number };
}

export interface GenerateCertificateOptions {
  studentName: string;
  courseName: string;
  lecturesCount: number | string;
  courseDuration: string;
  courseType?: string;
  issueDate?: string | Date;
  certificateId: string;
  templatePath?: string;
  outputPath?: string;
  saveToFile?: boolean;
  offsets?: CertificateOffsets;
}

export interface GeneratedCertificateResult {
  buffer: Buffer;
  filePath?: string;
  url?: string;
  fileName?: string;
}

@Injectable()
export class CertificateGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(CertificateGeneratorService.name);
  private fontsRegistered = false;

  // إعدادات الإحداثيات الأساسية لقالب الشهادة (بدقة 1920 × 1080)
  public readonly defaultCoordinates = {
    studentName: {
      x: 960,
      y: 390,
      align: 'center' as const,
      maxFontSize: 52,
      minFontSize: 26,
      maxWidth: 960,
      color: '#1a2b49',
      fontWeight: 'bold',
    },
    courseName: {
      x: 960,
      y: 520,
      align: 'center' as const,
      maxFontSize: 36,
      minFontSize: 22,
      maxWidth: 1020,
      color: '#2c3e50',
      fontWeight: 'bold',
    },
    lecturesCount: {
      x: 1250,
      y: 680,
      align: 'center' as const,
      fontSize: 26,
      color: '#475569',
      fontWeight: '600',
    },
    courseDuration: {
      x: 960,
      y: 680,
      align: 'center' as const,
      fontSize: 26,
      color: '#475569',
      fontWeight: '600',
    },
    courseType: {
      x: 670,
      y: 680,
      align: 'center' as const,
      fontSize: 26,
      color: '#475569',
      fontWeight: '600',
    },
    issueDate: {
      x: 1680,
      y: 835,
      align: 'right' as const,
      fontSize: 22,
      color: '#334155',
      fontWeight: 'bold',
    },
    certificateId: {
      x: 1680,
      y: 875,
      align: 'right' as const,
      fontSize: 22,
      color: '#334155',
      fontWeight: 'bold',
    },
  };

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.registerFonts();
  }

  /**
   * تسجيل الخطوط العربية ودعمها بشكل صحيح دون تقطع في الحروف
   */
  public registerFonts() {
    if (this.fontsRegistered) return;

    const fontCandidates = [
      {
        path: path.join(process.cwd(), 'assets/fonts/Cairo-Bold.ttf'),
        family: 'CairoBold',
      },
      {
        path: path.join(process.cwd(), 'assets/fonts/Cairo-Regular.ttf'),
        family: 'CairoRegular',
      },
      {
        path: path.join(process.cwd(), 'assets/fonts/Tajawal-Bold.ttf'),
        family: 'TajawalBold',
      },
      {
        path: path.join(process.cwd(), 'assets/fonts/Tajawal-Regular.ttf'),
        family: 'TajawalRegular',
      },
      {
        path: path.join(__dirname, '../../assets/fonts/Cairo-Bold.ttf'),
        family: 'CairoBold',
      },
      {
        path: path.join(__dirname, '../../assets/fonts/Cairo-Regular.ttf'),
        family: 'CairoRegular',
      },
      {
        path: '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf',
        family: 'NotoNaskhArabicBold',
      },
      {
        path: '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
        family: 'NotoNaskhArabicRegular',
      },
    ];

    for (const font of fontCandidates) {
      if (fs.existsSync(font.path)) {
        try {
          GlobalFonts.registerFromPath(font.path, font.family);
          this.logger.log(`Font registered successfully: ${font.family} from ${font.path}`);
        } catch (err) {
          this.logger.warn(`Failed to register font ${font.family}: ${err.message}`);
        }
      }
    }

    this.fontsRegistered = true;
  }

  /**
   * دالة مساعدة لتحديد المسار الأساسي لمجلد uploads
   */
  private getUploadsBaseDir(): string {
    if (fs.existsSync('/usr/src/app/uploads')) {
      return '/usr/src/app/uploads';
    }
    const localUploads = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(localUploads)) {
      fs.mkdirSync(localUploads, { recursive: true });
    }
    return localUploads;
  }

  /**
   * تحديد مسار صورة قالب الشهادة
   */
  private async resolveTemplateImage(customPath?: string): Promise<Buffer | string> {
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    const localCandidates = [
      path.join(this.getUploadsBaseDir(), 'certificates/image.png'),
      path.join(process.cwd(), 'uploads/certificates/image.png'),
      path.join(process.cwd(), 'assets/certificates/image.png'),
    ];

    for (const p of localCandidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // إذا لم تكن موجودة محلياً، نجلبها من الرابط الافتراضي
    const remoteUrl = 'https://api.exchangesmangement.online/uploads/certificates/image.png';
    try {
      const response = await fetch(remoteUrl);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // حفظ نسخة محلية للكاش المستقبلي
        const certDir = path.join(this.getUploadsBaseDir(), 'certificates');
        if (!fs.existsSync(certDir)) {
          fs.mkdirSync(certDir, { recursive: true });
        }
        fs.writeFileSync(path.join(certDir, 'image.png'), buffer);
        return buffer;
      }
    } catch (e) {
      this.logger.warn(`Could not fetch remote template: ${e.message}`);
    }

    throw new Error('لم يتم العثور على صورة قالب الشهادة في المسار المحدد أو الخادم.');
  }

  /**
   * إنشاء وتوليد صورة الشهادة بدقة 1920 × 1080 بكسل مع النصوص العربية المحاذية بدقة
   */
  async generateCertificate(
    options: GenerateCertificateOptions,
  ): Promise<GeneratedCertificateResult> {
    this.registerFonts();

    const templateSource = await this.resolveTemplateImage(options.templatePath);
    const templateImage = await loadImage(templateSource);

    const canvasWidth = 1920;
    const canvasHeight = 1080;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // 1. رسم القالب الأساسي متطابقاً مع دقة 1920 × 1080
    ctx.drawImage(templateImage, 0, 0, canvasWidth, canvasHeight);

    // 2. إعدادات النصوص والـ RTL
    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';

    const offsets = options.offsets || {};
    const coords = this.defaultCoordinates;

    // --- أ) اسم الطالب (studentName) ---
    const studentX = coords.studentName.x + (offsets.studentName?.x || 0);
    const studentY = coords.studentName.y + (offsets.studentName?.y || 0);
    this.drawAutoScaledText(
      ctx,
      options.studentName,
      studentX,
      studentY,
      coords.studentName.maxWidth,
      coords.studentName.maxFontSize,
      coords.studentName.minFontSize,
      'CairoBold, NotoNaskhArabicBold, sans-serif',
      coords.studentName.color,
      coords.studentName.align,
      coords.studentName.fontWeight,
    );

    // --- ب) اسم الدورة (courseName) ---
    const courseX = coords.courseName.x + (offsets.courseName?.x || 0);
    const courseY = coords.courseName.y + (offsets.courseName?.y || 0);
    this.drawAutoScaledText(
      ctx,
      options.courseName,
      courseX,
      courseY,
      coords.courseName.maxWidth,
      coords.courseName.maxFontSize,
      coords.courseName.minFontSize,
      'CairoBold, NotoNaskhArabicBold, sans-serif',
      coords.courseName.color,
      coords.courseName.align,
      coords.courseName.fontWeight,
    );

    // --- ج) عدد المحاضرات (lecturesCount) ---
    const lecturesText = typeof options.lecturesCount === 'number'
      ? `${options.lecturesCount} محاضرة`
      : options.lecturesCount.includes('محاضرة')
        ? options.lecturesCount
        : `${options.lecturesCount} محاضرة`;
    const lecturesX = coords.lecturesCount.x + (offsets.lecturesCount?.x || 0);
    const lecturesY = coords.lecturesCount.y + (offsets.lecturesCount?.y || 0);
    this.drawText(
      ctx,
      lecturesText,
      lecturesX,
      lecturesY,
      coords.lecturesCount.fontSize,
      'CairoRegular, NotoNaskhArabicRegular, sans-serif',
      coords.lecturesCount.color,
      coords.lecturesCount.align,
      coords.lecturesCount.fontWeight,
    );

    // --- د) مدة الدورة (courseDuration) ---
    const durationX = coords.courseDuration.x + (offsets.courseDuration?.x || 0);
    const durationY = coords.courseDuration.y + (offsets.courseDuration?.y || 0);
    this.drawText(
      ctx,
      options.courseDuration,
      durationX,
      durationY,
      coords.courseDuration.fontSize,
      'CairoRegular, NotoNaskhArabicRegular, sans-serif',
      coords.courseDuration.color,
      coords.courseDuration.align,
      coords.courseDuration.fontWeight,
    );

    // --- هـ) نوع الدورة (courseType) ---
    const courseTypeText = options.courseType || 'دورة تدريبية معتمدة';
    const typeX = coords.courseType.x + (offsets.courseType?.x || 0);
    const typeY = coords.courseType.y + (offsets.courseType?.y || 0);
    this.drawText(
      ctx,
      courseTypeText,
      typeX,
      typeY,
      coords.courseType.fontSize,
      'CairoRegular, NotoNaskhArabicRegular, sans-serif',
      coords.courseType.color,
      coords.courseType.align,
      coords.courseType.fontWeight,
    );

    // --- و) التاريخ (issueDate) ---
    const formattedDate = this.formatDate(options.issueDate);
    const dateX = coords.issueDate.x + (offsets.issueDate?.x || 0);
    const dateY = coords.issueDate.y + (offsets.issueDate?.y || 0);
    this.drawText(
      ctx,
      formattedDate,
      dateX,
      dateY,
      coords.issueDate.fontSize,
      'CairoBold, NotoNaskhArabicBold, sans-serif',
      coords.issueDate.color,
      coords.issueDate.align,
      coords.issueDate.fontWeight,
    );

    // --- ز) رقم الشهادة (certificateId) ---
    const certIdX = coords.certificateId.x + (offsets.certificateId?.x || 0);
    const certIdY = coords.certificateId.y + (offsets.certificateId?.y || 0);
    this.drawText(
      ctx,
      options.certificateId,
      certIdX,
      certIdY,
      coords.certificateId.fontSize,
      'CairoBold, NotoNaskhArabicBold, sans-serif',
      coords.certificateId.color,
      coords.certificateId.align,
      coords.certificateId.fontWeight,
    );

    const buffer = canvas.toBuffer('image/png');

    // حفظ كملف إذا كان مطلوباً
    let savedFilePath: string | undefined;
    let url: string | undefined;
    const fileName = `cert_${options.certificateId.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;

    if (options.saveToFile || options.outputPath) {
      if (options.outputPath) {
        savedFilePath = options.outputPath;
      } else {
        const outputDir = path.join(this.getUploadsBaseDir(), 'certificates/generated');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        savedFilePath = path.join(outputDir, fileName);
      }

      fs.writeFileSync(savedFilePath, buffer);

      const rawAppUrl =
        this.configService.get<string>('APP_URL') ||
        'https://api.exchangesmangement.online';
      const domain = new URL(rawAppUrl).origin;
      url = `${domain}/uploads/certificates/generated/${fileName}`;
    }

    return {
      buffer,
      filePath: savedFilePath,
      url,
      fileName,
    };
  }

  /**
   * طباعة نص مع تصغير تلقائي للخط إذا زاد عن أقصى عرض (Max Width)
   */
  private drawAutoScaledText(
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    initialFontSize: number,
    minFontSize: number,
    fontFamily: string,
    color: string,
    alignment: 'center' | 'right' | 'left',
    fontWeight: string = 'bold',
  ) {
    let fontSize = initialFontSize;
    ctx.textAlign = alignment;
    ctx.fillStyle = color;
    ctx.direction = 'rtl';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    while (ctx.measureText(text).width > maxWidth && fontSize > minFontSize) {
      fontSize -= 1.5;
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    }

    ctx.fillText(text, x, y);
  }

  /**
   * طباعة نص محدد بالحجم والمحاذاة
   */
  private drawText(
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fontFamily: string,
    color: string,
    alignment: 'center' | 'right' | 'left',
    fontWeight: string = 'normal',
  ) {
    ctx.textAlign = alignment;
    ctx.fillStyle = color;
    ctx.direction = 'rtl';
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillText(text, x, y);
  }

  /**
   * تنسيق التاريخ العربي/الميلادي بصيغة YYYY/MM/DD
   */
  private formatDate(dateInput?: string | Date): string {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) {
      return typeof dateInput === 'string' ? dateInput : new Date().toISOString().split('T')[0].replace(/-/g, '/');
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }
}

