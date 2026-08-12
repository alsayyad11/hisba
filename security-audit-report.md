# تقرير التدقيق الأمني لتطبيق حِسبة

**تاريخ التدقيق:** 12 أغسطس 2026  
**النطاق:** نسخة الويب، أصول Capacitor/Android، خدمات Supabase، المصادقة، التخزين المحلي، رفع الصور، التصدير، وسياسات النشر.

## خلاصة تنفيذية

أُجري تدقيق عملي على الكود الحالي ومسارات التشغيل، مع التركيز على مخاطر OWASP Top 10 المناسبة لتطبيق مالي يعمل بنمط offline-first. لا يمكن اعتبار أي مراجعة برمجية ضماناً لانعدام الثغرات بنسبة 100%، كما أن سياسات قاعدة البيانات تعتمد على تنفيذ ملف SQL المرفق داخل مشروع Supabase نفسه. بعد الإصلاحات، نجح فحص JavaScript وJSON، ونجح `npm audit --omit=dev` دون ثغرات إنتاجية معلنة، كما نجح بناء APK Debug.

| المجال | النتيجة | الإجراء |
|---|---|---|
| الاعتماديات الإنتاجية | لا توجد ثغرات npm إنتاجية في الفحص | تم التحقق بواسطة npm audit |
| تسريب service-role | لم يظهر service-role في الملفات المفحوصة | تم الإبقاء على المفتاح العام فقط، وهو ليس بديلاً عن RLS |
| جلسات الدخول | كان التطبيق يكرر session داخل localStorage | أزيل التخزين اليدوي للجلسة، وأصبح Supabase هو مدير الجلسة الوحيد |
| التخزين والصور | كان الكود يستخدم public URL رغم وجود سياسة bucket خاص | أصبح الرفع يعتمد على signed URL، مع تخزين مسار الكائن فقط |
| XSS وCSP | كانت إعدادات CSP غير موجودة، وكان HTML يحتوي سكربتات inline | أزيلت سكربتات الإعداد والـ login inline، وأضيفت CSP ورؤوس حماية |
| RLS | توجد سياسات تقيد الصفوف بـ `auth.uid()` | تم تجهيز SQL تقوية قابل للمراجعة والتنفيذ في Supabase |
| Android | كانت الأصول قديمة مقارنة بالويب | تمت مزامنة الأصول وإعادة بناء APK بنجاح |

## الإصلاحات المنفذة

تم إنشاء `js/runtime-config.js` و`js/login.js` لإزالة سكربتات inline من صفحات HTML، ثم أضيفت سياسة Content Security Policy في `vercel.json` تسمح فقط بالمصادر الضرورية: التطبيق نفسه، jsDelivr لمكتبة Supabase، Google Fonts، ومشروع Supabase المحدد. أضيفت كذلك رؤوس `Permissions-Policy` و`Cross-Origin-Opener-Policy` مع الإبقاء على `X-Frame-Options`, `X-Content-Type-Options`, و`Referrer-Policy`.

تم تعديل خدمة المصادقة حتى لا تعتمد على `hisba_cached_session` أو أي session يدوي يمكن العبث به من JavaScript آخر. ما زال Supabase يدير الجلسة المستمرة وفق إعداداته، بينما تُستخدم البيانات المحلية للعرض offline فقط ولا تُعامل كإثبات هوية أو تفويض.

تم تعديل صور الحساب لتُرفع إلى bucket خاص، ثم تُعرض بروابط موقعة مؤقتاً. لا ينبغي تشغيل هذا المسار قبل تنفيذ `supabase_security_hardening.sql` داخل Supabase، لأن التوافق بين خصوصية bucket وسياسات Storage ضروري.

## مراجعة OWASP

| الفئة | التقييم الحالي | الملاحظة |
|---|---|---|
| A01 Broken Access Control | يحتاج تنفيذ SQL | يجب تفعيل RLS على كل الجداول الخاصة والتأكد من عدم وجود policy أوسع من `auth.uid()` |
| A02 Cryptographic Failures | جيد بعد الإصلاح | لا تُخزن session يدوياً؛ يجب استخدام HTTPS وSupabase Auth وعدم تسجيل التوكنات |
| A03 Injection | متوسط/جيد | توجد قوالب `innerHTML` كثيرة؛ يجب إبقاء `escapeHTML` إلزامية لكل بيانات المستخدم وعدم إدخال HTML من قاعدة البيانات |
| A04 Insecure Design | متوسط | offline cache مناسب للعرض، لكنه لا يمنح صلاحيات ولا يجب استخدامه لتجاوز المصادقة |
| A05 Security Misconfiguration | تحسن | تمت إضافة CSP ورؤوس أمان؛ يلزم نشر `vercel.json` فعلياً واختبار الرؤوس على النطاق النهائي |
| A06 Vulnerable Components | جيد في فحص الإنتاج | `npm audit --omit=dev` أظهر صفر ثغرات؛ يجب إعادة الفحص مع كل تحديث |
| A07 Authentication Failures | تحسن | Supabase يدير الجلسة؛ يجب ضبط MFA، سياسات كلمة المرور، وحدود المحاولات من لوحة Supabase |
| A08 Software/Data Integrity | متوسط | مكتبة Supabase محملة من jsDelivr؛ يفضّل تثبيتها محلياً أو تثبيت نسخة دقيقة مع SRI عند النشر النهائي |
| A09 Logging/Monitoring | يحتاج إعداداً خارج الكود | فعّل Auth logs وDatabase logs وStorage logs والتنبيهات في Supabase |
| A10 SSRF | منخفض في هذا التطبيق | لا توجد خدمة خادم تستقبل URL من المستخدم، لكن يجب عدم إضافة proxy عام لاحقاً |

## إجراء مطلوب داخل Supabase

شغّل الملف `supabase_security_hardening.sql` بعد مراجعة أسماء الجداول والأعمدة في مشروعك. الملف يفعّل RLS للملفات الشخصية والحسابات والمعاملات والميزانيات والأهداف والفواتير والفئات، ويقيد القراءة والكتابة بـ `auth.uid()`. كما يجعل bucket `avatars` خاصاً ويقيد مساراته بالمستخدم الحالي.

يجب بعد التنفيذ اختبار مستخدمين مختلفين: المستخدم الأول لا يستطيع قراءة أو تعديل أو حذف أي صف يخص المستخدم الثاني، ولا يستطيع رفع صورة خارج مجلده، ولا يستطيع تعديل `user_id` إلى مستخدم آخر. يجب أيضاً التأكد من عدم وجود service-role key في الواجهة أو APK أو مستودع Git.

## التحقق المنفذ

تم تنفيذ فحص الصياغة لـ `js/app.js`, `js/pages/dashboard.js`, `js/pages/settings.js`, `js/services/auth.js`, `js/login.js`, و`js/runtime-config.js`. تم التحقق من صحة `vercel.json` و`manifest.json`، ومن تقديم ملفات HTML وCSS وJavaScript عبر الخادم المحلي. كما نجح `npm audit --omit=dev` دون ثغرات إنتاجية، ونجح `./gradlew assembleDebug --no-daemon`.

## مخاطر متبقية يجب عدم تجاهلها

البيانات المحلية قد تكون قابلة للقراءة من جهاز مكسور الحماية أو من JavaScript مصاب؛ لذلك لا ينبغي اعتبارها مخزناً آمناً للأسرار أو بديلاً عن RLS. كما أن الاعتماد على مكتبة خارجية من CDN يظل مخاطرة سلسلة توريد، ويُستحسن تثبيت النسخة محلياً في الإصدار النهائي. وأخيراً، يلزم اختبار اختراق خارجي وتفعيل مراقبة Supabase قبل اعتبار التطبيق جاهزاً للإنتاج المالي.

## مراجع

[1]: https://owasp.org/Top10/2021/ OWASP Top 10:2021  
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security Supabase Row Level Security  
[3]: https://supabase.com/docs/guides/storage/security/access-control Supabase Storage Access Control  
[4]: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP Content Security Policy — MDN  
[5]: https://docs.npmjs.com/cli/v10/commands/npm-audit npm audit Documentation
