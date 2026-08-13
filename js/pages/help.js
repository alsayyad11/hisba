/* ============================================================
   HISBA — HOW TO USE GUIDE
   ============================================================ */
import { getLanguage, renderIcon } from '../utils.js?v=locale-preference-v1';

const content = {
  ar: {
    title: 'إزاي أستخدم التطبيق؟',
    sub: 'حِسبة مش مجرد دفتر مصروفات؛ هو طريقة بسيطة تساعدك تعرف فلوسك راحت فين، وتاخد قرارات أهدى وأوضح.',
    flowTitle: 'رحلة حِسبة في دقيقة',
    flowSub: 'الفكرة كلها إنك تسجّل، تراجع، وتقرر. كل ما بياناتك كانت كاملة، الصورة قدامك تبقى أدق.',
    ruleTitle: 'القاعدة الذهبية: سجّل كل جنيه فورًا',
    ruleText: 'أول ما تدفع أو تستلم فلوس، سجّلها في حِسبة قبل ما تنساها. حتى المصروف الصغير مهم؛ لأن المصاريف الصغيرة لما تتجمع ممكن تغيّر نتيجة الشهر كله.',
    ruleAction: 'سجّل أول معاملة',
    journeyTitle: 'رحلتك مع حِسبة خطوة بخطوة',
    journeySub: 'مش مطلوب تغيّر عاداتك كلها مرة واحدة. ابدأ بخطوة بسيطة، وحِسبة هيساعدك تكمل.',
    steps: [
      ['01', 'اعمل حسابك وجهّز بياناتك', 'سجّل الدخول وأضف الكاش أو البنك أو البطاقة اللي بتستخدمها. اكتب الرصيد الحالي علشان الأرقام تبدأ من نقطة صحيحة.', 'accounts', 'افتح الحسابات'],
      ['02', 'سجّل كل دخل ومصروف أولًا بأول', 'اضغط «إضافة معاملة»، اختار دخل أو مصروف، واكتب المبلغ والفئة والحساب والتاريخ. ما تعتمدش على الذاكرة آخر اليوم.', 'transactions', 'أضف معاملة'],
      ['03', 'راجع لوحة التحكم', 'لوحة التحكم بتلخّص لك الرصيد والدخل والمصروفات وصافي المدخرات. مع الوقت هتشوف نمط إنفاقك بدل ما تتوقعه.', 'dashboard', 'افتح لوحة التحكم'],
      ['04', 'حط ميزانية واقعية', 'اختار فئة واحدة أو أكثر، وحدد مبلغًا مناسبًا للشهر. حِسبة ينبهك عند الاقتراب من الحد أو تجاوزه.', 'budgets', 'أنشئ ميزانية'],
      ['05', 'ابدأ هدف توفير صغير', 'حدد حاجة نفسك توصل لها ومبلغها، وبعدها تابع تقدمك. الهدف الصغير الواضح أسهل من قرار عام مثل «لازم أوفّر».', 'goals', 'أضف هدف توفير'],
      ['06', 'راجع واتعلم من أرقامك', 'قارن الشهور، شوف أكثر الفئات إنفاقًا، واستخدم التقرير Excel أو PDF لما تحتاج صورة كاملة عن مصروفاتك.', 'reports', 'افتح التقارير'],
      ['07', 'استخدمه بدون إنترنت', 'لو النت فصل، كمّل تسجيل عادي. البيانات تتحفظ على جهازك، ولما الاتصال يرجع تتم المزامنة مع حسابك تلقائيًا.', 'dashboard', 'ارجع للوحة التحكم'],
    ],
    benefitTitle: 'هتستفيد من حِسبة إزاي؟',
    benefits: [
      ['تشوف الحقيقة', 'بدل ما تقول «مش عارف فلوسي راحت فين»، هتشوف كل مبلغ اتصرف فين وإمتى.'],
      ['تقلل النسيان', 'تسجيل المصروف وقت حدوثه يمنع الفجوة بين اللي حصل فعلًا واللي فاكره.'],
      ['تاخد قرار أهدى', 'لما تعرف أرقامك، تقدر تقلل فئة معينة أو تزود التوفير من غير تخمين.'],
      ['تتابع هدفك', 'الميزانيات والتنبيهات وأهداف التوفير بتحوّل النية إلى خطوات قابلة للمتابعة.'],
    ],
    detailsTitle: 'كل قسم بيعمل إيه؟',
    details: [
      ['لوحة التحكم', 'ملخص سريع لأهم أرقامك، وآخر المعاملات، وحالة الميزانيات. افتحها كل يوم أو كل يومين لدقيقة واحدة.'],
      ['المعاملات', 'المكان الأساسي لكل دخل ومصروف. كل ما كتبت الفئة والوصف والتاريخ بدقة، تقاريرك هتبقى أنفع.'],
      ['الحسابات', 'اجمع الكاش والبنوك والبطاقات في مكان واحد، واعرف رصيد كل حساب بدل ما تفتش في أكثر من تطبيق.'],
      ['الميزانيات', 'حط حدًا للإنفاق. هتوصلك تنبيهات عند 80% وعند تجاوز 100%، فتقدر تتصرف قبل نهاية الشهر.'],
      ['أهداف التوفير', 'حوّل حاجة نفسك فيها إلى هدف بمبلغ وتقدم واضح، واحتفل بالتقدم حتى لو كان صغيرًا.'],
      ['التقارير', 'قارن الشهور وحلل الفئات وصدّر Excel أو PDF لو محتاج تراجع أو تشارك ملخص مصروفاتك.'],
      ['الإعدادات', 'غيّر اللغة والعملة والمظهر، وراجع بيانات حسابك وتفضيلاتك.'],
      ['بدون إنترنت', 'سجّل وعدّل بياناتك عادي. البيانات تفضل محفوظة على جهازك، والمزامنة تستأنف تلقائياً عند رجوع الإنترنت.'],
    ],
    faqTitle: 'أشهر الأسئلة والإجابات',
    faq: [
      ['هل لازم أسجل كل مصروف حتى لو مبلغ صغير؟', 'آه، وده أهم استخدام لحِسبة. المصروف الصغير لو اتكرر كتير ممكن يبقى جزءًا كبيرًا من إنفاقك. سجّله وقت ما يحصل علشان ما تنساهوش.'],
      ['أعمل إيه لو نسيت أسجل المصروف؟', 'سجّله أول ما تفتكره، وحاول تضيف التاريخ الصحيح والوصف. ولو بتنسى كثير، افتح حِسبة بعد الشراء مباشرة وخلي التسجيل عادة قصيرة.'],
      ['هل أقدر أستخدم التطبيق من غير إنترنت؟', 'أيوه. تقدر تضيف وتراجع البيانات بدون اتصال. التطبيق يحفظها محليًا، وبعد رجوع الإنترنت يزامنها مع حسابك.'],
      ['هل بيانات التطبيق هتظهر على الويب؟', 'أيوه، بشرط تسجيل الدخول بالحساب نفسه وانتظار اكتمال المزامنة عند وجود الإنترنت.'],
      ['أبدأ بميزانية لكل الفئات؟', 'الأفضل تبدأ بفئة أو فئتين مهمتين، مثل الأكل والمواصلات. لما تتعود، زوّد الفئات تدريجيًا.'],
      ['إيه الفرق بين الحساب والمعاملة؟', 'الحساب هو مكان الفلوس، مثل الكاش أو البنك. المعاملة هي الحركة التي حصلت على الحساب، مثل دفع 100 جنيه أو استلام دخل.'],
      ['إزاي أستفيد من التقارير؟', 'راجعها في نهاية كل أسبوع أو شهر. ركّز على أكثر فئة زادت، وقارنها بالشهر السابق، ثم اختار تغييرًا واحدًا قابلًا للتنفيذ.'],
      ['هل لازم يكون الشهر مثالي؟', 'لا. الهدف إنك تفهم عاداتك وتتحسن تدريجيًا. الاستمرار أهم من تسجيل مثالي لمدة أسبوع ثم التوقف.'],
    ],
    tipsTitle: 'عادات صغيرة تفرق',
    tips: ['سجّل المصروف لحظة حدوثه، قبل ما الذاكرة تلخبط التفاصيل.', 'افتح لوحة التحكم دقيقة واحدة كل يومين.', 'راجع الميزانية في منتصف الشهر، مش بعد ما تخلص.', 'ابدأ بتغيير واحد صغير يمكن الاستمرار عليه.', 'لو فاتتك معاملة، ارجع سجّلها بدل ما تسيب اليوم كله.'],
    quote: 'كل جنيه بتعرف راح فين، بيقرّبك خطوة من قرار مالي أهدى.',
    quoteBy: 'رسالة حِسبة اليوم',
    privacyTitle: 'بياناتك في أمان',
    privacy: 'بياناتك مرتبطة بحسابك. تقدر تستخدم التطبيق محليًا أثناء عدم الاتصال، ولا تشارك كلمة المرور مع أي شخص.',
  },
  'ar-fusha': {
    title: 'كيف أستخدم التطبيق؟',
    sub: 'حِسبة ليس مجرد دفتر للمصروفات؛ بل وسيلة بسيطة تساعدك على معرفة أين تذهب أموالك واتخاذ قرارات أكثر هدوءاً ووضوحاً.',
    flowTitle: 'رحلة حِسبة في دقيقة',
    flowSub: 'الفكرة بسيطة: سجّل، وراجع، وقرّر. وكلما اكتملت بياناتك، أصبحت الصورة أمامك أدق.',
    ruleTitle: 'القاعدة الذهبية: سجّل كل جنيه فوراً',
    ruleText: 'عند إنفاق المال أو استلامه، سجّله في حِسبة قبل أن تنساه. فالمصروفات الصغيرة مهمة أيضاً؛ إذ يمكن لتكرارها أن يغيّر نتيجة الشهر كله.',
    ruleAction: 'سجّل أول معاملة',
    journeyTitle: 'رحلتك مع حِسبة خطوة بخطوة',
    journeySub: 'لا يلزم أن تغيّر عاداتك كلها دفعة واحدة. ابدأ بخطوة بسيطة، ودع حِسبة يساعدك على الاستمرار.',
    steps: [
      ['01', 'أنشئ حساباتك وأعدّ بياناتك', 'سجّل الدخول وأضف النقد أو الحساب البنكي أو البطاقة التي تستخدمها. أدخل الرصيد الحالي لتبدأ الأرقام من نقطة صحيحة.', 'accounts', 'افتح الحسابات'],
      ['02', 'سجّل كل دخل ومصروف فور حدوثه', 'اضغط «إضافة معاملة»، ثم اختر دخلاً أو مصروفاً وأدخل المبلغ والفئة والحساب والتاريخ. لا تعتمد على الذاكرة في نهاية اليوم.', 'transactions', 'أضف معاملة'],
      ['03', 'راجع لوحة التحكم', 'تلخّص لوحة التحكم رصيدك ودخلك ومصروفاتك وصافي مدخراتك. ومع الوقت ستتعرف إلى نمط إنفاقك بدل التخمين.', 'dashboard', 'افتح لوحة التحكم'],
      ['04', 'ضع ميزانية واقعية', 'اختر فئة واحدة أو أكثر، وحدّد مبلغاً مناسباً للشهر. ينبهك حِسبة عند الاقتراب من الحد أو تجاوزه.', 'budgets', 'أنشئ ميزانية'],
      ['05', 'ابدأ بهدف ادخار صغير', 'حدّد ما تريد الوصول إليه ومبلغه، ثم تابع تقدّمك. فالهدف الصغير الواضح أسهل من نية عامة بالادخار.', 'goals', 'أضف هدف ادخار'],
      ['06', 'راجع أرقامك وتعلّم منها', 'قارن بين الشهور، واعرف الفئات الأعلى إنفاقاً، وصدّر تقرير Excel أو PDF عند الحاجة إلى صورة كاملة عن مصروفاتك.', 'reports', 'افتح التقارير'],
      ['07', 'استخدمه دون اتصال بالإنترنت', 'إذا انقطع الاتصال، فتابع التسجيل بصورة طبيعية. تحفظ بياناتك على جهازك وتُزامن مع حسابك عند عودة الاتصال.', 'dashboard', 'عُد إلى لوحة التحكم'],
    ],
    benefitTitle: 'كيف يفيدك حِسبة؟',
    benefits: [
      ['تعرف الحقيقة', 'بدلاً من التساؤل أين ذهبت أموالك، سترى أين أُنفِق كل مبلغ ومتى.'],
      ['تقلل النسيان', 'يسد تسجيل المصروف عند حدوثه الفجوة بين ما حدث فعلاً وما تتذكره.'],
      ['تتخذ قرارات أكثر هدوءاً', 'عندما تعرف أرقامك، يمكنك تقليل الإنفاق في فئة معينة أو زيادة الادخار دون تخمين.'],
      ['تتابع تقدّمك', 'تحوّل الميزانيات والتنبيهات وأهداف الادخار النوايا الجيدة إلى خطوات ظاهرة قابلة للمتابعة.'],
    ],
    detailsTitle: 'ماذا يفعل كل قسم؟',
    details: [
      ['لوحة التحكم', 'عرض سريع لأهم أرقامك وآخر المعاملات وحالة الميزانيات. افتحها لدقيقة كل يوم أو يومين.'],
      ['المعاملات', 'المكان الأساسي لكل دخل ومصروف. تجعل الفئات والملاحظات والتواريخ الدقيقة تقاريرك أكثر فائدة.'],
      ['الحسابات', 'اجمع النقد والبنوك والبطاقات في مكان واحد، واعرف رصيد كل حساب دون البحث في تطبيقات متعددة.'],
      ['الميزانيات', 'ضع حدوداً للإنفاق وتلقَّ تنبيهات عند 80٪ وبعد تجاوز 100٪، لتتمكن من التصرف قبل نهاية الشهر.'],
      ['أهداف الادخار', 'حوّل ما تريده إلى هدف ذي مبلغ وتقدّم واضحين، وقدّر كل خطوة صغيرة.'],
      ['التقارير', 'قارن بين الشهور، وحلّل الفئات، وصدّر تقارير Excel أو PDF عند الحاجة.'],
      ['الإعدادات', 'غيّر اللغة والعملة والمظهر، وراجع تفضيلات حسابك.'],
      ['الاستخدام دون اتصال', 'أضف البيانات وعدّلها بصورة طبيعية. تحفظ بياناتك على الجهاز وتُستأنف المزامنة تلقائياً عند عودة الاتصال.'],
    ],
    faqTitle: 'الأسئلة الشائعة',
    faq: [
      ['هل يلزم تسجيل المصروفات الصغيرة جداً؟', 'نعم. هذه من أهم عادات استخدام حِسبة؛ فقد تشكّل المصروفات الصغيرة المتكررة جزءاً كبيراً من إنفاقك، لذا سجّلها قبل أن تنساها.'],
      ['ماذا أفعل إذا نسيت تسجيل مصروف؟', 'سجّله بمجرد أن تتذكره، وأضف التاريخ والوصف الصحيحين. وإذا تكرر ذلك، افتح حِسبة مباشرة بعد الشراء واجعل التسجيل عادة قصيرة.'],
      ['هل يمكن استخدام التطبيق دون إنترنت؟', 'نعم. يمكنك إضافة البيانات ومراجعتها دون اتصال. يحفظها التطبيق محلياً ثم يزامنها مع حسابك عند عودة الاتصال.'],
      ['هل ستظهر بيانات التطبيق على الويب؟', 'نعم، عند تسجيل الدخول بالحساب نفسه والسماح للمزامنة بالاكتمال أثناء الاتصال بالإنترنت.'],
      ['هل ينبغي إنشاء ميزانية لكل فئة؟', 'من الأفضل أن تبدأ بفئة أو فئتين مهمتين، مثل الطعام والمواصلات، ثم تضيف فئات أخرى تدريجياً.'],
      ['ما الفرق بين الحساب والمعاملة؟', 'الحساب هو المكان الذي تُحفَظ فيه أموالك، مثل النقد أو البنك. أما المعاملة فهي الحركة التي حدثت في ذلك الحساب، مثل إنفاق 100 جنيه أو استلام دخل.'],
      ['كيف أستفيد من التقارير؟', 'راجعها أسبوعياً أو شهرياً. لاحظ الفئة التي زاد إنفاقها، وقارنها بالشهر السابق، ثم اختر تغييراً عملياً واحداً.'],
      ['هل يجب أن يكون كل شهر مثالياً؟', 'لا. الهدف هو فهم عاداتك والتحسن تدريجياً. الاستمرار أهم من أسبوع مثالي يتبعه التوقف.'],
    ],
    tipsTitle: 'عادات صغيرة تصنع فرقاً',
    tips: ['سجّل المصروف عند حدوثه قبل أن تضيع التفاصيل من الذاكرة.', 'افتح لوحة التحكم لدقيقة كل يومين.', 'راجع ميزانيتك في منتصف الشهر، لا في نهايته فقط.', 'اختر تغييراً صغيراً يمكنك الاستمرار عليه.', 'إذا فاتتك معاملة، فأضفها لاحقاً بدلاً من ترك اليوم كله.'],
    quote: 'كل جنيه تعرف أين ذهب يقرّبك خطوة من قرار مالي أكثر هدوءاً.',
    quoteBy: 'رسالة حِسبة اليوم',
    privacyTitle: 'بياناتك في أمان',
    privacy: 'ترتبط بياناتك بحسابك. يمكنك استخدام التطبيق محلياً أثناء عدم الاتصال، ولا تشارك كلمة المرور مع أي شخص.',
  },
  en: {
    title: 'How to use the app?',
    sub: 'Hisba is more than an expense log. It helps you understand where your money goes and make calmer, clearer decisions.',
    flowTitle: 'Hisba in one minute',
    flowSub: 'The idea is simple: record, review, and decide. The more complete your data, the clearer the picture becomes.',
    ruleTitle: 'The golden rule: record every amount right away',
    ruleText: 'As soon as you spend or receive money, record it in Hisba before you forget. Small expenses matter too; repeated small amounts can change the whole month.',
    ruleAction: 'Record your first transaction',
    journeyTitle: 'Your Hisba journey, step by step',
    journeySub: 'You do not need to change every habit at once. Start small and let Hisba help you stay consistent.',
    steps: [
      ['01', 'Set up your accounts', 'Sign in and add the cash, bank, or card accounts you use. Enter each current balance so your numbers start from the right point.', 'accounts', 'Open accounts'],
      ['02', 'Record every income and expense', 'Tap Add transaction, choose income or expense, and enter the amount, category, account, and date. Do not rely on memory at the end of the day.', 'transactions', 'Add a transaction'],
      ['03', 'Review the dashboard', 'The dashboard summarizes your balance, income, expenses, and savings. Over time, you will see your spending patterns instead of guessing.', 'dashboard', 'Open dashboard'],
      ['04', 'Set a realistic budget', 'Choose one or more categories and set a monthly amount. Hisba alerts you as you approach or exceed the limit.', 'budgets', 'Create a budget'],
      ['05', 'Start a small savings goal', 'Choose something you want to reach and set its target amount. A clear small goal is easier to follow than a general intention to save.', 'goals', 'Add a savings goal'],
      ['06', 'Review and learn from your numbers', 'Compare months, see your highest-spending categories, and export an Excel or PDF report when you need a complete view.', 'reports', 'Open reports'],
      ['07', 'Use it offline', 'If the internet goes down, keep recording normally. Your data stays on the device and syncs with your account when you reconnect.', 'dashboard', 'Back to dashboard'],
    ],
    benefitTitle: 'How does Hisba help you?',
    benefits: [
      ['See the truth', 'Instead of wondering where your money went, you can see what each amount was spent on and when.'],
      ['Forget less', 'Recording an expense when it happens prevents the gap between what really happened and what you remember.'],
      ['Make calmer decisions', 'Once you know your numbers, you can adjust a category or increase savings without guessing.'],
      ['Track progress', 'Budgets, alerts, and savings goals turn good intentions into visible actions.'],
    ],
    detailsTitle: 'What does each section do?',
    details: [
      ['Dashboard', 'A quick view of your key numbers, recent transactions, and budget status. Open it for one minute every day or two.'],
      ['Transactions', 'The main place for every income and expense. Accurate categories, notes, and dates make reports more useful.'],
      ['Accounts', 'Keep cash, banks, and cards together and see each balance without searching through multiple apps.'],
      ['Budgets', 'Set spending limits and receive alerts at 80% and after passing 100%, so you can act before the month ends.'],
      ['Savings goals', 'Turn something you want into a target with visible progress, and value every small step.'],
      ['Reports', 'Compare months, analyze categories, and export Excel or PDF reports when needed.'],
      ['Settings', 'Change language, currency, and appearance, and review your account preferences.'],
      ['Offline mode', 'Add and edit data normally. Your data stays saved on the device, and sync resumes automatically when you reconnect.'],
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      ['Do I need to record very small expenses?', 'Yes. That is one of the most important habits in Hisba. Small repeated expenses can become a large part of your spending, so record them before you forget.'],
      ['What if I forgot to record an expense?', 'Record it as soon as you remember and add the correct date and description. If it happens often, open Hisba immediately after a purchase and make it a short habit.'],
      ['Can I use the app without internet?', 'Yes. You can add and review data offline. The app saves it locally and syncs it with your account when the connection returns.'],
      ['Will my app data appear on the web?', 'Yes, when you sign in with the same account and allow the sync to finish while online.'],
      ['Should I create a budget for every category?', 'It is better to start with one or two important categories, such as food and transport, then add more gradually.'],
      ['What is the difference between an account and a transaction?', 'An account is where your money is held, such as cash or a bank. A transaction is what happened there, such as spending 100 or receiving income.'],
      ['How should I use reports?', 'Review them weekly or monthly. Notice which category increased, compare it with the previous month, and choose one practical change.'],
      ['Does every month need to be perfect?', 'No. The goal is to understand your habits and improve gradually. Consistency matters more than a perfect week followed by stopping.'],
    ],
    tipsTitle: 'Small habits that make a difference',
    tips: ['Record an expense when it happens, before memory loses the details.', 'Open the dashboard for one minute every couple of days.', 'Review your budget halfway through the month, not only at the end.', 'Choose one small change you can sustain.', 'If you miss a transaction, add it later instead of abandoning the whole day.'],
    quote: 'Every amount you understand brings you one step closer to calmer financial decisions.',
    quoteBy: 'Today’s Hisba message',
    privacyTitle: 'Your data stays protected',
    privacy: 'Your data is linked to your account. You can use the app locally while offline, and you should never share your password.',
  },
};

function go(page) { window.dispatchEvent(new CustomEvent('navigate', { detail: { page } })); }

export async function initHelp() {
  const language = getLanguage();
  const copy = content[language] || (language.startsWith('ar') ? content.ar : content.en);
  const isAr = language.startsWith('ar');
  const el = document.getElementById('page-content');
  if (!el) return;
  el.innerHTML = `
    <section class="page-header"><div><h1 class="page-title">${copy.title}</h1><p class="page-subtitle">${copy.sub}</p></div></section>
    <section class="help-hero card"><div class="help-hero-icon">?</div><div><h2>${copy.flowTitle}</h2><p>${copy.flowSub}</p></div></section>
    <section class="help-rule card"><div class="help-rule-icon">!</div><div><h2>${copy.ruleTitle}</h2><p>${copy.ruleText}</p><button class="btn btn-primary btn-sm help-route" data-page="transactions">${copy.ruleAction} <span aria-hidden="true">${isAr ? '←' : '→'}</span></button></div></section>
    <section class="help-section"><div class="section-heading"><h2>${copy.journeyTitle}</h2><p class="text-muted">${copy.journeySub}</p></div><div class="help-journey">${copy.steps.map(([n, title, desc, page, action]) => `<article class="card help-step help-journey-step"><div class="help-number">${n}</div><div class="help-step-content"><h3>${title}</h3><p>${desc}</p><button class="btn btn-ghost btn-sm help-route" data-page="${page}">${action} <span aria-hidden="true">${isAr ? '←' : '→'}</span></button></div></article>`).join('')}</div></section>
    <section class="help-section"><div class="section-heading"><h2>${copy.benefitTitle}</h2></div><div class="help-details-grid">${copy.benefits.map(([title, desc]) => `<article class="card help-detail"><h3>${title}</h3><p>${desc}</p></article>`).join('')}</div></section>
    <section class="help-section"><div class="section-heading"><h2>${copy.detailsTitle}</h2></div><div class="help-details-grid">${copy.details.map(([title, desc]) => `<article class="card help-detail"><h3>${title}</h3><p>${desc}</p></article>`).join('')}</div></section>
    <section class="help-section"><div class="section-heading"><h2>${copy.faqTitle}</h2></div><div class="help-faq">${copy.faq.map(([q, a]) => `<details class="card help-faq-item"><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>
    <section class="help-lower-grid"><article class="card help-quote"><div class="help-quote-mark">“</div><p>${copy.quote}</p><span>${copy.quoteBy}</span></article><article class="card help-tips"><h3>${copy.tipsTitle}</h3><ul>${copy.tips.map(tip => `<li><span>${renderIcon('check', 14)}</span>${tip}</li>`).join('')}</ul></article></section>
    <div class="card help-privacy"><h3>${copy.privacyTitle}</h3><p>${copy.privacy}</p></div>
  `;
  el.querySelectorAll('.help-route').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.page)));
}

