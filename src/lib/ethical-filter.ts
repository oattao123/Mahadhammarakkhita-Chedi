/**
 * Ethical Alignment & Filtering System
 *
 * Ensures AI responses align with authentic Buddhist teachings
 * and do not provide harmful advice.
 */

// Topics that require careful handling
const SENSITIVE_TOPICS = [
  'ฆ่าตัวตาย', 'suicide', 'self-harm', 'ทำร้ายตัวเอง',
  'อยากตาย', 'ไม่อยากมีชีวิต', 'เบื่อชีวิต',
];

const CRISIS_RESPONSE = `🙏 เราเข้าใจว่าคุณกำลังเผชิญกับช่วงเวลาที่ยากลำบากมาก

หากคุณกำลังมีความคิดทำร้ายตัวเอง กรุณาติดต่อ:
- สายด่วนสุขภาพจิต กรมสุขภาพจิต: 1323 (24 ชั่วโมง)
- สมาริตันส์แห่งประเทศไทย: 02-713-6793

พระพุทธเจ้าตรัสว่า "ชีวิตเป็นสิ่งที่หาได้ยาก" (กิจฺโฉ มนุสฺสปฏิลาโภ)
ทุกข์ทั้งปวงเป็นอนิจจัง ไม่เที่ยง ย่อมผ่านไป

คุณไม่ได้อยู่คนเดียว มีคนพร้อมรับฟังคุณ`;

// Keywords indicating potentially harmful/misleading content
const MISUSE_PATTERNS = [
  // พิธีกรรมอ้างอิงพุทธศาสนาที่ไม่ถูกต้อง
  'เสกคาถา', 'ของขลัง', 'เครื่องราง', 'ดูดวง', 'หมอดู',
  // ข้อมูลที่อาจบิดเบือนคำสอน
  'ไสยศาสตร์',
];

const DISCLAIMER_SUPERSTITION = `⚠️ สิ่งที่คุณถามอาจไม่ใช่แก่นแท้ของพุทธศาสนา พระพุทธเจ้าตรัสไว้ในกาลามสูตรว่าให้ใช้วิจารณญาณพิจารณา ไม่เชื่อสิ่งใดอย่างงมงาย หลักธรรมที่แท้จริงเน้นที่การพัฒนาจิตใจด้วยศีล สมาธิ ปัญญา`;

export interface FilterResult {
  isSafe: boolean;
  isCrisis: boolean;
  needsDisclaimer: boolean;
  crisisResponse?: string;
  disclaimer?: string;
  modifiedQuery?: string;
}

/**
 * Pre-filter: Check user input before sending to LLM
 */
export function preFilter(userMessage: string): FilterResult {
  const messageLower = userMessage.toLowerCase();

  // Check for crisis situations
  for (const term of SENSITIVE_TOPICS) {
    if (messageLower.includes(term)) {
      return {
        isSafe: true,
        isCrisis: true,
        needsDisclaimer: false,
        crisisResponse: CRISIS_RESPONSE,
      };
    }
  }

  // Check for superstition/misuse
  for (const pattern of MISUSE_PATTERNS) {
    if (messageLower.includes(pattern)) {
      return {
        isSafe: true,
        isCrisis: false,
        needsDisclaimer: true,
        disclaimer: DISCLAIMER_SUPERSTITION,
      };
    }
  }

  return {
    isSafe: true,
    isCrisis: false,
    needsDisclaimer: false,
  };
}

/**
 * Build the system prompt with ethical guidelines
 */
export function buildSystemPrompt(ragContext: string): string {
  return `คุณคือ "ธรรมสหาย" (Dhamma Sahāya) — ผู้ช่วย AI ที่ทำหน้าที่เป็นกัลยาณมิตรด้านพุทธศาสนาเถรวาท

## บทบาทของคุณ
- ให้คำแนะนำที่อิงหลักธรรมในพระไตรปิฎก ฉบับมหาจุฬาลงกรณราชวิทยาลัย
- แปลงหลักธรรมให้เป็นภาษาที่เข้าใจง่าย ประยุกต์ใช้ได้จริงในชีวิตประจำวัน
- ผสมผสานมุมมองทางจิตวิทยาเชิงบวกร่วมกับหลักธรรม เช่น เชื่อมโยง "พละ 5" กับ psychological resilience
- ตอบด้วยความเมตตา กรุณา เหมือนพี่เลี้ยงที่ดี

## กฎจริยธรรมที่ต้องปฏิบัติอย่างเคร่งครัด
1. ห้ามสร้างข้อมูลเท็จ — ถ้าไม่แน่ใจ ให้บอกตรงๆ ว่าไม่แน่ใจ
2. ห้ามอ้างพระสูตรที่ไม่มีอยู่จริง — อ้างอิงเฉพาะที่มีในฐานข้อมูลที่ให้ไว้
3. ห้ามให้คำแนะนำที่ขัดกับแก่นคำสอน เช่น ส่งเสริมความรุนแรง ความเกลียดชัง
4. ไม่ตัดสินหรือตำหนิผู้ถาม ไม่ว่าจะถามเรื่องอะไร
5. ไม่อ้างว่าตนเองเป็นพระ ครู หรือผู้รู้ — ชี้แจงว่าเป็น AI ที่ช่วยค้นคว้าเท่านั้น
6. หากเป็นเรื่องสุขภาพจิตที่รุนแรง ให้แนะนำให้พบผู้เชี่ยวชาญ
7. ไม่สนับสนุนไสยศาสตร์ เครื่องรางของขลัง หรือพิธีกรรมที่ไม่ใช่แก่นธรรม

## วิธีตอบ
- ใช้ภาษาไทยที่อบอุ่น สุภาพ เข้าใจง่าย
- อ้างอิงหลักธรรมพร้อมแหล่งที่มา (ชื่อพระสูตร/นิกาย)
- ให้คำแนะนำเชิงปฏิบัติที่ทำได้จริง
- ใส่คำบาลีดั้งเดิมพร้อมคำแปลเมื่อเหมาะสม
- ตอบกระชับ ไม่ยืดเยื้อ แต่ครอบคลุม

## ข้อมูลอ้างอิงจากพระไตรปิฎก (RAG Context)
${ragContext || 'ไม่มีข้อมูลอ้างอิงเพิ่มเติมสำหรับคำถามนี้'}

## หมายเหตุ
- คุณเป็น AI ไม่ใช่พระสงฆ์หรือครูบาอาจารย์ ควรแนะนำให้ศึกษาเพิ่มเติมจากพระไตรปิฎกโดยตรงหรือปรึกษาพระอาจารย์
- ตอบเป็นภาษาไทยเสมอ ยกเว้นคำบาลีที่เป็นศัพท์เฉพาะ`;
}
