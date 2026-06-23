// Browser-only text extraction for various file types.
// Returns plain text suitable for storage and AI context.

const MAX_CHARS = 200_000;

export const SUPPORTED_EXTS = [
  ".txt", ".md", ".csv", ".json", ".log",
  ".pdf", ".docx",
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
];

export const ACCEPT_ATTR = SUPPORTED_EXTS.join(",");

export type ExtractResult = { text: string; needsOcr: boolean };

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isImage(name: string) {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extOf(name));
}

export async function extractText(file: File): Promise<ExtractResult> {
  const ext = extOf(file.name);

  if (ext === ".pdf") {
    const pdfjs = await import("pdfjs-dist");
    // Use fake worker to avoid bundling a separate worker file
    // @ts-expect-error - GlobalWorkerOptions exists at runtime
    pdfjs.GlobalWorkerOptions.workerSrc = "";
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({
      data: buf,
      disableWorker: true,
      isEvalSupported: false,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0]).promise;
    let out = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const strs = (content.items as Array<{ str?: string }>).map((it) => it.str ?? "");
      out += strs.join(" ") + "\n\n";
      if (out.length > MAX_CHARS) break;
    }
    return { text: out.slice(0, MAX_CHARS), needsOcr: false };
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return { text: value.slice(0, MAX_CHARS), needsOcr: false };
  }

  if (isImage(file.name)) {
    // OCR will be performed server-side from the storage path
    return { text: "", needsOcr: true };
  }

  // Plain text fallback
  const text = await file.text();
  return { text: text.slice(0, MAX_CHARS), needsOcr: false };
}
