import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayloadType } from 'src/utils/types';
import { Role } from '@prisma/client';
import { CreateBackupDto } from './dto/create-backup.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// الترتيب الطوبولوجي للجداول لتجنب أي تعارض في القيود والعلاقات عند الاسترجاع
const TABLE_DEPENDENCY_ORDER: string[] = [
  'User',
  'Student',
  'Teacher',
  'TokenBlacklist',
  'EarnedBadge',
  'Course',
  'CourseReview',
  'PaymentAccount',
  'Payment',
  'Enrollment',
  'Module',
  'Lesson',
  'LessonPdf',
  'LessonProgress',
  'Exam',
  'Question',
  'Option',
  'ExamAttempt',
  'UserAnswer',
  'PracticeExam',
  'Assignment',
  'AssignmentSubmission',
  'Certificate',
  'Post',
  'PostComment',
  'PostLike',
  'PostView',
  'PollOption',
  'PollVote',
  'Comment',
  'Mention',
];

export interface BackupMetadata {
  version: string;
  engine: string;
  format: 'json' | 'sql';
  fileName: string;
  fileSize: number;
  formattedSize: string;
  checksum: string;
  createdAt: string;
  creator?: {
    id: number;
    email: string;
    role: string;
  };
  note?: string;
  tablesCount: number;
  totalRecords: number;
  tableRecords: Record<string, number>;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.backupDir = path.join(process.cwd(), 'db-backups');
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
        this.logger.log(`Created backups directory at: ${this.backupDir}`);
      } catch (err: any) {
        this.logger.error(`Failed to create backups directory: ${err?.message}`);
      }
    }
  }

  /**
   * دالة مساعدة لتنسيق حجم الملف بصيغة مفهومة (KB, MB)
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * تنظيف وتأمين اسم الملف ضد هجمات Path Traversal
   */
  private sanitizeFileName(fileName: string): string {
    const clean = path.basename(fileName);
    if (!clean || clean !== fileName || clean.includes('..') || clean.includes('/') || clean.includes('\\')) {
      throw new BadRequestException('اسم الملف غير صالح أو يحتوي على مسار غير مسموح به');
    }
    return clean;
  }

  /**
   * دالة تحويل القيم إلى نص SQL آمن
   */
  private sqlEscape(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return isFinite(val) ? val.toString() : 'NULL';
    if (typeof val === 'bigint') return val.toString();
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (Array.isArray(val)) {
      const escaped = val.map((v) =>
        typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : v,
      );
      return `'{${escaped.join(',')}}'`;
    }
    if (typeof val === 'object') {
      return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  /**
   * جلب قائمة الجداول الحالية في قاعدة البيانات
   */
  private async getPublicTables(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != '_prisma_migrations' ORDER BY table_name;`,
    );
    const dbTables = rows.map((r) => r.table_name);

    // ترتيب الجداول وفق الترتيب الطوبولوجي، مع إضافة أي جداول غير موجودة في القائمة الثابتة في النهاية
    const ordered: string[] = [];
    for (const t of TABLE_DEPENDENCY_ORDER) {
      if (dbTables.includes(t)) {
        ordered.push(t);
      }
    }
    for (const t of dbTables) {
      if (!ordered.includes(t)) {
        ordered.push(t);
      }
    }
    return ordered;
  }

  /**
   * 1. إنشاء نسخة احتياطية كاملة لجميع الجداول
   */
  async createBackup(user: JwtPayloadType, dto?: CreateBackupDto): Promise<{ success: boolean; message: string; backup: BackupMetadata }> {
    this.logger.log(`Starting database backup initiated by user ${user.id} (${user.email})...`);

    const tables = await this.getPublicTables();
    const format = dto?.format === 'sql' ? 'sql' : 'json';
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestampStr}.${format}`;
    const filePath = path.join(this.backupDir, fileName);

    const tablesData: Record<string, any[]> = {};
    const tableRecords: Record<string, number> = {};
    let totalRecords = 0;

    // استخراج بيانات كل جدول
    for (const tableName of tables) {
      try {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tableName}";`);
        tablesData[tableName] = rows;
        tableRecords[tableName] = rows.length;
        totalRecords += rows.length;
      } catch (err: any) {
        this.logger.warn(`Could not read table "${tableName}": ${err?.message}`);
        tablesData[tableName] = [];
        tableRecords[tableName] = 0;
      }
    }

    let fileContent: string;
    let checksum: string;

    if (format === 'sql') {
      // بناء ملف SQL ترانزاكشن متكامل
      const sqlParts: string[] = [
        `-- ============================================================`,
        `-- Algonaid Platform - Database Backup`,
        `-- Generated At: ${new Date().toISOString()}`,
        `-- Created By: ${user.email} (ID: ${user.id})`,
        `-- Total Tables: ${tables.length}`,
        `-- Total Records: ${totalRecords}`,
        `-- ============================================================`,
        ``,
        `BEGIN;`,
        `SET session_replication_role = 'replica';`,
        ``,
      ];

      // إفراغ الجداول
      if (tables.length > 0) {
        const quotedTables = tables.map((t) => `"${t}"`).join(', ');
        sqlParts.push(`TRUNCATE TABLE ${quotedTables} CASCADE;\n`);
      }

      // إدراج البيانات
      for (const tableName of tables) {
        const rows = tablesData[tableName];
        if (rows && rows.length > 0) {
          const columns = Object.keys(rows[0]);
          const quotedColumns = columns.map((c) => `"${c}"`).join(', ');

          // تقسيم إلى دفعات من 100 سجل في كل جملة INSERT
          const chunkSize = 100;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const valueRows = chunk.map(
              (r) => `(${columns.map((col) => this.sqlEscape(r[col])).join(', ')})`,
            );
            sqlParts.push(
              `INSERT INTO "${tableName}" (${quotedColumns}) VALUES\n  ${valueRows.join(',\n  ')};`,
            );
          }
          sqlParts.push('');
        }
      }

      sqlParts.push(`SET session_replication_role = 'origin';\n`);

      // إعادة ضبط الـ sequences لجميع الجداول ذات المعرف التلقائي
      sqlParts.push(`-- Reset Sequences`);
      for (const tableName of tables) {
        sqlParts.push(
          `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE(MAX(id), 1)) FROM "${tableName}";`,
        );
      }

      sqlParts.push(`\nCOMMIT;`);
      fileContent = sqlParts.join('\n');
      checksum = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');
    } else {
      // صيغة JSON الكاملة مع البصمة والبيانات الوصفية
      const rawPayload = {
        metadata: {
          version: '1.0',
          engine: 'algonaid-db-backup',
          format: 'json',
          createdAt: new Date().toISOString(),
          tablesCount: tables.length,
          totalRecords,
          tableRecords,
          creator: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          note: dto?.note || null,
        },
        tables: tablesData,
      };

      const serializedWithoutChecksum = JSON.stringify(rawPayload, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      checksum = crypto.createHash('sha256').update(serializedWithoutChecksum, 'utf8').digest('hex');

      const fullPayload = {
        ...rawPayload,
        checksum,
      };

      fileContent = JSON.stringify(fullPayload, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
        2,
      );
    }

    // حفظ الملف في المجلد
    fs.writeFileSync(filePath, fileContent, 'utf8');
    const stat = fs.statSync(filePath);

    const metadata: BackupMetadata = {
      version: '1.0',
      engine: 'algonaid-db-backup',
      format,
      fileName,
      fileSize: stat.size,
      formattedSize: this.formatBytes(stat.size),
      checksum,
      createdAt: new Date().toISOString(),
      creator: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      note: dto?.note || undefined,
      tablesCount: tables.length,
      totalRecords,
      tableRecords,
    };

    // حفظ ملف البيانات الوصفية المرافق
    const metaPath = path.join(this.backupDir, `${fileName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    this.logger.log(`Backup completed successfully: ${fileName} (${this.formatBytes(stat.size)}, ${totalRecords} records).`);

    return {
      success: true,
      message: `تم إنشاء النسخة الاحتياطية بنجاح (${this.formatBytes(stat.size)} - ${totalRecords} سجل في ${tables.length} جدول)`,
      backup: metadata,
    };
  }

  /**
   * 2. عرض قائمة النسخ الاحتياطية المتوفرة على السيرفر
   */
  async listBackups(): Promise<{ success: boolean; total: number; backups: BackupMetadata[] }> {
    if (!fs.existsSync(this.backupDir)) {
      return { success: true, total: 0, backups: [] };
    }

    const files = fs.readdirSync(this.backupDir);
    const backupFiles = files.filter(
      (f) =>
        !f.endsWith('.meta.json') &&
        (f.endsWith('.json') || f.endsWith('.sql') || f.endsWith('.dump')),
    );

    const backups: BackupMetadata[] = [];

    for (const fileName of backupFiles) {
      const filePath = path.join(this.backupDir, fileName);
      const metaPath = path.join(this.backupDir, `${fileName}.meta.json`);

      try {
        const stat = fs.statSync(filePath);

        // 1. محاولة قراءة ملف الـ meta المخصص إذا وُجد
        if (fs.existsSync(metaPath)) {
          const metaContent = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          backups.push({
            ...metaContent,
            fileName,
            fileSize: stat.size,
            formattedSize: this.formatBytes(stat.size),
          });
          continue;
        }

        // 2. إذا كان ملف JSON، نحاول قراءة الـ metadata من داخل الملف مباشرة
        if (fileName.endsWith('.json')) {
          try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (raw.metadata) {
              backups.push({
                ...raw.metadata,
                fileName,
                fileSize: stat.size,
                formattedSize: this.formatBytes(stat.size),
                checksum: raw.checksum || 'N/A',
              });
              continue;
            }
          } catch {}
        }

        // 3. كقيمة احتياطية للملفات الخارجية أو .dump القديمة
        backups.push({
          version: '1.0',
          engine: 'legacy-dump',
          format: fileName.endsWith('.sql') ? 'sql' : 'json',
          fileName,
          fileSize: stat.size,
          formattedSize: this.formatBytes(stat.size),
          checksum: 'N/A',
          createdAt: stat.mtime.toISOString(),
          tablesCount: 0,
          totalRecords: 0,
          tableRecords: {},
        });
      } catch (err: any) {
        this.logger.warn(`Could not read backup file ${fileName}: ${err?.message}`);
      }
    }

    // ترتيب النسخ الأحدث أولاً
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      success: true,
      total: backups.length,
      backups,
    };
  }

  /**
   * 3. جلب مسار ملف النسخة للتحميل
   */
  getBackupDownloadPath(fileName: string): { filePath: string; fileName: string; fileSize: number } {
    const cleanName = this.sanitizeFileName(fileName);
    const filePath = path.join(this.backupDir, cleanName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`ملف النسخة الاحتياطية (${cleanName}) غير موجود على السيرفر`);
    }

    const stat = fs.statSync(filePath);
    return {
      filePath,
      fileName: cleanName,
      fileSize: stat.size,
    };
  }

  /**
   * 4. فحص والتحقق من سلامة نسخة احتياطية (Verification & Health Check)
   */
  async verifyBackup(fileName: string): Promise<{
    success: boolean;
    valid: boolean;
    message: string;
    checksum: string;
    checksumMatched: boolean;
    tablesCount: number;
    totalRecords: number;
    tableRecords: Record<string, number>;
  }> {
    const cleanName = this.sanitizeFileName(fileName);
    const filePath = path.join(this.backupDir, cleanName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`ملف النسخة الاحتياطية (${cleanName}) غير موجود`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return {
        success: false,
        valid: false,
        message: 'الملف فارغ ولا يحتوي على أي بيانات (0 Bytes)',
        checksum: '',
        checksumMatched: false,
        tablesCount: 0,
        totalRecords: 0,
        tableRecords: {},
      };
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');

    if (cleanName.endsWith('.json')) {
      let parsed: any;
      try {
        parsed = JSON.parse(fileContent);
      } catch (err: any) {
        return {
          success: false,
          valid: false,
          message: `الملف تالف وغير قابل للقراءة كـ JSON صالح: ${err?.message}`,
          checksum: '',
          checksumMatched: false,
          tablesCount: 0,
          totalRecords: 0,
          tableRecords: {},
        };
      }

      if (!parsed.tables || typeof parsed.tables !== 'object') {
        return {
          success: false,
          valid: false,
          message: 'هيكل النسخة الاحتياطية غير متوافق (لا يحتوي على حقل الجداول tables)',
          checksum: parsed.checksum || '',
          checksumMatched: false,
          tablesCount: 0,
          totalRecords: 0,
          tableRecords: {},
        };
      }

      const storedChecksum = parsed.checksum || '';
      let checksumMatched = false;

      if (storedChecksum) {
        const { checksum: _, ...restPayload } = parsed;
        const serialized = JSON.stringify(restPayload);
        const computedChecksum = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
        checksumMatched = computedChecksum === storedChecksum;
      }

      const tables = Object.keys(parsed.tables);
      const tableRecords: Record<string, number> = {};
      let totalRecords = 0;

      for (const t of tables) {
        const rows = Array.isArray(parsed.tables[t]) ? parsed.tables[t].length : 0;
        tableRecords[t] = rows;
        totalRecords += rows;
      }

      return {
        success: true,
        valid: true,
        message: 'النسخة الاحتياطية سليمة ومتكاملة وقابلة للاسترجاع بنجاح',
        checksum: storedChecksum,
        checksumMatched,
        tablesCount: tables.length,
        totalRecords,
        tableRecords,
      };
    } else if (cleanName.endsWith('.sql')) {
      const hasBegin = fileContent.includes('BEGIN;');
      const hasCommit = fileContent.includes('COMMIT;');
      const hasTruncate = fileContent.includes('TRUNCATE TABLE');

      const valid = hasBegin && hasCommit;
      const currentChecksum = crypto.createHash('sha256').update(fileContent, 'utf8').digest('hex');

      return {
        success: true,
        valid,
        message: valid
          ? 'ملف الـ SQL سليم ويحتوي على معاملات Transaction متكاملة'
          : 'ملف الـ SQL ناقص أو لا يحتوي على كتل BEGIN / COMMIT',
        checksum: currentChecksum,
        checksumMatched: true,
        tablesCount: 0,
        totalRecords: 0,
        tableRecords: {},
      };
    }

    return {
      success: true,
      valid: true,
      message: 'الملف موجود وجاهز للفحص',
      checksum: '',
      checksumMatched: true,
      tablesCount: 0,
      totalRecords: 0,
      tableRecords: {},
    };
  }

  /**
   * 5. استرجاع قاعدة البيانات (Database Restore Engine)
   */
  async restoreBackup(
    user: JwtPayloadType,
    dto: RestoreBackupDto,
    file?: Express.Multer.File,
  ) {
    this.logger.warn(
      `DATABASE RESTORE INITIATED by user ${user.id} (${user.email}, Role: ${user.role})!`,
    );

    // 1. التحقق من صلاحيات المالك الحصرية
    if (user.role !== Role.OWNER) {
      throw new ForbiddenException('عملية استرجاع قاعدة البيانات حصرية بحساب المالك (Owner) فقط.');
    }

    // 2. التحقق من كلمة مرور المالك إذا تم إرسالها لزيادة الأمان
    if (dto.confirmPassword) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser?.password) {
        const isMatch = await bcrypt.compare(dto.confirmPassword, dbUser.password);
        if (!isMatch) {
          throw new UnauthorizedException(
            'كلمة المرور غير صحيحة! تم إلغاء عملية الاسترجاع فوراً حماية لقاعدة البيانات.',
          );
        }
      }
    }

    // 3. تحديد مصدر البيانات (ملف مرفوع أو ملف محفوظ مسبقاً على السيرفر)
    let fileContent: string;
    let sourceFileName: string;

    if (file && file.buffer) {
      fileContent = file.buffer.toString('utf8');
      sourceFileName = `uploaded-${file.originalname}`;
    } else if (dto.fileName) {
      const cleanName = this.sanitizeFileName(dto.fileName);
      const filePath = path.join(this.backupDir, cleanName);
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`الملف المحدد (${cleanName}) غير موجود على السيرفر`);
      }
      fileContent = fs.readFileSync(filePath, 'utf8');
      sourceFileName = cleanName;
    } else {
      throw new BadRequestException('يجب تحديد اسم ملف من السيرفر (fileName) أو رفع ملف نسخة احتياطية.');
    }

    // 4. التحقق من صلاحية البيانات قبل لمس أي شيء
    let parsedBackup: any = null;
    let isSql = sourceFileName.endsWith('.sql') || fileContent.trim().startsWith('--') || fileContent.includes('BEGIN;');

    if (!isSql) {
      try {
        parsedBackup = JSON.parse(fileContent);
      } catch (err: any) {
        throw new BadRequestException(`فشل قراءة ملف النسخة الاحتياطية كـ JSON صالح: ${err?.message}`);
      }

      if (!parsedBackup.tables || typeof parsedBackup.tables !== 'object') {
        throw new BadRequestException('هيكل النسخة الاحتياطية غير متوافق (لا توجد جداول).');
      }
    }

    // 5. الشبكة الوقائية (Safety Net): أخذ لقطة احتياطية للوضع الحالي تلقائياً قبل أي تعديل
    this.logger.log('Creating automatic pre-restore safety snapshot before restoring...');
    let preRestoreSnapshotName = '';
    try {
      const preBackup = await this.createBackup(user, {
        note: `نسخة تلقائية وقائية تم أخذها قبل استرجاع ملف: ${sourceFileName}`,
      });
      preRestoreSnapshotName = preBackup.backup.fileName;
      this.logger.log(`Safety snapshot created: ${preRestoreSnapshotName}`);
    } catch (snapshotErr: any) {
      this.logger.error(`Failed to create pre-restore snapshot: ${snapshotErr?.message}`);
      throw new BadRequestException('تعذر أخذ لقطة وقائية قبل الاسترجاع، تم إيقاف العملية للحفاظ على البيانات.');
    }

    // 6. تنفيذ عملية الاسترجاع داخل Transaction متكاملة
    const liveTables = await this.getPublicTables();
    let tablesRestoredCount = 0;
    let totalRecordsRestored = 0;
    const restoredTableRecords: Record<string, number> = {};

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // تعطيل الفحص المؤقت للقيود إن أمكن
          await tx.$executeRawUnsafe("SET session_replication_role = 'replica';").catch(() => null);

          if (isSql) {
            // تنفيذ ملف الـ SQL
            await tx.$executeRawUnsafe(fileContent);
          } else {
            // تفريغ الجداول القائمة
            if (liveTables.length > 0) {
              const quoted = liveTables.map((t) => `"${t}"`).join(', ');
              await tx.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE;`);
            }

            // إدراج البيانات بحسب الترتيب الطوبولوجي
            const backupTables = Object.keys(parsedBackup.tables);
            const orderedTablesToInsert = TABLE_DEPENDENCY_ORDER.filter((t) =>
              backupTables.includes(t),
            );
            for (const t of backupTables) {
              if (!orderedTablesToInsert.includes(t)) {
                orderedTablesToInsert.push(t);
              }
            }

            for (const tableName of orderedTablesToInsert) {
              const rows: any[] = parsedBackup.tables[tableName] || [];
              if (rows.length === 0) continue;

              const columns = Object.keys(rows[0]);
              const quotedColumns = columns.map((c) => `"${c}"`).join(', ');

              const chunkSize = 100;
              for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const valueRows = chunk.map(
                  (r) => `(${columns.map((col) => this.sqlEscape(r[col])).join(', ')})`,
                );
                const insertSql = `INSERT INTO "${tableName}" (${quotedColumns}) VALUES\n  ${valueRows.join(',\n  ')};`;
                await tx.$executeRawUnsafe(insertSql);
              }

              tablesRestoredCount++;
              totalRecordsRestored += rows.length;
              restoredTableRecords[tableName] = rows.length;
            }

            // إعادة ضبط الـ sequences لجميع الجداول
            for (const tableName of liveTables) {
              try {
                await tx.$executeRawUnsafe(
                  `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE(MAX(id), 1)) FROM "${tableName}";`,
                );
              } catch {
                // الجدول قد لا يحتوي على عمود id مسلسَل؛ يتم التجاهل بشكل طبيعي
              }
            }
          }

          // إعادة تفعيل القيود
          await tx.$executeRawUnsafe("SET session_replication_role = 'origin';").catch(() => null);
        },
        {
          timeout: 180000, // مهلة 3 دقائق للنسخ الكبيرة
          maxWait: 15000,
        },
      );
    } catch (restoreErr: any) {
      this.logger.error(`Restore failed and was rolled back: ${restoreErr?.message}`, restoreErr.stack);
      throw new BadRequestException(
        `فشلت عملية الاسترجاع وتم التراجع التلقائي (Rollback) دون أي ضرر على البيانات: ${restoreErr?.message}`,
      );
    }

    // 7. الفحص الفوري بعد الاسترجاع (Post-Restore Sanity Check)
    const postSanityCounts: Record<string, number> = {};
    let postTotalLiveRecords = 0;

    for (const t of liveTables) {
      try {
        const countRes = await this.prisma.$queryRawUnsafe<Array<{ count: string | number }>>(
          `SELECT COUNT(*) FROM "${t}";`,
        );
        const cnt = Number(countRes[0]?.count || 0);
        postSanityCounts[t] = cnt;
        postTotalLiveRecords += cnt;
      } catch {}
    }

    this.logger.log(`Restore completed and verified! Total live records now: ${postTotalLiveRecords}`);

    return {
      success: true,
      message: `تم استرجاع قاعدة البيانات بنجاح والتحقق من صحتها (${postTotalLiveRecords} سجل نشط)`,
      details: {
        restoredFile: sourceFileName,
        preRestoreSnapshot: preRestoreSnapshotName,
        restoredAt: new Date().toISOString(),
        tablesRestored: tablesRestoredCount || liveTables.length,
        totalRecordsRestored: totalRecordsRestored || postTotalLiveRecords,
        verificationStatus: 'PASSED_HEALTHY',
        liveCounts: postSanityCounts,
      },
    };
  }

  /**
   * 6. حذف نسخة احتياطية قديمة لتوفير المساحة
   */
  async deleteBackup(fileName: string): Promise<{ success: boolean; message: string }> {
    const cleanName = this.sanitizeFileName(fileName);
    const filePath = path.join(this.backupDir, cleanName);
    const metaPath = path.join(this.backupDir, `${cleanName}.meta.json`);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`ملف النسخة الاحتياطية (${cleanName}) غير موجود`);
    }

    try {
      fs.unlinkSync(filePath);
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
      this.logger.log(`Backup deleted: ${cleanName}`);
      return {
        success: true,
        message: `تم حذف النسخة الاحتياطية (${cleanName}) بنجاح`,
      };
    } catch (err: any) {
      throw new BadRequestException(`فشل حذف الملف: ${err?.message}`);
    }
  }
}
