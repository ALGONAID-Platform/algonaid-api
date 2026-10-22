# دليل إدارة ملفات الـ PDF للدروس (Lesson PDFs Management API)

تتوفر لمطور لوحة التحكم طريقتان لإدارة ملفات الـ PDF، يمكنه اختيار الأنسب لواجهته:

---

### 🌟 الطريقة (1): إرسال الملفات دفعة واحدة أثناء إنشاء أو تعديل الدرس (Recommended)

إذا كانت لوحة التحكم تقوم برفع الملفات مسبقاً إلى السيرفر/CDN، يمكن إرسال مصفوفة الروابط والعناوين مباشرة ضمن جسم طلب إنشاء أو تعديل الدرس:

* **المسار:** `POST /api/v1/lessons` أو `PATCH /api/v1/lessons/:id`
* **نوع المحتوى:** `application/json`
* **الترخيص:** `Bearer Token` (Admin / Owner)

```json
{
  "title": "الدرس الثاني: المتجهات والمصفوفات",
  "description": "شرح مفصل للجبر الخطي",
  "moduleId": 12,
  "status": "PUBLISHED",
  "pdfFiles": [
    {
      "title": "ملخص القوانين والجداول",
      "url": "https://ucarecdn.com/xxx-1/summary.pdf",
      "order": 1
    },
    {
      "title": "تمارين وأسئلة تدريبية",
      "url": "https://ucarecdn.com/xxx-2/exercises.pdf",
      "order": 2
    },
    {
      "title": "حلول التكاليف المنزلية",
      "url": "https://ucarecdn.com/xxx-3/solutions.pdf",
      "order": 3
    }
  ]
}
```

---

### 🌟 الطريقة (2): إدارة ملفات الـ PDF بشكل مستقل عبر Endpoints مخصصة

تتيح للمطور إضافة أو حذف ملفات في أي وقت من شاشة تفاصيل الدرس دون الحاجة لإعادة حفظ الدرس كاملاً:

#### 1. إضافة / رفع ملف PDF جديد للدرس
* **المسار:** `POST /api/v1/lessons/:lessonId/pdfs`
* **الترخيص:** `Bearer Token` (Admin / Owner)

##### الخيار أ: رفع ملف فيزيائي (Multipart / Form-Data):
- **المفاتيح المرسلة في FormData:**
  - `file`: (ملف الـ PDF المرفوع)
  - `title`: "عنوان الملف الذي يظهر للطلاب" *(اختياري - إن تُرك فارغاً يأخذ اسم الملف الأصلي)*
  - `order`: 1 *(اختياري)*

##### الخيار ب: إرسال رابط جاهز (JSON):
- **Content-Type:** `application/json`
```json
{
  "title": "ملف اختبارات سابقة",
  "url": "https://ucarecdn.com/xxx/exams.pdf",
  "order": 2
}
```

##### الاستجابة (201 Created):
```json
{
  "id": 15,
  "lessonId": 45,
  "title": "ملف اختبارات سابقة",
  "url": "https://ucarecdn.com/xxx/exams.pdf",
  "order": 2,
  "createdAt": "2026-10-21T17:45:00.000Z"
}
```

---

#### 2. حذف ملف PDF من الدرس
* **المسار:** `DELETE /api/v1/lessons/:lessonId/pdfs/:pdfId`
* **الترخيص:** `Bearer Token` (Admin / Owner)

##### الاستجابة (200 OK):
```json
{
  "message": "تم حذف ملف الـ PDF بنجاح"
}
```
*(ملاحظة: عند حذف الملف، يقوم الباك إند تلقائياً بتحديث `pdfUrl` للدرس ليشير للملف المتبقي التالي).*

---

#### 3. جلب جميع ملفات الدرس
* **المسار:** `GET /api/v1/lessons/:lessonId/pdfs`
* **الترخيص:** `Bearer Token`

##### الاستجابة (200 OK):
```json
[
  {
    "id": 10,
    "title": "ملخص الدرس الأول",
    "url": "https://ucarecdn.com/xxx/summary.pdf",
    "order": 1
  },
  {
    "id": 11,
    "title": "تمارين وتدريبات",
    "url": "https://ucarecdn.com/yyy/exercises.pdf",
    "order": 2
  }
]
```

---

### ثالثاً: شكل بيانات الدرس عند جلب تفاصيله من السيرفر GET /lessons/:id

```json
{
  "id": 45,
  "title": "الدرس الثاني: المتجهات والمصفوفات",
  "moduleId": 12,
  "courseId": 3,
  "videoUrl": "https://example.com/video.mp4",
  "pdfUrl": "https://ucarecdn.com/xxx-1/summary.pdf",
  "pdfFiles": [
    {
      "id": 10,
      "title": "ملخص القوانين والجداول",
      "url": "https://ucarecdn.com/xxx-1/summary.pdf",
      "order": 1
    },
    {
      "id": 11,
      "title": "تمارين وأسئلة تدريبية",
      "url": "https://ucarecdn.com/xxx-2/exercises.pdf",
      "order": 2
    }
  ]
}
```
