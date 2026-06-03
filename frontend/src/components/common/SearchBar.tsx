import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  className,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync state if controlled value changes from outside
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce value changes
  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [localValue, onChange, debounceMs]);

  return (
    <div className={`relative max-w-sm w-full ${className || ""}`}>
      <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
