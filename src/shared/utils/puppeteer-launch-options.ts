export function shouldUsePuppeteerPipeTransport() {
  // Bun on Windows can hang indefinitely when Puppeteer launches Chrome over pipe transport.
  return !(process.platform === "win32" && Boolean(process.versions.bun));
}
