# دليل مطور لوحة التحكم: تعديل الاختبارات وإدارة الأسئلة (Exam & Questions Management API)

> **وثيقة رسمية موجهة لمطور لوحة التحكم (Dashboard Developer)**  
> توضح هذه الوثيقة بالتفصيل كيفية تعديل بيانات الاختبارات بالكامل، تعديل الأسئلة والخيارات، العمليات على الأسئلة الفردية، مع نماذج JSON كاملة للـ Request والـ Response.

---

## 1. نظرة عامة على الـ Endpoints

| العملية | الطريقة (Method) | المسار (Endpoint) | الصلاحية |
| :--- | :--- | :--- | :--- |
| **جلب الاختبار مع أسئلته للتعديل** | `GET` | `/api/v1/exams/:id` | `ADMIN`, `OWNER` |
| **تعديل الاختبار وأسئلته بالكامل** | `PATCH` أو `PUT` | `/api/v1/exams/:id` | `ADMIN`, `OWNER` |
| **إضافة سؤال جديد للاختبار** | `POST` | `/api/v1/exams/:examId/questions` | `ADMIN`, `OWNER` |
| **تعديل سؤال محدد وخياراته** | `PATCH` أو `PUT` | `/api/v1/exams/questions/:questionId` | `ADMIN`, `OWNER` |
| **حذف سؤال من الاختبار** | `DELETE` | `/api/v1/exams/questions/:questionId` | `ADMIN`, `OWNER` |
| **رفع صورة للاختبار أو السؤال** | `POST` | `/api/v1/exams/upload-image` | `ADMIN`, `OWNER` |

> 🔑 **ملاحظة الهيدر لجميع الطلبات:**  
> يجب إرسال توكن الأدمن في الهيدر:  
> `Authorization: Bearer <ADMIN_OR_OWNER_TOKEN>`  
> `Content-Type: application/json`

---

## 2. جلب بيانات الاختبار وأسئلته بالكامل للتعديل

قبل فتح شاشة التعديل في لوحة التحكم، يقوم المطور باستدعاء هذا المسار لتعبئة الحقول بالبيانات الحالية:

* **المسار:** `GET /api/v1/exams/:id`
* **المعاملات:** `id` هو المعرف الرقمي للاختبار.

### نموذج الاستجابة (Response 200 OK للأدمن):
```json
{
  "id": 12,
  "title": "اختبار المحاضرة الثالثة: بروتوكولات التوجيه",
  "description": "يرجى قراءة الأسئلة بدقة قبل الإجابة",
  "imageUrl": "https://api.exchangesmangement.online/uploads/images/exam-cover.png",
  "passingScore": 60,
  "maxAttempts": 2,
  "timeLimit": 30,
  "examType": "LESSON_QUIZ",
  "rankingCriteria": "BOTH",
  "startTime": null,
  "endTime": null,
  "lessonId": 45,
  "courseId": null,
  "createdAt": "2026-10-20T10:00:00.000Z",
  "updatedAt": "2026-10-24T14:00:00.000Z",
  "totalQuestions": 2,
  "totalPoints": 4,
  "passingPoints": 3,
  "commentsCount": 5,
  "questions": [
    {
      "id": 101,
      "text": "أي من البروتوكولات التالية يعمل في طبقة النقل (Transport Layer)؟",
      "type": "MULTIPLE_CHOICE",
      "points": 2,
      "imageUrl": null,
      "examId": 12,
      "options": [
        {
          "id": 301,
          "text": "TCP",
          "isCorrect": true,
          "questionId": 101
        },
        {
          "id": 302,
          "text": "IP",
          "isCorrect": false,
          "questionId": 101
        },
        {
          "id": 303,
          "text": "HTTP",
          "isCorrect": false,
          "questionId": 101
        }
      ]
    },
    {
      "id": 102,
      "text": "بروتوكول UDP يوفر اتصالاً موثوقاً (Reliable Connection).",
      "type": "TRUE_FALSE",
      "points": 2,
      "imageUrl": "https://api.exchangesmangement.online/uploads/images/udp-diagram.png",
      "examId": 12,
      "options": [
        {
          "id": 304,
          "text": "صح",
          "isCorrect": false,
          "questionId": 102
        },
        {
          "id": 305,
          "text": "خطأ",
          "isCorrect": true,
          "questionId": 102
        }
      ]
    }
  ]
}
```

---

## 3. تعديل الاختبار وبياناته وأسئلته دفعة واحدة

يُستخدم لحفظ التعديلات الكاملة للاختبار عند ضغط زر "حفظ التعديلات" في شاشة الاختبار.

* **المسار:** `PATCH /api/v1/exams/:id` أو `PUT /api/v1/exams/:id`
* **طريقة الإرسال:** `application/json`

### الحقول المتاحة في الـ Payload (جميعها اختيارية في التعديل):

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| **`title`** | `string` | عنوان الاختبار |
| **`description`** | `string` | وصف أو تعليمات الاختبار |
| **`imageUrl`** | `string` | رابط صورة غلاف الاختبار |
| **`passingScore`** | `number` | النسبة المئوية للنجاح (من 0 إلى 100) |
| **`maxAttempts`** | `number` | عدد المحاولات المسموح بها للطالب (أصغر قيمة: 1) |
| **`timeLimit`** | `number` | مدة الاختبار بالدقائق (أو `null` إذا كان بدون وقت محدد) |
| **`examType`** | `enum` | `LESSON_QUIZ` \| `COURSE_QUIZ` \| `CHALLENGE` \| `FINAL_EXAM` |
| **`rankingCriteria`**| `enum` | معيار الترتيب: `BOTH` \| `SCORE` \| `SPEED` |
| **`startTime`** | `string (ISO)` | وقت بدء التحدي (إلزامي إذا كان `CHALLENGE`) |
| **`endTime`** | `string (ISO)` | وقت انتهاء التحدي |
| **`asAssignment`** | `boolean` | هل يُعامل كتكليف واجب للدرس |
| **`questions`** | `array` | مصفوفة الأسئلة المحدثة وخياراتها |

### نص الـ JSON الذي يتم إدخاله (Request Body):
```json
{
  "title": "اختبار المحاضرة الثالثة: بروتوكولات التوجيه (محدّث)",
  "description": "تم تحديث وقت الاختبار ودرجة النجاح",
  "passingScore": 70,
  "timeLimit": 25,
  "maxAttempts": 3,
  "imageUrl": "https://api.exchangesmangement.online/uploads/images/new-cover.png",
  "questions": [
    {
      "text": "ما هو المنفذ الافتراضي لبروتوكول HTTPS؟",
      "type": "MULTIPLE_CHOICE",
      "points": 2,
      "imageUrl": "https://api.exchangesmangement.online/uploads/images/ports.png",
      "options": [
        { "text": "443", "isCorrect": true },
        { "text": "80", "isCorrect": false },
        { "text": "21", "isCorrect": false }
      ]
    },
    {
      "text": "عنوان IPv4 يتكون من 32 بت.",
      "type": "TRUE_FALSE",
      "points": 1,
      "imageUrl": null,
      "options": [
        { "text": "صح", "isCorrect": true },
        { "text": "خطأ", "isCorrect": false }
      ]
    }
  ]
}
```

### استجابة النجاح (Response 200 OK):
```json
{
  "id": 12,
  "title": "اختبار المحاضرة الثالثة: بروتوكولات التوجيه (محدّث)",
  "description": "تم تحديث وقت الاختبار ودرجة النجاح",
  "imageUrl": "https://api.exchangesmangement.online/uploads/images/new-cover.png",
  "passingScore": 70,
  "maxAttempts": 3,
  "timeLimit": 25,
  "examType": "LESSON_QUIZ",
  "rankingCriteria": "BOTH",
  "startTime": null,
  "endTime": null,
  "lessonId": 45,
  "courseId": null,
  "createdAt": "2026-10-20T10:00:00.000Z",
  "updatedAt": "2026-10-24T17:05:00.000Z",
  "questions": [
    {
      "id": 105,
      "text": "ما هو المنفذ الافتراضي لبروتوكول HTTPS؟",
      "type": "MULTIPLE_CHOICE",
      "points": 2,
      "imageUrl": "https://api.exchangesmangement.online/uploads/images/ports.png",
      "examId": 12,
      "options": [
        { "id": 310, "text": "443", "isCorrect": true, "questionId": 105 },
        { "id": 311, "text": "80", "isCorrect": false, "questionId": 105 },
        { "id": 312, "text": "21", "isCorrect": false, "questionId": 105 }
      ]
    },
    {
      "id": 106,
      "text": "عنوان IPv4 يتكون من 32 بت.",
      "type": "TRUE_FALSE",
      "points": 1,
      "imageUrl": null,
      "examId": 12,
      "options": [
        { "id": 313, "text": "صح", "isCorrect": true, "questionId": 106 },
        { "id": 314, "text": "خطأ", "isCorrect": false, "questionId": 106 }
      ]
    }
  ]
}
```

---

## 4. العمليات المستقلة على الأسئلة (Granular Question Actions)

تسمح للوحة التحكم بالتعديل أو الإضافة أو الحذف السريع لأي سؤال بدون إعادة إرسال باقي أسئلة الاختبار:

---

### أ. إضافة سؤال جديد للاختبار
* **المسار:** `POST /api/v1/exams/:examId/questions`

#### نص الـ JSON المدخل (Request Body):
```json
{
  "text": "أي من البروتوكولات التالية يُستخدم لنقل الملفات الآمن؟",
  "type": "MULTIPLE_CHOICE",
  "points": 2,
  "imageUrl": null,
  "options": [
    { "text": "SFTP", "isCorrect": true },
    { "text": "FTP", "isCorrect": false },
    { "text": "TFTP", "isCorrect": false }
  ]
}
```

#### الاستجابة (Response 201 Created):
```json
{
  "id": 107,
  "text": "أي من البروتوكولات التالية يُستخدم لنقل الملفات الآمن؟",
  "type": "MULTIPLE_CHOICE",
  "points": 2,
  "imageUrl": null,
  "examId": 12,
  "options": [
    { "id": 315, "text": "SFTP", "isCorrect": true, "questionId": 107 },
    { "id": 316, "text": "FTP", "isCorrect": false, "questionId": 107 },
    { "id": 317, "text": "TFTP", "isCorrect": false, "questionId": 107 }
  ]
}
```

---

### ب. تعديل سؤال محدد وخياراته
* **المسار:** `PATCH /api/v1/exams/questions/:questionId` أو `PUT /api/v1/exams/questions/:questionId`
* **المعاملات:** `questionId` معرّف السؤال المراد تعديله.

#### نص الـ JSON المدخل (Request Body):
```json
{
  "text": "أي من البروتوكولات التالية يُستخدم لنقل الملفات الآمن؟ (تم تعديل الخيارات)",
  "type": "MULTIPLE_CHOICE",
  "points": 3,
  "imageUrl": "https://api.exchangesmangement.online/uploads/images/sftp-diagram.png",
  "options": [
    { "text": "SFTP عبر منفذ 22", "isCorrect": true },
    { "text": "FTP عبر منفذ 21", "isCorrect": false },
    { "text": "Telnet", "isCorrect": false }
  ]
}
```

#### الاستجابة (Response 200 OK):
```json
{
  "id": 107,
  "text": "أي من البروتوكولات التالية يُستخدم لنقل الملفات الآمن؟ (تم تعديل الخيارات)",
  "type": "MULTIPLE_CHOICE",
  "points": 3,
  "imageUrl": "https://api.exchangesmangement.online/uploads/images/sftp-diagram.png",
  "examId": 12,
  "options": [
    { "id": 318, "text": "SFTP عبر منفذ 22", "isCorrect": true, "questionId": 107 },
    { "id": 319, "text": "FTP عبر منفذ 21", "isCorrect": false, "questionId": 107 },
    { "id": 320, "text": "Telnet", "isCorrect": false, "questionId": 107 }
  ]
}
```

---

### ج. حذف سؤال من الاختبار
* **المسار:** `DELETE /api/v1/exams/questions/:questionId`

#### الاستجابة (Response 200 OK):
```json
{
  "message": "تم حذف السؤال بنجاح"
}
```

---

## 5. رفع صورة لسؤال أو غلاف الاختبار (Upload Image)

عند اختيار صورة من جهاز الكمبيوتر لغلاف الاختبار أو لأحد الأسئلة، ارفعها أولاً لتحصل على الرابط ثم ضعه في حقل `imageUrl`.

* **المسار:** `POST /api/v1/exams/upload-image`
* **نوع المحتوى:** `multipart/form-data`
* **المفاتيح في FormData:**
  - `image` أو `file`: (ملف الصورة المرفوع - jpg, jpeg, png, webp, gif بحد أقصى 10MB).

#### الاستجابة (Response 201 Created):
```json
{
  "imageUrl": "https://api.exchangesmangement.online/uploads/images/7a8f9c1e2b4d6a8e0f1a2b3c4d5e6f7a.png"
}
```

---

## 6. كود استدعاء متكامل لمطور الواجهة (React / Axios Snippet)

```javascript
import axios from 'axios';

const API_BASE = 'https://api.exchangesmangement.online/api/v1';

// 1. جلب الاختبار وأسئلته لتعبئة الفورم
export async function getExamForEdit(examId, token) {
  const res = await axios.get(`${API_BASE}/exams/${examId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data; // يحتوي على questions مع خياراتها
}

// 2. رفع صورة
export async function uploadExamImage(file, token) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await axios.post(`${API_BASE}/exams/upload-image`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data.imageUrl;
}

// 3. حفظ تعديلات الاختبار بالكامل
export async function saveExamFullUpdate(examId, examData, token) {
  const res = await axios.patch(`${API_BASE}/exams/${examId}`, examData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.data;
}

// 4. حذف سؤال منفرد
export async function deleteQuestion(questionId, token) {
  const res = await axios.delete(`${API_BASE}/exams/questions/${questionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
```
