import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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

// ---------------------------------------------------------------------------
// 1. SMTP Credentials Form
// ---------------------------------------------------------------------------
const smtpSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().min(1, "Port is required"),
  user: z.string().min(1, "User is required"),
  password: z.string().min(1, "Password is required"),
  fromEmail: z.string().email("Invalid email address"),
  secure: z.boolean(),
});

export type SmtpFormValues = z.infer<typeof smtpSchema>;

interface SmtpFormProps {
  initialValues: Partial<SmtpFormValues>;
  onSubmit: (data: SmtpFormValues) => void;
  isLoading: boolean;
}

export function SmtpForm({ initialValues, onSubmit, isLoading }: SmtpFormProps) {
  const form = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      host: initialValues.host || "",
      port: initialValues.port || 587,
      user: initialValues.user || "",
      password: initialValues.password || "",
      fromEmail: initialValues.fromEmail || "",
      secure: !!initialValues.secure,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 text-left">
        <div className="grid grid-cols-3 gap-2">
          <FormField
            control={form.control}
            name="host"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">SMTP Host</FormLabel>
                <FormControl>
                  <Input placeholder="smtp.mailtrap.io" className="font-mono text-xs py-1.5" {...field} />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="port"
            render={({ field }) => (
              <FormItem className="col-span-1">
                <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">SMTP Port</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="587"
                    className="font-mono text-xs py-1.5"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={form.control}
            name="user"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">SMTP User</FormLabel>
                <FormControl>
                  <Input className="font-mono text-xs py-1.5" {...field} />
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
                <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">SMTP Password</FormLabel>
                <FormControl>
                  <Input type="password" className="font-mono text-xs py-1.5" {...field} />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <FormField
            control={form.control}
            name="fromEmail"
            render={({ field }) => (
              <FormItem className="w-40">
                <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">From Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="support@company.com" className="font-mono text-xs py-1.5" {...field} />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secure"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0 mt-5">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="rounded border-black/10 text-ink focus:ring-black cursor-pointer"
                  />
                </FormControl>
                <FormLabel className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider cursor-pointer select-none">
                  Use SSL/TLS
                </FormLabel>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full mt-2 font-mono select-none">
          {isLoading ? "Saving Settings..." : "Save SMTP Credentials"}
        </Button>
      </form>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// 2. Slack Webhook Form
// ---------------------------------------------------------------------------
const slackSchema = z.object({
  webhookUrl: z.string().url("Must be a valid URL"),
});

export type SlackFormValues = z.infer<typeof slackSchema>;

interface SlackFormProps {
  initialValues: Partial<SlackFormValues>;
  onSubmit: (data: SlackFormValues) => void;
  isLoading: boolean;
}

export function SlackForm({ initialValues, onSubmit, isLoading }: SlackFormProps) {
  const form = useForm<SlackFormValues>({
    resolver: zodResolver(slackSchema),
    defaultValues: {
      webhookUrl: initialValues.webhookUrl || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 text-left">
        <FormField
          control={form.control}
          name="webhookUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Webhook URL</FormLabel>
              <FormControl>
                <Input placeholder="https://hooks.slack.com/services/..." className="font-mono text-xs py-1.5" {...field} />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full mt-2 font-mono select-none">
          {isLoading ? "Saving..." : "Save Slack Webhook"}
        </Button>
      </form>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// 3. WhatsApp Integration Form
// ---------------------------------------------------------------------------
const whatsappSchema = z.object({
  apiToken: z.string().min(1, "API Token is required"),
  phoneId: z.string().min(1, "Phone ID is required"),
});

export type WhatsAppFormValues = z.infer<typeof whatsappSchema>;

interface WhatsAppFormProps {
  initialValues: Partial<WhatsAppFormValues>;
  onSubmit: (data: WhatsAppFormValues) => void;
  isLoading: boolean;
}

export function WhatsAppForm({ initialValues, onSubmit, isLoading }: WhatsAppFormProps) {
  const form = useForm<WhatsAppFormValues>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: {
      apiToken: initialValues.apiToken || "",
      phoneId: initialValues.phoneId || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 text-left">
        <FormField
          control={form.control}
          name="apiToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">API Token</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Meta access token" className="font-mono text-xs py-1.5" {...field} />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phoneId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Phone Number ID</FormLabel>
              <FormControl>
                <Input placeholder="Meta phone number id" className="font-mono text-xs py-1.5" {...field} />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full mt-2 font-mono select-none">
          {isLoading ? "Saving..." : "Save WhatsApp Settings"}
        </Button>
      </form>
    </Form>
  );
}
