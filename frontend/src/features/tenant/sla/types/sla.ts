export interface SlaTarget {
  id: string;
  slaPolicyId: string;
  priority: "low" | "normal" | "high" | "urgent";
  responseTimeHours: number;
  resolutionTimeHours: number;
  escalateAfterHours: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface SlaPolicy {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessDays: string[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface SlaPolicyDetails extends SlaPolicy {
  targets: SlaTarget[];
}
