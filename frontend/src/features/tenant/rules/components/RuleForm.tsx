import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2 } from "lucide-react";
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
import { RoutingRule } from "../types";

const conditionSchema = z.object({
  field: z.enum(["priority", "category", "client"]),
  operator: z.string(),
  value: z.string().min(1, "Criteria value is required"),
});

const ruleFormSchema = z.object({
  name: z.string().min(2, "Rule name must be at least 2 characters"),
  conditions: z.array(conditionSchema).min(1, "At least one condition is required"),
  targetTeamId: z.string(),
  targetAgentId: z.string(),
  assignmentMode: z.enum(["direct", "round-robin"]),
  isActive: z.boolean(),
});

export type RuleFormValues = z.infer<typeof ruleFormSchema>;

interface RuleFormProps {
  initialValues?: RoutingRule;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onCancel: () => void;
  clientsList: { id: string; name: string }[];
  teamsList: { id: string; name: string }[];
  staffList: { id: string; firstName: string; lastName: string }[];
  isEdit?: boolean;
}

export function RuleForm({
  initialValues,
  onSubmit,
  isLoading,
  onCancel,
  clientsList,
  teamsList,
  staffList,
  isEdit = false,
}: RuleFormProps) {
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: isEdit && initialValues
      ? {
          name: initialValues.name || "",
          conditions: [
            {
              field: initialValues.criteriaField || "priority",
              operator: "equals",
              value: initialValues.criteriaValue || "",
            },
          ],
          targetTeamId: initialValues.targetTeamId || "",
          targetAgentId: initialValues.targetAgentId || "",
          assignmentMode: initialValues.assignmentMode || "direct",
          isActive: initialValues.isActive !== false,
        }
      : {
          name: "",
          conditions: [{ field: "priority", operator: "equals", value: "" }],
          targetTeamId: "",
          targetAgentId: "",
          assignmentMode: "direct",
          isActive: true,
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "conditions",
  });

  const assignmentMode = form.watch("assignmentMode");

  const handleFormSubmit = (data: RuleFormValues) => {
    // Map array conditions back to criteriaField and criteriaValue for backend compatibility
    const primaryCondition = data.conditions[0];
    const payload = {
      name: data.name,
      criteriaField: primaryCondition.field,
      criteriaValue: primaryCondition.value,
      targetTeamId: data.targetTeamId || null,
      targetAgentId: data.targetAgentId || null,
      assignmentMode: data.assignmentMode,
      isActive: data.isActive,
    };
    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rule Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. VIP Triage Rule" {...field} />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        {/* Matching Criteria Block */}
        <div className="border border-black/10 rounded-xl p-4 bg-surface/5 space-y-4 text-left">
          <div className="flex justify-between items-center select-none">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Rule Conditions (If...)
            </span>
            {/* Limit to 1 for current backend database mapping but keep array structures */}
            {fields.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => append({ field: "priority", operator: "equals", value: "" })}
              >
                <Plus className="size-3 mr-1" /> Add Condition
              </Button>
            )}
          </div>

          {fields.map((condField, idx) => (
            <div key={condField.id} className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={`conditions.${idx}.field`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Match Field</FormLabel>
                      <FormControl>
                        <select
                          className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            form.setValue(`conditions.${idx}.value`, ""); // reset value on type change
                          }}
                        >
                          <option value="priority">Priority</option>
                          <option value="category">Category / Workstream</option>
                          <option value="client">Client Account</option>
                        </select>
                      </FormControl>
                      <FormError />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`conditions.${idx}.value`}
                  render={({ field }) => {
                    const criteriaFieldType = form.getValues(`conditions.${idx}.field`);
                    return (
                      <FormItem>
                        <FormLabel>Criteria Value</FormLabel>
                        <FormControl>
                          {criteriaFieldType === "priority" ? (
                            <select
                              className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                              {...field}
                            >
                              <option value="">Select Priority</option>
                              <option value="low">Low</option>
                              <option value="normal">Normal</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          ) : criteriaFieldType === "client" ? (
                            <select
                              className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                              {...field}
                            >
                              <option value="">Select Client Account</option>
                              {clientsList.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input placeholder="e.g. billing, motion" {...field} />
                          )}
                        </FormControl>
                        <FormError />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Show trash icon for future scaling if multiple are added, but hide for now since only 1 is supported */}
              {fields.length > 1 && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-danger hover:bg-danger/10 hover:text-danger h-7 text-[10px] px-2"
                    onClick={() => remove(idx)}
                  >
                    <Trash2 className="size-3 mr-1" /> Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
          {form.formState.errors.conditions?.root?.message && (
            <p className="text-[10px] text-danger font-mono mt-1">
              {form.formState.errors.conditions.root.message}
            </p>
          )}
        </div>

        {/* Assignment Target Block */}
        <div className="border border-black/10 rounded-xl p-4 bg-surface/5 space-y-4 text-left">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block select-none">
            Assignment Destination (Then...)
          </span>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="targetTeamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Support Team</FormLabel>
                  <FormControl>
                    <select
                      className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                      {...field}
                    >
                      <option value="">No Team Assigned</option>
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

            <FormField
              control={form.control}
              name="targetAgentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Agent (Direct Only)</FormLabel>
                  <FormControl>
                    <select
                      disabled={assignmentMode === "round-robin"}
                      className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all disabled:opacity-50"
                      {...field}
                    >
                      <option value="">No Agent Assigned</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormError />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="assignmentMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assignment Mode</FormLabel>
                <FormControl>
                  <select
                    className="w-full bg-canvas ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 transition-all"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      if (e.target.value === "round-robin") {
                        form.setValue("targetAgentId", ""); // clear agent in round robin
                      }
                    }}
                  >
                    <option value="direct">Direct (Static Assignment)</option>
                    <option value="round-robin">Round-Robin (Workload Load-Balanced)</option>
                  </select>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        {isEdit && (
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between p-4 border border-black/10 rounded-xl bg-surface/5 mt-4 text-left">
                <div>
                  <span className="text-xs font-semibold block">Active Rule Status</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Inactive rules are bypassed in the routing engine.
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
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-black/10">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : isEdit ? "Save Rule Settings" : "Create Rule"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
