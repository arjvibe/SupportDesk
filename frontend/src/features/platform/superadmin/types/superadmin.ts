export type Organization = {
  id: string;
  name: string;
  subdomain: string;
  subscriptionTier: string;
  isActive: boolean;
  userCount: number;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrganizationPayload = {
  name: string;
  subdomain: string;
  subscriptionTier: string;
  adminEmail?: string;
  adminPassword?: string;
  adminFirstName?: string;
  adminLastName?: string;
};

export type EditOrganizationPayload = {
  name: string;
  subdomain: string;
  subscriptionTier: string;
  isActive: boolean;
};

export type NotificationChannelConfig = {
  channel: string;
  enabled: boolean;
  config: any;
};
