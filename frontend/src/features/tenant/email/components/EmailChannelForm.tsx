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

const emailChannelSchema = z.object({
  emailAddress: z.string().email("Invalid email address"),
  isActive: z.boolean(),
  defaultClientId: z.string(),
  defaultTeamId: z.string(),
  defaultPriority: z.enum(["low", "normal", "high", "urgent"]),
  unknownSenderPolicy: z.enum(["quarantine", "create_client", "reject"]),
  replyBehavior: z.enum(["reopen_resolved", "create_new_ticket", "ignore"]),
  autoAckEnabled: z.boolean(),
});

export type EmailChannelFormValues = z.infer<typeof emailChannelSchema>;

interface EmailChannelFormProps {
  initialValues: Partial<EmailChannelFormValues>;
  onSubmit: (data: EmailChannelFormValues) => void;
  isLoading: boolean;
  clientsList: { id: string; name: string }[];
  teamsList: { id: string; name: string }[];
}

export function EmailChannelForm({
  initialValues,
  onSubmit,
  isLoading,
  clientsList,
  teamsList,
}: EmailChannelFormProps) {
  const form = useForm<EmailChannelFormValues>({
    resolver: zodResolver(emailChannelSchema),
    defaultValues: {
      emailAddress: initialValues.emailAddress || "",
      isActive: initialValues.isActive !== false,
      defaultClientId: initialValues.defaultClientId || "",
      defaultTeamId: initialValues.defaultTeamId || "",
      defaultPriority: initialValues.defaultPriority || "normal",
      unknownSenderPolicy: initialValues.unknownSenderPolicy as any || "quarantine",
      replyBehavior: initialValues.replyBehavior as any || "reopen_resolved",
      autoAckEnabled: initialValues.autoAckEnabled !== false,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-left">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="emailAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inbound Service Email Address</FormLabel>
                <FormControl>
                  <Input placeholder="support@aura.com" className="font-mono" {...field} />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultPriority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Ticket Priority</FormLabel>
                <FormControl>
                  <select
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    {...field}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="defaultClientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Client Account mapping</FormLabel>
                <FormControl>
                  <select
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    {...field}
                  >
                    <option value="">No Client Account (External/Isolated)</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultTeamId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Support Team assignment</FormLabel>
                <FormControl>
                  <select
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    {...field}
                  >
                    <option value="">No Team (Inboxes Queue)</option>
                    {teamsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unknownSenderPolicy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unknown Sender Policy</FormLabel>
                <FormControl>
                  <select
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    {...field}
                  >
                    <option value="quarantine">Quarantine Sender (Review Queue)</option>
                    <option value="create_client">Auto-register Guest User</option>
                    <option value="reject">Reject & Ignore Inbound Mail</option>
                  </select>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="replyBehavior"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Replies to Resolved Tickets</FormLabel>
                <FormControl>
                  <select
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    {...field}
                  >
                    <option value="reopen_resolved">Re-Open Original Case</option>
                    <option value="create_new_ticket">Generate New Thread / Ticket</option>
                    <option value="ignore">Ignore Inbound Response</option>
                  </select>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-black/10 rounded-xl p-4 bg-surface/5">
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between space-y-0 py-1">
                <div>
                  <span className="text-xs font-semibold block">Channel Status</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Deactivated channels ignore inbound mail listener cron jobs.
                  </span>
                </div>
                <FormControl>
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`relative w-10 h-6 rounded-full transition-colors flex items-center shrink-0 ${
                      field.value ? "bg-black" : "bg-black/10"
                    }`}
                  >
                    <span
                      className={`size-5 rounded-full bg-canvas shadow-sm transition-transform absolute ${
                        field.value ? "right-0.5" : "left-0.5"
                      }`}
                    />
                  </button>
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="autoAckEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between space-y-0 py-1">
                <div>
                  <span className="text-xs font-semibold block">Auto-Response (Receipt Ack)</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Send automated ticket receipt emails to submitters on ingestion.
                  </span>
                </div>
                <FormControl>
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={`relative w-10 h-6 rounded-full transition-colors flex items-center shrink-0 ${
                      field.value ? "bg-black" : "bg-black/10"
                    }`}
                  >
                    <span
                      className={`size-5 rounded-full bg-canvas shadow-sm transition-transform absolute ${
                        field.value ? "right-0.5" : "left-0.5"
                      }`}
                    />
                  </button>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading} className="w-full select-none">
          {isLoading ? "Saving Settings..." : "Save Channel Configurations"}
        </Button>
      </form>
    </Form>
  );
}
