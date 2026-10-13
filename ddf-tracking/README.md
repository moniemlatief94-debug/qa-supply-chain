# DDF Tracking — تطبيق تتبع تحميل وتنزيل الثلاجات

تطبيق ويب مجاني ومفتوح المصدر (MIT) يطابق نموذج **DAL Food – QA – DDF Tracking**.
يعمل على الهاتف ويُثبَّت كتطبيق، ويعمل **بدون إنترنت**، وبياناته في قاعدة بيانات داخل الهاتف (IndexedDB).

## المميزات
- نفس حقول النموذج: Operation، Driver، Plate No، Truck operation type، Load From/Date، Receiving/Offloading Date، أوقات وحرارة البدء والانتهاء.
- 10 أسئلة Yes/No (تظهر الإجابة "No" بالأحمر).
- جدول الأصناف: Loaded QTY، UOM، Product Info (رقم الباتش/الانتهاء)، Attachments (صور)، Damage QTY، Damage % (يُحسب تلقائياً).
- Truck condition، Issues، Root Cause، Corrective action، Preventive action، Reported By.
- **تنزيل بالباتش**: زر «Offload this load» ينشئ تقرير Offloading مرتبطاً بنفس الحمولة وبنفس أرقام الباتش.
- حفظ تلقائي، ترقيم تلقائي (DDF-2026-0001)، بحث بالباتش/اللوحة/السائق.
- تقرير ملخص + تصدير CSV (Excel) + طباعة/PDF + نسخة احتياطية JSON (مع الصور).

## الشعار
الشعار في `logo.png` وأيقونات التثبيت `icon-*.png`. لاستبداله بنسخة أعلى جودة: ضع ملفاً بنفس الأسماء (أيقونات 192 و512 مربعة).

## التشغيل
الملفات ثابتة (HTML/JS فقط) — لا تحتاج سيرفر ولا قاعدة بيانات خارجية.

**للتجربة السريعة:** افتح `index.html` في Chrome.

**النشر التلقائي:** عند رفع المشروع إلى GitHub فعّل Settings ← Pages ← Source: **GitHub Actions**، فيُنشر الموقع تلقائياً عند كل push إلى `main` على `https://<username>.github.io/<repo>/`.

**للتثبيت على الهاتف (مجاناً):** ارفع كل الملفات على أي استضافة ثابتة مجانية، مثل:
- Netlify Drop: https://app.netlify.com/drop (اسحب المجلد فقط)
- GitHub Pages أو Cloudflare Pages

ثم افتح الرابط في Chrome على الهاتف ← القائمة ⋮ ← **Install app / إضافة إلى الشاشة الرئيسية**.

## ملاحظات
- البيانات محفوظة في كل هاتف على حدة. خذ **نسخة احتياطية** من الإعدادات بانتظام.
- قائمة الأصناف والقوائم المنسدلة وحد الحرارة تُعدَّل من **Settings**.
- إن احتجتم قاعدة بيانات مشتركة بين عدة هواتف، يمكن ربط التطبيق لاحقاً بـ Supabase أو PocketBase (مفتوحا المصدر).
