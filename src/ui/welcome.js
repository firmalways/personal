(function () {
  "use strict";
  const P = globalThis.FirmAlwaysPage;
  const D = {
    title: ["เริ่มต้นใช้งาน", "Get started"],
    h1: ["ใช้ AI ได้เหมือนเดิม โดยข้อมูลส่วนตัวไม่หลุดออกไป", "Use AI as you always do, without your personal data leaving"],
    lead: ["FirmAlways Personal ตรวจข้อความในเครื่องของคุณก่อนส่งให้ ChatGPT, Claude, Gemini, Copilot, Perplexity และ DeepSeek ใช้บัญชีเดิมได้ ไม่ต้องมี API key ไม่ต้องติดตั้งโปรแกรมอื่น", "FirmAlways Personal checks your text on your device before it goes to ChatGPT, Claude, Gemini, Copilot, Perplexity and DeepSeek. Keep your account. No API key, nothing else to install."],
    hHow: ["ทำงานอย่างไร", "How it works"],
    step1: ["เมื่อคุณวางข้อความหรือกดส่ง FirmAlways ตรวจหาข้อมูลส่วนบุคคล ข้อมูลอ่อนไหว และรหัสลับ", "When you paste or press send, FirmAlways looks for personal data, sensitive data and secrets."],
    step2: ["ข้อมูลส่วนบุคคลถูกแทนด้วย placeholder เช่น «PHONE_1» ส่วนรหัสผ่านและข้อมูลอ่อนไหวจะไม่ถูกส่ง", "Personal data is replaced with placeholders such as «PHONE_1»; passwords and sensitive data are not sent."],
    step3: ["เมื่อ AI ตอบ หน้าจอของคุณแสดงค่าจริงกลับมา คนอื่นและผู้ให้บริการ AI ไม่เห็น", "When the AI answers, your screen shows the real values again. Nobody else, including the AI provider, sees them."],
    exYou: ["คุณพิมพ์: ช่วยร่างข้อความถึงคุณสมศรี โทร 089-765-4321", "You type: Draft a message to คุณสมศรี, phone 089-765-4321"],
    exAi: ["AI ได้รับ: ช่วยร่างข้อความถึงคุณ«PERSON_1» โทร «PHONE_1»", "The AI gets: Draft a message to คุณ«PERSON_1», phone «PHONE_1»"],
    hChoose: ["Basic หรือ Advanced ใช้ฟรีทั้งคู่", "Basic or Advanced, both free"],
    chooseText: ["ค่าเริ่มต้นคือ Basic Mode ตามชุดนโยบาย Thailand PDPA Baseline และ Developer Secret Protection ถ้าอยากควบคุมเอง เปิด Advanced Mode เพื่อเลือกการทำงานรายประเภท เพิ่มคำลับ และสร้างกฎของคุณ", "You start in Basic mode with the Thailand PDPA Baseline and Developer Secret Protection packs. Switch to Advanced mode to set each data type, add your own keywords and write your own rules."],
    trySample: ["ลองสแกนตัวอย่าง", "Try a sample scan"],
    openSettings: ["เปิดหน้าตั้งค่า", "Open settings"],
    hPromise: ["สิ่งที่เราสัญญา", "Our promise"],
    p1: ["ข้อความของคุณถูกตรวจในเครื่องนี้ ส่วนขยายนี้ไม่ส่งข้อความไปที่ FirmAlways หรือที่อื่น", "Your text is checked on this device. The extension sends nothing to FirmAlways or anyone else."],
    p2: ["ค่าจริงที่ซ่อนไว้อยู่ในหน่วยความจำ และหายไปเมื่อปิดเบราว์เซอร์", "Masked real values stay in memory and are gone when the browser closes."],
    p3: ["รายงานเก็บเฉพาะจำนวนและประเภทข้อมูล ไม่เก็บข้อความ", "The report keeps counts and data types only, never text."],
    p4: ["ฟรีตลอด ไม่จำกัดจำนวนข้อความ และไม่ลดความแม่นยำเพื่อให้อัปเกรด", "Free for good, no message limits, and detection is never weakened to make you upgrade."],
    hLimits: ["สิ่งที่ยังไม่ครอบคลุม", "What it does not cover yet"],
    l1: ["ไฟล์และรูปภาพที่อัปโหลดเข้าเว็บ AI (ใช้หน้าสแกนเอกสารเพื่อทำฉบับที่ปลอดภัยก่อน)", "Files and images uploaded to the AI site (use Scan text to make a safe copy first)."],
    l2: ["แอปมือถือ แอปเดสก์ท็อป และการพูดด้วยเสียง", "Mobile apps, desktop apps and voice input."],
    l3: ["ชื่อที่ไม่มีคำนำหน้า และข้อมูลที่ระบุตัวตนได้จากบริบทเท่านั้น", "Names without a title, and data that identifies someone only from context."],
    l4: ["ข้อความที่พิมพ์เองจะอยู่ในช่องพิมพ์ของเว็บก่อนกดส่ง เว็บนั้นอ่านได้ทางเทคนิค (เช่น ระบบบันทึกร่าง) การวางข้อความปลอดภัยกว่า เพราะถูกตรวจก่อนเข้าไปในช่อง ค่าจริงที่แสดงในคำตอบก็อยู่บนหน้าเว็บนั้นเช่นกัน", "Text you type sits in the site's box before you press send, so the site can technically read it (for example to save drafts). Pasting is safer because it is checked before it enters the box. Real values shown in answers are on that page too."],
  };
  P.load().then((s) => {
    P.header("welcome.html");
    P.translate(D, P.lang(s));
  });
})();
