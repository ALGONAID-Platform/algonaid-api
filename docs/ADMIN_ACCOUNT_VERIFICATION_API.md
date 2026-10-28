# دليل واجهة تأكيد وتوثيق الحسابات من لوحة التحكم (Admin Account Verification API)

يوفر هذا الدليل جميع الـ Endpoints الخاصة بإدارة تأكيد الحسابات وتوثيقها يدوياً من قِبل الأدمن أو المالك (Admin / Owner) للطلاب أو المستخدمين الذين يواجهون صعوبة في استقبال رسائل التأكيد عبر البريد الإلكتروني.

---

## 1. توثيق حساب بواسطة البريد الإلكتروني أو معرّف المستخدم (Body)

تتيح هذه الـ Endpoint توثيق الحساب مباشرة بتمرير البريد الإلكتروني أو معرّف المستخدم في جسم الطلب (JSON).

* **المسار**: `POST /api/v1/users/verify` (أو `PATCH /api/v1/users/verify`)
* **الصلاحية**: `ADMIN`, `OWNER` (يتطلب Bearer Token)
* **Headers**:
  ```http
  Authorization: Bearer <ADMIN_JWT_TOKEN>
  Content-Type: application/json
  ```

### أمثلة للطلب (Request Body):

#### أ) التوثيق عبر البريد الإلكتروني (الأسهل في لوحة التحكم):
```json
{
  "email": "student@example.com"
}
```

#### ب) التوثيق عبر معرّف المستخدم (User ID):
```json
{
  "userId": 45
}
```

#### ج) إمكانية إلغاء التوثيق إذا لزم الأمر:
```json
{
  "email": "student@example.com",
  "verified": false
}
```

### الرد المتوقع (Response 200 OK):
```json
{
  "success": true,
  "message": "تم توثيق وتأكيد حساب المستخدم بنجاح.",
  "data": {
    "id": 45,
    "name": "أحمد محمد",
    "email": "student@example.com",
    "role": "STUDENT",
    "emailVerified": true,
    "createdAt": "2026-10-25T14:20:00.000Z",
    "updatedAt": "2026-10-28T17:30:00.000Z"
  }
}
```

---

## 2. توثيق حساب بواسطة معرّف المستخدم في المسار (URL Param)

* **المسار**: `POST /api/v1/users/:id/verify` (أو `PATCH /api/v1/users/:id/verify`)
* **الصلاحية**: `ADMIN`, `OWNER` (يتطلب Bearer Token)
* **Body** (اختياري):
  ```json
  {
    "verified": true
  }
  ```

### مثال الطلب:
```http
POST /api/v1/users/45/verify
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

### الرد المتوقع (Response 200 OK):
```json
{
  "success": true,
  "message": "تم توثيق وتأكيد حساب المستخدم بنجاح.",
  "data": {
    "id": 45,
    "name": "أحمد محمد",
    "email": "student@example.com",
    "role": "STUDENT",
    "emailVerified": true,
    "createdAt": "2026-10-25T14:20:00.000Z",
    "updatedAt": "2026-10-28T17:30:00.000Z"
  }
}
```

---

## 3. جلب قائمة الحسابات غير المؤكدة للوحة التحكم (Unverified Accounts)

تتيح هذه الـ Endpoint للوحة التحكم عرض جدول بجميع الحسابات غير المؤكدة مع دعم البحث والترقيم بالصفحات (Pagination)، بحيث يظهر بجانب كل حساب زر "تأكيد الحساب".

* **المسار**: `GET /api/v1/users/unverified`
* **الصلاحية**: `ADMIN`, `OWNER` (يتطلب Bearer Token)
* **Query Parameters**:
  - `page`: رقم الصفحة (افتراضياً `1`)
  - `limit`: عدد النتائج في الصفحة (افتراضياً `20`)
  - `search`: كلمة للبحث في الاسم أو البريد الإلكتروني (اختياري)

### مثال الطلب:
```http
GET /api/v1/users/unverified?page=1&limit=10&search=ahmed
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

### الرد المتوقع (Response 200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "name": "أحمد محمد",
      "email": "ahmed@example.com",
      "role": "STUDENT",
      "emailVerified": false,
      "createdAt": "2026-10-28T10:00:00.000Z",
      "updatedAt": "2026-10-28T10:00:00.000Z",
      "studentProfile": {
        "academicId": "STU-1045",
        "grade": "الثالث الثانوي"
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
