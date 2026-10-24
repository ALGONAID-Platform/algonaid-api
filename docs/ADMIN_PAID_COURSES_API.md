# توثيق واجهة جلب الكورسات المدفوعة للوحة التحكم (Admin Paid Courses API)

> **وثيقة موجهة لمطور لوحة التحكم (Dashboard Frontend Developer)**  
> توضح هذه الوثيقة كيفية استخدام الـ Endpoint المخصصة لجلب كافة الكورسات المدفوعة للإدارة لعرضها في جداول لوحة التحكم وإدارتها.

---

## 1. معلومات الـ Endpoint الأساسية

* **المسار الأساسي:** `GET /api/v1/courses/admin/paid`
* **المسار البديل:** `GET /api/v1/courses/paid/admin` *(كلاهما يعملان بنفس النتيجة)*
* **الصلاحية المطلوبة (Guards):** `ADMIN` أو `OWNER` فقط عبر `Bearer Token`.  
  *(أي مستخدم عادي أو طالب يتم رفضه مباشرة بكود `403 Forbidden`).*

---

## 2. الفرق بين endpoint الطلاب و endpoint الأدمن

| وجه المقارنة | 👨‍🎓 مسار الطلاب والزوار (`GET /courses/paid`) | 🛡️ مسار الأدمن (`GET /courses/admin/paid`) |
| :--- | :--- | :--- |
| **الصلاحية** | عام للجميع (زوار وطلاب) | **خاص بالإدارة فقط** (`ADMIN` / `OWNER`) |
| **استثناء الكورسات المشترك بها** | **يستثني** الكورسات التي اشترك فيها الطالب مسبقاً | **يرجع كل الكورسات المدفوعة** بلا استثناء حتى لو كان مسجلاً فيها |
| **حجب البيانات الحساسة** | يحجب الوصف والأهداف (`null`) | **يعرض الوصف والأهداف كاملة** |
| **بيانات المحاضر** | الاسم فقط | **بيانات المحاضر الكاملة** مع المعرف والإيميل والصورة |
| **إحصائيات الكورس** | عدد المشتركين فقط | إحصائيات شاملة (المشتركين، الموديولات، الاختبارات، المقاعد المتبقية) |

---

## 3. معاملات الـ Query (اختيارية للـ Pagination)

| المعامل | النوع | إلزامي؟ | الوصف |
| :--- | :--- | :--- | :--- |
| **`page`** | `number` | لا | رقم الصفحة (الافتراضي: 1) |
| **`limit`** | `number` | لا | عدد النتائج لكل صفحة (الافتراضي: 10) |

> 💡 **ملاحظة للمطور:**
> - إذا أرسلت معاملات `page` أو `limit`، ستكون الاستجابة مهيكلة بصفحات: `{ data: [...], meta: { total, page, limit, totalPages } }`.
> - إذا لم ترسل معاملات صفحات، ستكون الاستجابة مصفوفة مباشرة بكافة الكورسات المدفوعة: `[ ... ]`.

---

## 4. نموذج الطلب (HTTP Request)

```http
GET /api/v1/courses/admin/paid?page=1&limit=10
Authorization: Bearer <ADMIN_OR_OWNER_JWT_TOKEN>
```

---

## 5. نموذج الاستجابة مع الـ Pagination (200 OK)

```json
{
  "data": [
    {
      "id": 5,
      "title": "دورة الأمن السيبراني المتقدمة",
      "description": "شرح كامل للأمن السيبراني والشبكات واختبار الاختراق",
      "thumbnail": "https://api.exchangesmangement.online/uploads/images/course-5.jpg",
      "isPaid": true,
      "price": "50000.00",
      "discountedPrice": "40000.00",
      "priceYerOld": "50000.00",
      "discountedPriceYerOld": "40000.00",
      "priceYerNew": "200000.00",
      "discountedPriceYerNew": "160000.00",
      "priceSar": "350.00",
      "discountedPriceSar": "280.00",
      "courseType": "LIVE_RECORDED",
      "scheduleDaysText": "السبت والإثنين والأربعاء الساعة 8 مساءً",
      "maxStudents": 50,
      "startDate": "2026-11-01T00:00:00.000Z",
      "endDate": "2026-12-15T00:00:00.000Z",
      "durationWeeks": 6,
      "scheduleDays": ["SATURDAY", "MONDAY", "WEDNESDAY"],
      "objectives": [
        "إتقان أساسيات أمن المعلومات",
        "تطبيق عملي على أدوات كالي لينكس",
        "تأمين خوادم الويب وقواعد البيانات"
      ],
      "certificateMinScore": 70,
      "certificateMinAttendance": 80,
      "createdAt": "2026-10-15T12:00:00.000Z",
      "updatedAt": "2026-10-24T14:30:00.000Z",
      "instructorId": 1,
      "teacher": {
        "id": 1,
        "name": "المهندس/ نذير الجنيد",
        "user": {
          "id": 2,
          "name": "المهندس/ نذير الجنيد",
          "email": "nazir@algonaid.com",
          "avatar": "https://api.exchangesmangement.online/uploads/avatars/nazir.jpg"
        }
      },
      "enrollmentsCount": 23,
      "modulesCount": 8,
      "practiceExamsCount": 4,
      "examsCount": 3,
      "isFull": false,
      "remainingSeats": 27
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

---

## 6. كود استدعاء جاهز للوحة التحكم (JavaScript / React / Vue)

```javascript
import axios from 'axios';

// دالة جلب الكورسات المدفوعة للأدمن
export async function fetchAdminPaidCourses({ page = 1, limit = 10, token }) {
  try {
    const response = await axios.get('/api/v1/courses/admin/paid', {
      params: { page, limit },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // في حال تفعيل الـ pagination:
    // response.data.data = قائمة الكورسات
    // response.data.meta = معلومات الصفحات { total, totalPages, ... }
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      console.error('ليس لديك صلاحية للوصول (Admin/Owner فقط)');
    }
    throw error;
  }
}
```
