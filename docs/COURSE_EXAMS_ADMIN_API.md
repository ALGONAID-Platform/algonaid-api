# 📚 دليل التوثيق الشامل لاختبارات الكورسات (Course Exams & Quizzes)
> **موجّه لمطوّر لوحة تحكم الأدمن (Admin Dashboard Developer)**  
> **Backend Base URL:** `https://api.algonaid.online` (أو مسار الخادم المعتمد)

---

## 🔑 1. المصادقة والصلاحيات (Authentication & Authorization)
- **Headers المطلوبة في جميع الطلبات:**
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **الأدوار المصرّح لها بإدارة وتعديل الاختبارات:**
  - `ADMIN` أو `OWNER` (أو مدرّب الكورس المسجل).

---

## 🏗️ 2. الأنواع والخيارات المتاحة (Enums & Constants)

### أ. نوع الاختبار (`ExamType`)
- `LESSON_QUIZ`: اختبار مرحلي مرتبط بدرس محدد (`lessonId`).
- `COURSE_QUIZ`: اختبار نهائي أو عام للكورس (`courseId`) مع لوحة شرف دائمة.
- `CHALLENGE`: تحدي مؤقت له تاريخ ووقت بداية (`startTime`) وتاريخ ووقت نهاية (`endTime`).

### ب. معيار الترتيب في لوحة الشرف (`RankingCriteria`)
- `BOTH`: الترتيب بالدرجة أولاً، ثم بالسرعة (الوقت المستغرق بالملي ثانية) كفاصل تعادل (الافتراضي والموصى به).
- `SCORE`: الترتيب بالدرجة فقط.
- `SPEED`: الترتيب بالسرعة فقط.

### ج. نوع السؤال (`QuestionType`)
- `MULTIPLE_CHOICE`: اختيار من متعدد.
- `TRUE_FALSE`: صح أو خطأ.

### د. حالة محاولة الطالب (`ExamStatus`)
- `IN_PROGRESS`: محاولة جارية.
- `PASSED`: ناجح ومجتاز للاختبار.
- `FAILED`: راسب.
- `IMPROVEMENT_NEEDED`: قريب من درجة النجاح (أقل من نسبة النجاح بـ 10% أو أقل).

---

## 🛠️ 3. جدول ملخص للـ Endpoints

| Method | Endpoint | الوظيفة | الصلاحية |
| :--- | :--- | :--- | :--- |
| **POST** | `/exams/upload-image` | رفع صورة غلاف الاختبار أو صورة لأحد الأسئلة | Admin, Owner |
| **POST** | `/exams` | إنشاء اختبار جديد مع كامل الأسئلة والخيارات دفعة واحدة | Admin, Owner |
| **GET** | `/exams` | استعراض جميع اختبارات المنصة (بما فيها المسودات للأدمن) | Admin, Owner, Student |
| **GET** | `/exams/course/:courseId` | جلب اختبارات كورس معين مع المتصدرين والإحصائيات | Admin, Owner, Student |
| **GET** | `/exams/:id` | جلب تفاصيل ومعلومات الاختبار | Admin, Owner, Student |
| **PATCH** | `/exams/:id` | تعديل بيانات الاختبار والأسئلة والخيارات | Admin, Owner |
| **DELETE** | `/exams/:id` | حذف الاختبار نهائياً مع أسئلته ومحاولاته | Admin, Owner |
| **GET** | `/exams/:id/stats` | إحصائيات متقدمة ومفصلة ونسب الإجابات الصحيحة/الخاطئة لكل سؤال | Admin, Owner (والطلاب بعد انتهاء التحدي) |
| **GET** | `/exams/:id/leaderboard` | قائمة المتصدرين ولوحة الشرف للاختبار | الجميع |
| **GET** | `/comments/exam/:examId` | جلب قسم التعليقات وإعلان تكريم الأوائل | الجميع |
| **POST** | `/practice-exams` | إضافة نموذج امتحاني PDF لكورس معين | Admin, Owner |
| **GET** | `/practice-exams?courseId=:id` | جلب نماذج الـ PDF ومراجع الكورس | الجميع (مقيد باشتراك الكورسات المدفوعة) |

---

## 📋 4. التفاصيل الدقيقة لكل Endpoint مع الـ Request & Response

---

### 1️⃣ رفع صورة للاختبار أو السؤال
`POST /exams/upload-image`

- **Content-Type:** `multipart/form-data`
- **Body:**
  - `image`: ملف الصورة (`jpg`, `jpeg`, `png`, `webp`, `gif` بحد أقصى 5MB).
- **Response (201 Created):**
```json
{
  "imageUrl": "https://ucarecdn.com/xxxx-xxxx-xxxx/image.png"
}
```

---

### 2️⃣ إنشاء اختبار جديد
`POST /exams`

- **Content-Type:** `application/json`
- **Body Fields Schema:**
  - `title` *(string, مطلوب)*: عنوان الاختبار.
  - `description` *(string, اختياري)*: وصف الاختبار أو تعليماته.
  - `imageUrl` *(string, اختياري)*: رابط صورة غلاف الاختبار.
  - `examType` *(Enum: LESSON_QUIZ | COURSE_QUIZ | CHALLENGE, افتراضي: LESSON_QUIZ)*.
  - `rankingCriteria` *(Enum: BOTH | SCORE | SPEED, افتراضي: BOTH)*.
  - `passingScore` *(number, 0-100, افتراضي: 50)*: النسبة المئوية للنجاح.
  - `maxAttempts` *(number, >=1, افتراضي: 1)*: عدد المحاولات المسموح بها.
  - `timeLimit` *(number, دقائق, اختياري)*: مدة الاختبار (اتركه `null` إذا كان بلا وقت محدد).
  - `startTime` *(ISO 8601 string, مطلوب في حالة CHALLENGE)*: وقت بدء الاختبار.
  - `endTime` *(ISO 8601 string, مطلوب في حالة CHALLENGE)*: وقت انتهاء الاختبار.
  - `courseId` *(number, مطلوب إذا كان اختبار كورس أو تحدي)*: معرّف الكورس.
  - `lessonId` *(number, مطلوب إذا كان اختبار درس)*: معرّف الدرس.
    > ⚠️ **ملاحظة:** لا ترسل `courseId` و `lessonId` معاً في نفس الاختبار.
  - `asAssignment` *(boolean, اختياري، افتراضي: false)*:
    > ✨ **خاصية مميزة:** إذا كان `true` وتم ربطه بدرس (`lessonId`)، يقوم النظام آلياً بتسجيله كتكليف (Quiz Assignment) ويُصحح ويرصد آلياً للطالب عند تسليمه.
  - `questions` *(array, مطلوب)*: مصفوفة تحتوي الأسئلة والخيارات:
    - `text` *(string, مطلوب)*: نص السؤال.
    - `type` *(Enum: MULTIPLE_CHOICE | TRUE_FALSE)*.
    - `points` *(number, افتراضي: 1)*: درجات هذا السؤال.
    - `imageUrl` *(string, اختياري)*: رابط صورة مرفقة مع السؤال.
    - `options` *(array, خيارين على الأقل)*:
      - `text` *(string, مطلوب)*: نص الخيار.
      - `isCorrect` *(boolean, مطلوب)*: هل الخيار صحيح (`true`) أم خاطئ (`false`).

- **مثال Request Body متكامل:**
```json
{
  "title": "الاختبار النهائي لدورة Flutter المتقدمة",
  "description": "اختبار تقييمي شامل لقياس المهارات ومفاهيم إدارة الحالة",
  "imageUrl": "https://ucarecdn.com/sample-exam-cover.jpg",
  "examType": "COURSE_QUIZ",
  "rankingCriteria": "BOTH",
  "passingScore": 60,
  "maxAttempts": 2,
  "timeLimit": 30,
  "courseId": 5,
  "questions": [
    {
      "text": "أي من الودجات التالية تُعتبر مناسبة لإنشاء واجهات لا تتغير حالتها؟",
      "type": "MULTIPLE_CHOICE",
      "points": 5,
      "imageUrl": null,
      "options": [
        { "text": "StatelessWidget", "isCorrect": true },
        { "text": "StatefulWidget", "isCorrect": false },
        { "text": "InheritedWidget", "isCorrect": false },
        { "text": "AnimatedWidget", "isCorrect": false }
      ]
    },
    {
      "text": "هل تعتبر دالة setState مسؤولة عن إعادة بناء الـ Widget Tree؟",
      "type": "TRUE_FALSE",
      "points": 5,
      "options": [
        { "text": "صح", "isCorrect": true },
        { "text": "خطأ", "isCorrect": false }
      ]
    }
  ]
}
```

- **مثال Response (201 Created):**
```json
{
  "id": 14,
  "title": "الاختبار النهائي لدورة Flutter المتقدمة",
  "description": "اختبار تقييمي شامل لقياس المهارات ومفاهيم إدارة الحالة",
  "imageUrl": "https://ucarecdn.com/sample-exam-cover.jpg",
  "passingScore": 60,
  "maxAttempts": 2,
  "timeLimit": 30,
  "examType": "COURSE_QUIZ",
  "rankingCriteria": "BOTH",
  "startTime": null,
  "endTime": null,
  "lessonId": null,
  "courseId": 5,
  "createdAt": "2026-10-18T00:20:00.000Z",
  "updatedAt": "2026-10-18T00:20:00.000Z",
  "questions": [
    {
      "id": 45,
      "text": "أي من الودجات التالية تُعتبر مناسبة لإنشاء واجهات لا تتغير حالتها؟",
      "type": "MULTIPLE_CHOICE",
      "points": 5,
      "imageUrl": null,
      "examId": 14,
      "options": [
        { "id": 101, "text": "StatelessWidget", "isCorrect": true, "questionId": 45 },
        { "id": 102, "text": "StatefulWidget", "isCorrect": false, "questionId": 45 },
        { "id": 103, "text": "InheritedWidget", "isCorrect": false, "questionId": 45 },
        { "id": 104, "text": "AnimatedWidget", "isCorrect": false, "questionId": 45 }
      ]
    }
  ]
}
```

---

### 3️⃣ تحديث الاختبار والأسئلة
`PATCH /exams/:id`

- **المسار:** `/exams/14`
- **Body:** ترسل الحقول المراد تعديلها فقط (Partial Update).
- **تحديث الأسئلة:** إذا تم إرسال مصفوفة `questions`، يقوم النظام تلقائياً بمسح الأسئلة السابقة وإعادة إنشاء الأسئلة والخيارات الجديدة داخل Transaction آمنة.
- **تحديث ربط التكليف:** إذا كان الاختبار تابعاً لدرس، يمكن إرسال `"asAssignment": true` أو `false` لتحويله أو إلغاء تحويله لتكليف.

- **مثال Request Body:**
```json
{
  "title": "الاختبار النهائي لدورة Flutter المتقدمة (محدث)",
  "timeLimit": 45,
  "passingScore": 70
}
```

---

### 4️⃣ حذف الاختبار
`DELETE /exams/:id`

- **المسار:** `/exams/14`
- **الوظيفة:** حذف الاختبار نهائياً وجميع الأسئلة والخيارات ومحاولات الطلاب وإجاباتهم المرتبطة به.
- **Response (200 OK):**
```json
{
  "message": "Exam deleted successfully"
}
```

---

### 5️⃣ جلب اختبارات كورس معين مع المتصدرين
`GET /exams/course/:courseId`

- **المسار:** `/exams/course/5`
- **Response (200 OK):**
```json
[
  {
    "id": 14,
    "title": "الاختبار النهائي لدورة Flutter المتقدمة",
    "description": "اختبار تقييمي شامل",
    "imageUrl": "https://ucarecdn.com/cover.jpg",
    "passingScore": 60,
    "maxAttempts": 2,
    "timeLimit": 30,
    "examType": "COURSE_QUIZ",
    "rankingCriteria": "BOTH",
    "startTime": null,
    "endTime": null,
    "totalQuestions": 10,
    "totalPoints": 50,
    "passingPoints": 30,
    "minPassingScore": 30,
    "isEnded": false,
    "timeStatus": "ONGOING",
    "participantsCount": 24,
    "topParticipants": [
      {
        "studentId": 12,
        "name": "أحمد علي",
        "avatar": "https://ucarecdn.com/avatar1.png",
        "completedAt": "2026-10-17T18:30:00.000Z"
      }
    ],
    "commentsCount": 8,
    "latestComment": {
      "id": 105,
      "text": "اختبار رائع ومفيد جداً!",
      "createdAt": "2026-10-17T20:15:00.000Z",
      "userName": "سارة محمد",
      "userAvatar": null
    }
  }
]
```

---

### 6️⃣ إحصائيات متقدمة للاختبار وتحليل الأسئلة (Admin Analytics)
`GET /exams/:id/stats`

- **المسار:** `/exams/14/stats`
- **الوصف:** يوفّر للأدمن تحليلاً رقمياً شاملاً:
  - إجمالي المشاركين والمكتمل وغير المكتمل.
  - متوسط درجات الطلاب وتوزيع التقديرات (`excellent`, `veryGood`, `good`, `acceptable`, `failed`).
  - إحصائية تفصيلية لكل سؤال: كم طالب أجاب عليه، كم إجابة صحيحة، كم إجابة خاطئة، ونسبة النجاح في السؤال (`correctPercentage`).
- **Response (200 OK):**
```json
{
  "overview": {
    "totalParticipants": 45,
    "completed": 40,
    "notCompleted": 5,
    "averageScore": 38.5,
    "gradeDistribution": {
      "excellent": 15,
      "veryGood": 12,
      "good": 8,
      "acceptable": 5,
      "failed": 0
    }
  },
  "questions": [
    {
      "questionId": 45,
      "text": "أي من الودجات التالية تُعتبر مناسبة لإنشاء واجهات لا تتغير حالتها؟",
      "imageUrl": null,
      "totalAnswered": 45,
      "correctCount": 38,
      "wrongCount": 7,
      "correctPercentage": 84
    },
    {
      "questionId": 46,
      "text": "هل تعتبر دالة setState مسؤولة عن إعادة بناء الـ Widget Tree؟",
      "imageUrl": null,
      "totalAnswered": 45,
      "correctCount": 42,
      "wrongCount": 3,
      "correctPercentage": 93
    }
  ]
}
```

---

### 7️⃣ لوحة الشرف والمتصدرين (Leaderboard)
`GET /exams/:id/leaderboard`

- **المسار:** `/exams/14/leaderboard`
- **الوصف:** قائمة الطلاب الفائزين بالترتيب حسب الدرجة والسرعة:
- **Response (200 OK):**
```json
{
  "examId": 14,
  "examTitle": "الاختبار النهائي لدورة Flutter المتقدمة",
  "rankingCriteria": "BOTH",
  "isEnded": true,
  "status": "ENDED",
  "endTime": "2026-10-17T23:59:59.000Z",
  "participantsCount": 40,
  "leaderboard": [
    {
      "rank": 1,
      "studentId": 12,
      "name": "أحمد علي",
      "avatar": "https://ucarecdn.com/avatar1.png",
      "score": 50,
      "timeTakenMs": 420000,
      "completedAt": "2026-10-17T18:30:00.000Z"
    },
    {
      "rank": 2,
      "studentId": 18,
      "name": "محمود سمير",
      "avatar": null,
      "score": 48,
      "timeTakenMs": 510000,
      "completedAt": "2026-10-17T19:10:00.000Z"
    }
  ]
}
```

---

### 8️⃣ التعليقات والإعلان الرسمي لنتائج الاختبار
`GET /comments/exam/:examId`

- **المسار:** `/comments/exam/14`
- **الوصف:** جلب كافة التعليقات والردود المرتبطة بالاختبار.
- **ملاحظة أوتوماتيكية للباك إند:** يمتلك النظام خدمة مجدولة (`ExamsScheduler`) تعمل كل دقيقة في الخلفية؛ وعند انتهاء موعد الاختبار (`endTime`):
  1. تُغلق المحاولات الجارية وتُرصد درجاتها.
  2. يُحسب الثلاثة الأوائل وأعلى درجة والمتوسط.
  3. يُنشر تعليق رسمي تلقائي يتضمن لوحة الشرف والإحصائيات، مع عمل **Mentions** لكافة المشاركين ليردهم إشعار بنتيجة الاختبار.

---

### 9️⃣ نماذج الامتحانات والمراجع PDF (`Practice Exams`)
في حال كانت لوحة الأدمن تدير أيضاً مراجع ونماذج الاختبارات السابقة بصيغة PDF:

| Endpoint | Method | الوظيفة |
| :--- | :---: | :--- |
| `/practice-exams` | **POST** | إضافة نموذج PDF جديد لكورس معين |
| `/practice-exams/:id` | **PATCH** | تعديل النموذج |
| `/practice-exams/:id` | **DELETE** | حذف النموذج |
| `/practice-exams?courseId=5` | **GET** | جلب النماذج الخاصة بكورس محدد |

- **Body إضافة نموذج PDF (`POST /practice-exams`):**
```json
{
  "title": "نموذج اختبار نصفي تجريبي مع الحل النموذجي",
  "grade": 100,
  "pdfUrl": "https://ucarecdn.com/sample-exam.pdf",
  "courseId": 5
}
```

---

## ⚡ 5. إرشادات وقواعد عمل هامة لمطوّر لوحة التحكم (Frontend Guidelines)

1. **قاعدة الـ Mutual Exclusivity للربط:**
   - إذا اخترت ربط الاختبار بدرس محدد (`lessonId`)، لا ترسل حقل `courseId`.
   - إذا اخترت أن يكون الاختبار اختباراً للكورس ككل أو تحدياً (`courseId`)، لا ترسل `lessonId`.
2. **الكويز كتكليف دراسي (`asAssignment: true`):**
   - وفّر في واجهة إنشاء اختبار الدرس مفتاح تفعيل (Switch/Checkbox) بعنوان: `"تعيين كـ تكليف تلقائي للدرس"`. عند تفعيله وإرسال `asAssignment: true`، سيظهر في تبويب التكليفات ويُصحح فورياً للطالب بمجرد إرسال إجاباته.
3. **تنسيق التواريخ في التحديات (`CHALLENGE`):**
   - حقول `startTime` و `endTime` يجب إرسالها بصيغة ISO 8601 القياسية (مثل `2026-10-25T18:00:00.000Z`).
4. **تعديل الأسئلة:**
   - عند تعديل أسئلة الاختبار من شاشة التعديل، قم بإرسال مصفوفة `questions` بكامل أسئلتها وخياراتها المحدثة ليتم حفظها دفعة واحدة.

