import type jsPDF from 'jspdf';

let cachedRegular: string | null = null;
let cachedBold: string | null = null;
let loading: Promise<void> | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

export async function ensureNotoLoaded(): Promise<void> {
  if (cachedRegular && cachedBold) return;
  if (!loading) {
    loading = (async () => {
      const [reg, bold] = await Promise.all([
        fetchAsBase64('/fonts/NotoSans-Regular.ttf'),
        fetchAsBase64('/fonts/NotoSans-Bold.ttf'),
      ]);
      cachedRegular = reg;
      cachedBold = bold;
    })();
  }
  await loading;
}

export function registerNotoFont(doc: jsPDF): boolean {
  if (!cachedRegular || !cachedBold) return false;
  doc.addFileToVFS('NotoSans-Regular.ttf', cachedRegular);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', cachedBold);
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  return true;
}
