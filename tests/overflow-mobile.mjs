// Teste de regressão: a página não pode ficar mais larga que a tela no celular.
// Uso: MF_URL=http://127.0.0.1:8765/ node tests/overflow-mobile.mjs
// Precisa do Playwright e do Chrome instalados (npm i playwright; canal "chrome").
// Falha (exit 1) se scrollWidth > clientWidth, se o layout viewport crescer
// (innerWidth != largura da tela) ou se algum elemento visível passar da borda.
import { chromium } from "playwright";

const BASE = process.env.MF_URL || "http://127.0.0.1:8765/";
const UAS = {
  "chrome-android": "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  "samsung-internet": "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
};
const VIEWPORTS = [[320, 640], [360, 800], [384, 854], [390, 844], [412, 915], [430, 932], [768, 1024]];
const ITENS = ["Coxinha", "Kibe", "Risole"];

const medir = (page) => page.evaluate(() => {
  const de = document.documentElement;
  const W = de.clientWidth;
  const fora = [];
  for (const e of document.querySelectorAll("body *")) {
    // Dentro de uma faixa que rola (overflow auto/scroll) é esperado passar da borda.
    let rola = false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if ((o === "auto" || o === "scroll") && p.getBoundingClientRect().right <= W + 1) { rola = true; break; }
    }
    if (rola) continue;
    const r = e.getBoundingClientRect();
    if (r.width > 0 && (r.right > W + 1 || r.left < -1) && getComputedStyle(e).visibility !== "hidden") {
      fora.push(`${e.tagName.toLowerCase()}.${String(e.className && e.className.baseVal === undefined ? e.className : "").split(" ")[0]} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
  }
  return { W, iw: innerWidth, sw: de.scrollWidth, bsw: document.body.scrollWidth, fora: fora.slice(0, 6) };
});

let falhas = 0, total = 0;
const checar = async (page, rotulo) => {
  total++;
  const m = await medir(page);
  const ok = m.sw <= m.W && m.bsw <= m.W && m.iw === m.W && m.fora.length === 0;
  if (!ok) { falhas++; console.log(`FALHA ${rotulo}: ${JSON.stringify(m)}`); }
  else console.log(`ok    ${rotulo} (scrollWidth ${m.sw} / clientWidth ${m.W})`);
};

const browser = await chromium.launch({ channel: "chrome" });
for (const [w, h] of VIEWPORTS) {
  for (const [uaNome, userAgent] of Object.entries(UAS)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625, userAgent, locale: "pt-BR", timezoneId: "America/Manaus" });
    const page = await ctx.newPage();
    const tag = `${w}x${h} ${uaNome}`;
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await checar(page, `${tag} | carrinho vazio`);

    for (const nome of ITENS) {
      const btn = page.locator(`button[data-mais][aria-label^="Adicionar ${nome}"]`).first();
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    }
    await page.waitForTimeout(300);
    await checar(page, `${tag} | 3 itens no carrinho`);

    await page.evaluate(() => scrollTo(0, 0));
    await checar(page, `${tag} | 3 itens, topo`);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await checar(page, `${tag} | carrinho restaurado após recarregar`);

    if (uaNome === "chrome-android") {
      await page.locator("[data-abre-checkout]:visible").first().click();
      await page.waitForTimeout(500);
      await checar(page, `${tag} | checkout aberto`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${total - falhas}/${total} verificações ok`);
process.exit(falhas ? 1 : 0);
