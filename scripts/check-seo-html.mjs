import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(msg) {
  errors.push(msg);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function strip(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function titlesFrom(html) {
  return [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((m) =>
    strip(m[1])
  );
}

function h1sFrom(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    strip(m[1])
  );
}

function layoutTitleFromAstro(source) {
  const match = source.match(/<BaseLayout[\s\S]*?\btitle="([^"]+)"/);
  return match ? match[1].trim() : "";
}

function pageTitle(html, isAstroSource) {
  const fromTag = titlesFrom(html)[0] || "";
  if (fromTag) return fromTag;
  if (isAstroSource) return layoutTitleFromAstro(html);
  return "";
}

const astroNew = path.join(root, "src/pages/como-descargar-scribd-gratis.astro");
const astroHome = path.join(root, "src/pages/index.astro");
const astroScribd = path.join(root, "src/pages/scribd.astro");
const distNew = path.join(root, "dist/client/como-descargar-scribd-gratis/index.html");
const distHome = path.join(root, "dist/client/index.html");
const distScribd = path.join(root, "dist/client/scribd/index.html");
const sitemap0 = path.join(root, "dist/client/sitemap-0.xml");
const sitemapIndex = path.join(root, "dist/client/sitemap-index.xml");

if (!exists(astroNew)) {
  fail("missing src/pages/como-descargar-scribd-gratis.astro");
}

const useDistPage = exists(distNew);
const newSource = useDistPage ? read(distNew) : exists(astroNew) ? read(astroNew) : "";
const homeSource =
  useDistPage && exists(distHome)
    ? read(distHome)
    : exists(astroHome)
      ? read(astroHome)
      : "";
const scribdSource =
  useDistPage && exists(distScribd)
    ? read(distScribd)
    : exists(astroScribd)
      ? read(astroScribd)
      : "";

const newTitle = pageTitle(newSource, !useDistPage);
const homeTitle = pageTitle(homeSource, !(useDistPage && exists(distHome)));

if (!newTitle) fail("new page <title> is empty");
if (newTitle && homeTitle && newTitle === homeTitle) {
  fail(`new page title must differ from homepage title (got "${newTitle}")`);
}

const h1s = h1sFrom(newSource);
if (h1s.length !== 1) {
  fail(`expected exactly one <h1>, got ${h1s.length}`);
} else {
  const h1 = h1s[0];
  const hasScribdGratis = h1.includes("Scribd") && /gratis/i.test(h1);
  const hasComoDescargar = /Cómo descargar/i.test(h1);
  if (!hasScribdGratis && !hasComoDescargar) {
    fail(`h1 must contain Scribd+gratis or "Cómo descargar" (got "${h1}")`);
  }
}

const sitemapPath = exists(sitemap0) ? sitemap0 : exists(sitemapIndex) ? sitemapIndex : null;
if (sitemapPath) {
  const sitemap = read(sitemapPath);
  if (!sitemap.includes("https://descargarscript.com/como-descargar-scribd-gratis")) {
    fail(`${path.relative(root, sitemapPath)} missing https://descargarscript.com/como-descargar-scribd-gratis`);
  }
} else if (exists(astroNew)) {
  const astro = read(astroNew);
  if (!/export const prerender\s*=\s*true/.test(astro)) {
    fail("new astro page missing export const prerender = true");
  }
  if (!astroNew.endsWith("como-descargar-scribd-gratis.astro")) {
    fail("new page path does not match /como-descargar-scribd-gratis/");
  }
}

if (exists(astroNew) && !/export const prerender\s*=\s*true/.test(read(astroNew))) {
  fail("new astro page missing export const prerender = true");
}

if (!scribdSource.includes("/como-descargar-scribd-gratis")) {
  fail("/scribd does not contain /como-descargar-scribd-gratis");
}

if (errors.length) {
  console.error("SEO HTML check failed:");
  for (const err of errors) console.error(` - ${err}`);
  process.exit(1);
}

console.log(
  `SEO HTML check passed (${useDistPage ? "dist/client HTML" : "astro source"})`
);
console.log(` new title: ${newTitle}`);
console.log(` home title: ${homeTitle}`);
console.log(` h1: ${h1s[0]}`);
