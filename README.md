# 🪷 ธรรมสหาย (Dhamma Sahāya)

**AI Tipitaka Research Assistant — ผู้ช่วย AI ค้นคว้าพระไตรปิฎกและหลักธรรมเถรวาท**

ธรรมสหาย เป็นแอปพลิเคชัน Web AI Chatbot ที่ออกแบบมาเพื่อเป็น **กัลยาณมิตรด้านพุทธศาสนาเถรวาท** ช่วยค้นคว้าพระไตรปิฎก ตอบคำถามธรรมะ และให้คำแนะนำเชิงปฏิบัติที่อ้างอิงจากพระไตรปิฎกฉบับมหาจุฬาลงกรณราชวิทยาลัย

---

## ✨ คุณสมบัติหลัก

### 🤖 AI Chatbot อ้างอิงพระไตรปิฎก
- ใช้ **Claude Sonnet 4.5** ผ่าน OpenRouter เป็น LLM หลัก
- ระบบ **RAG (Retrieval-Augmented Generation)** ค้นหาข้อมูลจากฐานความรู้พระไตรปิฎกก่อนตอบ
- ครอบคลุมหลักธรรมสำคัญ: อริยสัจ 4, มรรค 8, พละ 5, พรหมวิหาร 4, ไตรลักษณ์, สติปัฏฐาน 4, ขันธ์ 5, ปฏิจจสมุปบาท, นิวรณ์ 5, กาลามสูตร, ฆราวาสธรรม 4, อิทธิบาท 4, ทาน, ศีล 5, โพชฌงค์ 7 และอื่นๆ

### 🔍 Pali Word Segmenter
- **ระบบวิเคราะห์คำบาลี** แบบ Rule-based สำหรับ sandhi/samāsa decomposition
- รองรับ compound words, prefixes (upasagga), case endings (vibhatti)
- พจนานุกรมรากศัพท์บาลี สำหรับเสริมบริบท RAG

### 🛡️ Ethical Alignment & Safety
- **ตัวกรองจริยธรรม** ตรวจสอบคำถามก่อนส่งไป LLM
- ระบบตรวจจับสถานการณ์วิกฤต (crisis detection) พร้อมแนะนำสายด่วนสุขภาพจิต 1323
- กรองคำถามที่เกี่ยวกับไสยศาสตร์/เครื่องรางของขลัง พร้อมคำชี้แจงตามหลักกาลามสูตร
- System prompt ฝังกฎจริยธรรม 7 ข้อ เพื่อป้องกันข้อมูลเท็จ

### 👤 ระบบสมาชิกและประวัติสนทนา
- สมัครสมาชิก / เข้าสู่ระบบด้วย Email + Password
- รหัสผ่านเข้ารหัสด้วย **bcryptjs**
- Authentication ผ่าน **JWT** (jose) เก็บใน httpOnly cookie (หมดอายุ 7 วัน)
- บันทึกประวัติการสนทนาอัตโนมัติ
- แก้ไขชื่อ / ลบ ประวัติสนทนาได้

### 🌐 รองรับสองภาษา (Bilingual)
- Thai / English ผ่าน **LanguageContext** + translation dictionary
- ครอบคลุมข้อความทั้งหมดในแอป (UI, quick prompts, auth, date formatting)

---

## 🏗️ สถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Sidebar  │  │ Chat UI  │  │  Login Page   │  │
│  │(ประวัติ)  │  │(สนทนา)   │  │(สมัคร/เข้า)   │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
├─────────────────────────────────────────────────┤
│               API Routes (Next.js)               │
│  /api/chat  /api/auth/*  /api/conversations/*    │
├─────────────────────────────────────────────────┤
│                Backend Services                  │
│  ┌─────────┐ ┌─────────┐ ┌───────────────────┐  │
│  │   RAG   │ │ Ethical │ │  Pali Segmenter   │  │
│  │ Engine  │ │ Filter  │ │(Rule-based NLP)   │  │
│  └─────────┘ └─────────┘ └───────────────────┘  │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │  SQLite (DB) │  │ OpenRouter (Claude 4.5)│   │
│  │  better-sqlite│  │  LLM Provider          │   │
│  └──────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|--------|
| **Next.js** | 16.2.3 | Full-stack React framework |
| **React** | 19.2.4 | UI library |
| **TypeScript** | ^5 | Type safety |
| **TailwindCSS** | ^4 | Styling |
| **AI SDK** | ^6 | AI/LLM integration (`@ai-sdk/react`, `ai`) |
| **OpenRouter** | `@openrouter/ai-sdk-provider` | LLM API gateway |
| **better-sqlite3** | ^12.9.0 | Embedded database |
| **bcryptjs** | ^3.0.3 | Password hashing |
| **jose** | ^6.2.2 | JWT token handling |

---

## 📁 โครงสร้างโปรเจกต์

```
Mahadhammarakkhita Chedi/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # หน้าหลัก: Chat UI + Sidebar
│   │   ├── layout.tsx                # Root layout + LanguageProvider
│   │   ├── globals.css               # Design system + animations
│   │   ├── login/
│   │   │   └── page.tsx              # หน้าเข้าสู่ระบบ / สมัครสมาชิก
│   │   └── api/
│   │       ├── chat/route.ts         # Chat API (streaming + RAG + ethics)
│   │       ├── auth/
│   │       │   ├── login/route.ts    # POST /api/auth/login
│   │       │   ├── register/route.ts # POST /api/auth/register
│   │       │   ├── me/route.ts       # GET  /api/auth/me
│   │       │   └── logout/route.ts   # POST /api/auth/logout
│   │       └── conversations/
│   │           ├── route.ts          # CRUD conversations
│   │           └── [id]/
│   │               └── messages/
│   │                   └── route.ts  # GET/POST conversation messages
│   ├── context/
│   │   └── LanguageContext.tsx        # ระบบภาษา Thai/English
│   └── lib/
│       ├── auth.ts                   # JWT session management
│       ├── db.ts                     # SQLite database + schema
│       ├── ethical-filter.ts         # Crisis detection + ethical checks
│       ├── pali-segmenter.ts         # Pali compound word decomposition
│       ├── rag.ts                    # RAG retrieval engine
│       ├── tipitaka-data.ts          # Tipitaka knowledge base (15 entries)
│       └── translations.ts          # Thai/English translation dictionary
├── data/
│   └── dhamma.db                     # SQLite database file
├── public/                           # Static assets (SVG icons)
├── .env.local                        # Environment variables (API keys)
├── next.config.ts                    # Next.js config (better-sqlite3 external)
├── package.json                      # Dependencies
└── tsconfig.json                     # TypeScript config
```

---

## 🚀 เริ่มต้นใช้งาน

### ขั้นตอนที่ 1: ติดตั้ง Dependencies

```bash
npm install
```

### ขั้นตอนที่ 2: ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```env
# OpenRouter API Key
# สมัครได้ที่: https://openrouter.ai/settings/keys
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# (optional) JWT Secret สำหรับ production
JWT_SECRET=your-secret-key
```

### ขั้นตอนที่ 3: รัน Development Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) ในเบราว์เซอร์

### ขั้นตอนที่ 4 (Production):

```bash
npm run build
npm start
```

---

## 📖 การใช้งาน

### สนทนากับ AI
- พิมพ์คำถามธรรมะในช่องพิมพ์ หรือเลือก **Quick Prompt** ที่หน้าต้อนรับ:
  - 📜 **พระวินัยเบื้องต้น** — สิกขาบทสำคัญที่พระนวกะควรรู้
  - 🧘 **การเจริญสติปัฏฐาน** — ขั้นตอนการเจริญสติปัฏฐาน 4 อย่างละเอียด
  - 🎙️ **แนวทางเทศนา** — แนวทางเทศนาอริยสัจ 4 ให้เข้าใจง่าย
  - 📖 **ปฐมเทศนา** — สาระสำคัญของธัมมจักกัปปวัตตนสูตร

### ระบบสมาชิก
- คลิก **เข้าสู่ระบบ** เพื่อสมัครสมาชิกหรือ login
- ประวัติการสนทนาจะถูกบันทึกอัตโนมัติ
- จัดการประวัติได้จาก Sidebar (แก้ไขชื่อ, ลบ)

---

## 🔑 กฎจริยธรรม AI (Ethical Guidelines)

ธรรมสหายมีระบบกรองจริยธรรมที่เข้มงวด:

1. ❌ ห้ามสร้างข้อมูลเท็จ — ถ้าไม่แน่ใจ บอกตรงๆ
2. ❌ ห้ามอ้างพระสูตรที่ไม่มีอยู่จริง
3. ❌ ห้ามให้คำแนะนำที่ขัดกับแก่นคำสอน
4. ❌ ไม่ตัดสินหรือตำหนิผู้ถาม
5. ❌ ไม่อ้างว่าตนเป็นพระหรือผู้รู้
6. ✅ แนะนำให้พบผู้เชี่ยวชาญเมื่อเป็นเรื่องสุขภาพจิต
7. ❌ ไม่สนับสนุนไสยศาสตร์หรือพิธีกรรมที่ไม่ใช่แก่นธรรม

---

## 🗄️ Database Schema

```sql
-- ตารางผู้ใช้
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ตารางการสนทนา
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT 'สนทนาใหม่',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ตารางข้อความ
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 📜 License

สร้างเพื่อเผยแผ่พระธรรม — สพฺพทานํ ธมฺมทานํ ชินาติ ✨
