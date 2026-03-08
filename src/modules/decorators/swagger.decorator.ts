import { applyDecorators } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";

// توثيق إنشاء موديول جديد
export function SwaggerCreateModule() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ 
      summary: '📦 إضافة وحدة دراسية (Module)',
      description: 'يسمح للمعلم بإضافة وحدة جديدة تابعة لكورس معين.' 
    }),
    ApiBody({
      schema: {
        example: {
          courseId: 1,
          title: 'الوحدة الأولى: التفاضل',
          description: 'شرح مفصل لأساسيات التفاضل'
        }
      }
    }),
    ApiResponse({ status: 201, description: '✅ تم إنشاء الوحدة بنجاح' }),
    ApiResponse({ status: 400, description: '⚠️ تأكد من صحة الـ courseId' })
  );
}

// توثيق جلب وحدات كورس معين
export function SwaggerGetModulesByCourse() {
  return applyDecorators(
    ApiOperation({ 
      summary: '📚 جلب موديولات كورس محدد',
      description: 'يسترجع كافة الوحدات الدراسية المرتبطة بكورس معين.' 
    }),
    ApiParam({ name: 'courseId', description: 'معرف الكورس' }),
    ApiResponse({ status: 200, description: '✅ تم جلب البيانات بنجاح' })
  );
}
export function SwaggerUpdateModule() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: '📝 تحديث بيانات وحدة دراسية' }),
    ApiParam({ name: 'id', description: 'معرف الموديول المراد تعديله' }),
    ApiResponse({ status: 200, description: '✅ تم التحديث بنجاح' }),
    ApiResponse({ status: 401, description: '🚫 التوكن غير صالح أو منتهي' })
  );
}

/**
 * توثيق حذف وحدة دراسية (Module) نهائياً
 */
export function SwaggerDeleteModule() {
  return applyDecorators(
    ApiBearerAuth(), // أيقونة القفل في السواجر
    ApiOperation({ 
      summary: '🗑️ حذف موديول نهائياً',
      description: 'يقوم بحذف الوحدة الدراسية وكافة الدروس المرتبطة بها (بسبب الـ Cascade Delete في Prisma). يتطلب صلاحيات Admin أو Owner.' 
    }),
    ApiParam({ 
      name: 'id', 
      description: 'المعرف الفريد للموديول المراد حذفه', 
      example: 1 
    }),
    ApiResponse({ 
      status: 200, 
      description: '✅ تم حذف الموديول ودروسه بنجاح' 
    }),
    ApiResponse({ 
      status: 401, 
      description: '🚫 غير مصرح (التوكن مفقود أو غير صحيح)' 
    }),
    ApiResponse({ 
      status: 403, 
      description: '❌ ليس لديك الصلاحيات الكافية للحذف' 
    }),
    ApiResponse({ 
      status: 404, 
      description: '⚠️ الموديول غير موجود في قاعدة البيانات' 
    })
  );
}