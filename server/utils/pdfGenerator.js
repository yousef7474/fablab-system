const puppeteer = require('puppeteer-core');

const fs = require('fs');
const { execSync } = require('child_process');

let chromiumPath;
try {
  chromiumPath = require('chromium').path;
} catch {
  // On Linux server, find system chromium
  const paths = ['/snap/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'];
  chromiumPath = paths.find(p => fs.existsSync(p));
  if (!chromiumPath) {
    try { chromiumPath = execSync('which chromium-browser || which chromium || which google-chrome 2>/dev/null').toString().trim(); } catch {}
  }
}

console.log('PDF Generator: Chromium path =', chromiumPath);

const generatePdfFromHtml = async (html, options = {}) => {
  if (!chromiumPath) throw new Error('Chromium not found');

  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      landscape: options.landscape !== undefined ? options.landscape : true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};

module.exports = { generatePdfFromHtml };
