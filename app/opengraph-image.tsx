import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const alt = 'AI Discussion Club';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), 'public/brand/logo.png'));
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
      <img src={`data:image/png;base64,${logo.toString('base64')}`} width={600} height={600} alt="" />
    </div>,
    size,
  );
}
