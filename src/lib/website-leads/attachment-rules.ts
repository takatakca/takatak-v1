// Attachment limits shared by the website form (browser) and the server.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_LEAD = 5;
export const MAX_TOTAL_BYTES_PER_LEAD = 25 * 1024 * 1024;

/** File extensions accepted for reference files. */
export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".docx",
  ".xlsx",
  ".pptx",
  ".txt",
] as const;

export function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
