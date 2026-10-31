# دليل واجهة برمجة النسخ الاحتياطي والاسترجاع لقاعدة البيانات
# Database Backup & Restore API Guide (Dashboard Integration)

يوفر هذا الدليل المواصفات الكاملة للـ Endpoints الخاصة بنظام النسخ الاحتياطي والاسترجاع لقاعدة البيانات، والمصممة خصيصاً لربطها بأزرار لوحة التحكم (Dashboard).

---

## الميزات الأمنية والتقنية للنظام:

1. **التحقق من سلامة النسخة (SHA-256 Checksum):** يتم توليد بصمة تشفير لكل نسخة، والتحقق منها قبل أي عملية استرجاع لمنع تشغيل ملفات مبتورة أو تالفة.
2. **الشبكة الوقائية التلقائية (Safety Net Snapshot):** عند طلب استرجاع أي نسخة، يقوم السيرفر **تلقائياً** بأخذ نسخة احتياطية فورية من الوضع الحالي قبل إجراء أي مسح للجداول، للتمكن من التراجع بضغطة زر في حال الخطأ.
3. **الاسترجاع الذري (Atomic Single Transaction):** تتم عملية الاسترجاع بالكامل داخل Transaction واحدة؛ إما أن تنجح بنسبة 100% أو يتم التراجع التلقائي (Rollback) دون أي أثر على البيانات.
4. **إعادة ضبط السلاسل التلقائية (Sequences Reset):** يتم تحديث عدادات الترقيم التلقائي لجميع الجداول (`setval`) لضمان عدم حدوث أخطاء ID Duplicate عند إضافة أي مستخدم أو كورس جديد لاحقاً.
5. **الفحص الصحي الفوري بعد الاسترجاع (Post-Restore Sanity Check):** يقوم السيرفر بعد السجلات والتحقق من سلامة الجداول وإرجاع تقرير مفصل يؤكد استرجاع كل جدول.

---

## جدول نقاط النهاية (Endpoints Summary):

| المسار (Path) | الطريقة | الصلاحية | الوظيفة |
| :--- | :---: | :---: | :--- |
| `/api/v1/admin/backup/create` | `POST` | `OWNER`, `ADMIN` | **زر "نسخ احتياطي الآن"**: أخذ نسخة وحفظها. |
| `/api/v1/admin/backup` | `GET` | `OWNER`, `ADMIN` | **جدول النسخ الاحتياطية**: عرض قائمة النسخ المحفوظة. |
| `/api/v1/admin/backup/:fileName/verify` | `GET` | `OWNER`, `ADMIN` | **فحص النسخة**: التحقق من سلامة وصحة أي نسخة. |
| `/api/v1/admin/backup/:fileName/download` | `GET` | `OWNER`, `ADMIN` | **زر "تحميل"**: تنزيل ملف النسخة إلى جهاز الأدمن. |
| `/api/v1/admin/backup/restore` | `POST` | `OWNER` فقط | **زر "استرجاع النسخة"**: استرجاع نسخة من السيرفر أو عبر رفع ملف. |
| `/api/v1/admin/backup/:fileName` | `DELETE` | `OWNER` فقط | **زر "حذف"**: حذف نسخة قديمة لتوفير المساحة. |

---

## 1. إنشاء نسخة احتياطية جديدة (Create Backup)

يقوم بعمل مسح لجميع جداول قاعدة البيانات واستخراج السجلات والبيانات الوصفية وحفظها في مجلد `db-backups/` على السيرفر.

* **المسار**: `POST /api/v1/admin/backup/create`
* **الصلاحية**: `OWNER`, `ADMIN`
* **Headers**:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
  ```
* **جسم الطلب (Request Body - اختياري)**:
  ```json
  {
    "format": "json",
    "note": "نسخة احتياطية قبل التحديث الأسبوعي"
  }
  ```
  *(يمكن ترك الـ Body فارغاً `{}` وسيتم أخذ نسخة بصيغة `json` افتراضياً).*

### الرد المتوقع (Response 201 Created):
```json
{
  "success": true,
  "message": "تم إنشاء النسخة الاحتياطية بنجاح (1.45 MB - 5420 سجل في 16 جدول)",
  "backup": {
    "version": "1.0",
    "engine": "algonaid-db-backup",
    "format": "json",
    "fileName": "backup-2026-10-31T22-30-15-123Z.json",
    "fileSize": 1520412,
    "formattedSize": "1.45 MB",
    "checksum": "a8f3b2c918e7d4a6f...",
    "createdAt": "2026-10-31T22:30:15.123Z",
    "creator": {
      "id": 1,
      "email": "owner@algonaid.com",
      "role": "OWNER"
    },
    "note": "نسخة احتياطية قبل التحديث الأسبوعي",
    "tablesCount": 16,
    "totalRecords": 5420,
    "tableRecords": {
      "User": 120,
      "Student": 115,
      "Teacher": 5,
      "Course": 8,
      "Lesson": 64,
      "Enrollment": 310,
      "Exam": 12
    }
  }
}
```

---

## 2. عرض قائمة النسخ الاحتياطية (List Backups)

* **المسار**: `GET /api/v1/admin/backup` (أو `GET /api/v1/admin/backup/list`)
* **الصلاحية**: `OWNER`, `ADMIN`
* **Headers**:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  ```

### الرد المتوقع (Response 200 OK):
```json
{
  "success": true,
  "total": 3,
  "backups": [
    {
      "fileName": "backup-2026-10-31T22-30-15-123Z.json",
      "fileSize": 1520412,
      "formattedSize": "1.45 MB",
      "checksum": "a8f3b2c9...",
      "createdAt": "2026-10-31T22:30:15.123Z",
      "tablesCount": 16,
      "totalRecords": 5420,
      "note": "نسخة احتياطية قبل التحديث الأسبوعي"
    },
    {
      "fileName": "pre-restore-auto-snapshot-2026-10-31T20-10-00-000Z.json",
      "fileSize": 1519000,
      "formattedSize": "1.45 MB",
      "checksum": "f1c2d3...",
      "createdAt": "2026-10-31T20:10:00.000Z",
      "tablesCount": 16,
      "totalRecords": 5418,
      "note": "نسخة تلقائية وقائية تم أخذها قبل استرجاع ملف"
    }
  ]
}
```

---

## 3. فحص والتحقق من سلامة نسخة (Verify Backup)

يقوم بالتحقق من أن الملف لم يتعرض للتلف، ومطابقة بصمة الـ SHA-256، والتأكد من توافق الجداول والسجلات.

* **المسار**: `GET /api/v1/admin/backup/:fileName/verify`
* **الصلاحية**: `OWNER`, `ADMIN`
* **Headers**:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  ```

### الرد المتوقع (Response 200 OK):
```json
{
  "success": true,
  "valid": true,
  "message": "النسخة الاحتياطية سليمة ومتكاملة وقابلة للاسترجاع بنجاح",
  "checksum": "a8f3b2c918e7d4a6f...",
  "checksumMatched": true,
  "tablesCount": 16,
  "totalRecords": 5420,
  "tableRecords": {
    "User": 120,
    "Student": 115,
    "Course": 8,
    "Lesson": 64
  }
}
```

---

## 4. تحميل ملف النسخة الاحتياطية (Download Backup)

يتيح لمدير المنصة تحميل ملف النسخة إلى جهازه الشخصي للاحتفاظ به خارج السيرفر.

* **المسار**: `GET /api/v1/admin/backup/:fileName/download`
* **الصلاحية**: `OWNER`, `ADMIN`
* **Headers**:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  ```
* **الرد**: يتم تحميل الملف مباشرة (`Content-Disposition: attachment; filename="backup-..."`).

---

## 5. استرجاع قاعدة البيانات (Restore Backup)

> [!CAUTION]
> هذه العملية حساسة وتقوم باستبدال البيانات الحالية بالبيانات الموجودة في ملف النسخة. لذلك فهي محصورة برتبة **المالك (`OWNER`) فقط**.

يمكن إجراء الاسترجاع بإحدى طريقتين:

### أ) استرجاع ملف موجود مسبقاً على السيرفر (عبر JSON Body):
* **المسار**: `POST /api/v1/admin/backup/restore`
* **Headers**:
  ```http
  Authorization: Bearer <OWNER_JWT_TOKEN>
  Content-Type: application/json
  ```
* **جسم الطلب (Request Body)**:
  ```json
  {
    "fileName": "backup-2026-10-31T22-30-15-123Z.json",
    "confirmPassword": "OwnerPassword123"
  }
  ```
  *(حقل `confirmPassword` اختياري ولكنه يوصى به في لوحة التحكم كإجراء أمان إضافي لتأكيد هوية المالك).*

### ب) استرجاع عبر رفع ملف نسخة من جهاز المالك (Multipart Form):
* **المسار**: `POST /api/v1/admin/backup/restore`
* **Headers**:
  ```http
  Authorization: Bearer <OWNER_JWT_TOKEN>
  Content-Type: multipart/form-data
  ```
* **Body Form-Data**:
  - `file`: (ملف النسخة `.json` أو `.sql` المرفوع من جهاز المالك)
  - `confirmPassword`: (اختياري)

### ما يقوم به السيرفر خطوة بخطوة أثناء الاسترجاع:
1. التحقق من صلاحية ملف النسخة وسلامته (Verification).
2. **أخذ نسخة وقائية تلقائية فورية (Pre-restore Snapshot)** من قاعدة البيانات الحالية لضمان عدم ضياع أي بيانات حية.
3. بدء المعاملة الذرية (Database Transaction).
4. تفريغ الجداول (Truncate with Cascade).
5. إدراج السجلات بالترتيب الطوبولوجي بدفعات منظمة.
6. تحديث عدادات الترقيم التلقائي (`Sequences`) لجميع الجداول.
7. تثبيت المعاملة (Commit).
8. فحص المطابقة الفوري (Post-Restore Sanity Check).

### الرد المتوقع (Response 200 OK):
```json
{
  "success": true,
  "message": "تم استرجاع قاعدة البيانات بنجاح والتحقق من صحتها (5420 سجل نشط)",
  "details": {
    "restoredFile": "backup-2026-10-31T22-30-15-123Z.json",
    "preRestoreSnapshot": "pre-restore-auto-snapshot-2026-10-31T22-45-00-000Z.json",
    "restoredAt": "2026-10-31T22:45:05.100Z",
    "tablesRestored": 16,
    "totalRecordsRestored": 5420,
    "verificationStatus": "PASSED_HEALTHY",
    "liveCounts": {
      "User": 120,
      "Student": 115,
      "Course": 8,
      "Lesson": 64,
      "Enrollment": 310
    }
  }
}
```

---

## 6. حذف نسخة احتياطية من السيرفر (Delete Backup)

* **المسار**: `DELETE /api/v1/admin/backup/:fileName`
* **الصلاحية**: `OWNER` فقط
* **Headers**:
  ```http
  Authorization: Bearer <OWNER_JWT_TOKEN>
  ```

### الرد المتوقع (Response 200 OK):
```json
{
  "success": true,
  "message": "تم حذف النسخة الاحتياطية (backup-2026-10-31T22-30-15-123Z.json) بنجاح"
}
```

---

## دليل مقترح لتصميم واجهة لوحة التحكم (Frontend UI Recommendations):

1. **قسم النسخ الاحتياطي (Backups Tab):**
   - زر رئيسي علوي أخضر أو أزرق: `[ إنشاء نسخة احتياطية جديدة ]` يطلب إدخال ملاحظة اختيارية ثم يرسل `POST /admin/backup/create`.
   - جدول يعرض النسخ المتوفرة:
     - اسم النسخة / الملاحظة
     - التاريخ والوقت
     - الحجم (مثال: `1.45 MB`)
     - عدد السجلات (مثال: `5,420 سجل`)
     - أزرار الإجراءات لكل صف:
       - `[ فحص ]`: يستدعي `/verify` للتأكد من سلامتها ويعرض مؤشر أخضر.
       - `[ تحميل ]`: ينزل الملف لجهاز الأدمن.
       - `[ استرجاع ]`: يفتح نافذة تأكيد الاسترجاع.
       - `[ حذف ]`: لحذف النسخة.

2. **نافذة تأكيد الاسترجاع (Restore Modal):**
   - تنبيه أحمر: *"تحذير: سيتم استرجاع الجداول من النسخة المحددة. سيقوم النظام بأخذ نسخة وقائية تلقائية قبل البدء مباشرة."*
   - حقل إدخال اختياري: *"كلمة مرور حسابك للتأكيد"*.
   - خيار إضافي: إمكانية اختيار ملف من الجهاز إذا كان المستخدم يريد رفع ملف محفوظ على حاسوبه الشخصي.
   - زر تأكيد أحمر: `[ تأكيد الاسترجاع الآن ]`.
