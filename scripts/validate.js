import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { TOOLS, TOOL_CATEGORIES } from '../public/js/data/tools-catalog.js';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function collectJsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const jsFiles = await collectJsFiles(ROOT);
  for (const file of jsFiles) {
    await execFileAsync(process.execPath, ['--check', file]);
  }

  if (TOOLS.length < 100) {
    throw new Error(`Expected >= 100 tools in catalog, found ${TOOLS.length}`);
  }

  const ids = new Set();
  for (const tool of TOOLS) {
    if (ids.has(tool.id)) {
      throw new Error(`Duplicate tool ID: ${tool.id}`);
    }
    ids.add(tool.id);
    if (!TOOL_CATEGORIES.includes(tool.category)) {
      throw new Error(`Invalid category "${tool.category}" on tool "${tool.id}"`);
    }
    if (!['LOCAL', 'API', 'LIMITED', 'EDUCATIONAL'].includes(tool.classification)) {
      throw new Error(`Invalid classification "${tool.classification}" on tool "${tool.id}"`);
    }
  }

  const moduleFiles = {
    flagship: await fs.readFile(path.join(ROOT, 'public/js/tools/flagship.js'), 'utf8'),
    privacy: await fs.readFile(path.join(ROOT, 'public/js/tools/privacy.js'), 'utf8'),
    network: await fs.readFile(path.join(ROOT, 'public/js/tools/network.js'), 'utf8'),
    crypto: await fs.readFile(path.join(ROOT, 'public/js/tools/crypto.js'), 'utf8'),
    security: await fs.readFile(path.join(ROOT, 'public/js/tools/security.js'), 'utf8'),
    data: await fs.readFile(path.join(ROOT, 'public/js/tools/data.js'), 'utf8'),
    identity: await fs.readFile(path.join(ROOT, 'public/js/tools/identity.js'), 'utf8'),
    utilities: await fs.readFile(path.join(ROOT, 'public/js/tools/utilities.js'), 'utf8'),
    educational: await fs.readFile(path.join(ROOT, 'public/js/tools/educational.js'), 'utf8')
  };

  for (const tool of TOOLS) {
    const wb = tool.workbench;
    const src = moduleFiles[wb.module];
    if (!src) {
      throw new Error(`Unknown workbench module "${wb.module}" on tool "${tool.id}"`);
    }
    if (!src.includes(`'${wb.kind}'`)) {
      throw new Error(`Missing workbench handler '${wb.kind}' in ${wb.module}.js for tool "${tool.id}"`);
    }
    if (wb.checklistId && !src.includes(`'${wb.checklistId}'`)) {
      throw new Error(`Missing checklist '${wb.checklistId}' in educational.js for tool "${tool.id}"`);
    }
    if (wb.articleId && !src.includes(`'${wb.articleId}'`)) {
      throw new Error(`Missing article '${wb.articleId}' in educational.js for tool "${tool.id}"`);
    }
  }

  console.log(`Validated ${jsFiles.length} JS modules and ${TOOLS.length} tools across ${TOOL_CATEGORIES.length} categories.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
