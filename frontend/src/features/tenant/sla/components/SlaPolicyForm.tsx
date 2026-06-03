import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ShieldAlert, ShieldCheck } from "lucide-react";
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
import { SlaPolicyDetails } from "../types";

const DAYS = [
  { code: "1", label: "Mon" },
  { code: "2", label: "Tue" },
  { code: "3", label: "Wed" },
  { code: "4", label: "Thu" },
  { code: "5", label: "Fri" },
  { code: "6", label: "Sat" },
  { code: "7", label: "Sun" },
];

const targetSchema = z.object({
  id: z.string(),
  slaPolicyId: z.string(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  responseTimeHours: z.number().min(0, "Must be positive"),
  resolutionTimeHours: z.number().min(0, "Must be positive"),
  escalateAfterHours: z.number().min(0, "Must be positive"),
});

const slaFormSchema = z.object({
  name: z.string().min(2, "Policy name must be at least 2 characters"),
  description: z.string(),
  businessHoursStart: z.string().min(5, "Start time is required"),
  businessHoursEnd: z.string().min(5, "End time is required"),
  businessDays: z.array(z.string()).min(1, "Select at least one day"),
  targets: z.array(targetSchema),
}).refine(
  (data) => {
    return data.targets.every((t) => t.responseTimeHours <= t.resolutionTimeHours);
  },
  {
    message: "Response hours cannot exceed resolution hours for any priority level.",
    path: ["targets"],
  }
);

export type SlaFormValues = z.infer<typeof slaFormSchema>;

interface SlaPolicyFormProps {
  policyDetails: SlaPolicyDetails;
  onSubmit: (data: SlaFormValues) => void;
  isLoading: boolean;
  error: string | null;
  success: boolean;
  onMakeDefault?: () => void;
  isMakingDefault?: boolean;
}

export function SlaPolicyForm({
  policyDetails,
  onSubmit,
  isLoading,
  error,
  success,
  onMakeDefault,
  isMakingDefault,
}: SlaPolicyFormProps) {
  const formatTime = (t: string) => (t && t.length >= 5 ? t.substring(0, 5) : t);

  const form = useForm<SlaFormValues>({
    resolver: zodResolver(slaFormSchema),
    defaultValues: {
      name: policyDetails.name || "",
      description: policyDetails.description || "",
      businessHoursStart: formatTime(policyDetails.businessHoursStart) || "09:00",
      businessHoursEnd: formatTime(policyDetails.businessHoursEnd) || "18:00",
      businessDays: policyDetails.businessDays || [],
      targets: policyDetails.targets || [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "targets",
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="border border-black/10 rounded-2xl bg-canvas p-6 shadow-sm">
          {/* Editor Header Status */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-black/5">
            <div>
              <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-muted-foreground select-none">
                Policy Configuration Editor
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 select-none">
                Set working calendars and priority deadline multipliers.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!policyDetails.isDefault && onMakeDefault && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onMakeDefault}
                  disabled={isMakingDefault || isLoading}
                >
                  Make Org Default
                </Button>
              )}
              
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving Settings..." : "Save Policy Settings"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {form.formState.errors.targets?.root?.message && (
            <div className="mb-6 p-3 bg-danger/5 ring-1 ring-danger/15 rounded-lg text-xs text-danger flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>{form.formState.errors.targets.root.message}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3 bg-success/5 ring-1 ring-success/15 rounded-lg text-xs text-success flex items-start gap-2">
              <ShieldCheck className="size-4 shrink-0 mt-0.5" />
              <span>SLA policy settings successfully saved!</span>
            </div>
          )}

          <div className="space-y-6">
            {/* General details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 select-none">
                <span className="text-xs font-semibold block">SLA Identity</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Name and purpose explanation.
                </span>
              </div>

              <div className="md:col-span-2 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Policy Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. VIP Policy" {...field} />
                      </FormControl>
                      <FormError />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <textarea
                          className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all resize-none"
                          rows={2}
                          placeholder="Describe this policy..."
                          {...field}
                        />
                      </FormControl>
                      <FormError />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <hr className="border-black/5" />

            {/* Business Hours Calendar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 select-none">
                <span className="text-xs font-semibold block">Business Hours Calendar</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Defines days and hours when SLA response and resolution timers are active.
                </span>
              </div>

              <div className="md:col-span-2 space-y-4">
                {/* Day Selector checkboxes */}
                <FormField
                  control={form.control}
                  name="businessDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Working Days</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {DAYS.map((d) => {
                          const isActive = field.value?.includes(d.code);
                          return (
                            <button
                              type="button"
                              key={d.code}
                              onClick={() => {
                                const nextVal = isActive
                                  ? field.value.filter((val) => val !== d.code)
                                  : [...(field.value || []), d.code].sort();
                                field.onChange(nextVal);
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                                isActive
                                  ? "bg-black text-canvas"
                                  : "bg-black/5 hover:bg-black/10 text-muted-foreground"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                      <FormError />
                    </FormItem>
                  )}
                />

                {/* Working Hours start/end picker */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessHoursStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Working Hours Start</FormLabel>
                        <FormControl>
                          <Input type="time" className="font-mono" {...field} />
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessHoursEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Working Hours End</FormLabel>
                        <FormControl>
                          <Input type="time" className="font-mono" {...field} />
                        </FormControl>
                        <FormError />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <hr className="border-black/5" />

            {/* Targets Threshold Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 select-none">
                <span className="text-xs font-semibold block">SLA Target Thresholds</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Set target intervals (in hours) for First Response, Resolution, and warning offset.
                </span>
              </div>

              <div className="md:col-span-2 space-y-4">
                {fields.map((targetField, idx) => (
                  <div
                    key={targetField.id}
                    className="border border-black/10 rounded-xl p-4 bg-surface/5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center"
                  >
                    <div className="sm:col-span-1 select-none">
                      <span className="text-xs font-bold uppercase tracking-wider font-mono block">
                        {form.getValues(`targets.${idx}.priority`)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:col-span-3 gap-2">
                      <FormField
                        control={form.control}
                        name={`targets.${idx}.responseTimeHours`}
                        render={({ field }) => (
                          <FormItem className="space-y-0.5">
                            <FormLabel className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground">Response (h)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                className="font-mono h-8 text-xs py-1"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                              />
                            </FormControl>
                            <FormError />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`targets.${idx}.resolutionTimeHours`}
                        render={({ field }) => (
                          <FormItem className="space-y-0.5">
                            <FormLabel className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground">Resolve (h)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                className="font-mono h-8 text-xs py-1"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                              />
                            </FormControl>
                            <FormError />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`targets.${idx}.escalateAfterHours`}
                        render={({ field }) => (
                          <FormItem className="space-y-0.5">
                            <FormLabel className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground">Escalate (h)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                className="font-mono h-8 text-xs py-1"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                              />
                            </FormControl>
                            <FormError />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
