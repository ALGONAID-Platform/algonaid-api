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
      details.push('اضغط هنا للدخول للاختبار والمنافسة عبر تطبيق منصة الجنيد');
      description = details.join(' • ');
    }

    let imageUrl = exam?.imageUrl || exam?.course?.thumbnail || '';
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = imageUrl.startsWith('/')
        ? `https://api.exchangesmangement.online${imageUrl}`
        : `https://api.exchangesmangement.online/${imageUrl}`;
    }

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
      subHeader: exam?.course?.title ? `كورس: ${exam.course.title}` : undefined,
      chips,
      statusMessage: 'جاري توجيهك لفتح الاختبار في تطبيق منصة الجنيد...',
    });
  }

  /**
   * صفحة التوجيه العامة (للكورسات والدروس والمنشورات)
   */
  async getRedirectPage(type: 'course' | 'lesson' | 'post' | 'exam', id: string): Promise<string> {
    if (type === 'exam') {
      return this.getExamRedirectPage(id);
    }

    let path = 'lessonDetails';
    let contentName = 'الدرس';
    let badgeEmoji = '📖';

    if (type === 'course') {
      path = 'modulesList';
      contentName = 'محتوى الدورة';
      badgeEmoji = '🎓';
    } else if (type === 'post') {
      path = 'posts';
      contentName = 'المنشور';
      badgeEmoji = '📢';
    }

    const pageTitle = `${contentName} | منصة الجنيد التعليمية`;
    const description = `افتح ${contentName} مباشرة داخل تطبيق منصة الجنيد التعليمية.`;

    return this.renderRedirectPage({
      pageTitle,
      rawTitle: 'منصة الجنيد التعليمية',
      description,
      path,
      id,
      badgeEmoji,
      badgeText: contentName,
      statusMessage: `جاري فتح ${contentName} داخل تطبيق منصة الجنيد...`,
    });
  }

  /**
   * القالب الموحد لتوليد صفحة HTML أنيقة متضمنة وسوم Open Graph وإعادة التوجيه إلى التطبيق
   */
  private renderRedirectPage(config: RedirectPageConfig): string {
    const safeId = this.escapeForJS(config.id);
    const safePath = this.escapeForJS(config.path);
    const rawUrl = `https://api.exchangesmangement.online/${safePath}/${safeId}`;
    const appIntentUrl = `intent://api.exchangesmangement.online/${safePath}/${safeId}#Intent;scheme=https;package=com.algonaid.app;end`;

    const escapedPageTitle = this.escapeHtml(config.pageTitle);
    const escapedRawTitle = this.escapeHtml(config.rawTitle);
    const escapedDesc = this.escapeHtml(config.description);
    const escapedImg = this.escapeHtml(config.imageUrl);
    const escapedRawUrl = this.escapeHtml(rawUrl);
    const escapedIntentUrl = this.escapeHtml(appIntentUrl);
    const escapedSubHeader = this.escapeHtml(config.subHeader);
    const escapedBadgeText = this.escapeHtml(config.badgeText || 'منصة الجنيد');
    const badgeEmoji = config.badgeEmoji || '✨';
    const statusMessage = this.escapeHtml(config.statusMessage || 'جاري فتح المحتوى داخل تطبيق منصة الجنيد...');

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

    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #00E676;
            --primary-glow: rgba(0, 230, 118, 0.35);
            --bg-gradient: radial-gradient(circle at 50% 50%, #0d1f14 0%, #080d0a 100%);
            --card-bg: rgba(20, 32, 25, 0.7);
            --text-main: #FFFFFF;
            --text-muted: #B3C5BD;
            --chip-bg: rgba(0, 230, 118, 0.08);
            --chip-border: rgba(0, 230, 118, 0.2);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Cairo', 'Outfit', sans-serif;
            background: var(--bg-gradient);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-x: hidden;
            position: relative;
        }

        body::before, body::after {
            content: '';
            position: absolute;
            width: 320px;
            height: 320px;
            border-radius: 50%;
            background: var(--primary);
            filter: blur(120px);
            opacity: 0.15;
            z-index: 0;
            pointer-events: none;
        }

        body::before { top: -60px; right: -60px; }
        body::after { bottom: -60px; left: -60px; }

        .container {
            width: 100%;
            max-width: 480px;
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 230, 118, 0.18);
            border-radius: 24px;
            padding: 36px 28px;
            text-align: center;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.55);
            z-index: 10;
            position: relative;
            animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(28px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(0, 230, 118, 0.12);
            color: var(--primary);
            border: 1px solid rgba(0, 230, 118, 0.3);
            padding: 6px 14px;
            border-radius: 30px;
            font-size: 0.85rem;
            font-weight: 700;
            margin-bottom: 16px;
        }

        .banner-wrapper {
            width: 100%;
            height: 180px;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
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
            margin-bottom: 20px;
        }

        .logo-icon {
            width: 76px;
            height: 76px;
            background: linear-gradient(135deg, #00E676 0%, #00B0FF 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
            box-shadow: 0 0 25px var(--primary-glow);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.4); }
            70% { box-shadow: 0 0 0 18px rgba(0, 230, 118, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); }
        }

        .logo-icon svg {
            width: 42px;
            height: 42px;
            fill: white;
        }

        h1 {
            font-size: 1.55rem;
            font-weight: 800;
            margin-bottom: 8px;
            line-height: 1.35;
            background: linear-gradient(to left, #ffffff, #a3f7c9);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .sub-header {
            font-size: 0.95rem;
            color: #81C784;
            font-weight: 600;
            margin-bottom: 14px;
        }

        .chips-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
            margin: 16px 0 20px;
        }

        .chip {
            background: var(--chip-bg);
            border: 1px solid var(--chip-border);
            color: #E0E0E0;
            padding: 5px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .subtitle {
            font-size: 0.92rem;
            color: var(--text-muted);
            line-height: 1.55;
            margin-bottom: 24px;
        }

        .loader-dots {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 6px;
            margin-bottom: 28px;
        }

        .dot {
            width: 9px;
            height: 9px;
            background-color: var(--primary);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 16px 24px;
            border-radius: 16px;
            font-size: 1.05rem;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.3s ease;
            cursor: pointer;
            margin-bottom: 14px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #00E676 0%, #00C853 100%);
            color: #05140b;
            border: none;
            box-shadow: 0 4px 16px rgba(0, 230, 118, 0.35);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 22px rgba(0, 230, 118, 0.55);
            background: linear-gradient(135deg, #00FF87 0%, #00E676 100%);
        }

        .store-buttons {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }

        .store-btn {
            flex: 1;
            padding: 10px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.85rem;
            transition: all 0.2s ease;
        }

        .store-btn:hover {
            background: rgba(0, 230, 118, 0.06);
            border-color: rgba(0, 230, 118, 0.28);
            color: var(--text-main);
        }

        .store-btn svg {
            width: 20px;
            height: 20px;
            fill: currentColor;
        }

        .footer-text {
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.3);
            margin-top: 24px;
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

        <p class="subtitle" id="status-msg">${statusMessage}</p>
        
        <div class="loader-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>

        <a href="${escapedIntentUrl}" class="btn btn-primary" id="open-app-btn">افتح في التطبيق الآن</a>
        
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 18px 0 10px;">ليس لديك التطبيق بعد؟ حمله الآن مجاناً:</p>
        
        <div class="store-buttons">
            <a href="https://play.google.com/store/apps/details?id=com.algonaid.app" class="store-btn" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.42,12.1L17.87,12.87L16.55,12L17.87,11.33M3,3.41L17.3,10.56L14,12.21L3,3.41M3,20.59L14,11.79L17.3,13.44L3,20.59Z"/>
                </svg>
                Google Play
            </a>
            <a href="https://apps.apple.com/app/id-demo" class="store-btn" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z"/>
                </svg>
                App Store
            </a>
        </div>

        <p class="footer-text">منصة الجنيد التعليمية © 2026</p>
    </div>

    <script>
        const appIntentUrl = '${this.escapeForJS(appIntentUrl)}';
        const rawUrl = '${this.escapeForJS(rawUrl)}';
        
        function attemptRedirect() {
            if (/Android/i.test(navigator.userAgent)) {
                window.location.href = appIntentUrl;
            } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                window.location.href = rawUrl;
            } else {
                const statusMsg = document.getElementById('status-msg');
                if (statusMsg) {
                    statusMsg.innerText = 'هذا الرابط مخصص للفتح عبر تطبيق منصة الجنيد على الهواتف الذكية.';
                }
            }
        }

        setTimeout(attemptRedirect, 800);
    </script>
</body>
</html>`;
  }
}
