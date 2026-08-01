/** Browser-side file parsing: PDF, spreadsheets, CSV and plain text. */

export type ParsedPage = { page: number; text: string };

export type FileKind = "pdf" | "sheet" | "text" | "image" | "audio" | "unknown";

export function detectKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/\.(csv|tsv|xlsx|xls)$/.test(name)) return "sheet";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("text/") || /\.(txt|md|json|log)$/.test(name)) return "text";
  return "unknown";
}

export async function parsePdf(file: File): Promise<ParsedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: ParsedPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    pages.push({ page: pageNumber, text });
  }

  return pages;
}

export async function parseSheet(file: File): Promise<ParsedPage[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  return workbook.SheetNames.map((name, index) => {
    const sheet = workbook.Sheets[name];
    const csv = sheet ? XLSX.utils.sheet_to_csv(sheet) : "";
    return { page: index + 1, text: `Sheet: ${name}\n${csv}` };
  });
}

export async function parseText(file: File): Promise<ParsedPage[]> {
  const text = await file.text();
  const size = 6000;
  if (text.length <= size) return [{ page: 1, text }];

  const pages: ParsedPage[] = [];
  for (let start = 0; start < text.length; start += size) {
    pages.push({ page: pages.length + 1, text: text.slice(start, start + size) });
  }
  return pages;
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < buffer.length; i += step) {
    binary += String.fromCharCode(...buffer.subarray(i, i + step));
  }
  return btoa(binary);
}