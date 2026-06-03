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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StaffMember } from "../api/clientsApi";

const clientSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string(),
  clientTier: z.enum(["trial", "business", "enterprise"]),
  ownerId: z.string(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormProps {
  onSubmit: (values: ClientFormValues) => void;
  isPending: boolean;
  staffList: StaffMember[];
  defaultValues?: Partial<ClientFormValues>;
}

export function ClientForm({ onSubmit, isPending, staffList, defaultValues }: ClientFormProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      domain: "",
      clientTier: "trial",
      ownerId: "",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input placeholder="E.g. Wayne Enterprises" {...field} />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Domain (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="E.g. wayne.com" {...field} />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientTier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Tier</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Tier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Owner</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Owner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Select Owner</SelectItem>
                    {staffList.map((st) => (
                      <SelectItem key={st.id} value={st.id}>
                        {st.firstName} {st.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormError />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full mt-2" isLoading={isPending}>
          {defaultValues ? "Save Changes" : "Create Account"}
        </Button>
      </form>
    </Form>
  );
}
