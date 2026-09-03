const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://listado.mercadolibre.com.ar/smart-home', { waitUntil: 'networkidle2' });
  const html = await page.content();
  const title = await page.title();
  console.log('Title:', title);
  console.log('HTML length:', html.length);
  const match = html.match(/MLA-?\d+/g);
  console.log('Found MLAs:', match ? match.length : 0);
  await browser.close();
})();
