#!/usr/bin/env node
/**
 * bust.js — Cache-busting otomatis untuk proyek static HTML.
 *
 * Cara pakai:  node assets/js/core/bust.js
 *
 * Apa yang dilakukan:
 *  1. Scan semua file .css dan .js di /assets/ (kecuali bust.js sendiri)
 *  2. Hitung hash pendek (8 char) dari konten setiap file
 *  3. Cari semua file .html yang mereferensikan file tersebut dengan ?v=xxx
 *  4. Ganti ?v=xxx dengan ?v=<hash baru>
 *  5. Update juga VCACHE di head.js (untuk favicon)
 *
 * Hash hanya berubah kalau konten file benar-benar berubah,
 * jadi tampilan tetap konsisten — tidak ada mismatch versi.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "../../..");
const ASSETS_DIR = path.join(ROOT, "assets");

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
}

function findFiles(dir, ext) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (entry.name.endsWith(ext) && entry.name !== "bust.js") {
      results.push(full);
    }
  }
  return results;
}

function findHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "supabase") {
      results.push(...findHtmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

const faviconDir = path.join(ASSETS_DIR, "favicon");
const headJsPath = path.join(ASSETS_DIR, "js", "core", "head.js");

if (fs.existsSync(headJsPath) && fs.existsSync(faviconDir)) {
  let headContent = fs.readFileSync(headJsPath, "utf8");
  const faviconFiles = findFiles(faviconDir, ".png")
    .concat(findFiles(faviconDir, ".svg"))
    .concat(findFiles(faviconDir, ".ico"));

  let combinedHash = "";
  for (const f of faviconFiles.sort()) {
    combinedHash += hashFile(f);
  }
  const vcache = crypto.createHash("md5").update(combinedHash).digest("hex").slice(0, 8);
  const newHead = headContent.replace(/const VCACHE = "[^"]+";/, `const VCACHE = "${vcache}";`);
  if (newHead !== headContent) {
    fs.writeFileSync(headJsPath, newHead, "utf8");
    console.log(`  updated: assets/js/core/head.js (VCACHE=${vcache})`);
  }
}

const assetFiles = [...findFiles(ASSETS_DIR, ".css"), ...findFiles(ASSETS_DIR, ".js")];
const hashMap = {};

for (const file of assetFiles) {
  const rel = "/" + path.relative(ROOT, file).replace(/\\/g, "/");
  hashMap[rel] = hashFile(file);
}

const htmlFiles = findHtmlFiles(ROOT);
let totalUpdates = 0;

for (const htmlFile of htmlFiles) {
  let content = fs.readFileSync(htmlFile, "utf8");
  let changed = false;

  for (const [assetPath, hash] of Object.entries(hashMap)) {
    const escaped = assetPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})\\?v=[^"'\\s]+`, "g");
    const replacement = `${assetPath}?v=${hash}`;
    const newContent = content.replace(regex, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(htmlFile, content, "utf8");
    totalUpdates++;
    console.log(`  updated: ${path.relative(ROOT, htmlFile)}`);
  }
}

console.log(`\n  Done. ${totalUpdates} file(s) updated.`);
