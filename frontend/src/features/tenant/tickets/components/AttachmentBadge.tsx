import { FileText } from "lucide-react";
import { getApiBase } from "@/utils/api";
import type { Attachment } from "../types";

interface AttachmentBadgeProps {
  attachment: Attachment;
  ticketId: string;
}

export function AttachmentBadge({ attachment, ticketId }: AttachmentBadgeProps) {
  const isImage =
    attachment.mimeType?.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".svg", ".gif"].some((ext) =>
      attachment.fileName.toLowerCase().endsWith(ext)
    );
  
  const apiBase = getApiBase();
  const downloadUrl = `${apiBase}/tickets/${ticketId}/attachments/${attachment.id}/download`;

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-black/10 bg-canvas/50 hover:bg-canvas/90 hover:border-black/20 transition-all text-left text-ink max-w-[200px]"
      title={`Download ${attachment.fileName}`}
    >
      {isImage ? (
        <div className="size-8 rounded bg-surface border border-black/5 flex items-center justify-center overflow-hidden shrink-0">
          <img
            src={downloadUrl}
            alt={attachment.fileName}
            className="size-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="size-8 rounded bg-surface border border-black/5 flex items-center justify-center shrink-0">
          <FileText className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-medium truncate font-mono">
          {attachment.fileName}
        </p>
        <p className="text-[8px] text-muted-foreground font-mono">
          {(attachment.fileSize / 1024).toFixed(1)} KB
        </p>
      </div>
    </a>
  );
}
