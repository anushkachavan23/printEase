export async function detectPdfPageCount(file: File): Promise<number> {
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return 1;
  }
  try {
    const buffer = await file.slice(0, 2 * 1024 * 1024).arrayBuffer();
    const text = new TextDecoder('latin1').decode(buffer);

    const pageMatches = text.match(/\/Type\s*\/Page\b(?!s)/g);
    if (pageMatches && pageMatches.length > 0) {
      return Math.min(500, pageMatches.length);
    }

    const countMatches = [...text.matchAll(/\/Count\s+(\d+)/g)];
    if (countMatches.length > 0) {
      const counts = countMatches
        .map((m) => Number(m[1]))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 500);
      if (counts.length > 0) {
        return Math.max(...counts);
      }
    }
    return 1;
  } catch {
    return 1;
  }
}

export async function createSamplePdfFile(): Promise<File> {
  const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R] /Count 4 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj
4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj
5 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj
6 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj
trailer << /Root 1 0 R >>
%%EOF`;
  const blob = new Blob([minimalPdf], { type: 'application/pdf' });
  return new File([blob], 'Q4_Architectural_Brief.pdf', {
    type: 'application/pdf',
  });
}

export async function createSampleImageFile(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(40, 40, 260, 400);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(330, 40, 270, 190);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(330, 250, 270, 190);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('printEase', 355, 110);
    ctx.font = '18px sans-serif';
    ctx.fillText('EXHIBITION POSTER A3', 355, 145);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(
        new File([blob || new Blob([''], { type: 'image/png' })], 'Exhibition_Poster_Proof.png', {
          type: 'image/png',
        })
      );
    }, 'image/png');
  });
}
