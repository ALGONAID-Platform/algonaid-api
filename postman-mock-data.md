# Postman Mock Data for Algonaid API

هذا الملف يحتوي على بيانات جاهزة (JSON Payloads) يمكنك نسخها ولصقها مباشرة في تبويب `Body` (بصيغة `raw` واختيار `JSON`) في Postman لاختبار نقاط النهاية (Endpoints) الخاصة بمشروعك.

## 1. Authentication (المصادقة)

### Register User (إنشاء حساب طالب)
```json
{
  "name": "أحمد علي",
  "email": "ahmad.student@example.com",
  "password": "password123",
  "role": "STUDENT"
}
```

### Register User (إنشاء حساب معلم)
```json
{
  "name": "أ. خالد محمود",
  "email": "khaled.teacher@example.com",
  "password": "password123",
  "role": "ADMIN"
}
```

### Login User (تسجيل الدخول)
```json
{
  "email": "ahmad.student@example.com",
  "password": "password123"
}
```

---

## 2. Profiles (الملفات الشخصية)

### Create Student Profile (إنشاء ملف طالب)
```json
{
  "academicId": "STU-2026-001",
  "grade": "الصف العاشر",
  "birthDate": "2010-05-15T00:00:00.000Z",
  "address": "الرياض، المملكة العربية السعودية"
}
```

### Create Teacher Profile (إنشاء ملف معلم)
```json
{
  "specialization": "الرياضيات",
  "bio": "معلم رياضيات بخبرة تزيد عن 10 سنوات في تدريس المرحلة الثانوية.",
  "experience": 10
}
```

---

## 3. Courses & Modules (الدورات والوحدات)

### Create Course (إنشاء كورس جديد - يتطلب صلاحيات معلم)
```json
{
  "title": "مقدمة في الجبر",
  "description": "دورة شاملة تغطي أساسيات علم الجبر والمعادلات الخطية.",
  "thumbnail": "https://example.com/algebra-thumbnail.jpg"
}
```

### Create Module (إنشاء وحدة دراسية تابعة للكورس)
*ملاحظة: تأكد من تعديل `courseId` للرقم الصحيح.*
```json
{
  "title": "الوحدة الأولى: المعادلات الخطية",
  "description": "فهم المعادلات الخطية وكيفية حلها خطوة بخطوة.",
  "courseId": 1
}
```

---

## 4. Lessons (الدروس)

### Create Lesson (إنشاء درس جديد)
*ملاحظة: تأكد من تعديل `moduleId` للرقم الصحيح.*
```json
{
  "title": "الدرس الأول: إيجاد قيمة س (X)",
  "description": "تعلم الخطوات الأساسية لعزل المتغير س في المعادلة.",
  "content": "في هذا الدرس سوف نتطرق إلى القواعد الأساسية لنقل الأرقام بين طرفي المعادلة...",
  "videoUrl": "https://youtube.com/watch?v=example123",
  "pdfUrl": "https://example.com/lesson1-notes.pdf",
  "order": 1,
  "moduleId": 1
}
```

---

## 5. Exams & Questions (الاختبارات والأسئلة)

### Create Exam (إنشاء اختبار لدرس معين)
*ملاحظة: تأكد من تعديل `lessonId` للرقم الصحيح.*
```json
{
  "title": "اختبار قصير: المعادلات الخطية",
  "description": "اختبر معلوماتك في حل المعادلات البسيطة.",
  "passingScore": 60,
  "maxAttempts": 3,
  "lessonId": 1
}
```

### Create Question (إنشاء سؤال للاختبار)
*ملاحظة: تأكد من تعديل `examId` للرقم الصحيح.*
```json
{
  "text": "ما هي قيمة س في المعادلة التالية: 2س = 10 ؟",
  "type": "MULTIPLE_CHOICE",
  "points": 5,
  "examId": 1
}
```

### Create Options (إنشاء خيارات للسؤال)
*ملاحظة: تأكد من تعديل `questionId` للرقم الصحيح.*

**الخيار الأول (الإجابة الصحيحة):**
```json
{
  "text": "5",
  "isCorrect": true,
  "questionId": 1
}
```

**الخيار الثاني (إجابة خاطئة):**
```json
{
  "text": "10",
  "isCorrect": false,
  "questionId": 1
}
```

---

## 6. Student Actions (تفاعلات الطالب)

### Enroll in Course (التسجيل في الدورة)
```json
{
  "courseId": 1
}
```

### Start Exam Attempt (بدء محاولة اختبار)
```json
{
  "examId": 1
}
```

### Submit User Answer (إرسال إجابة الطالب لسؤال معين)
```json
{
  "attemptId": 1,
  "questionId": 1,
  "selectedOptionId": 1
}
```

### Update Lesson Progress (تحديث تقدم الطالب في الدرس)
```json
{
  "lessonId": 1,
  "isCompleted": true
}
```
