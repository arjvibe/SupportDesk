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

const teamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters"),
  description: z.string(),
});

export type TeamFormValues = z.infer<typeof teamSchema>;

interface TeamFormProps {
  onSubmit: (data: TeamFormValues) => void;
  isLoading: boolean;
  onCancel: () => void;
}

export function TeamForm({ onSubmit, isLoading, onCancel }: TeamFormProps) {
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      description: "",
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
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Tier 1 Support" {...field} />
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
                  className="w-full min-h-20 px-3 py-2 text-xs border border-black/10 rounded-lg bg-surface/5 focus:bg-canvas focus:outline-none focus:ring-1 focus:ring-black/20 font-sans"
                  placeholder="Describe the team's coverage scope..."
                  {...field}
                />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

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
            {isLoading ? "Creating..." : "Create Team"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
