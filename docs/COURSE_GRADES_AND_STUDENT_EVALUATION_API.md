# 📊 دليل واجهات برمجة التطبيقات لسجلات الدرجات وتقييم الطلاب
# Course Grades & Student Performance Evaluation API Documentation

> **موجّه لمطوّر الواجهة الأمامية ولوحة تحكم الأدمن والمعلم (Frontend & Dashboard Developer)**  
> **Global Prefix:** `/api/v1`  
> **Backend Base URL:** `https://api.algonaid.online/api/v1` (أو خادم التطوير المحلي `http://localhost:3000/api/v1`)

---

## 📌 جدول المحتويات
1. [المصادقة والصلاحيات (Authentication & Roles)](#1-المصادقة-والصلاحيات-authentication--roles)
2. [نظرة عامة على الـ Endpoints](#2-نظرة-عامة-على-الـ-endpoints)
3. [دليل التفاصيل لكل Endpoint مع الأمثلة](#3-دليل-التفاصيل-لكل-endpoint-مع-الأمثلة)
   - [أ. جلب جدول درجات وحضور طالب محدد في كورس](#أ-جلب-جدول-درجات-وحضور-طالب-محدد-في-كورس-عند-الضغط-على-الطالب)
   - [ب. جلب ملخص الدرجات وسجلات تقييم الدورة كاملة](#ب-جلب-ملخص-الدرجات-وسجلات-تقييم-الدورة-كاملة-course-grades-tab)
   - [ج. حفظ وتحديث درجات التكاليف دفعة واحدة (Bulk Save)](#ج-حفظ-وتحديث-درجات-التكاليف-دفعة-واحدة-bulk-grade-saving)
   - [د. تحديث درجة تكليف فردي وملاحظات المعلم](#د-تحديث-درجة-تكليف-فردي-وملاحظات-المعلم-single-grade-update)
4. [دليل التكامل وبناء الجداول والبطاقات في لوحة التحكم (Frontend Integration Guide)](#4-دليل-التكامل-وبناء-الجداول-والبطاقات-في-لوحة-التحكم-frontend-integration-guide)
5. [أكواد الحالات والأخطاء الشائعة (HTTP Status Codes & Errors)](#5-أكواد-الحالات-والأخطاء-الشائعة-http-status-codes--errors)

---

## 1. المصادقة والصلاحيات (Authentication & Roles)

- **Headers المطلوبة في جميع الطلبات:**
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **الصلاحيات والأدوار:**
  - `ADMIN` و `OWNER`: إمكانية الوصول الكامل لجميع الكورسات والطلاب والتعديل المباشر للدرجات.
  - المعلم (Teacher / Instructor): الوصول للكورسات التي يكون هو مدرسها المسجل (`instructorId`).
  - الطالب (`STUDENT`): يمكنه استعراض درجاته وتقييمه الخاص فقط في الكورسات المسجل فيها.

> [!TIP]
> جميع المسارات التي تستقبل `studentId` تدعم بمرونة تمرير إما معرّف الطالب في جدول الطلاب `Student.id` أو معرّف المستخدم `User.id`، مما يمنع حدوث أي أخطاء إذا أرسلت الواجهة الأمامية أحدهما بدلاً من الآخر.

---

## 2. نظرة عامة على الـ Endpoints

| Method | Endpoint | الوظيفة | الصلاحية |
| :--- | :--- | :--- | :--- |
| **GET** | `/grades/courses/:courseId/students/:studentId` | عرض جدول درجات الطالب الحالي (تكاليف كل درس، الاختبارات، الحضور، والمجاميع) | Admin, Owner, المعلم، والطالب نفسه |
| **GET** | `/courses/:courseId/students/:studentId/grades` | مسار بديل متطابق لنفس الوظيفة السابقة | Admin, Owner, المعلم، والطالب نفسه |
| **GET** | `/grades/courses/:courseId` | جلب ملخص درجات طلاب الدورة كاملة مع سجلات التقييم لتبويب Grades | Admin, Owner, المعلم |
| **POST** | `/grades/courses/:courseId/bulk` | حفظ وتحديث درجات التكاليف دفعة واحدة من لوحة التحكم | Admin, Owner, المعلم |
| **PATCH** | `/grades/courses/:courseId/students/:studentId/assignments/:assignmentId` | رصد أو تعديل درجة تكليف لطالب معين وملاحظة المعلم | Admin, Owner, المعلم |
| **PUT** | `/grades/courses/:courseId/students/:studentId/assignments/:assignmentId` | مسار بديل PUT لتعديل درجة تكليف الطالب | Admin, Owner, المعلم |

---

## 3. دليل التفاصيل لكل Endpoint مع الأمثلة

---

### أ. جلب جدول درجات وحضور طالب محدد في كورس (عند الضغط على الطالب)

هذا هو الـ Endpoint الأساسي المستخدم عند ضغط المعلم أو الإدارة على اسم طالب معين في قائمة طلاب الكورس لعرض بطاقة أدائه وجدول درجاته ومساره الكامل.

- **Method:** `GET`
- **Path:** `/api/v1/grades/courses/:courseId/students/:studentId`  
  *(أو المسار البديل: `/api/v1/courses/:courseId/students/:studentId/grades`)*
- **URL Parameters:**
  - `courseId` (Number - Required): معرّف الدورة التدريبية.
  - `studentId` (Number - Required): معرّف الطالب (`Student.id` أو `User.id`).

#### مثال على الاستجابة الناجحة (Response 200 OK):

```json
{
  "course": {
    "id": 10,
    "title": "دورة هندسة الشبكات المتقدمة",
    "instructorId": 2,
    "teacherName": "المهندس/ نذير الجنيد"
  },
  "student": {
    "id": 5,
    "userId": 12,
    "academicId": "STD-2026-005",
    "name": "أحمد محمد العولقي",
    "email": "ahmed@example.com",
    "avatar": "https://ucarecdn.com/xxxx-xxxx/avatar.png",
    "grade": "المستوى الثالث"
  },
  "enrollment": {
    "status": "ACTIVE",
    "enrolledAt": "2026-10-01T09:30:00.000Z"
  },
  "summary": {
    "attendance": {
      "totalLessons": 20,
      "attendedLessons": 18,
      "attendancePercentage": 90
    },
    "assignments": {
      "totalCount": 10,
      "submittedCount": 9,
      "gradedCount": 9,
      "totalEarnedScore": 85,
      "totalMaxScore": 100,
      "percentage": 85,
      "averageScore": 85
    },
    "exams": {
      "totalCount": 2,
      "attemptedCount": 2,
      "passedCount": 2,
      "totalEarnedPoints": 48,
      "totalMaxPoints": 50,
      "percentage": 96,
      "averageScore": 96
    },
    "overall": {
      "totalEarnedPoints": 133,
      "totalPossiblePoints": 150,
      "totalPercentage": 89,
      "cumulativeGpa": 88,
      "gradeLetter": "B+",
      "progressPercentage": 90
    }
  },
  "lessons": [
    {
      "lessonId": 101,
      "lessonTitle": "مقدمة في بروتوكولات التوجيه OSPF",
      "moduleId": 1,
      "moduleTitle": "الوحدة الأولى: أساسيات التوجيه",
      "order": 1,
      "dayNumber": 1,
      "isMandatory": true,
      "scheduledAt": "2026-10-02T16:00:00.000Z",
      "attendance": {
        "isAttended": true,
        "isCompleted": true,
        "completedAt": "2026-10-02T17:45:12.000Z",
        "watchCount": 2,
        "status": "PRESENT"
      },
      "assignment": {
        "id": 201,
        "title": "تطبيق عملي: إعداد OSPF Single Area",
        "type": "TASK",
        "maxScore": 10,
        "dueDate": "2026-10-05T23:59:59.000Z",
        "submissionId": 305,
        "status": "GRADED",
        "score": 9,
        "submittedAt": "2026-10-04T18:20:00.000Z",
        "feedback": "تنفيذ ممتاز وتكوين صحيح للـ Router ID",
        "fileUrl": "https://ucarecdn.com/xxxx/packet-tracer-lab.pkt",
        "content": "تم إعداد الشبكة والتأكد من الـ adjacency بنجاح.",
        "gradedAt": "2026-10-05T10:15:00.000Z"
      },
      "exam": null,
      "lessonTotalEarned": 9,
      "lessonTotalMax": 10
    },
    {
      "lessonId": 102,
      "lessonTitle": "اختبار مفاهيم OSPF وتوزيع الأحمال",
      "moduleId": 1,
      "moduleTitle": "الوحدة الأولى: أساسيات التوجيه",
      "order": 2,
      "dayNumber": 2,
      "isMandatory": true,
      "scheduledAt": "2026-10-06T16:00:00.000Z",
      "attendance": {
        "isAttended": true,
        "isCompleted": true,
        "completedAt": "2026-10-06T16:40:00.000Z",
        "watchCount": 1,
        "status": "PRESENT"
      },
      "assignment": null,
      "exam": {
        "id": 401,
        "title": "كويز مرحلي: بروتوكول OSPF",
        "maxPoints": 20,
        "passingScore": 60,
        "score": 19,
        "percentage": 95,
        "status": "PASSED",
        "isPassed": true,
        "attemptsCount": 1,
        "completedAt": "2026-10-06T16:35:00.000Z"
      },
      "lessonTotalEarned": 19,
      "lessonTotalMax": 20
    }
  ],
  "dailyTimeline": [ /* نفس محتوى lessons تماماً لتوافق الواجهات التي تعتمد على اسم dailyTimeline */ ],
  "courseExams": [
    {
      "id": 501,
      "title": "الاختبار النهائي للدورة",
      "maxPoints": 100,
      "passingScore": 70,
      "score": 88,
      "percentage": 88,
      "status": "PASSED",
      "isPassed": true,
      "attemptsCount": 1,
      "completedAt": "2026-11-01T20:00:00.000Z"
    }
  ]
}
```

---

### ب. جلب ملخص الدرجات وسجلات تقييم الدورة كاملة (Course Grades Tab)

يستخدم لتحميل بيانات شاشة الدرجات العامة للدورة (`Grades Tab`) في لوحة التحكم، حيث يعرض كافة التقييمات وقائمة الطلاب مع نتائجهم وسجلات الـ Grade Records.

- **Method:** `GET`
- **Path:** `/api/v1/grades/courses/:courseId`
- **URL Parameters:**
  - `courseId` (Number - Required): معرّف الدورة التدريبية.

#### مثال على الاستجابة الناجحة (Response 200 OK):

```json
{
  "course": {
    "id": 10,
    "title": "دورة هندسة الشبكات المتقدمة"
  },
  "enrolledStudentsCount": 35,
  "assessmentsCount": 12,
  "assessments": [
    {
      "id": 201,
      "assessmentId": 201,
      "type": "ASSIGNMENT",
      "title": "تطبيق عملي: إعداد OSPF Single Area",
      "lessonId": 101,
      "lessonTitle": "مقدمة في بروتوكولات التوجيه OSPF",
      "maxScore": 10
    },
    {
      "id": 401,
      "assessmentId": 401,
      "type": "EXAM",
      "title": "كويز مرحلي: بروتوكول OSPF",
      "lessonId": 102,
      "lessonTitle": "اختبار مفاهيم OSPF وتوزيع الأحمال",
      "maxScore": 20
    }
  ],
  "students": [
    {
      "student": {
        "id": 5,
        "userId": 12,
        "academicId": "STD-2026-005",
        "name": "أحمد محمد العولقي",
        "email": "ahmed@example.com",
        "avatar": "https://ucarecdn.com/xxxx/avatar.png"
      },
      "summary": {
        "attendance": { "totalLessons": 20, "attendedLessons": 18, "attendancePercentage": 90 },
        "assignments": { "totalCount": 10, "submittedCount": 9, "gradedCount": 9, "totalEarnedScore": 85, "totalMaxScore": 100, "percentage": 85, "averageScore": 85 },
        "exams": { "totalCount": 2, "attemptedCount": 2, "passedCount": 2, "totalEarnedPoints": 48, "totalMaxPoints": 50, "percentage": 96, "averageScore": 96 },
        "overall": { "totalEarnedPoints": 133, "totalPossiblePoints": 150, "totalPercentage": 89, "cumulativeGpa": 88, "gradeLetter": "B+", "progressPercentage": 90 }
      }
    }
  ],
  "gradeRecords": [
    {
      "studentId": 5,
      "studentName": "أحمد محمد العولقي",
      "assessmentId": 201,
      "assessmentType": "ASSIGNMENT",
      "assessmentTitle": "تطبيق عملي: إعداد OSPF Single Area",
      "lessonId": 101,
      "lessonTitle": "مقدمة في بروتوكولات التوجيه OSPF",
      "maxScore": 10,
      "score": 9,
      "status": "GRADED",
      "note": "تنفيذ ممتاز وتكوين صحيح للـ Router ID",
      "gradedAt": "2026-10-05T10:15:00.000Z"
    },
    {
      "studentId": 5,
      "studentName": "أحمد محمد العولقي",
      "assessmentId": 401,
      "assessmentType": "EXAM",
      "assessmentTitle": "كويز مرحلي: بروتوكول OSPF",
      "lessonId": 102,
      "lessonTitle": "اختبار مفاهيم OSPF وتوزيع الأحمال",
      "maxScore": 20,
      "score": 19,
      "status": "PASSED",
      "note": null,
      "gradedAt": "2026-10-06T16:35:00.000Z"
    }
  ]
}
```

---

### ج. حفظ وتحديث درجات التكاليف دفعة واحدة (Bulk Grade Saving)

يستخدم عندما يقوم المعلم بتعديل أو إدخال درجات متعددة في جدول لوحة التحكم ثم يضغط على زر "حفظ الدرجات" (Save Grades). يتم تنفيذ العملية بالكامل داخل **Database Transaction** لضمان عدم حدوث أي تضارب.

- **Method:** `POST`
- **Path:** `/api/v1/grades/courses/:courseId/bulk`
- **URL Parameters:**
  - `courseId` (Number - Required): معرّف الدورة.
- **Request Body (JSON):**

```json
{
  "grades": [
    {
      "studentId": 5,
      "assessmentId": 201,
      "score": 9,
      "note": "أداء رائع جداً"
    },
    {
      "studentId": 6,
      "assignmentId": 201,
      "score": 8,
      "note": "ممتاز مع بعض النواقص في التقرير"
    }
  ]
}
```

> [!NOTE]
> يدعم الباك إند كلاً من الحقلين `assessmentId` أو `assignmentId` لتفادي أي تعارض في التسمية في لوحة التحكم.

#### مثال على الاستجابة الناجحة (Response 201 Created):

```json
{
  "message": "تم حفظ الدرجات بنجاح",
  "savedCount": 2,
  "records": [
    {
      "submissionId": 305,
      "studentId": 5,
      "assignmentId": 201,
      "score": 9,
      "status": "GRADED",
      "feedback": "أداء رائع جداً",
      "gradedAt": "2026-11-13T17:15:00.000Z"
    },
    {
      "submissionId": 306,
      "studentId": 6,
      "assignmentId": 201,
      "score": 8,
      "status": "GRADED",
      "feedback": "ممتاز مع بعض النواقص في التقرير",
      "gradedAt": "2026-11-13T17:15:00.000Z"
    }
  ]
}
```

---

### د. تحديث درجة تكليف فردي وملاحظات المعلم (Single Grade Update)

لتعديل درجة تكليف طالب معين بشكل مباشر أو إضافة ملاحظة/تغذية راجعة فردية.

- **Method:** `PATCH` *(أو `PUT`)*
- **Path:** `/api/v1/grades/courses/:courseId/students/:studentId/assignments/:assignmentId`
- **URL Parameters:**
  - `courseId` (Number): معرّف الدورة.
  - `studentId` (Number): معرّف الطالب (`Student.id` أو `User.id`).
  - `assignmentId` (Number): معرّف التكليف.
- **Request Body (JSON):**

```json
{
  "score": 10,
  "feedback": "تم استكمال المطلوب وحل النواقص بنجاح"
}
```
*(يدعم أيضاً تمرير حقل `note` كبديل عن `feedback`)*

#### مثال على الاستجابة الناجحة (Response 200 OK):

```json
{
  "message": "تم حفظ الدرجة بنجاح",
  "submission": {
    "id": 305,
    "assignmentId": 201,
    "studentId": 5,
    "score": 10,
    "status": "GRADED",
    "feedback": "تم استكمال المطلوب وحل النواقص بنجاح",
    "gradedById": 2,
    "gradedAt": "2026-11-13T17:20:00.000Z"
  }
}
```

---

## 4. دليل التكامل وبناء الجداول والبطاقات في لوحة التحكم (Frontend Integration Guide)

### السيناريو 1: عند ضغط المعلم على طالب في لوحة التحكم (Student Modal / Page)

عند استدعاء:
`GET /api/v1/grades/courses/${courseId}/students/${studentId}`

يمكن للواجهة الأمامية رسم واجهة تفاعلية غنية تتكون من قسمين:

#### 1. بطاقات المؤشرات العلوية (Summary KPI Cards)
- **بطاقة الحضور:** النسبة المئوية `summary.attendance.attendancePercentage`% (المحاضرات المحضورة `attendedLessons` من إجمالي `totalLessons`).
- **بطاقة درجات التكاليف:** `summary.assignments.totalEarnedScore` / `summary.assignments.totalMaxScore` (المتوسط: `summary.assignments.averageScore`%).
- **بطاقة درجات الاختبارات:** `summary.exams.totalEarnedPoints` / `summary.exams.totalMaxPoints` (نسبة الاجتياز: `summary.exams.passedCount` / `summary.exams.totalCount`).
- **بطاقة المجموع التراكمي العام:**
  - المجموع الإجمالي: `summary.overall.totalEarnedPoints` / `summary.overall.totalPossiblePoints`.
  - المعدل التراكمي: `summary.overall.cumulativeGpa`%.
  - تقدير الحرف: `summary.overall.gradeLetter` (A+, A, B+, إلخ).

#### 2. جدول أداء الدروس التفصيلي (Lessons Performance Table)
يتم التكرار على مصفوفة `response.lessons` لبناء صفوف الجدول كالتالي:

| ترتيب الدرس (`order`) | اسم الدرس والموديول | الحضور والغياب | التكليف والواجب | درجة التكليف | الاختبار / الكويز | نتيجة الاختبار | مجموع الدرس |
| :---: | :--- | :---: | :--- | :---: | :--- | :---: | :---: |
| #1 | مقدمة OSPF <br><small>الوحدة 1</small> | 🟢 حاضر (`PRESENT`) | إعداد OSPF Single Area | **9** / 10 | — | — | **9** / 10 |
| #2 | كويز مرحلي <br><small>الوحدة 1</small> | 🟢 حاضر (`PRESENT`) | — | — | كويز مفاهيم OSPF | 🟢 ناجح (**19** / 20) | **19** / 20 |
| #3 | التوجيه المتقدم <br><small>الوحدة 2</small> | 🔴 غائب (`ABSENT`) | تكليف Multi-area | لم يسلّم | — | — | **0** / 10 |

---

### السيناريو 2: تبويب درجات الدورة العام (Course Grades Matrix Tab)

عند فتح تبويب الدرجات للكورس:
1. اطلب البيانات عبر: `GET /api/v1/grades/courses/${courseId}`.
2. اعرض أعمدة الجدول بأسماء التقييمات من مصفوفة `assessments` (العنوان والنوع والدرجة العظمى).
3. اعرض صفوف الطلاب من مصفوفة `students`.
4. عند قيام المعلم بتعديل درجات الطلاب، اجمع الدرجات المعدلة في مصفوفة وأرسلها في طلب واحد إلى:
   `POST /api/v1/grades/courses/${courseId}/bulk`.

---

## 5. أكواد الحالات والأخطاء الشائعة (HTTP Status Codes & Errors)

| Code | السبب | مثال على رسالة الخطأ |
| :--- | :--- | :--- |
| **400 Bad Request** | إدخال درجة سالبة أو أكبر من الدرجة العظمى المحددة للتكليف | `الدرجة (15) غير صحيحة، يجب أن تكون بين 0 و 10` |
| **400 Bad Request** | الطالب غير مسجل في هذه الدورة | `الطالب برقم 5 غير مسجل في هذه الدورة` |
| **401 Unauthorized** | عدم إرسال التوكن أو انتهاء صلاحيته | `Unauthorized` |
| **403 Forbidden** | المعلم لا يملك صلاحية تدريس هذه الدورة أو طالب يحاول رؤية درجات زميله | `ليس لديك صلاحية الوصول لدرجات هذه الدورة` |
| **404 Not Found** | الكورس أو الطالب أو التكليف غير موجود | `الدورة برقم 99 غير موجودة` |
