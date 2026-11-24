export type ColorMode = 'bw' | 'color';
export type SidesMode = 'single' | 'double';
export type PaperSize = 'A4' | 'A3' | 'Letter';
export type OrderStatus = 'Received' | 'Printing' | 'Ready for Pickup' | 'Completed';
export type PaymentMethod = 'upi_qr' | 'upi_id';

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'Received',
  'Printing',
  'Ready for Pickup',
  'Completed',
];

export const CAMPUS_COUNTER = {
  name: 'Print Shop SSPU',
  location: 'Print Shop SSPU · Campus Ground Floor',
  hoursLabel: 'Mon–Sat · 8:00 AM – 8:00 PM',
  upiId: 'printshopsspu@upi',
  merchantName: 'Print Shop SSPU',
};

export interface PrintSettings {
  colorMode: ColorMode;
  sides: SidesMode;
  paperSize: PaperSize;
  copies: number;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  colorMode: 'bw',
  sides: 'double',
  paperSize: 'A4',
  copies: 1,
};

export interface PrintableFileSpec {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pages: number;
  colorMode: ColorMode;
  sides: SidesMode;
  paperSize: PaperSize;
  copies: number;
}

export interface ItemPriceBreakdown {
  unitPageRate: number;
  duplexDiscount: number;
  totalPagesPrinted: number;
  totalSheetsUsed: number;
  lineSubtotal: number;
}

export function calculateItemPricing(spec: {
  pages: number;
  copies: number;
  colorMode: ColorMode;
  sides: SidesMode;
  paperSize: PaperSize;
}): ItemPriceBreakdown {
  const safePages = Math.max(1, Math.min(500, Math.floor(spec.pages || 1)));
  const safeCopies = Math.max(1, Math.min(500, Math.floor(spec.copies || 1)));

  const baseRate = spec.colorMode === 'color' ? 10 : 2;
  const paperMultiplier = spec.paperSize === 'A3' ? 2 : 1;
  const unitPageRate = baseRate * paperMultiplier;

  const totalPagesPrinted = safePages * safeCopies;
  const rawPrice = totalPagesPrinted * unitPageRate;
  const isDuplexEligible = spec.sides === 'double' && safePages > 1;
  const duplexDiscount = isDuplexEligible ? Number((rawPrice * 0.1).toFixed(2)) : 0;
  const lineSubtotal = Number(Math.max(2, rawPrice - duplexDiscount).toFixed(2));

  const sheetsPerCopy =
    spec.sides === 'double' ? Math.ceil(safePages / 2) : safePages;
  const totalSheetsUsed = sheetsPerCopy * safeCopies;

  return {
    unitPageRate,
    duplexDiscount,
    totalPagesPrinted,
    totalSheetsUsed,
    lineSubtotal,
  };
}

export function calculateOrderPricing(
  items: Array<{
    pages: number;
    copies: number;
    colorMode: ColorMode;
    sides: SidesMode;
    paperSize: PaperSize;
  }>
) {
  let subtotal = 0;
  let totalPages = 0;
  let totalSheets = 0;
  let totalDuplexSavings = 0;

  for (const item of items) {
    const calc = calculateItemPricing(item);
    subtotal += calc.lineSubtotal;
    totalPages += calc.totalPagesPrinted;
    totalSheets += calc.totalSheetsUsed;
    totalDuplexSavings += calc.duplexDiscount;
  }

  subtotal = Number(subtotal.toFixed(2));
  const total = subtotal;

  return {
    subtotal,
    total,
    totalPages,
    totalSheets,
    totalDuplexSavings: Number(totalDuplexSavings.toFixed(2)),
  };
}

export interface OrderStatusEvent {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface PrintOrderItemRecord extends PrintableFileSpec {
  lineSubtotal: number;
  totalSheetsUsed: number;
}

export interface PrintOrderRecord {
  pickupCode: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  counterName: string;
  counterLocation: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  paymentStatus: 'Paid';
  items: PrintOrderItemRecord[];
  subtotal: number;
  total: number;
  totalSheets: number;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  createdAt: string;
  updatedAt: string;
  readyNotificationSent: boolean;
}

export interface PublicUserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  defaultSettings: PrintSettings;
  deviceNotificationsEnabled: boolean;
  createdAt: string;
}

export interface ReadyPushNotification {
  id: string;
  pickupCode: string;
  counterName: string;
  counterLocation: string;
  customerName: string;
  createdAt: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}
