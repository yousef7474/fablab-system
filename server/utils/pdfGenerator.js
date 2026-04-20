const puppeteer = require('puppeteer-core');

let chromiumPath;
try {
  chromiumPath = require('chromium').path;
} catch {
  // On Linux server, use system chromium
  chromiumPath = '/usr/bin/chromium-browser' || '/usr/bin/google-chrome' || '/usr/bin/chromium';
}

const generatePdfFromHtml = async (html, options = {}) => {
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
