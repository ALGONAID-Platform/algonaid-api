import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

interface RedirectPageConfig {
  pageTitle: string;
  rawTitle: string;
  description: string;
  imageUrl?: string;
  path: string;
  id: string;
  badgeEmoji?: string;
  badgeText?: string;
  subHeader?: string;
  chips?: string[];
  statusMessage?: string;
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * دالة لتأمين النصوص البرمجية داخل كود JavaScript (الحماية من ثغرات XSS)
   */
  private escapeForJS(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E')
      .replace(/&/g, '\\x26')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  /**
   * دالة لتأمين النصوص داخل وسوم وخصائص HTML (الحماية من XSS)
   */
  private escapeHtml(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * تنسيق رابط الصورة ليصبح رابطاً مطلقاً صحيحاً
   */
  private formatImageUrl(imageUrl?: string | null): string {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return imageUrl.startsWith('/')
      ? `https://api.exchangesmangement.online${imageUrl}`
      : `https://api.exchangesmangement.online/${imageUrl}`;
  }

  getHello(): string {
    return 'OK';
  }

  /**
   * جلب بيانات الاختبار وإنشاء صفحة التوجيه ومعاينة Open Graph
   */
  async getExamRedirectPage(id: string): Promise<string> {
    const examId = parseInt(id, 10);
    const exam = !isNaN(examId)
      ? await this.prisma.exam.findUnique({
          where: { id: examId },
          include: {
            course: {
              select: {
                title: true,
                thumbnail: true,
              },
            },
            lesson: {
              select: {
                title: true,
              },
            },
            _count: {
              select: {
                questions: true,
              },
            },
          },
        }).catch(() => null)
      : null;

    const rawTitle = exam?.title || 'اختبار';
    const courseOrLesson = exam?.course?.title || exam?.lesson?.title || '';
    const pageTitle = courseOrLesson
      ? `${rawTitle} - ${courseOrLesson} | منصة الجنيد`
      : `${rawTitle} | منصة الجنيد التعليمية`;

    let description = exam?.description?.trim();
    if (!description) {
      const details: string[] = [];
      if (exam?.course?.title) details.push(`كورس: ${exam.course.title}`);
      if (exam?._count?.questions) details.push(`${exam._count.questions} أسئلة`);
      if (exam?.timeLimit) details.push(`${exam.timeLimit} دقيقة`);
      details.push('اضغط هنا لخوض الاختبار ومنافسة زملائك عبر تطبيق منصة الجنيد التعليمية');
      description = details.join(' • ');
    }

    const imageUrl = this.formatImageUrl(exam?.imageUrl || exam?.course?.thumbnail);

    const chips: string[] = [];
    if (exam?._count?.questions) chips.push(`❓ ${exam._count.questions} أسئلة`);
    chips.push(`⏱️ ${exam?.timeLimit ? exam.timeLimit + ' دقيقة' : 'بلا حد زمني'}`);
    if (exam?.passingScore) chips.push(`🎯 درجة النجاح: ${exam.passingScore}%`);

    return this.renderRedirectPage({
      pageTitle,
      rawTitle,
      description,
      imageUrl,
      path: 'examPage',
      id,
      badgeEmoji: '📝',
      badgeText: 'اختبار تعليمي',
      subHeader: exam?.course?.title ? `كورس: ${exam.course.title}` : (exam?.lesson?.title ? `درس: ${exam.lesson.title}` : undefined),
      chips,
      statusMessage: 'محتوى الاختبار متاح بالكامل عبر التطبيق',
    });
  }

  /**
   * صفحة التوجيه العامة (للكورسات والدروس والمنشورات) مع جلب البيانات الحقيقية من قاعدة البيانات
   */
  async getRedirectPage(type: 'course' | 'lesson' | 'post' | 'exam', id: string): Promise<string> {
    if (type === 'exam') {
      return this.getExamRedirectPage(id);
    }

    if (type === 'course') {
      const courseId = parseInt(id, 10);
      const course = !isNaN(courseId)
        ? await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
              teacher: {
                include: {
                  user: { select: { name: true } },
                },
              },
              _count: {
                select: {
                  modules: true,
                  enrollments: true,
                },
              },
            },
          }).catch(() => null)
        : null;

      const rawTitle = course?.title || 'دورة تدريبية';
      const pageTitle = `${rawTitle} | منصة الجنيد التعليمية`;
      const description = course?.description?.trim() || `انضم إلى دورة "${rawTitle}" على تطبيق منصة الجنيد التعليمية واستفد من الدروس التفاعلية والتكاليف والاختبارات الدورية.`;
      const imageUrl = this.formatImageUrl(course?.thumbnail);
      const chips: string[] = [];
      if (course?._count?.modules) chips.push(`📚 ${course._count.modules} وحدات تعليمية`);
      if (course?.isPaid) {
        chips.push('💎 دورة معتمدة');
      } else {
        chips.push('🎁 دورة مجانية');
      }
      if (course?._count?.enrollments) chips.push(`👥 ${course._count.enrollments} طالب مسجل`);

      return this.renderRedirectPage({
        pageTitle,
        rawTitle,
        description,
        imageUrl,
        path: 'modulesList',
        id,
        badgeEmoji: '🎓',
        badgeText: 'دورة تدريبية',
        subHeader: course?.teacher?.user?.name ? `إشراف: ${course.teacher.user.name}` : undefined,
        chips,
        statusMessage: 'محتوى الدورة متاح بالكامل عبر التطبيق',
      });
    }

    if (type === 'lesson') {
      const lessonId = parseInt(id, 10);
      const lesson = !isNaN(lessonId)
        ? await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
              module: {
                include: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                      thumbnail: true,
                    },
                  },
                },
              },
            },
          }).catch(() => null)
        : null;

      const rawTitle = lesson?.title || 'درس تعليمي';
      const courseTitle = lesson?.module?.course?.title;
      const pageTitle = courseTitle ? `${rawTitle} - ${courseTitle} | منصة الجنيد` : `${rawTitle} | منصة الجنيد التعليمية`;
      const description = lesson?.description?.trim() || (courseTitle ? `تابع درس "${rawTitle}" ضمن دورة "${courseTitle}" عبر تطبيق منصة الجنيد التعليمية.` : `تابع هذا الدرس عبر تطبيق منصة الجنيد التعليمية.`);
      const imageUrl = this.formatImageUrl(lesson?.imageUrl || lesson?.module?.course?.thumbnail);
      const chips: string[] = [];
      if (courseTitle) chips.push(`🎓 ${courseTitle}`);
      if (lesson?.scheduledAt) {
        chips.push('🗓️ محاضرة مباشرة/مجدولة');
      } else if (lesson?.videoUrl) {
        chips.push('🎥 درس فيديو تفاعلي');
      } else if (lesson?.isReading) {
        chips.push('📖 درس قراءة ومطالعة');
      }

      return this.renderRedirectPage({
        pageTitle,
        rawTitle,
        description,
        imageUrl,
        path: 'lessonDetails',
        id,
        badgeEmoji: '📖',
        badgeText: 'درس تعليمي',
        subHeader: courseTitle ? `دورة: ${courseTitle}` : undefined,
        chips,
        statusMessage: 'محتوى الدرس متاح بالكامل عبر التطبيق',
      });
    }

    if (type === 'post') {
      const postId = parseInt(id, 10);
      const post = !isNaN(postId)
        ? await this.prisma.post.findUnique({
            where: { id: postId },
            include: {
              author: {
                select: {
                  name: true,
                  avatar: true,
                },
              },
              _count: {
                select: {
                  comments: true,
                  likes: true,
                },
              },
            },
          }).catch(() => null)
        : null;

      const rawTitle = post?.title || (post?.content ? (post.content.length > 50 ? post.content.substring(0, 50) + '...' : post.content) : 'منشور تعليمي');
      const pageTitle = `${rawTitle} | منصة الجنيد التعليمية`;
      const description = post?.content?.trim() || 'شاهد هذا المنشور وتفاعل معه عبر تطبيق منصة الجنيد التعليمية.';
      const imageUrl = this.formatImageUrl(post?.imageUrl || post?.author?.avatar);
      const chips: string[] = [];
      if (post?.author?.name) chips.push(`✍️ ${post.author.name}`);
      if (post?._count?.likes) chips.push(`❤️ ${post._count.likes} إعجاب`);
      if (post?._count?.comments) chips.push(`💬 ${post._count.comments} تعليق`);

      return this.renderRedirectPage({
        pageTitle,
        rawTitle,
        description,
        imageUrl,
        path: 'posts',
        id,
        badgeEmoji: '📢',
        badgeText: 'منشور تفاعلي',
        subHeader: post?.author?.name ? `الناشر: ${post.author.name}` : undefined,
        chips,
        statusMessage: 'المنشور متاح للمشاهدة والتفاعل داخل التطبيق',
      });
    }

    return this.renderRedirectPage({
      pageTitle: 'منصة الجنيد التعليمية',
      rawTitle: 'منصة الجنيد التعليمية',
      description: 'افتح المحتوى مباشرة داخل تطبيق منصة الجنيد التعليمية.',
      path: 'modulesList',
      id,
      badgeEmoji: '✨',
      badgeText: 'منصة الجنيد',
    });
  }

  /**
   * القالب الموحد لتوليد صفحة هبوط أنيقة متضمنة وسوم Open Graph ورسالة توضيحية وزر المتجر المباشر
   */
  private renderRedirectPage(config: RedirectPageConfig): string {
    const safeId = this.escapeForJS(config.id);
    const safePath = this.escapeForJS(config.path);
    const rawUrl = `https://api.exchangesmangement.online/${safePath}/${safeId}`;
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.algonaid.app';
    const appIntentUrl = `intent://api.exchangesmangement.online/${safePath}/${safeId}#Intent;scheme=https;package=com.algonaid.app;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.algonaid.app;end`;

    const escapedPageTitle = this.escapeHtml(config.pageTitle);
    const escapedRawTitle = this.escapeHtml(config.rawTitle);
    const escapedDesc = this.escapeHtml(config.description);
    const escapedImg = this.escapeHtml(config.imageUrl);
    const escapedRawUrl = this.escapeHtml(rawUrl);
    const escapedIntentUrl = this.escapeHtml(appIntentUrl);
    const escapedSubHeader = this.escapeHtml(config.subHeader);
    const escapedBadgeText = this.escapeHtml(config.badgeText || 'منصة الجنيد');
    const badgeEmoji = config.badgeEmoji || '✨';

    const chipsHtml = config.chips && config.chips.length > 0
      ? `<div class="chips-container">${config.chips.map(chip => `<span class="chip">${this.escapeHtml(chip)}</span>`).join('')}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedPageTitle}</title>
    
    <!-- Meta & SEO Tags -->
    <meta name="description" content="${escapedDesc}">
    <meta name="theme-color" content="#00E676">

    <!-- Open Graph (WhatsApp, Telegram, Facebook) -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapedRawUrl}">
    <meta property="og:title" content="${escapedPageTitle}">
    <meta property="og:description" content="${escapedDesc}">
    ${config.imageUrl ? `
    <meta property="og:image" content="${escapedImg}">
    <meta property="og:image:secure_url" content="${escapedImg}">
    <meta property="og:image:alt" content="${escapedRawTitle}">` : ''}
    <meta property="og:site_name" content="منصة الجنيد التعليمية">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapedRawUrl}">
    <meta name="twitter:title" content="${escapedPageTitle}">
    <meta name="twitter:description" content="${escapedDesc}">
    ${config.imageUrl ? `<meta name="twitter:image" content="${escapedImg}">` : ''}

    <!-- App Links (Android & iOS) -->
    <meta property="al:android:url" content="${escapedIntentUrl}">
    <meta property="al:android:package" content="com.algonaid.app">
    <meta property="al:android:app_name" content="منصة الجنيد">
    <meta property="al:web:url" content="${escapedRawUrl}">

    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #00E676;
            --primary-dark: #00C853;
            --primary-glow: rgba(0, 230, 118, 0.4);
            --bg-gradient: radial-gradient(circle at 50% 30%, #0d2317 0%, #060b08 100%);
            --card-bg: rgba(18, 30, 24, 0.85);
            --text-main: #FFFFFF;
            --text-muted: #B0C4BA;
            --border-color: rgba(0, 230, 118, 0.22);
            --chip-bg: rgba(0, 230, 118, 0.1);
            --chip-border: rgba(0, 230, 118, 0.25);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Cairo', sans-serif;
            background: var(--bg-gradient);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            position: relative;
            overflow-x: hidden;
        }

        body::before, body::after {
            content: '';
            position: absolute;
            width: 360px;
            height: 360px;
            border-radius: 50%;
            background: var(--primary);
            filter: blur(140px);
            opacity: 0.16;
            z-index: 0;
            pointer-events: none;
        }

        body::before { top: -80px; right: -80px; }
        body::after { bottom: -80px; left: -80px; }

        .container {
            width: 100%;
            max-width: 500px;
            background: var(--card-bg);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--border-color);
            border-radius: 28px;
            padding: 32px 24px;
            text-align: center;
            box-shadow: 0 24px 50px rgba(0, 0, 0, 0.6);
            z-index: 10;
            position: relative;
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(0, 230, 118, 0.12);
            color: var(--primary);
            border: 1px solid rgba(0, 230, 118, 0.35);
            padding: 6px 16px;
            border-radius: 30px;
            font-size: 0.88rem;
            font-weight: 700;
            margin-bottom: 18px;
        }

        .banner-wrapper {
            width: 100%;
            height: 190px;
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
            background: #0d1a12;
        }

        .banner-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .logo-area {
            position: relative;
            display: inline-block;
            margin-bottom: 18px;
        }

        .logo-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #00E676 0%, #00B0FF 100%);
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            box-shadow: 0 0 30px var(--primary-glow);
        }

        .logo-icon svg {
            width: 44px;
            height: 44px;
            fill: white;
        }

        h1 {
            font-size: 1.55rem;
            font-weight: 800;
            margin-bottom: 8px;
            line-height: 1.38;
            background: linear-gradient(to left, #ffffff, #a3f7c9);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .sub-header {
            font-size: 0.95rem;
            color: #81C784;
            font-weight: 600;
            margin-bottom: 12px;
        }

        .chips-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
            margin: 14px 0 18px;
        }

        .chip {
            background: var(--chip-bg);
            border: 1px solid var(--chip-border);
            color: #E2ECE6;
            padding: 5px 12px;
            border-radius: 12px;
            font-size: 0.82rem;
            font-weight: 600;
        }

        .content-desc {
            font-size: 0.9rem;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 22px;
            padding: 0 8px;
        }

        /* كارد التثبيت المخصص والرسالة التوضيحية */
        .install-hero-card {
            background: linear-gradient(180deg, rgba(0, 230, 118, 0.08) 0%, rgba(0, 230, 118, 0.03) 100%);
            border: 1px solid rgba(0, 230, 118, 0.3);
            border-radius: 20px;
            padding: 22px 18px;
            margin: 18px 0 20px;
            text-align: right;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
            position: relative;
        }

        .install-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
        }

        .install-icon-badge {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            background: rgba(0, 230, 118, 0.18);
            border: 1px solid rgba(0, 230, 118, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.35rem;
            flex-shrink: 0;
        }

        .install-header-text h3 {
            font-size: 1.05rem;
            font-weight: 700;
            color: #FFFFFF;
            margin-bottom: 2px;
        }

        .install-header-text p {
            font-size: 0.8rem;
            color: var(--primary);
            font-weight: 600;
        }

        .install-notice-text {
            font-size: 0.88rem;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 18px;
        }

        .install-notice-text strong {
            color: #FFFFFF;
        }

        /* أزرار المتاجر */
        .btn-store-main {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            width: 100%;
            background: linear-gradient(135deg, #00E676 0%, #00C853 100%);
            color: #03140a;
            padding: 15px 20px;
            border-radius: 16px;
            text-decoration: none;
            font-weight: 700;
            transition: all 0.3s ease;
            box-shadow: 0 6px 20px rgba(0, 230, 118, 0.4);
            margin-bottom: 10px;
        }

        .btn-store-main:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 26px rgba(0, 230, 118, 0.6);
            background: linear-gradient(135deg, #1aff8c 0%, #00E676 100%);
        }

        .store-icon {
            width: 28px;
            height: 28px;
            flex-shrink: 0;
            fill: currentColor;
        }

        .btn-store-text {
            text-align: right;
            flex: 1;
        }

        .btn-store-sub {
            font-size: 0.75rem;
            display: block;
            opacity: 0.85;
            font-weight: 600;
            line-height: 1.2;
        }

        .btn-store-title {
            font-size: 1.1rem;
            font-weight: 800;
            display: block;
            line-height: 1.2;
        }

        .badge-free {
            background: rgba(0, 0, 0, 0.18);
            color: #03140a;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.78rem;
            font-weight: 800;
        }

        .store-secondary-grid {
            display: flex;
            gap: 10px;
        }

        .btn-store-secondary {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            color: var(--text-main);
            text-decoration: none;
            font-size: 0.82rem;
            font-weight: 600;
            transition: all 0.2s ease;
        }

        .btn-store-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.25);
        }

        .btn-store-secondary svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }

        /* زر الفتح لمن يملك التطبيق */
        .already-installed-box {
            margin-top: 20px;
            padding-top: 18px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .already-installed-label {
            font-size: 0.84rem;
            color: var(--text-muted);
            margin-bottom: 10px;
        }

        .btn-open-app {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 13px 20px;
            background: rgba(0, 230, 118, 0.08);
            border: 1px solid rgba(0, 230, 118, 0.25);
            border-radius: 14px;
            color: var(--primary);
            text-decoration: none;
            font-weight: 700;
            font-size: 0.95rem;
            transition: all 0.2s ease;
        }

        .btn-open-app:hover {
            background: rgba(0, 230, 118, 0.16);
            border-color: rgba(0, 230, 118, 0.4);
            color: #FFFFFF;
        }

        .footer-text {
            font-size: 0.78rem;
            color: rgba(255, 255, 255, 0.35);
            margin-top: 22px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-badge">
            <span>${badgeEmoji}</span>
            <span>${escapedBadgeText}</span>
        </div>

        ${config.imageUrl ? `
        <div class="banner-wrapper">
            <img src="${escapedImg}" alt="${escapedRawTitle}" class="banner-img" onerror="this.parentElement.style.display='none'">
        </div>
        ` : `
        <div class="logo-area">
            <div class="logo-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z"/>
                </svg>
            </div>
        </div>
        `}

        <h1>${escapedRawTitle}</h1>
        ${escapedSubHeader ? `<p class="sub-header">${escapedSubHeader}</p>` : ''}
        
        ${chipsHtml}

        <p class="content-desc">${escapedDesc}</p>

        <!-- كارد التوجيه لمتجر التطبيقات للمستخدمين الجدد أو الذين لا يملكون التطبيق -->
        <div class="install-hero-card">
            <div class="install-header">
                <div class="install-icon-badge">📲</div>
                <div class="install-header-text">
                    <h3>تطبيق منصة الجنيد مطلوب</h3>
                    <p>للوصول الكامل والتفاعل مع المحتوى</p>
                </div>
            </div>

            <p class="install-notice-text">
                هذا المحتوى التفاعلي متاح عبر <strong>تطبيق منصة الجنيد التعليمية</strong>. حمّل التطبيق الآن مجاناً لمتابعة الدروس، حل الاختبارات والتكاليف، والمنافسة مع زملائك.
            </p>

            <a href="${playStoreUrl}" class="btn-store-main" target="_blank" rel="noopener noreferrer" id="playstore-link">
                <svg class="store-icon" viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.42,12.1L17.87,12.87L16.55,12L17.87,11.33M3,3.41L17.3,10.56L14,12.21L3,3.41M3,20.59L14,11.79L17.3,13.44L3,20.59Z"/>
                </svg>
                <div class="btn-store-text">
                    <span class="btn-store-sub">تثبيت فوري ومجاني من</span>
                    <span class="btn-store-title">Google Play</span>
                </div>
                <span class="badge-free">مجاناً</span>
            </a>

            <div class="store-secondary-grid">
                <a href="https://apps.apple.com/app/id-demo" class="btn-store-secondary" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24">
                        <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z"/>
                    </svg>
                    <span>متوفر على App Store</span>
                </a>
            </div>
        </div>

        <!-- قسم فتح المحتوى في التطبيق لمن قام بتثبيته مسبقاً -->
        <div class="already-installed-box">
            <p class="already-installed-label">هل قمت بتثبيت التطبيق مسبقاً على جهازك؟</p>
            <a href="${escapedIntentUrl}" class="btn-open-app" id="open-app-btn">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span>فتح المحتوى في التطبيق الآن</span>
            </a>
        </div>

        <p class="footer-text">منصة الجنيد التعليمية © 2026</p>
    </div>

    <script>
        const appIntentUrl = '${this.escapeForJS(appIntentUrl)}';
        const rawUrl = '${this.escapeForJS(rawUrl)}';
        
        // محاولة الفتح التلقائي على أندرويد إذا كان التطبيق مثبتًا
        // في حال لم يكن التطبيق مثبتًا، يتكفل رابط Intent بتحويله للمتجر أو يبقى المستخدم في صفحة الهبوط
        function attemptRedirect() {
            if (/Android/i.test(navigator.userAgent)) {
                window.location.href = appIntentUrl;
            }
        }

        setTimeout(attemptRedirect, 1000);
    </script>
</body>
</html>`;
  }
}
