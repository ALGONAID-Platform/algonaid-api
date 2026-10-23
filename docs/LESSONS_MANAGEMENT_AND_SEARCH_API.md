# دليل مطور لوحة التحكم: إدارة والبحث عن الدروس (Lessons & Search API)

> **وثيقة رسمية موجهة لمطور لوحة التحكم (Dashboard Developer)**  
> تغطي هذه الوثيقة الـ Endpoints الخاصة بجلب دروس الكورس مع الترقيم الصفحي (Pagination)، ومحرك البحث عن الدروس، والعمليات الكاملة (عرض، تعديل، حذف، إدارة ملفات) على أي درس.

---

## 1. نظرة عامة على دورة عمل شاشة الدروس في لوحة التحكم (Workflow)

```
[ شريط البحث والفلترة ] ──> (GET /lessons/search?q=...) ──> [ جدول نتائج الدروس ]
                                                                     │
               ┌─────────────────────────────────────────────────────┤
               ▼                                                     ▼
     [ تعديل الدرس ]                                           [ حذف الدرس ]
(PATCH /lessons/:id)                                      (DELETE /lessons/:id)
```

1. يقوم الأدمن بالبحث عن درس معين عبر اسمه أو محتواه (أو استعراض دروس كورس محدد).
2. تظهر النتائج في جدول مع ترقيم صفحات (`Pagination`).
3. بالضغط على أي درس، يحصل الأدمن على معرّف الدرس (`id`)، ويستطيع:
   - فتح شاشة تفاصيل الدرس (`GET /lessons/:id`).
   - تعديل بيانات الدرس (`PATCH /lessons/:id`).
   - حذف الدرس (`DELETE /lessons/:id`).
   - التحكم في البث المباشر (`PATCH /lessons/:id/live-status`).
   - إدارة ملفات الـ PDF المرفقة بالدرس (إضافة / حذف).

---

## 2. نقطة النهاية (1): البحث في الدروس (Search Lessons)

تُستخدم للبحث السريع عن أي درس بالاسم أو الوصف، مع إمكانية الفلترة بحسب الكورس أو الوحدة أو حالة النشر وترقيم النتائج.

* **المسار:** `GET /api/v1/lessons/search`
* **الصلاحية (Auth):** `Bearer Token` (`ADMIN`, `OWNER`, `STUDENT`)
* **معاملات الـ Query (Query Parameters):**

| المعامل | النوع | إلزامي؟ | الوصف | القيمة الافتراضية |
| :--- | :--- | :--- | :--- | :--- |
| **`q`** | `string` | **نعم** | كلمة أو نص البحث (يبحث في عنوان ووصف الدرس) | - |
| **`courseId`** | `number` | لا | حصر البحث داخل كورس محدد | - |
| **`moduleId`** | `number` | لا | حصر البحث داخل وحدة محددة | - |
| **`status`** | `enum` | لا | فلترة حسب حالة النشر (`DRAFT` أو `PUBLISHED`) *(خاص بالإدارة)* | الكل للإدارة |
| **`page`** | `number` | لا | رقم الصفحة | `1` |
| **`limit`** | `number` | لا | عدد النتائج لكل صفحة | `10` |

### مثال الطلب (Request):
```http
GET /api/v1/lessons/search?q=الشبكات&courseId=4&page=1&limit=10
Authorization: Bearer <ADMIN_TOKEN>
```

### نموذج الاستجابة (200 OK):
```json
{
  "data": [
    {
      "id": 45,
      "title": "مقدمة في أساسيات الشبكات",
      "description": "شرح طبقات OSI والمفاهيم الأساسية",
      "content": "محتوى الشرح النصي...",
      "videoUrl": "https://server.com/videos/net1.mp4",
      "recordingVideoUrl": null,
      "liveMeetingUrl": null,
      "pdfUrl": "https://ucarecdn.com/xxx/summary.pdf",
      "pdfFiles": [
        {
          "id": 12,
          "title": "ملخص الطبقات",
          "url": "https://ucarecdn.com/xxx/summary.pdf",
          "order": 1
        }
      ],
      "status": "PUBLISHED",
      "liveStatus": "COMPLETED",
      "isLocked": false,
      "isFreePreview": false,
      "dayNumber": 1,
      "order": 1,
      "commentsCount": 8,
      "hasTest": true,
      "hasExam": true,
      "hasAssignment": false,
      "module": {
        "id": 10,
        "title": "الوحدة الأولى: البداية",
        "courseId": 4,
        "courseTitle": "دورة هندسة الشبكات المتكاملة"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

## 3. نقطة النهاية (2): جلب دروس كورس محدد مع الصفحات (Course Lessons with Pagination)

تُستخدم عند فتح كورس معين في لوحة التحكم لعرض جميع دروسه بشكل صفحات.

* **المسار:** `GET /api/v1/lessons/course/:courseId`
* **الصلاحية (Auth):** `Bearer Token` (`ADMIN`, `OWNER`, `STUDENT`)
* **معاملات الـ Query:**

| المعامل | النوع | الافتراضي | الوصف |
| :--- | :--- | :--- | :--- |
| **`page`** | `number` | `1` | رقم الصفحة |
| **`limit`** | `number` | `10` | عدد الدروس في الصفحة |

### مثال الطلب:
```http
GET /api/v1/lessons/course/4?page=1&limit=10
Authorization: Bearer <ADMIN_TOKEN>
```

### نموذج الاستجابة (200 OK):
```json
{
  "data": [
    {
      "id": 45,
      "title": "الدرس الأول: بنية الشبكات",
      "description": "شرح تمهيدي",
      "moduleId": 10,
      "order": 1,
      "status": "PUBLISHED",
      "commentsCount": 3
    }
  ],
  "meta": {
    "total": 35,
    "page": 1,
    "limit": 10,
    "totalPages": 4
  }
}
```

---

## 4. العمليات المتاحة على الدرس المحدد (Actions on a Lesson)

بمجرد اختيار الدرس من نتائج البحث أو الجدول عبر معرّفه (`lesson.id`)، تتوفر العمليات التالية لمطور لوحة التحكم:

### أ. جلب تفاصيل الدرس كاملة (Get Lesson Details)
* **المسار:** `GET /api/v1/lessons/:id`
* **الاستجابة:** كائن الدرس بكافة حقوله وروابطه وملفاته واختباراته وتكليفاته.

---

### ب. تعديل بيانات الدرس (Update Lesson)
تسمح بتعديل عنوان الدرس، الوصف، رابط الفيديو، حالة النشر، أو استبدال ملف الـ PDF.

* **المسار:** `PATCH /api/v1/lessons/:id`
* **نوع المحتوى:** `application/json` (أو `multipart/form-data` في حال رفع ملف PDF مباشر)
* **الصلاحية:** `ADMIN` أو `OWNER`

```json
{
  "title": "عنوان الدرس المحدث",
  "description": "تحديث الوصف التوضيحي",
  "videoUrl": "https://server.com/new-video.mp4",
  "status": "PUBLISHED",
  "order": 2,
  "dayNumber": 2,
  "isFreePreview": false
}
```

---

### ج. حذف الدرس (Delete Lesson)
يقوم بحذف الدرس نهائياً من قاعدة البيانات مع كافة ارتباطاته.

* **المسار:** `DELETE /api/v1/lessons/:id`
* **الصلاحية:** `ADMIN` أو `OWNER`
* **الاستجابة:**
```json
{
  "message": "تم حذف الدرس بنجاح"
}
```

---

### د. تحديث حالة البث المباشر ورابط التسجيل (Update Live Status)
للتحكم في حالة المحاضرة المباشرة للدرس (مجدولة، جارية الآن، مكتملة) وتحديد رابط التسجيل:

* **المسار:** `PATCH /api/v1/lessons/:id/live-status`
* **الصلاحية:** `ADMIN` أو `OWNER`
* **جسم الطلب (Body):**
```json
{
  "liveStatus": "COMPLETED",
  "recordingVideoUrl": "https://server.com/recordings/lesson-45.mp4"
}
```
> القيم المتاحة لـ `liveStatus`: `SCHEDULED` | `LIVE_NOW` | `COMPLETED` | `CANCELLED`.

---

### هـ. إدارة ملفات الـ PDF المرفقة بالدرس (Manage Lesson PDFs)

1. **إضافة ملف PDF جديد للدرس:**
   * **المسار:** `POST /api/v1/lessons/:id/pdfs`
   * **Payload (JSON):**
     ```json
     {
       "title": "مذكرة التمارين الإضافية",
       "url": "https://ucarecdn.com/xxx/exercises.pdf",
       "order": 2
     }
     ```
   * *(يدعم أيضاً الرفع الفيزيائي كـ `multipart/form-data` عبر مفتاح `file`)*.

2. **حذف ملف PDF محدد من الدرس:**
   * **المسار:** `DELETE /api/v1/lessons/:id/pdfs/:pdfId`

3. **جلب قائمة كل ملفات الـ PDF للدرس:**
   * **المسار:** `GET /api/v1/lessons/:id/pdfs`

---

## 5. نموذج تطبيق واجهة البحث لمطور الـ Frontend (React / Vue)

```javascript
// دالة البحث واستدعاء الـ API
async function searchLessons({ query, courseId, page = 1, limit = 10 }) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    limit: String(limit),
  });
  if (courseId) params.append('courseId', String(courseId));

  const response = await fetch(`/api/v1/lessons/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  return await response.json(); // { data: [...], meta: { total, totalPages, ... } }
}

// دالة حذف الدرس
async function deleteLesson(lessonId) {
  if (!confirm('هل أنت متأكد من حذف هذا الدرس نهائياً؟')) return;

  await fetch(`/api/v1/lessons/${lessonId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  // تحديث الجدول بعد الحذف...
}
```
