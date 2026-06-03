import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/tenant/auth";
import { getActiveSubdomain, resolveAssetUrl } from "@/utils/api";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/lib/queryKeys";
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

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isLoggingIn, loginError } = useAuth();
  const activeSubdomain = getActiveSubdomain();

  const { data: workspaceData } = useQuery<any>({
    queryKey: queryKeys.auth.workspace(activeSubdomain),
    queryFn: async () => {
      if (!activeSubdomain) return null;
      return apiClient.get<any>("/auth/workspace");
    },
    enabled: !!activeSubdomain,
  });

  const org = workspaceData?.org || null;

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (values: LoginValues) => {
    try {
      await login(values);
    } catch (err) {
      console.error("Login attempt failed", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas text-ink px-6">
      <div className="w-full max-w-sm font-sans">
        <div className="text-center mb-10">
          <span className="font-serif italic text-4xl tracking-tight text-ink block mb-2 flex justify-center">
            {org?.logoUrl ? (
              <img src={resolveAssetUrl(org.logoUrl)} alt={org.name} className="h-10 max-w-[200px] object-contain" />
            ) : (
              org?.name || "Aura"
            )}
          </span>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Support desk authentication
          </p>
        </div>

        <div className="bg-canvas ring-1 ring-black/10 rounded-2xl p-8 shadow-sm">
          {loginError && (
            <div className="mb-6 p-4 bg-danger/5 ring-1 ring-danger/20 rounded-xl text-xs text-danger font-medium leading-relaxed">
              {loginError}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@company.com" {...field} />
                    </FormControl>
                    <FormError />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormError />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full mt-2"
                isLoading={isLoggingIn}
              >
                Sign In
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-8 leading-relaxed max-w-[28ch] mx-auto font-serif italic">
          "A calm mind brings inner strength and self-confidence, so that's very important for good health."
        </p>
      </div>
    </div>
  );
}
