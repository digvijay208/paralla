const { chromium } = require("playwright-core");

const EXE = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://localhost:48113/";
const SHOT = (n) => (process.env.TEMP || "C:/Temp") + "/t-" + n + ".png";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 160));
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1. content present
  const h1raw = ((await page.textContent("h1")) || "").replace(/ /g, " ");
  check("hero headline", h1raw.includes("Parallel agents"));
  check("gradient line", h1raw.includes("one window"));
  check("CTA buttons", (await page.locator(".hero .btn").count()) === 2);
  check("agent cards", (await page.locator("#agents .card").count()) === 4);
  check("bento cards", (await page.locator(".bento .card").count()) === 6);
  check("persona cards", (await page.locator(".persona").count()) === 3);
  check("faq items", (await page.locator(".faq-item").count()) === 5);
  check("canvas running", (await page.locator("canvas.streams").count()) === 1);
  check("demo windows", (await page.locator(".demo-win").count()) === 2);
  check("demo runners", (await page.locator('.demo-body:not(.code-body) .rail-item').count()) === 4);

  // 2. FAQ accordion toggles
  const firstOpen = await page.locator(".faq-item.open").count();
  await page.click(".faq-list .faq-item:nth-child(2) .faq-q");
  await page.waitForTimeout(800);
  const openQ = await page.locator(".faq-list .faq-item:nth-child(2) .faq-a").isVisible();
  check("faq toggle opens", firstOpen === 1 && openQ);

  // 2b. demo interactions: switch runner, compare, reset
  await page.evaluate(() => document.querySelector("#demo").scrollIntoView({ block: "start" }));
  await page.waitForTimeout(2000);
  await page.click('.rail-item:nth-child(3)');
  await page.waitForTimeout(600);
  const selName = await page.textContent(".demo-agenthead b");
  await page.click(".demo-agenthead .demo-tabs button:nth-child(2)");
  await page.waitForTimeout(400);
  const codeShown = await page.locator(".demo-code").isVisible();
  await page.click("text=Compare");
  await page.waitForTimeout(600);
  const cols = await page.locator(".compare-col").count();
  await page.screenshot({ path: SHOT("demo") });
  check("demo runner switch", (selName || "").includes("Claude"));
  check("demo code tab", codeShown);
  check("demo compare view", cols === 3);
  check("code demo panes", (await page.locator(".codepane").count()) === 2);
  check("code demo browser", (await page.locator(".browserpane").count()) === 1);

  // 3. theme toggle flips + persists
  await page.click('button[aria-label="Toggle theme"]');
  await page.waitForTimeout(500);
  const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const stored = await page.evaluate(() => localStorage.getItem("paralla-theme"));
  check("theme toggle", theme === "light" && stored === "light", `theme=${theme}`);
  await page.screenshot({ path: SHOT("light") });
  await page.click('button[aria-label="Toggle theme"]'); // back to dark
  await page.waitForTimeout(400);

  // 4. nav anchor smooth-scrolls
  await page.click('.nav nav a[href="#faq"]');
  await page.waitForTimeout(2500);
  const faqTop = await page.evaluate(() => {
    const r = document.querySelector("#faq").getBoundingClientRect();
    return Math.round(r.top);
  });
  check("anchor scroll to faq", Math.abs(faqTop) < 200, `top=${faqTop}`);

  // 5. mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const noX = await page.evaluate(() => document.documentElement.scrollWidth <= 390);
  check("mobile no h-overflow", noX);
  const menuVisible = await page.locator('button[aria-label="Menu"]').isVisible();
  await page.click('button[aria-label="Menu"]');
  await page.waitForTimeout(400);
  const menuLinks = await page.locator(".mobile-menu a").count();
  check("mobile menu", menuVisible && menuLinks === 5);
  await page.click('.mobile-menu a[href="#faq"]');
  await page.waitForTimeout(2000);
  const menuClosed = (await page.locator(".mobile-menu").count()) === 0;
  check("mobile menu navigates", menuClosed);
  await page.screenshot({ path: SHOT("mobile-dark") });

  check("zero console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  console.log(results.join("\n"));
  await browser.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
