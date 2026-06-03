import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { getApiBase, getActiveSubdomain, resolveAssetUrl } from "../utils/api";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { BrandingForm, BrandingFormValues } from "@/features/tenant/branding";

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

  // Sync state when org context is available
  useEffect(() => {
    if (org) {
      setLogoUrl(org.logoUrl || "");
      setPrimaryColor(org.primaryColor || "#000000");
      setSecondaryColor(org.secondaryColor || "#ffffff");
    }
  }, [org]);

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
    },
    onError: (err: any) => {
      setSaveError(err.message || "Failed to upload logo image");
    }
  });

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

  const handleUploadLogoFile = async (file: File): Promise<string> => {
    const data = await uploadLogoMutation.mutateAsync(file);
    return data.logoUrl;
  };

  const handleFormSubmit = (data: BrandingFormValues) => {
    setSaveError(null);
    setSaveSuccess(false);

    saveBrandingMutation.mutate({
      logoUrl: (data.logoUrl || "").trim(),
      primaryColor: data.primaryColor.trim(),
      secondaryColor: data.secondaryColor.trim(),
    });
  };

  return (
    <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm font-sans text-ink">
      <div className="border-b border-black/5 pb-4 mb-6 text-left select-none">
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

      <BrandingForm
        initialValues={{
          logoUrl,
          primaryColor,
          secondaryColor,
        }}
        onSubmit={handleFormSubmit}
        isLoading={saveBrandingMutation.isPending}
        onUploadLogo={handleUploadLogoFile}
        isUploadingLogo={uploadLogoMutation.isPending}
        resolveAssetUrl={resolveAssetUrl}
      />
    </div>
  );
}
