import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { getApiBase, getActiveSubdomain, resolveAssetUrl } from "../utils/api";
import { ShieldAlert, ShieldCheck, Palette, Image as ImageIcon, Upload, Trash2 } from "lucide-react";

const API_BASE = getApiBase();

export default function BrandingSettings() {
  const queryClient = useQueryClient();
  const { org } = useAuth();
  const activeSubdomain = getActiveSubdomain();

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const [secondaryColor, setSecondaryColor] = useState("#ffffff");

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [dragActive, setDragActive] = useState(false);

  // Mutation to handle logo file upload
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch(`${API_BASE}/uploads/logo`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload logo file");
      return data;
    },
    onSuccess: (data) => {
      setLogoUrl(data.logoUrl);
      setSaveError(null);
      // We do NOT invalidate queries or trigger saves here, keeping changes local to form preview
    },
    onError: (err: any) => {
      setSaveError(err.message || "Failed to upload logo image");
    }
  });

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
      const file = e.dataTransfer.files[0];
      uploadLogoMutation.mutate(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      uploadLogoMutation.mutate(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
  };

  // Sync state when org context is available
  useEffect(() => {
    if (org) {
      setLogoUrl(org.logoUrl || "");
      setPrimaryColor(org.primaryColor || "#000000");
      setSecondaryColor(org.secondaryColor || "#ffffff");
    }
  }, [org]);

  // Mutation to save settings
  const saveBrandingMutation = useMutation({
    mutationFn: async (payload: { logoUrl: string; primaryColor: string; secondaryColor: string }) => {
      const res = await fetch(`${API_BASE}/settings/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save branding settings");
      return data;
    },
    onSuccess: () => {
      // Invalidate both authenticated session cache and public workspace info
      queryClient.invalidateQueries({ queryKey: ["auth_session"] });
      queryClient.invalidateQueries({ queryKey: ["public_workspace", activeSubdomain] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => {
      setSaveError(err.message || "Failed to update branding settings");
      setSaveSuccess(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    // Validate Hex Colors
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(primaryColor)) {
      setSaveError("Primary color must be a valid 6-character hex code (e.g. #3b82f6)");
      return;
    }
    if (!hexRegex.test(secondaryColor)) {
      setSaveError("Secondary color must be a valid 6-character hex code (e.g. #ffffff)");
      return;
    }

    saveBrandingMutation.mutate({
      logoUrl: logoUrl.trim(),
      primaryColor: primaryColor.trim(),
      secondaryColor: secondaryColor.trim(),
    });
  };

  return (
    <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm font-sans text-ink">
      <div className="border-b border-black/5 pb-4 mb-6 text-left">
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground">
          Workspace Branding & Style Customization
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize your support portal with your company logo and brand colors.
        </p>
      </div>

      {saveSuccess && (
        <div className="mb-6 p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2 text-left">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <span>Branding theme updated successfully! Colors and logos are applied instantly.</span>
        </div>
      )}

      {saveError && (
        <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2 text-left">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Editor Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6 text-left">
          
          {/* Logo Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-black/5">
              <ImageIcon className="size-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Workspace Logo</span>
            </div>
            
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1">
                Upload Logo Image
              </span>
              
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
                  disabled={uploadLogoMutation.isPending}
                />
                
                {uploadLogoMutation.isPending ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="size-5 rounded-full border-2 border-black/10 border-t-brand-primary animate-spin" />
                    <span className="text-[11px] text-muted-foreground font-medium">Uploading logo to storage…</span>
                  </div>
                ) : (
                  <>
                    <div className="size-10 rounded-full bg-black/5 grid place-items-center text-muted-foreground">
                      <Upload className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">
                        Drag and drop your logo here, or <span className="text-brand-primary underline decoration-dotted">browse files</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        PNG, JPG, JPEG, SVG up to 2MB (horizontal layout recommended)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {logoUrl && (
                <div className="flex items-center justify-between p-3 border border-black/10 rounded-xl bg-surface/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={resolveAssetUrl(logoUrl)} alt="Current Logo" className="h-8 max-w-[120px] object-contain shrink-0" />
                    <span className="text-[10px] font-mono text-muted-foreground truncate">
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

            {/* URL Fallback Collapsible */}
            <details className="group border border-black/5 rounded-xl bg-surface/10 overflow-hidden">
              <summary className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-ink cursor-pointer list-none flex items-center justify-between select-none">
                <span>Or paste direct image URL instead</span>
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t border-black/5 space-y-3">
                <input
                  type="text"
                  placeholder="e.g. https://company.com/assets/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all font-mono"
                />
                <span className="text-[9px] text-muted-foreground block leading-normal">
                  Paste the absolute URL of an externally hosted image. This will override any uploaded files.
                </span>
              </div>
            </details>
          </div>

          {/* Color Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-black/5">
              <Palette className="size-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">Theme Colors</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Primary Color */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                  Primary Color (CTA Buttons, Nav highlights)
                </span>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg overflow-hidden border border-black/10 shrink-0 relative">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="absolute inset-0 size-full border-0 p-0 cursor-pointer scale-125"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={7}
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#000000"
                    className="w-32 bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all font-mono text-center"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                  Secondary Color (Button Text, highlights contrast)
                </span>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg overflow-hidden border border-black/10 shrink-0 relative">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="absolute inset-0 size-full border-0 p-0 cursor-pointer scale-125"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={7}
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#ffffff"
                    className="w-32 bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all font-mono text-center"
                  />
                </div>
              </div>

            </div>
          </div>

          <button
            type="submit"
            disabled={saveBrandingMutation.isPending}
            className="w-full bg-brand-primary text-brand-secondary py-3 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            {saveBrandingMutation.isPending ? "Applying Style Changes…" : "Save Custom Theme"}
          </button>
        </form>

        {/* Real-time Theme Preview */}
        <div className="border border-black/10 rounded-xl p-5 bg-surface/5 flex flex-col justify-between">
          <div className="text-left">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-4 pb-2 border-b border-black/5">
              Live Interactive Preview
            </span>
            
            {/* Logo Preview */}
            <div className="mb-8">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">Logo Header Preview</span>
              <div className="h-14 border border-black/10 rounded-lg bg-canvas/80 backdrop-blur-md flex items-center px-4">
                {logoUrl ? (
                  <img src={resolveAssetUrl(logoUrl)} alt="Logo Preview" className="h-8 max-w-full object-contain" />
                ) : (
                  <span className="font-serif italic text-xl tracking-tight text-ink">
                    {org?.name || "Workspace"}
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
    </div>
  );
}
