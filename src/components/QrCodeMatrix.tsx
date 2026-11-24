import React from 'react';

interface QrCodeMatrixProps {
  value: string;
  size?: number;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const QrCodeMatrix: React.FC<QrCodeMatrixProps> = ({ value, size = 148 }) => {
  const grid = 21;
  const cells: boolean[][] = Array.from({ length: grid }, () => Array(grid).fill(false));

  const drawFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[startRow + r][startCol + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, grid - 7);
  drawFinder(grid - 7, 0);

  for (let i = 8; i < grid - 8; i += 1) {
    cells[6][i] = i % 2 === 0;
    cells[i][6] = i % 2 === 0;
  }

  let state = hashSeed(value || 'PRL-0000');
  const isReserved = (r: number, c: number) => {
    if (r < 8 && c < 8) return true;
    if (r < 8 && c >= grid - 8) return true;
    if (r >= grid - 8 && c < 8) return true;
    if (r === 6 || c === 6) return true;
    return false;
  };

  for (let r = 0; r < grid; r += 1) {
    for (let c = 0; c < grid; c += 1) {
      if (isReserved(r, c)) continue;
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      cells[r][c] = (state & 1) === 1;
    }
  }

  return (
    <div
      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-3"
      aria-label={`Pickup QR pass for ${value}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${grid} ${grid}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${value}`}
      >
        <rect width={grid} height={grid} fill="#ffffff" />
        {cells.map((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0f172a" />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};
