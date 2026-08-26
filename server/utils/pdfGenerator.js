const puppeteer = require('puppeteer-core');

const fs = require('fs');
const { execSync } = require('child_process');

// Find chromium - prefer system install over npm package
let chromiumPath;
try {
  chromiumPath = execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null').toString().trim();
} catch {}
if (!chromiumPath) {
  const paths = ['/snap/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'];
  chromiumPath = paths.find(p => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } });
}
if (!chromiumPath) {
  try { chromiumPath = require('chromium').path; } catch {}
}

console.log('PDF Generator: Chromium path =', chromiumPath);

const generatePdfFromHtml = async (html, options = {}) => {
  if (!chromiumPath) throw new Error('Chromium not found');

  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      // Reduce memory footprint on the 2GB droplet — many small
      // reports with lots of embedded images can otherwise OOM.
      '--single-process',
      '--no-zygote',
      '--disable-extensions'
    ]
  });

  try {
    const page = await browser.newPage();
    // 'load' waits for every subresource — but our HTML is fully
    // self-contained (all images are inline data URIs), so
    // 'domcontentloaded' is enough and much faster.
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeout || 60000
    });
    // Brief settle time for fonts / large inline images to decode.
    await new Promise(r => setTimeout(r, 800));

    const pdfData = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape !== undefined ? options.landscape : true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: options.margin || { top: 0, right: 0, bottom: 0, left: 0 },
      timeout: options.timeout || 60000
    });

    // Ensure it's a proper Buffer
    return Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
};

module.exports = { generatePdfFromHtml };
