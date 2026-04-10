# المستشار المالي — CFO Intelligence System v4

نظام ذكاء مالي متكامل لمديري الشؤون المالية، مبني بـ React + TypeScript + tRPC + SQLite.

---

## 🚀 التشغيل السريع (محلي)

### المتطلبات
- Node.js 20+
- npm 10+

### الخطوات

```bash
# 1. نسخ المشروع
git clone https://github.com/YOUR_USERNAME/cfo-intelligence.git
cd cfo-intelligence

# 2. تثبيت المكتبات
npm install

# 3. إعداد متغيرات البيئة
cp .env.example .env
# عدّل .env وغيّر JWT_SECRET

# 4. تهيئة قاعدة البيانات (يُنشئ المستخدمين والشركات التجريبية)
npm run db:seed

# 5. تشغيل المشروع
npm run dev
```

افتح المتصفح على: **http://localhost:5173**

---

## 🔑 بيانات الدخول الافتراضية

| الدور | البريد الإلكتروني | كلمة المرور |
|-------|------------------|-------------|
| CFO Admin | admin@cfo.local | Admin@2024 |
| مدير | ahmed@cfo.local | Ahmed@123 |
| محاسب | fatima@cfo.local | Fatima@123 |
| مدقق | mkandari@cfo.local | Mohammed@123 |

> ⚠️ **غيّر كلمات المرور فوراً في بيئة الإنتاج**

---

## 🐳 التشغيل بـ Docker

```bash
# بناء وتشغيل
docker-compose up -d

# عرض السجلات
docker-compose logs -f

# إيقاف
docker-compose down
```

التطبيق سيعمل على: **http://localhost:3001**

---

## ☁️ النشر على الإنترنت

### الخيار 1: Railway (مجاني — الأسهل)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### الخيار 2: Render
1. ادفع الكود على GitHub
2. اذهب إلى render.com → New Web Service
3. اربط الـ repository
4. Build Command: `npm install && npm run build && npm run db:seed`
5. Start Command: `npm start`
6. أضف متغيرات البيئة من `.env.example`

### الخيار 3: VPS (Ubuntu)
```bash
# على السيرفر
git clone https://github.com/YOUR_USERNAME/cfo-intelligence.git
cd cfo-intelligence
npm install
cp .env.example .env
nano .env  # عدّل JWT_SECRET وضع NODE_ENV=production

npm run build
npm run db:seed
npm start

# للتشغيل الدائم مع PM2
npm install -g pm2
pm2 start "npm start" --name cfo-system
pm2 save
pm2 startup
```

---

## 📁 هيكل المشروع

```
cfo-intelligence/
├── client/                 # React Frontend (Vite)
│   ├── index.html
│   └── src/
│       ├── App.tsx         # Root component + auth routing
│       ├── main.tsx        # Entry point
│       ├── lib/trpc.ts     # tRPC client
│       └── pages/
│           ├── LoginPage.tsx    # صفحة تسجيل الدخول
│           └── Dashboard.tsx    # لوحة التحكم الرئيسية
├── server/
│   ├── index.ts            # Express server
│   ├── router.ts           # tRPC routers (auth, users, company, journal)
│   ├── db.ts               # SQLite connection
│   ├── auth.ts             # JWT + bcrypt
│   └── seed.ts             # تهيئة قاعدة البيانات
├── drizzle/
│   └── schema.ts           # 8 جداول (users, companies, journal_entries...)
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔒 نظام الصلاحيات (RBAC)

| الدور | الصلاحيات |
|-------|-----------|
| `cfo_admin` | تحكم كامل: المستخدمون، الشركات، كل التقارير |
| `manager` | التقارير والتحليلات + إدارة محدودة |
| `accountant` | رفع البيانات + القوائم المالية |
| `auditor` | عرض فقط (قراءة) |
| `partner` | لوحة التحكم + التقارير الأساسية |
| `custom` | صلاحيات مخصصة |

---

## 🛠️ أوامر مفيدة

```bash
npm run dev          # تشغيل المشروع (frontend + backend معاً)
npm run dev:server   # الباك إند فقط (port 3001)
npm run dev:client   # الفرونت إند فقط (port 5173)
npm run build        # بناء للإنتاج
npm run db:seed      # تهيئة قاعدة البيانات
npm run db:studio    # فتح Drizzle Studio لعرض قاعدة البيانات
```

---

## 🔧 متغيرات البيئة

```env
PORT=3001                          # منفذ الخادم
NODE_ENV=production                # development أو production
JWT_SECRET=your-secret-key-here   # مفتاح JWT (32+ حرف)
VITE_API_URL=http://localhost:3001 # عنوان API للـ frontend
```

---

## 📡 API Endpoints (tRPC)

```
POST /trpc/auth.login          - تسجيل الدخول → JWT token
GET  /trpc/auth.me             - بيانات المستخدم الحالي
POST /trpc/auth.changePassword - تغيير كلمة المرور

GET  /trpc/company.list        - قائمة الشركات
POST /trpc/company.create      - إنشاء شركة جديدة
POST /trpc/company.delete      - حذف شركة

GET  /trpc/users.list          - قائمة المستخدمين
POST /trpc/users.create        - إنشاء مستخدم
POST /trpc/users.update        - تعديل مستخدم
POST /trpc/users.delete        - حذف مستخدم
POST /trpc/users.grantAccess   - منح صلاحية لشركة

GET  /trpc/journal.listEntries - القيود المحاسبية (pagination)
GET  /trpc/journal.trialBalance - ميزان المراجعة
GET  /trpc/journal.syncStatus  - حالة المزامنة

GET  /trpc/audit.getLogs       - سجل النشاط
```

---

## 🤝 المساهمة

1. Fork المشروع
2. أنشئ branch جديد: `git checkout -b feature/اسم-الميزة`
3. Commit التغييرات: `git commit -m "إضافة: وصف الميزة"`
4. Push: `git push origin feature/اسم-الميزة`
5. افتح Pull Request

---

**تم تطويره بـ ❤️ لمديري الشؤون المالية في منطقة الخليج العربي**
