/**
 * pdfjs-dist 需要把 CMap（中日韩字体映射）和标准字体拷到 public/ 下，
 * 否则中文 PDF 提取会因为缺少 UniGB-UCS2-H 之类的 CMap 而变成乱码。
 */
import { cp, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'node_modules', 'pdfjs-dist');
const dest = join(root, 'public', 'pdfjs');

const jobs = [
  [join(src, 'cmaps'), join(dest, 'cmaps')],
  [join(src, 'standard_fonts'), join(dest, 'standard_fonts')],
];

for (const [from, to] of jobs) {
  try {
    await access(from);
  } catch {
    console.warn(`[pdfjs] skip missing ${from}`);
    continue;
  }
  await access(to).then(
    () => null,
    async () => {
      await mkdir(to, { recursive: true });
      await cp(from, to, { recursive: true });
      console.log(`[pdfjs] copied -> ${to.replace(root, '.')}`);
    },
  );
}
