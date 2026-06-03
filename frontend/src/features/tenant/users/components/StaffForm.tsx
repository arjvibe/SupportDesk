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

const baseSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "agent"]),
  jobTitle: z.string().optional().default(""),
});

const createSchema = baseSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const editSchema = baseSchema.extend({
  isActive: z.boolean(),
});

export type StaffCreateValues = z.infer<typeof createSchema>;
export type StaffEditValues = z.infer<typeof editSchema>;

interface StaffFormProps {
  initialValues?: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onCancel: () => void;
  isEdit?: boolean;
}

export function StaffForm({
  initialValues,
  onSubmit,
  isLoading,
  onCancel,
  isEdit = false,
}: StaffFormProps) {
  const schema = isEdit ? editSchema : createSchema;
  
  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          firstName: initialValues?.firstName || "",
          lastName: initialValues?.lastName || "",
          email: initialValues?.email || "",
          role: initialValues?.role || "agent",
          jobTitle: initialValues?.jobTitle || "",
          isActive: initialValues?.isActive !== false,
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          role: "agent",
          jobTitle: "",
          password: "",
        },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john.doe@company.com" {...field} />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        {!isEdit && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workspace Role</FormLabel>
                <FormControl>
                  <select
                    className="w-full bg-surface ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all"
                    {...field}
                  >
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Lead Engineer" {...field} />
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
              <FormItem className="flex flex-row items-center gap-2 space-y-0 py-2 text-left">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="size-4 accent-black rounded border-black/10 focus:ring-0 cursor-pointer"
                  />
                </FormControl>
                <FormLabel className="text-xs font-semibold cursor-pointer select-none">
                  Active Status (Agents must be active to login and receive tickets)
                </FormLabel>
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
            {isLoading
              ? isEdit
                ? "Saving..."
                : "Registering..."
              : isEdit
              ? "Save Changes"
              : "Register Staff"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
