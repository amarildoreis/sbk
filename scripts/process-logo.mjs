import sharp from "sharp";
import path from "node:path";

// A Logomarca.jpeg original tem fundo branco sólido por trás do badge navy
// arredondado. Como o produto usa o badge sobre fundos escuros (painel de
// marca, sidebar), precisamos de uma versão com cantos transparentes —
// exatamente o "ideal: PNG com fundo transparente" citado no CLAUDE.md (seção 11).
const src = path.resolve("Assets/Logomarca.jpeg");
const out = path.resolve("public/brand/sbk-badge.png");

const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const threshold = 235; // pixels quase-brancos (fundo) viram transparentes

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r >= threshold && g >= threshold && b >= threshold) {
    data[i + 3] = 0;
  }
}

await sharp(data, { raw: { width, height, channels } })
  .trim()
  .png()
  .toFile(out);

console.log(`Logo processada: ${out}`);

// Badge apenas com o ícone (cana-de-açúcar), recortado do lockup completo e
// remontado num quadrado arredondado navy — para uso em tamanhos pequenos
// (topbar, sidebar), onde o wordmark "SBK" do lockup completo ficaria
// ilegível. Continua sendo a arte original, só re-hospedada num contêiner
// consistente em qualquer tamanho.
const iconOut = path.resolve("public/brand/sbk-icon.png");
const size = 256;
const radius = 56;
const navy = { r: 0x12, g: 0x18, b: 0x3f, alpha: 1 };

const roundedMask = Buffer.from(
  `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
);

const icon = await sharp(out)
  .extract({ left: 175, top: 10, width: 220, height: 220 })
  .resize(size, size)
  .toBuffer();

const base = await sharp({
  create: { width: size, height: size, channels: 4, background: navy },
})
  .composite([{ input: icon, blend: "over" }])
  .png()
  .toBuffer();

await sharp(base)
  .composite([{ input: roundedMask, blend: "dest-in" }])
  .png()
  .toFile(iconOut);

console.log(`Ícone processado: ${iconOut}`);
