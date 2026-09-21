import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
 
  getRedirectPage(type: 'course' | 'lesson' | 'post', id: string): string {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>منصة الجنيد التعليمية | Algonaid</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #00E676;
            --primary-glow: rgba(0, 230, 118, 0.35);
            --bg-gradient: radial-gradient(circle at 50% 50%, #0d1f14 0%, #080d0a 100%);
            --card-bg: rgba(20, 32, 25, 0.65);
            --text-main: #FFFFFF;
            --text-muted: #B3C5BD;
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

        /* Ambient Glowing Background Blobs */
        body::before, body::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            border-radius: 50%;
            background: var(--primary);
            filter: blur(120px);
            opacity: 0.15;
            z-index: 0;
            pointer-events: none;
        }

        body::before {
            top: -50px;
            right: -50px;
        }

        body::after {
            bottom: -50px;
            left: -50px;
        }

        .container {
            width: 100%;
            max-width: 480px;
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 230, 118, 0.15);
            border-radius: 24px;
            padding: 40px 30px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            z-index: 10;
            position: relative;
            animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .logo-area {
            position: relative;
            display: inline-block;
            margin-bottom: 24px;
        }

        .logo-icon {
            width: 80px;
            height: 80px;
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
            0% {
                box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.4);
            }
            70% {
                box-shadow: 0 0 0 20px rgba(0, 230, 118, 0);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(0, 230, 118, 0);
            }
        }

        .logo-icon svg {
            width: 44px;
            height: 44px;
            fill: white;
        }

        h1 {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 10px;
            background: linear-gradient(to left, #fff, #a3f7c9);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            font-size: 0.95rem;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 30px;
        }

        .loader-dots {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 6px;
            margin-bottom: 35px;
        }

        .dot {
            width: 10px;
            height: 10px;
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
            font-size: 1.1rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s ease;
            cursor: pointer;
            margin-bottom: 16px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #00E676 0%, #00C853 100%);
            color: #05140b;
            border: none;
            box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 230, 118, 0.5);
            background: linear-gradient(135deg, #00FF87 0%, #00E676 100%);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-main);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(0, 230, 118, 0.3);
        }

        .store-buttons {
            display: flex;
            gap: 12px;
            margin-top: 24px;
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
            background: rgba(0, 230, 118, 0.05);
            border-color: rgba(0, 230, 118, 0.25);
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
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-area">
            <div class="logo-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z"/>
                </svg>
            </div>
        </div>
        <h1>منصة الجنيد التعليمية</h1>
        <p class="subtitle" id="status-msg">جاري فتح المحتوى داخل التطبيق الخاص بك...</p>
        
        <div class="loader-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>

        <a href="#" class="btn btn-primary" id="open-app-btn">افتح في التطبيق الآن</a>
        
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 20px 0 10px;">ليس لديك التطبيق بعد؟ حمله الآن:</p>
        
        <div class="store-buttons">
            <a href="https://play.google.com/store/apps/details?id=com.algonaid.app" class="store-btn" target="_blank">
                <svg viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.42,12.1L17.87,12.87L16.55,12L17.87,11.33M3,3.41L17.3,10.56L14,12.21L3,3.41M3,20.59L14,11.79L17.3,13.44L3,20.59Z"/>
                </svg>
                Google Play
            </a>
            <a href="https://apps.apple.com/app/id-demo" class="store-btn" target="_blank">
                <svg viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z"/>
                </svg>
                App Store
            </a>
        </div>

        <p class="footer-text">منصة الجنيد التعليمية © 2026</p>
    </div>

    <script>
        const type = '${type}';
        const id = '${id}';
        
        let path = '';
        if (type === 'course') path = 'modulesList';
        else if (type === 'post') path = 'posts';
        else path = 'lessonDetails';
        
        const rawUrl = 'https://api.exchangesmangement.online/' + path + '/' + id;
        
        // 1. Set the dynamic target link for "Open in App" button
        const appIntentUrl = 'intent://api.exchangesmangement.online/' + path + '/' + id + '#Intent;scheme=https;package=com.algonaid.app;end';
        const openAppBtn = document.getElementById('open-app-btn');
        openAppBtn.href = appIntentUrl;

        // 2. Set dynamic text content
        const statusMsg = document.getElementById('status-msg');
        let msg = 'جاري فتح المحتوى في تطبيق منصة الجنيد...';
        if (type === 'course') msg = 'جاري فتح محتوى الدورة في تطبيق منصة الجنيد...';
        else if (type === 'post') msg = 'جاري فتح المنشور في تطبيق منصة الجنيد...';
        else if (type === 'lesson') msg = 'جاري فتح تفاصيل الدرس في تطبيق منصة الجنيد...';
        statusMsg.innerText = msg;

        // 3. Auto-redirect attempts
        function attemptRedirect() {
            if (/Android/i.test(navigator.userAgent)) {
                window.location.href = appIntentUrl;
            } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                window.location.href = rawUrl;
            } else {
                statusMsg.innerText = 'هذا الرابط مخصص للفتح عبر تطبيق منصة الجنيد على الهاتف.';
            }
        }

        setTimeout(attemptRedirect, 800);
    </script>
</body>
</html>`;
  }
}

