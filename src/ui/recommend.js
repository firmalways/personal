(function () {
  "use strict";
  const P = globalThis.FirmAlwaysPage;
  const D = {
    title: ["แนะนำให้องค์กร", "Recommend"],
    intro: ["เอกสารหนึ่งหน้าสำหรับส่งให้หัวหน้า ฝ่าย IT หรือ DPO พิมพ์หรือบันทึกเป็น PDF ได้ ไม่มีข้อมูลการใช้งานของคุณแนบไปด้วย", "A one-page brief for your manager, IT or DPO. Print it or save it as PDF. None of your usage data is included."],
    print: ["พิมพ์ / บันทึกเป็น PDF", "Print / save as PDF"],
    copyLink: ["คัดลอกลิงก์เว็บไซต์", "Copy website link"],
    copied: ["คัดลอกแล้ว", "Copied"],
    h1: ["FirmAlways: ใช้ AI ในองค์กรโดยไม่ทำข้อมูลส่วนบุคคลหลุด", "FirmAlways: use AI at work without leaking personal data"],
    sub: ["AI Security & Governance Harness ที่ทำงานในเครื่อง สร้างในประเทศไทย รองรับภาษาไทย", "A local-first AI security and governance harness, built in Thailand, made for Thai data."],
    hProblem: ["ปัญหา", "The problem"],
    problem: ["พนักงานวางข้อมูลลูกค้า เลขบัตรประชาชน เงินเดือน และรหัสผ่านลงในแชต AI ทุกวัน เมื่อข้อมูลถึงผู้ให้บริการแล้ว องค์กรเรียกคืนไม่ได้ และอาจต้องรับผิดตาม PDPA ตามข้อเท็จจริงของแต่ละกรณี การเขียนคำสั่งให้ AI \"ห้ามเปิดเผย\" ไม่ช่วย เพราะข้อมูลถูกส่งออกไปแล้ว", "Staff paste customer data, ID numbers, salaries and passwords into AI chats every day. Once the provider has it, the organisation cannot take it back, and may be liable under the PDPA depending on the facts. Telling the AI \"do not disclose\" does not help: the data has already left."],
    hWhat: ["FirmAlways ทำอะไร", "What FirmAlways does"],
    w1: ["ตรวจข้อความในเครื่องก่อนส่ง และแทนข้อมูลส่วนบุคคลด้วย placeholder ผู้ใช้ยังเห็นค่าจริงในคำตอบ", "Checks text on the device before it is sent and replaces personal data with placeholders; the user still sees real values in the answer."],
    w2: ["ไม่ส่งรหัสผ่าน API key และข้อมูลอ่อนไหวตามมาตรา 26 ที่อยู่คู่กับตัวบุคคล (ค่าเริ่มต้น)", "Does not send passwords, API keys or section 26 sensitive data about a person (default policy)."],
    w3: ["ตรวจจับข้อมูลไทยได้แม่น: เลขบัตรตรวจ checksum, เบอร์ไทย, ชื่อที่มีคำนำหน้า, ที่อยู่, บัญชีธนาคาร", "Accurate on Thai data: checksum-verified ID numbers, Thai phones, titled names, addresses, bank accounts."],
    w4: ["โอเพนซอร์ส ตรวจสอบโค้ดได้ ไม่เก็บข้อความต้นฉบับ", "Open source, auditable, and it never stores the original text."],
    hStandards: ["ช่วยสนับสนุนกฎหมายและมาตรฐาน", "Supports these laws and standards"],
    colStd: ["ข้อกำหนด", "Requirement"],
    colHow: ["FirmAlways ช่วยอย่างไร", "How FirmAlways helps"],
    s1: ["มาตรการรักษาความมั่นคงปลอดภัยทางเทคนิคเมื่อส่งข้อมูลให้ผู้ให้บริการภายนอก", "A technical security measure when data goes to an outside provider."],
    s2: ["ไม่ส่งข้อมูลอ่อนไหวที่อยู่คู่กับตัวบุคคลโดยค่าเริ่มต้น", "Sensitive data about a person is not sent by default."],
    s3: ["Data masking และ data leakage prevention สำหรับ AI", "Data masking and data leakage prevention for AI."],
    s4: ["บันทึกเหตุการณ์แบบไม่เก็บเนื้อหา ใช้ประกอบการสอบสวนได้ (Gate / Pro)", "Content-free event logs that support an investigation (Gate / Pro)."],
    s5: ["ควบคุมข้อมูลที่ใช้กับระบบ AI และการใช้งาน AI ที่ได้รับอนุญาต", "Controls the data used with AI systems and approved AI use."],
    s6: ["การปกป้องข้อมูลและการสร้างความตระหนักรู้ในการใช้ Generative AI", "Data protection and awareness for generative AI use."],
    disclaimer: ["FirmAlways ไม่ได้ทำให้องค์กรผ่าน PDPA หรือได้รับการรับรอง ISO โดยอัตโนมัติ เป็นเครื่องมือช่วยนำมาตรการไปใช้และสร้างหลักฐานประกอบ ข้อมูลที่แทนด้วย placeholder ที่คืนค่าได้ยังถือเป็นข้อมูลส่วนบุคคล", "FirmAlways does not make an organisation PDPA compliant or ISO certified by itself; it helps put measures in place and produce evidence. Data replaced with reversible placeholders is still personal data."],
    hTiers: ["รุ่นของ FirmAlways", "FirmAlways editions"],
    colFor: ["สำหรับ", "For"],
    colGives: ["สิ่งที่ได้", "What you get"],
    free: ["ฟรี", "Free"],
    t1for: ["พนักงานทุกคน", "Every employee"],
    t1: ["ส่วนขยายเบราว์เซอร์ Privacy Mirror รายงานส่วนตัว ตั้งค่า Basic/Advanced", "Browser extension, Privacy Mirror, personal report, Basic/Advanced settings."],
    t2for: ["ทีมพัฒนาและระบบ AI ขององค์กร", "Developers and the organisation's AI systems"],
    t2: ["AI Gateway, ป้องกัน Coding Agent/MCP/Tool, Policy-as-Code, หลักฐานทางเทคนิค, ติดตั้งเองได้", "AI gateway, coding agent/MCP/tool guard, policy-as-code, technical evidence, self-hosted."],
    t3for: ["IT, CISO และ DPO", "IT, CISO and DPO"],
    t3: ["นโยบายกลางที่พนักงานลดระดับไม่ได้ แยกตามแผนก รายงาน DPO/ROPA หลักฐาน PDPA/ISO", "Central policy staff cannot weaken, per-department rules, DPO/ROPA reports, PDPA/ISO evidence."],
    hPilot: ["เริ่มทดลองในองค์กร", "Start a pilot"],
    pl1: ["ให้ทีมเล็ก 5–10 คนติดตั้ง Personal (ฟรี) 2 สัปดาห์ และดูรายงานของตัวเอง", "Have a team of 5–10 install Personal (free) for two weeks and look at their own reports."],
    pl2: ["ทบทวนประเภทข้อมูลที่พบ กับ DPO และฝ่าย IT", "Review the kinds of data found with the DPO and IT."],
    pl3: ["ถ้าต้องการบังคับนโยบายทั้งองค์กร ติดต่อเรื่อง FirmAlways Pro", "To enforce a policy across the organisation, ask about FirmAlways Pro."],
    noData: ["เอกสารนี้สร้างจาก FirmAlways Personal และไม่มีข้อมูลการใช้งานของผู้ส่ง", "Generated by FirmAlways Personal. It contains none of the sender's usage data."],
  };
  P.load().then((s) => {
    const l = P.lang(s);
    P.header("recommend.html");
    P.translate(D, l);
    document.getElementById("print").addEventListener("click", () => window.print());
    document.getElementById("copyLink").addEventListener("click", async (e) => {
      await navigator.clipboard.writeText("https://firmalways.meapplication.co.th/" + (l === "en" ? "en/" : ""));
      e.target.textContent = P.pick(D.copied, l);
    });
  });
})();
