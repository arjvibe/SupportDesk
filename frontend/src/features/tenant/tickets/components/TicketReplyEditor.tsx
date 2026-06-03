import { useState } from "react";
import { Send, Paperclip, X, FileText } from "lucide-react";
import { useUploadAttachment } from "../hooks/useTicketAttachments";
import type { Attachment } from "../types";

interface TicketReplyEditorProps {
  onSubmit: (payload: {
    body: string;
    isInternal: boolean;
    attachments: Attachment[];
  }) => void;
  isPending: boolean;
}

export function TicketReplyEditor({ onSubmit, isPending }: TicketReplyEditorProps) {
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [composerBody, setComposerBody] = useState("");
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useUploadAttachment();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    setIsUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 5MB size limit.`);
        continue;
      }

      try {
        const data = await uploadMutation.mutateAsync(file);
        setUploadedAttachments((prev) => [...prev, data]);
      } catch (error: any) {
        console.error("File upload failed:", error);
        alert(
          `Failed to upload "${file.name}": ${error.message || "Unknown error"}`
        );
      }
    }
    setIsUploading(false);
    e.target.value = "";
  };

  const handleSendComposer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerBody.trim() && uploadedAttachments.length === 0) return;

    onSubmit({
      body: composerBody,
      isInternal: composerTab === "note",
      attachments: uploadedAttachments,
    });

    setComposerBody("");
    setUploadedAttachments([]);
  };

  const isSubmitDisabled =
    isPending ||
    isUploading ||
    (!composerBody.trim() && uploadedAttachments.length === 0);

  return (
    <div className="p-3 border-t border-black/10 bg-canvas">
      <form onSubmit={handleSendComposer} className="flex flex-col gap-2">
        {/* Toggle Tabs */}
        <div className="flex gap-2 text-[10px] font-mono uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setComposerTab("reply")}
            className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
              composerTab === "reply"
                ? "bg-brand-primary text-brand-secondary shadow-sm"
                : "bg-surface text-muted-foreground hover:text-ink"
            }`}
          >
            Public Reply
          </button>
          <button
            type="button"
            onClick={() => setComposerTab("note")}
            className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
              composerTab === "note"
                ? "bg-warning/20 text-warning border border-warning/30 shadow-sm"
                : "bg-surface text-muted-foreground hover:text-ink"
            }`}
          >
            Internal Note
          </button>
        </div>

        {/* Queued staged attachments */}
        {uploadedAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-black/5 bg-surface/30 rounded-t-xl text-left">
            {uploadedAttachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-canvas border border-black/10 text-[10px] font-mono"
              >
                <FileText className="size-3 text-muted-foreground" />
                <span className="max-w-[120px] truncate" title={file.fileName}>
                  {file.fileName}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setUploadedAttachments((prev) =>
                      prev.filter((_, i) => i !== idx)
                    )
                  }
                  className="text-muted-foreground hover:text-ink shrink-0 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div
          className={`flex items-end gap-2 p-1.5 rounded-2xl border transition-all ${
            uploadedAttachments.length > 0 ? "rounded-t-none border-t-0" : ""
          } ${
            composerTab === "note"
              ? "bg-warning/[0.02] border-warning/30 focus-within:border-warning"
              : "bg-canvas border-black/10 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/20"
          }`}
        >
          <label className="size-8 rounded-xl flex items-center justify-center shrink-0 hover:bg-surface active:scale-95 cursor-pointer transition-all">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
            <Paperclip
              className={`size-4 ${
                isUploading
                  ? "animate-pulse text-muted-foreground"
                  : "text-muted-foreground hover:text-ink"
              }`}
            />
          </label>
          <textarea
            rows={1}
            value={composerBody}
            onChange={(e) => setComposerBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isSubmitDisabled) {
                  handleSendComposer(e);
                }
              }
            }}
            placeholder={
              composerTab === "note"
                ? "Type internal note..."
                : "Type your response..."
            }
            className="flex-1 bg-transparent text-xs px-2 py-1.5 focus:outline-none resize-none leading-normal max-h-24 overflow-y-auto"
            style={{ height: "32px" }}
          />
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`size-8 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40 shadow-sm cursor-pointer ${
              composerTab === "note"
                ? "bg-warning text-white hover:opacity-90"
                : "bg-brand-primary text-brand-secondary hover:opacity-95"
            }`}
            title={
              composerTab === "note" ? "Post Internal Note" : "Send Response"
            }
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
