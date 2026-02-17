export interface NavItem {
  label: string;
  href: string;
}

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { label: 'CRM', href: '/dashboard/crm' },
  { label: 'Bookings', href: '/dashboard/bookings' },
  { label: 'Projects', href: '/dashboard/projects' },
  { label: 'Inventory', href: '/dashboard/inventory' },
  { label: 'Rentals', href: '/dashboard/rentals' },
  { label: 'Billing', href: '/dashboard/billing' }
];
