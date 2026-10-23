# دليل التمييز بين السداد الآلي (تطبيق كارتي) والسداد اليدوي (السندات)
### الخاص بمطور لوحة التحكم (Dashboard Frontend Developer Guide)

يوضح هذا المستند كيفية التمييز البرمجي والبصري داخل لوحة التحكم بين **عمليات الشراء الآلية المباشرة عبر تطبيق كارتي (Automated Karti Payments)** و**عمليات الشراء اليدوية عبر رفع السندات (Manual Receipt Payments)**.

---

## 1. المعيار البرمجي الأساسي للتمييز (The Core Distinction Rule)

يتم التمييز بشكل قاطع ودقيق من خلال فحص حقل **`receiptUrl`** في كائن الدفع (`payment`):

```typescript
// فحص نوع عملية الدفع
const isAutoKarti = payment.receiptUrl === 'EXTERNAL_KARTI_PAYMENT';
```

* **إذا كان `receiptUrl === 'EXTERNAL_KARTI_PAYMENT'`:**
  ⬅️ **سداد إلكتروني آلي مباشر عبر تطبيق كارتي**.
* **إذا كان `receiptUrl` يحتوي على رابط صورة حقيقي (مثل `https://.../receipt.jpg`):**
  ⬅️ **سداد يدوي من الطالب قام برفع صورة السند**.

---

## 2. جدول الفروقات البرمجية والبيانات

| الحقل في كائن الدفع | ⚡ السداد الآلي (تطبيق كارتي) | 📄 السداد اليدوي (رفع السند) |
| :--- | :--- | :--- |
| **`receiptUrl`** | دائماً القيمة النصية: `'EXTERNAL_KARTI_PAYMENT'` | رابط صورة حقيقي للسند المرفوع |
| **`status`** | **`APPROVED`** فوراً (معتمد تلقائياً لحظة الدفع) | يبدأ بـ **`PENDING`** (معلق ينتظر المراجعة) |
| **`paymentAccountId`** | **`null`** (لأنه خصم مباشر من محفظة العميل) | رقم معرّف الحساب البنكي الذي حوّل إليه الطالب |
| **`reviewedById`** | **`null`** (تم الاعتماد آلياً بدون تدخل بشري) | معرّف الأدمن الذي راجع السند واعتمد الطلب |
| **`notes`** | تلقائياً: `سداد إلكتروني مباشر عبر تطبيق كرتي (رقم العملية: ...)` | ملاحظات الطالب إن وُجدت |
| **تفعيل الكورس** | **فوري** (اشتراك الطالب يصبح `ACTIVE` لحظياً) | **معلق** حتى يضغط الأدمن زر الموافقة |

---

## 3. التوجيهات لتصميم واجهة لوحة التحكم (UI / UX Recommendations)

### أ. في جدول المدفوعات (Payments Table):
1. **وسم نوع الدفع (Payment Type Badge):**
   * للعمليات الآلية: عرض وسم بنفسجي أو أزرق: `⚡ سداد آلي (كارتي)`
   * للعمليات اليدوية: عرض وسم رمادي أو برتقالي: `📄 حوالة يدوية (سند)`
2. **عمود السند والمرفقات (Receipt Column):**
   * إذا كانت العملية **يدوية**: أظهر زر **"معاينة صورة السند"** لفتح نافذة منبثقة تفحص السند.
   * إذا كانت العملية **آلية**: **لا تظهر زر معاينة الصورة** (لأنه لا توجد صورة سند مرفوعة)، بل أظهر بدلاً منه: **"رقم العملية: {transactionNumber}"** مع أيقونة التحقق الأخضر.

---

### ب. في فلاتر البحث والفرز (Filters):
يُفضل إضافة فلتر تصفية حسب طريقة الدفع:
* **الكل (All)**
* **سداد إلكتروني آلي (كارتي)**: حيث يتم إرسال طلب جلب كل المدفوعات وتصفية النتائج التي تحتوي على `receiptUrl === 'EXTERNAL_KARTI_PAYMENT'`.
* **سندات وحوالات يدوية**: حيث يتم جلب المدفوعات التي تحتوي على رابط صورة.

---

### ج. شاشة "الطلبات المعلقة" (Pending Payments):
* **تنبيه:** طلبات كارتي الآلية **لن تظهر أبداً في قائمة الطلبات المعلقة** `GET /api/v1/payments/admin/pending` لأن حالتها تنزل معتمدة فوراً `APPROVED`.
* تظهر طلبات كارتي فقط في شاشة **"سجل كل المدفوعات"** `GET /api/v1/payments/admin/all` لغرض التقارير والمحاسبة المالية.

---

## 4. نموذج كود مساعد لمطور الواجهة (Code Snippets)

### دالة المساعدة (Helper Function):
```javascript
export function getPaymentMethodInfo(payment) {
  if (payment.receiptUrl === 'EXTERNAL_KARTI_PAYMENT') {
    return {
      isAuto: true,
      label: 'سداد آلي (تطبيق كارتي)',
      badgeColor: 'purple', // أو الكلاس المناسب في Tailwind / MUI
      icon: 'bolt',
      hasReceiptImage: false,
    };
  }

  return {
    isAuto: false,
    label: 'سداد يدوي (سند تحويل)',
    badgeColor: 'blue',
    icon: 'document',
    hasReceiptImage: true,
  };
}
```

### مثال استخدام داخل مكوّن React / Vue:
```jsx
const paymentInfo = getPaymentMethodInfo(payment);

return (
  <tr>
    {/* اسم الطالب والكورس */}
    <td>{payment.student.user.name}</td>
    <td>{payment.course.title}</td>

    {/* نوع السداد */}
    <td>
      <span className={`badge badge-${paymentInfo.badgeColor}`}>
        {paymentInfo.label}
      </span>
    </td>

    {/* صورة السند أو رقم العملية */}
    <td>
      {paymentInfo.hasReceiptImage ? (
        <button onClick={() => openReceiptModal(payment.receiptUrl)}>
          🔍 معاينة السند
        </button>
      ) : (
        <span className="text-muted">
          عملية كارتي رقم: <strong>{payment.transactionNumber}</strong>
        </span>
      )}
    </td>

    {/* الحالة */}
    <td>
      <span className={payment.status === 'APPROVED' ? 'text-success' : 'text-warning'}>
        {payment.status === 'APPROVED' ? 'معتمد' : 'معلق'}
      </span>
    </td>
  </tr>
);
```

---

## 5. أمثلة الاستجابة القادمة من الـ API (API Response Examples)

### نموذج 1: استجابة سداد آلي عبر تطبيق كارتي
```json
{
  "id": 142,
  "amount": "25000.00",
  "currency": "YER_OLD",
  "status": "APPROVED",
  "receiptUrl": "EXTERNAL_KARTI_PAYMENT",
  "transactionNumber": "KARTI-9823411",
  "paymentAccountId": null,
  "reviewedById": null,
  "notes": "سداد إلكتروني مباشر عبر تطبيق كرتي (رقم العملية: KARTI-9823411)",
  "createdAt": "2026-10-23T14:10:00.000Z"
}
```

### نموذج 2: استجابة سداد يدوي برفع صورة السند
```json
{
  "id": 143,
  "amount": "25000.00",
  "currency": "YER_OLD",
  "status": "PENDING",
  "receiptUrl": "https://api.exchangesmangement.online/uploads/receipt-172969.jpg",
  "transactionNumber": "77182934",
  "paymentAccountId": 2,
  "reviewedById": null,
  "notes": "تم التحويل عبر الكريمي جوال",
  "createdAt": "2026-10-23T14:15:00.000Z"
}
```
