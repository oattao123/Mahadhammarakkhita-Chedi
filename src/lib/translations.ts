export type Locale = 'th' | 'en';

export const translations = {
  th: {
    // App
    'app.name': 'ธรรมสหาย',
    'app.subtitle': 'ผู้ช่วยค้นคว้าพระไตรปิฎกและหลักธรรมเถรวาท',
    'app.loading': 'กำลังโหลด...',
    'app.disclaimer': 'ธรรมสหายเป็นเครื่องมือ AI อ้างอิงพระไตรปิฎก กรุณาตรวจสอบกับคัมภีร์ต้นฉบับ',

    // Sidebar
    'sidebar.newChat': 'สนทนาใหม่',
    'sidebar.noHistory': 'ยังไม่มีประวัติการสนทนา',
    'sidebar.loginPrompt': 'เข้าสู่ระบบเพื่อบันทึกประวัติ',
    'sidebar.rename': 'แก้ไขชื่อ',
    'sidebar.delete': 'ลบ',
    'sidebar.save': 'บันทึก',
    'sidebar.cancel': 'ยกเลิก',

    // Chat
    'chat.placeholder': 'ถามคำถามธรรมะ หรือค้นคว้าพระไตรปิฎก...',
    'chat.you': 'คุณ',
    'chat.assistant': 'ธรรมสหาย',
    'chat.searching': 'กำลังค้นคว้า...',
    'chat.historySaved': 'ประวัติสนทนาจะถูกบันทึกอัตโนมัติ',
    'chat.loginToSave': 'เข้าสู่ระบบเพื่อบันทึกประวัติการสนทนา',

    // Welcome
    'welcome.greeting': 'นมัสการ',
    'welcome.defaultGreeting': 'ธรรมสหาย',
    'welcome.subtitle': 'ค้นคว้าพระไตรปิฎก พระวินัย พระสูตร พระอภิธรรม',

    // Quick prompts
    'prompt.vinaya': 'พระวินัยเบื้องต้น',
    'prompt.vinaya.text': 'สิกขาบทสำคัญที่พระนวกะควรรู้',
    'prompt.meditation': 'การเจริญสติปัฏฐาน',
    'prompt.meditation.text': 'ขั้นตอนการเจริญสติปัฏฐาน 4 อย่างละเอียด',
    'prompt.sermon': 'แนวทางเทศนา',
    'prompt.sermon.text': 'แนวทางเทศนาอริยสัจ 4 ให้เข้าใจง่ายสำหรับคนรุ่นใหม่',
    'prompt.sutta': 'ปฐมเทศนา',
    'prompt.sutta.text': 'สาระสำคัญของธัมมจักกัปปวัตตนสูตร',

    // Auth
    'auth.login': 'เข้าสู่ระบบ',
    'auth.register': 'สร้างบัญชีใหม่',
    'auth.logout': 'ออกจากระบบ',
    'auth.name': 'ชื่อ / ฉายา',
    'auth.namePlaceholder': 'เช่น พระมหาสมชาย',
    'auth.email': 'อีเมล',
    'auth.emailPlaceholder': 'example@email.com',
    'auth.password': 'รหัสผ่าน',
    'auth.passwordPlaceholder': 'รหัสผ่าน',
    'auth.passwordMinLength': 'อย่างน้อย 6 ตัวอักษร',
    'auth.loginButton': 'เข้าสู่ระบบ',
    'auth.registerButton': 'สร้างบัญชี',
    'auth.processing': 'กำลังดำเนินการ...',
    'auth.hasAccount': 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ',
    'auth.noAccount': 'ยังไม่มีบัญชี? สร้างบัญชีใหม่',
    'auth.secureNote': 'ข้อมูลของท่านจะถูกเก็บรักษาอย่างปลอดภัย',
    'auth.connectionError': 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
    'auth.serverError': 'เซิร์ฟเวอร์เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
    'auth.loginOrRegister': 'เข้าสู่ระบบ / สมัครสมาชิก',
    'auth.error': 'เกิดข้อผิดพลาด',

    // Date formatting
    'date.justNow': 'เมื่อสักครู่',
    'date.minutesAgo': 'นาทีที่แล้ว',
    'date.hoursAgo': 'ชม.ที่แล้ว',
    'date.daysAgo': 'วันที่แล้ว',

    // Language
    'lang.switch': 'EN',

    // Google OAuth
    'auth.continueWithGoogle': 'ดำเนินการต่อด้วย Google',
    'auth.or': 'หรือ',
    'auth.oauthError': 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่',
    'auth.oauthNoSecret': 'ระบบยังไม่ได้ตั้งค่า Google Client Secret — กรุณาตั้งค่า GOOGLE_CLIENT_SECRET ใน Environment Variables',
    'auth.oauthStateFailed': 'Cookie หมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
    'auth.oauthTokenFailed': 'ไม่สามารถยืนยันตัวตนกับ Google ได้ — ตรวจสอบ Client ID/Secret',

    // Documents
    'doc.upload': 'อัปโหลดเอกสาร',
    'doc.uploading': 'กำลังอัปโหลด...',
    'doc.uploadSuccess': 'อัปโหลดสำเร็จ',
    'doc.uploadError': 'อัปโหลดไม่สำเร็จ',
    'doc.myDocuments': 'เอกสารของฉัน',
    'doc.noDocuments': 'ยังไม่มีเอกสาร',
    'doc.pages': 'หน้า',
    'doc.deleteConfirm': 'ลบเอกสารนี้?',
    'doc.supportedFormats': 'รองรับ PDF, TXT, MD',
    'doc.loginToUpload': 'เข้าสู่ระบบเพื่ออัปโหลดเอกสาร',

    // Pali Reader / TTS
    'pali.speak': 'อ่านออกเสียง',
    'pali.stop': 'หยุด',
    'pali.speaking': 'กำลังอ่าน...',
    'pali.loading': 'กำลังเตรียม...',
    'pali.speed': 'ความเร็ว',

    // Dataset
    'dataset.title': 'คลังข้อมูลธรรม',
    'dataset.ingest': 'นำเข้าข้อมูล',
    'dataset.ingesting': 'กำลังนำเข้า...',
    'dataset.done': 'นำเข้าสำเร็จ',
    'dataset.error': 'นำเข้าไม่สำเร็จ',
    'dataset.count': 'เอกสาร',
    'dataset.files': 'ไฟล์',
  },

  en: {
    // App
    'app.name': 'Dhamma Sahāya',
    'app.subtitle': 'Tipitaka Research Assistant for Theravāda Buddhism',
    'app.loading': 'Loading...',
    'app.disclaimer': 'Dhamma Sahāya is an AI tool referencing the Tipitaka. Please verify with original scriptures.',

    // Sidebar
    'sidebar.newChat': 'New Chat',
    'sidebar.noHistory': 'No conversation history',
    'sidebar.loginPrompt': 'Log in to save history',
    'sidebar.rename': 'Rename',
    'sidebar.delete': 'Delete',
    'sidebar.save': 'Save',
    'sidebar.cancel': 'Cancel',

    // Chat
    'chat.placeholder': 'Ask about Dhamma or search the Tipitaka...',
    'chat.you': 'You',
    'chat.assistant': 'Dhamma Sahāya',
    'chat.searching': 'Searching...',
    'chat.historySaved': 'Chat history is saved automatically',
    'chat.loginToSave': 'Log in to save chat history',

    // Welcome
    'welcome.greeting': 'Welcome',
    'welcome.defaultGreeting': 'Dhamma Sahāya',
    'welcome.subtitle': 'Search the Tipitaka — Vinaya, Sutta, Abhidhamma',

    // Quick prompts
    'prompt.vinaya': 'Vinaya Basics',
    'prompt.vinaya.text': 'Important precepts every new monk should know',
    'prompt.meditation': 'Satipaṭṭhāna Practice',
    'prompt.meditation.text': 'Step-by-step guide to the Four Foundations of Mindfulness',
    'prompt.sermon': 'Sermon Guidance',
    'prompt.sermon.text': 'How to explain the Four Noble Truths to modern audiences',
    'prompt.sutta': 'First Sermon',
    'prompt.sutta.text': 'Key teachings of the Dhammacakkappavattana Sutta',

    // Auth
    'auth.login': 'Log In',
    'auth.register': 'Create Account',
    'auth.logout': 'Log Out',
    'auth.name': 'Name / Monastic Title',
    'auth.namePlaceholder': 'e.g. Phra Maha Somchai',
    'auth.email': 'Email',
    'auth.emailPlaceholder': 'example@email.com',
    'auth.password': 'Password',
    'auth.passwordPlaceholder': 'Password',
    'auth.passwordMinLength': 'At least 6 characters',
    'auth.loginButton': 'Log In',
    'auth.registerButton': 'Create Account',
    'auth.processing': 'Processing...',
    'auth.hasAccount': 'Already have an account? Log in',
    'auth.noAccount': "Don't have an account? Create one",
    'auth.secureNote': 'Your data is kept safe and secure.',
    'auth.connectionError': 'Cannot connect to server',
    'auth.serverError': 'Server error. Please try again.',
    'auth.loginOrRegister': 'Log In / Register',
    'auth.error': 'An error occurred',

    // Date formatting
    'date.justNow': 'Just now',
    'date.minutesAgo': 'min ago',
    'date.hoursAgo': 'hr ago',
    'date.daysAgo': 'days ago',

    // Language
    'lang.switch': 'TH',

    // Google OAuth
    'auth.continueWithGoogle': 'Continue with Google',
    'auth.or': 'or',
    'auth.oauthError': 'Google sign-in failed. Please try again.',
    'auth.oauthNoSecret': 'GOOGLE_CLIENT_SECRET is not configured — please set it in Environment Variables',
    'auth.oauthStateFailed': 'Session cookie expired or invalid. Please try again.',
    'auth.oauthTokenFailed': 'Could not authenticate with Google — check Client ID/Secret',

    // Documents
    'doc.upload': 'Upload Document',
    'doc.uploading': 'Uploading...',
    'doc.uploadSuccess': 'Uploaded successfully',
    'doc.uploadError': 'Upload failed',
    'doc.myDocuments': 'My Documents',
    'doc.noDocuments': 'No documents yet',
    'doc.pages': 'pages',
    'doc.deleteConfirm': 'Delete this document?',
    'doc.supportedFormats': 'Supports PDF, TXT, MD',
    'doc.loginToUpload': 'Log in to upload documents',

    // Pali Reader / TTS
    'pali.speak': 'Read aloud',
    'pali.stop': 'Stop',
    'pali.speaking': 'Reading...',
    'pali.loading': 'Preparing...',
    'pali.speed': 'Speed',

    // Dataset
    'dataset.title': 'Dhamma Library',
    'dataset.ingest': 'Import Dataset',
    'dataset.ingesting': 'Importing...',
    'dataset.done': 'Import complete',
    'dataset.error': 'Import failed',
    'dataset.count': 'documents',
    'dataset.files': 'files',
  },
} as const;

export type TranslationKey = keyof typeof translations.th;
