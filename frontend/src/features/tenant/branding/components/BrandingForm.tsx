import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Palette, Image as ImageIcon, Upload, Trash2, ShieldAlert } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormError,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

const brandingSchema = z.object({
  logoUrl: z.string(),
  primaryColor: z.string().regex(hexColorRegex, "Must be a valid 6-char hex color (e.g. #000000)"),
  secondaryColor: z.string().regex(hexColorRegex, "Must be a valid 6-char hex color (e.g. #ffffff)"),
});

export type BrandingFormValues = z.infer<typeof brandingSchema>;

interface BrandingFormProps {
  initialValues: Partial<BrandingFormValues>;
  onSubmit: (data: BrandingFormValues) => void;
  isLoading: boolean;
  onUploadLogo: (file: File) => Promise<string>;
  isUploadingLogo: boolean;
  resolveAssetUrl: (path: string) => string;
}

export function BrandingForm({
  initialValues,
  onSubmit,
  isLoading,
  onUploadLogo,
  isUploadingLogo,
  resolveAssetUrl,
}: BrandingFormProps) {
  const [dragActive, setDragActive] = useState(false);
  const [localUploadError, setLocalUploadError] = useState<string | null>(null);

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logoUrl: initialValues.logoUrl || "",
      primaryColor: initialValues.primaryColor || "#000000",
      secondaryColor: initialValues.secondaryColor || "#ffffff",
    },
  });

  const logoUrl = form.watch("logoUrl");
  const primaryColor = form.watch("primaryColor");
  const secondaryColor = form.watch("secondaryColor");

  // Keep colors updated if changed from props
  useEffect(() => {
    if (initialValues.logoUrl !== undefined) form.setValue("logoUrl", initialValues.logoUrl);
    if (initialValues.primaryColor) form.setValue("primaryColor", initialValues.primaryColor);
    if (initialValues.secondaryColor) form.setValue("secondaryColor", initialValues.secondaryColor);
  }, [initialValues, form]);

  const validateAndUploadFile = async (file: File) => {
    setLocalUploadError(null);
    // 2MB size cap
    if (file.size > 2 * 1024 * 1024) {
      setLocalUploadError("Logo file size exceeds 2MB limit.");
      return;
    }
    // Allowed extensions
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setLocalUploadError("Invalid file type. Only PNG, JPG, JPEG, and SVG are allowed.");
      return;
    }

    try {
      const url = await onUploadLogo(file);
      form.setValue("logoUrl", url);
    } catch (err: any) {
      setLocalUploadError(err.message || "Failed to upload logo.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndUploadFile(e.target.files[0]);
    }
  };

  const handleRemoveLogo = () => {
    form.setValue("logoUrl", "");
    setLocalUploadError(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form Section */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6 text-left">
          
          {/* Logo settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-black/5 select-none">
              <ImageIcon className="size-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Workspace Logo</span>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1 select-none">
                Upload Logo Image
              </span>

              {localUploadError && (
                <div className="p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
                  <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                  <span>{localUploadError}</span>
                </div>
              )}

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all flex flex-col items-center justify-center gap-3 relative ${
                  dragActive 
                    ? "border-brand-primary bg-brand-primary/5" 
                    : "border-black/10 bg-surface/30 hover:border-black/25"
                }`}
              >
                <input
                  type="file"
                  id="logo-file-input"
                  accept="image/png, image/jpeg, image/jpg, image/svg+xml"
                  onChange={handleFileSelect}
                  className="absolute inset-0 size-full opacity-0 cursor-pointer z-10"
                  disabled={isUploadingLogo}
                />
                
                {isUploadingLogo ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="size-5 rounded-full border-2 border-black/10 border-t-brand-primary animate-spin" />
                    <span className="text-[11px] text-muted-foreground font-medium select-none">Uploading logo to storage…</span>
                  </div>
                ) : (
                  <>
                    <div className="size-10 rounded-full bg-black/5 grid place-items-center text-muted-foreground">
                      <Upload className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold select-none">
                        Drag and drop your logo here, or <span className="text-brand-primary underline decoration-dotted">browse files</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono select-none">
                        PNG, JPG, JPEG, SVG up to 2MB (horizontal layout recommended)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {logoUrl && (
                <div className="flex items-center justify-between p-3 border border-black/10 rounded-xl bg-surface/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={resolveAssetUrl(logoUrl)} alt="Current Logo" className="h-8 max-h-10 object-contain shrink-0" />
                    <span className="text-[10px] font-mono text-muted-foreground truncate select-all">
                      {logoUrl.split("/").pop()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="p-1.5 rounded-lg hover:bg-danger/10 hover:text-danger text-muted-foreground transition-all flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Pasting URL fallback */}
            <details className="group border border-black/5 rounded-xl bg-surface/10 overflow-hidden">
              <summary className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-ink cursor-pointer list-none flex items-center justify-between select-none">
                <span>Or paste direct image URL instead</span>
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t border-black/5 space-y-3">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="e.g. https://company.com/assets/logo.png"
                          className="font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormError />
                    </FormItem>
                  )}
                />
                <span className="text-[9px] text-muted-foreground block leading-normal select-none">
                  Paste the absolute URL of an externally hosted image. This will override any uploaded files.
                </span>
              </div>
            </details>
          </div>

          {/* Color theme settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-black/5 select-none">
              <Palette className="size-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Theme Colors</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Primary Color */}
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2 select-none">
                      Primary Color (CTA Buttons, Nav highlights)
                    </FormLabel>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg overflow-hidden border border-black/10 shrink-0 relative">
                        <input
                          type="color"
                          value={field.value}
                          onChange={field.onChange}
                          className="absolute inset-0 size-full border-0 p-0 cursor-pointer scale-125"
                        />
                      </div>
                      <FormControl>
                        <Input maxLength={7} className="w-32 font-mono text-center" {...field} />
                      </FormControl>
                    </div>
                    <FormError />
                  </FormItem>
                )}
              />

              {/* Secondary Color */}
              <FormField
                control={form.control}
                name="secondaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2 select-none">
                      Secondary Color (Button Text, highlights contrast)
                    </FormLabel>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg overflow-hidden border border-black/10 shrink-0 relative">
                        <input
                          type="color"
                          value={field.value}
                          onChange={field.onChange}
                          className="absolute inset-0 size-full border-0 p-0 cursor-pointer scale-125"
                        />
                      </div>
                      <FormControl>
                        <Input maxLength={7} className="w-32 font-mono text-center" {...field} />
                      </FormControl>
                    </div>
                    <FormError />
                  </FormItem>
                )}
              />

            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full py-3 text-xs font-semibold select-none">
            {isLoading ? "Applying Style Changes…" : "Save Custom Theme"}
          </Button>
        </form>
      </Form>

      {/* Live Interactive Preview */}
      <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between select-none">
        <div className="text-left">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-4 pb-2 border-b border-black/5">
            Live Interactive Preview
          </span>
          
          {/* Logo Preview */}
          <div className="mb-8">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">Logo Header Preview</span>
            <div className="h-14 border border-black/10 rounded-lg bg-canvas/80 backdrop-blur-md flex items-center px-4">
              {logoUrl ? (
                <img src={resolveAssetUrl(logoUrl)} alt="Logo Preview" className="h-8 max-h-10 object-contain" />
              ) : (
                <span className="font-serif italic text-xl tracking-tight text-ink">
                  Workspace
                </span>
              )}
            </div>
          </div>

          {/* Button Preview */}
          <div className="space-y-2">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block">Interactive Components Preview</span>
            <div className="p-4 border border-black/10 rounded-lg bg-canvas/80 space-y-4">
              <button
                type="button"
                style={{ backgroundColor: primaryColor, color: secondaryColor }}
                className="w-full py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-all shadow-sm cursor-default"
              >
                Primary Brand CTA
              </button>
              <div className="flex gap-2 justify-center">
                <div className="size-3 rounded-full" style={{ backgroundColor: primaryColor }} />
                <div className="size-3 rounded-full opacity-60" style={{ backgroundColor: primaryColor }} />
                <div className="size-3 rounded-full opacity-30" style={{ backgroundColor: primaryColor }} />
              </div>
            </div>
          </div>
        </div>

        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center mt-6">
          Preview updates dynamically as you select colors and URLs.
        </div>
      </div>
    </div>
  );
}
