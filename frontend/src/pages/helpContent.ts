import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Compass,
  History as HistoryIcon,
  LogOut,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  ShoppingCart,
  Store as StoreIcon,
  Tags,
  Target,
  Truck,
  User as UserIcon,
  Users,
} from 'lucide-react';
import type { Role } from '../types/auth';

export interface HelpSection {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  bullets?: string[];
  steps?: string[];
  important?: string[];
}

export interface HelpGroup {
  id: string;
  title: string;
  sections: HelpSection[];
}

// Shared across every role — sign-in, notifications, profile, and logout
// behave identically regardless of what dashboard the user lands on.
const GETTING_STARTED_SECTION: HelpSection = {
  id: 'common-getting-started',
  title: 'Getting Started',
  icon: Compass,
  description: 'NForce RetailOps opens the right dashboard for you automatically based on your role.',
  steps: [
    'Sign in using the credentials provided to you.',
    'The application opens the dashboard for your role automatically.',
    'Use the navigation menu to move between the features available to you.',
    'The features you see depend on your role and permissions.',
  ],
};

const COMMON_SECTIONS: HelpSection[] = [
  GETTING_STARTED_SECTION,
  {
    id: 'common-notifications',
    title: 'Notifications',
    icon: Bell,
    description: 'Notifications keep you informed about activity associated with your account.',
    bullets: [
      'View notifications associated with your account.',
      'Mark a notification as read, or mark all as read.',
    ],
  },
  {
    id: 'common-profile',
    title: 'Profile',
    icon: UserIcon,
    description: 'Your Profile shows your account details.',
    bullets: [
      'View your name, email, and role.',
      'Update your basic profile information and photo where the app allows it.',
      'Change your password from the Profile page.',
    ],
    important: [
      'Which fields you can edit depends on your account type.',
    ],
  },
  {
    id: 'common-logout',
    title: 'Logout & Session Timeout',
    icon: LogOut,
    description: 'Sign out manually, or the app will sign you out automatically after a period of inactivity.',
    bullets: [
      'Open the profile menu and choose Logout.',
      'Confirm the logout when prompted.',
      'After logging out, your session is cleared and you return to the sign-in screen.',
    ],
    important: [
      'The app also enforces an inactivity timeout and signs you out automatically to keep your account secure.',
    ],
  },
];

// Shared between Owner/Admin and Super Admin: both answer a missed End of Day
// from the same Notifications panel, and only the first answer is kept.
const MISSED_END_OF_DAY_ADMIN_SECTION: HelpSection = {
  id: 'admin-missed-eod',
  title: 'Missed End of Day Counts',
  icon: AlertTriangle,
  description:
    "If an item had a Start of Day count yesterday but no End of Day count, you and the store's employees are notified the next day.",
  steps: [
    'Open Notifications and find the missed End of Day notification.',
    'For each item, choose Counted this item and enter the available and damaged / spoiled stock, then Save End of Day.',
    "Or choose Couldn't count it and explain why (at least 5 words), then Submit reason.",
  ],
  important: [
    'Each item is answered once: whoever responds first (you or an employee) is the answer that is kept.',
    "Employees cannot record today's Start of Day for an item until yesterday's missed End of Day is answered.",
    'A counted answer is saved as a normal End of Day and updates the order list.',
  ],
};

const SUPER_ADMIN_SECTIONS: HelpSection[] = [
  {
    id: 'sa-dashboard',
    title: 'Dashboard & Operations',
    icon: BarChart3,
    description: 'Your dashboard gives you a platform-wide view of operational activity across all stores and owners.',
    bullets: [
      'Monitor platform-level statistics and trends.',
      'Get a quick view of activity across every store on the platform.',
    ],
  },
  {
    id: 'sa-owners',
    title: 'Owners/Admins',
    icon: Building2,
    description: 'Manage the Owner/Admin accounts that run each store.',
    bullets: [
      'Create a new Owner/Admin account.',
      "Edit an Owner/Admin's details.",
      'Activate or deactivate an Owner/Admin account.',
      'Assign or remove store access for an Owner/Admin.',
      'Review which stores are assigned to each Owner/Admin.',
    ],
  },
  {
    id: 'sa-stores',
    title: 'Stores',
    icon: StoreIcon,
    description: 'Manage stores across the platform.',
    bullets: [
      'Create a new store.',
      'Edit store details.',
      'Activate or deactivate a store.',
      "Assign or reassign a store's Owner/Admin.",
      'View all stores across the platform.',
    ],
  },
  {
    id: 'sa-employees',
    title: 'Employees',
    icon: Users,
    description: 'Manage employee accounts across every owner and store.',
    bullets: [
      'View employees across every owner and store.',
      'Create a new employee account.',
      'Update employee information.',
      'Activate or deactivate an employee.',
      'Delete an employee account.',
      'Assign or reassign an employee to a store.',
    ],
  },
  {
    id: 'sa-categories',
    title: 'Categories',
    icon: Tags,
    description: 'Manage the task categories used across the platform.',
    bullets: [
      'Create a new category.',
      'Edit an existing category.',
      'Activate or deactivate a category.',
      'Delete a category.',
    ],
  },
  {
    id: 'sa-checklist',
    title: 'Daily Checklist',
    icon: ClipboardList,
    description: 'Review task responses submitted at any store.',
    bullets: [
      'Select a store to review.',
      'Select a historical date.',
      'Review the task responses submitted for that store and date.',
      'Identify eligible responses that may need correction.',
    ],
  },
  {
    id: 'sa-corrections',
    title: 'Correcting Historical Responses',
    icon: Pencil,
    description: 'Correct an eligible historical response when an error is found, for any store.',
    bullets: [
      'Open an eligible historical response from the Daily Checklist.',
      'Enter the corrected value.',
      'Provide a reason for the correction.',
      'Save the correction.',
      'Review the correction history for a response, including the original value, the corrected value, who made the change, when it was made, and the reason given.',
    ],
    important: [
      'A correction reason is required before you can save.',
      'The original response is retained, and every correction is permanently recorded in correction history.',
      'As Super Admin, you can correct eligible responses across any store.',
    ],
  },
  {
    id: 'sa-reports',
    title: 'Platform Reports',
    icon: BarChart3,
    description: 'View platform-level statistics and trends across stores.',
    bullets: [
      'View operational statistics and trends across the platform.',
    ],
  },
  {
    id: 'sa-inventory',
    title: 'Inventory Catalogue',
    icon: Boxes,
    description: "Manage every store's inventory items, inventory categories, and stock check history from the Inventory tab.",
    bullets: [
      'Items: select a store to view, filter, and export its items (CSV or PDF).',
      'Add Item: use Select Store to add an item to one store, several stores, or All Stores.',
      'Click an item to edit its name, category, unit, Weekday Min (Mon–Thu), Weekend Min (Fri–Sun), and preferred supplier.',
      'Activate, deactivate, or delete an item.',
      'Add a new unit of measurement from the Unit dropdown (Add new unit). New units are available to every store.',
      'Categories: add, edit, activate/deactivate, and delete inventory categories.',
      'Stock Check History: review counts across stores by date range, export to Excel or PDF, and use Correct this count to fix a Start of Day or End of Day count with a reason.',
    ],
    important: [
      'Every stock count correction is recorded in the correction history with who made it and why.',
    ],
  },
  {
    id: 'sa-suppliers',
    title: 'Suppliers',
    icon: Truck,
    description: 'Manage the suppliers that inventory items are ordered from.',
    bullets: [
      'Add Supplier with a name, contact number, location, and the store(s) it serves.',
      'Edit, activate/deactivate, or delete a supplier.',
      'Use Show Details to see how many items each store gets from a supplier.',
    ],
    important: [
      'A supplier with order history is deactivated instead of deleted.',
      'Owner/Admins can choose existing suppliers but cannot add new ones.',
    ],
  },
  {
    id: 'sa-orders',
    title: 'Orders',
    icon: ShoppingCart,
    description: "Run any store's order list and reports from the Orders tab.",
    bullets: [
      'Select a store to work its Order List, Inventory Counts, and End of Day Report. These work the same way as for Owner/Admins.',
      'Purchasing Report shows ordered and received quantities by supplier across all stores, or for one store when one is selected.',
    ],
  },
  MISSED_END_OF_DAY_ADMIN_SECTION,
  {
    id: 'sa-daily-cash',
    title: 'Daily Cash',
    icon: Banknote,
    description: "Enter or review any active store's daily cash figures.",
    bullets: [
      'Select a store, then a business date.',
      'Enter or update the cash figures and save. The form works the same way as for Owner/Admins.',
    ],
    important: [
      'Saving a date that already has an entry overwrites it.',
    ],
  },
  {
    id: 'sa-cash-target',
    title: 'Cash Drawer Targets',
    icon: Target,
    description: 'Set how much cash a store’s drawer should hold at the start of each day.',
    steps: [
      'Open Stores.',
      'Click the cash icon (Cash drawer target) on the store’s row.',
      'Enter the new target amount and save.',
    ],
    important: [
      'Targets can only be set for active stores.',
    ],
  },
  {
    id: 'sa-month-end-cash',
    title: 'Month-End Cash',
    icon: CalendarRange,
    description: 'Review monthly cash totals and the closing reconciliation for one store or all stores combined.',
    bullets: [
      'Move between months with the Previous month / Next month arrows.',
      'All Stores (the default) shows the combined totals of every store that recorded cash that month.',
      'Select a store to see its totals, closing variance, and Daily Breakdown.',
    ],
    important: [
      'Negative variance is a shortage; positive variance is an overage.',
      'This page is read-only. Make changes from Daily Cash.',
    ],
  },
  {
    id: 'sa-issues',
    title: 'Issues',
    icon: MessageSquareWarning,
    description: 'Review issues raised by employees across every store. Open Issues from the profile menu or the Home issues tile.',
    bullets: [
      'Filter by status (Active, Open, Acknowledged, Resolved, All Status) and by store, or search by store, employee, or issue.',
      'Acknowledge an Open issue, or Resolve an Open or Acknowledged issue, with an optional response.',
      'Use Nudge owner to remind the store owner to act on an unresolved issue.',
    ],
    important: [
      'Acknowledging or resolving notifies both the employee and the store owner.',
      'You can nudge an owner about the same issue once every 24 hours.',
    ],
  },
];

const OWNER_ADMIN_SECTIONS: HelpSection[] = [
  {
    id: 'oa-dashboard',
    title: 'Dashboard',
    icon: BarChart3,
    description: "Your dashboard gives you a quick view of your store's activity.",
    bullets: [
      "View a summary of today's completion, employees, categories, and open issues for your store.",
    ],
    important: [
      'Your dashboard and store-specific features are currently focused on your assigned store.',
    ],
  },
  {
    id: 'oa-checklist',
    title: 'Daily Checklist',
    icon: ClipboardList,
    description: 'Review task responses submitted by employees for your store.',
    bullets: [
      "Review today's task responses for your store.",
      'Select a historical date to review past responses.',
      'Correct an eligible response if an error is found.',
    ],
    important: [
      'Checklist access is limited to your store.',
    ],
  },
  {
    id: 'oa-tasks',
    title: 'Tasks',
    icon: CheckSquare,
    description: 'Create and manage the tasks your employees complete.',
    bullets: [
      'Create a new task.',
      "Choose the task's category.",
      'Set the response type (Yes/No, numeric, or text).',
      'Set the completion type (single or multiple completions).',
      "Set the task's schedule.",
      "Choose which store(s) the task applies to, as supported by the current setup.",
      'Edit an existing task.',
      'Activate or deactivate a task.',
    ],
  },
  {
    id: 'oa-employees',
    title: 'Employees',
    icon: Users,
    description: 'Manage which employees work at your store.',
    bullets: [
      'View the employees assigned to your store.',
      'Find an existing employee to add to your store.',
      'Assign an existing employee to your store.',
      'Unassign an employee from your store.',
      'Update employee information where the app allows it.',
      'Activate or deactivate an employee.',
      "Reset an employee's password.",
    ],
    important: [
      'Creating or deleting employee accounts is handled by Super Admin.',
    ],
  },
  {
    id: 'oa-categories',
    title: 'Categories',
    icon: Tags,
    description: "View and organize your store's task categories.",
    bullets: [
      "View your store's categories.",
      'Reorder categories.',
    ],
    important: [
      'Category creation, editing, activation/deactivation, and deletion are managed by Super Admin.',
    ],
  },
  {
    id: 'oa-corrections',
    title: 'Correcting Historical Responses',
    icon: Pencil,
    description: 'Correct an eligible historical response for your store when an error is found.',
    bullets: [
      'Open an eligible historical response from the Daily Checklist.',
      'Enter the corrected value.',
      'Provide a reason for the correction.',
      'Save the correction.',
      'Review the correction history for a response, including the original value, the corrected value, who made the change, when it was made, and the reason given.',
    ],
    important: [
      'A correction reason is required before you can save.',
      'The original response is retained, and every correction is permanently recorded in correction history.',
      'Owner/Admin corrections are limited to your store.',
    ],
  },
  {
    id: 'oa-issues',
    title: 'Issues',
    icon: MessageSquareWarning,
    description: 'Review and respond to issues raised by employees at your store. Open Issues from the profile menu or the Home issues tile.',
    bullets: [
      'Filter by status (Active, Open, Acknowledged, Resolved, All Status) or search by employee or issue.',
      'Acknowledge an Open issue to show it is being looked into.',
      'Resolve an Open or Acknowledged issue.',
      'Add an optional response (up to 500 characters) when you acknowledge or resolve.',
    ],
    important: [
      'The employee who raised the issue is notified when you acknowledge or resolve it.',
      'Resolved issues are cleared 7 days after they are resolved.',
    ],
  },
  {
    id: 'oa-inventory',
    title: 'Inventory',
    icon: Boxes,
    description: "Manage your store's inventory items and minimum quantities from the Inventory tab.",
    bullets: [
      'Items: view each item’s status (In Stock, Low Stock, Out of Stock, Inactive), on-hand count, and supplier. Filter by category or supplier, and export to CSV or PDF.',
      'Add Item: enter the name, category, unit, weekday and weekend minimums, and preferred supplier, then Add to Catalog.',
      'Click an item to change its details or minimums, then Save & Sync Rules.',
      'Activate, deactivate, or delete an item.',
      'Suppliers: view the suppliers available to your store.',
    ],
    important: [
      'The Weekday Min applies Monday–Thursday and the Weekend Min applies Friday–Sunday.',
      'Suppliers and units are added by Super Admin. You can choose from the existing ones.',
    ],
  },
  {
    id: 'oa-stock-history',
    title: 'Stock Check History & Corrections',
    icon: HistoryIcon,
    description: 'Review past Start of Day and End of Day counts for your store and correct them when needed.',
    bullets: [
      'Open Inventory → Stock Check History and choose a date range.',
      'Filter by category or status (Shortage, Sufficient, Not Counted), or search by item or staff name.',
      'Export the history to Excel or PDF.',
      'Use the pencil (Correct this count) to change a Start of Day or End of Day count. Choose a reason and add an optional note.',
      'A correction can also fill in a count that was never recorded.',
    ],
    important: [
      'The previous values are kept, and every correction is recorded in the correction history with who made it and why.',
    ],
  },
  MISSED_END_OF_DAY_ADMIN_SECTION,
  {
    id: 'oa-orders',
    title: 'Orders',
    icon: ShoppingCart,
    description: 'Use the Order List to see what needs ordering, from which supplier, and to track deliveries.',
    bullets: [
      'Items short of tomorrow’s minimum after an End of Day count are added automatically as Needs ordering.',
      'Need is the shortfall from the count. Manual is any extra quantity added. Ordered is the total placed.',
      'Change an item’s status from its status menu: Needs ordering → Ordered → Received.',
      'When marking Received, confirm the quantity that actually arrived. It is added to current stock.',
      'Select several items to Mark ordered or Mark received together, or use Mark all ordered on a supplier group.',
      'Add item to order extra stock outside the daily count.',
      'View By supplier or as a List, and filter by category, status, or supplier.',
    ],
    important: [
      'Copy (per supplier) and Copy selected items copy a plain-text order list grouped by supplier, ready to paste into WhatsApp or SMS.',
      'If someone else has already updated an item, you are told and the list refreshes.',
    ],
  },
  {
    id: 'oa-order-reports',
    title: 'Inventory Counts & Order Reports',
    icon: BarChart3,
    description: 'The Orders tab also has tabs for current stock levels and reports.',
    bullets: [
      'Inventory Counts: see current stock against each minimum, filter to Out of Stock, Below Minimum, or Not Updated Today, and Edit count with a reason.',
      'End of Day Report: for any day, see Start of Day, dead stock, End of Day, usage, and order status for every item. Copy Report copies it as text.',
      'Purchasing Report: see ordered and received quantities by supplier for a date range, and export to Excel or PDF.',
    ],
  },
  {
    id: 'oa-daily-cash',
    title: 'Daily Cash',
    icon: Banknote,
    description: "Record each day's cash drawer figures for your store.",
    steps: [
      'Open Daily Cash and choose the business date (today by default).',
      'Enter the five fields in order: opening drawer cash, cash expenses, cash removed, cash remaining (your end-of-day count), and other adjustments.',
      'Select Save Entry, or Update Entry if the date already has one.',
    ],
    important: [
      'Every field is required. Enter 0 if there is nothing to record.',
      'Only Other adjustments can be negative. Use a minus sign for money taken out.',
      'Future dates cannot be entered. You can update a past date, which overwrites the saved figures.',
      'Expected Cash on Hand = Opening Cash − Cash Expenses − Cash Removed ± Other Adjustments. It turns amber if the last entry is 2 or more days old.',
      'The page shows who first entered each day (older entries show Unknown). Every later edit is kept in an audit trail with who made it and when.',
    ],
  },
  {
    id: 'oa-cash-target',
    title: 'Cash Target',
    icon: Target,
    description: 'Set the amount of cash your drawer should hold at the start of each day.',
    bullets: [
      'View the current target. Default means your store has not set its own yet.',
      'Enter a new target amount and select Save Target.',
    ],
    important: [
      'If a save fails, the previous target stays in effect.',
    ],
  },
  {
    id: 'oa-month-end-cash',
    title: 'Month-End Cash',
    icon: CalendarRange,
    description: "Review a month's cash totals and how the closing figures reconcile.",
    bullets: [
      'Move between months with the Previous month / Next month arrows.',
      'See monthly totals for cash removed, cash expenses, and adjustments.',
      'Compare Expected Cash on Hand with the Actual Cash Count on the last recorded day (Variance), and see every day’s over/short added up (Net Daily Variance).',
      'Use the Daily Breakdown table to see each recorded day. The closing day is marked.',
    ],
    important: [
      'Negative variance is a shortage; positive variance is an overage.',
      'This page is read-only. Make changes from Daily Cash.',
    ],
  },
];

const EMPLOYEE_SECTIONS: HelpSection[] = [
  {
    id: 'emp-today',
    title: "Today's Checklist",
    icon: ClipboardList,
    description: "Use Today's Checklist to see and complete the tasks assigned to your store.",
    bullets: [
      'View the tasks assigned to your store for today.',
      'Open a task to complete it.',
      'Submit your response.',
    ],
  },
  {
    id: 'emp-completing-tasks',
    title: 'Completing Tasks',
    icon: CheckSquare,
    description: 'Follow these steps to complete a task.',
    steps: [
      "Open Today's Checklist.",
      'Select a task.',
      'Provide the required response.',
      'Submit the task.',
    ],
  },
  {
    id: 'emp-undo',
    title: 'Undoing a Submission',
    icon: RotateCcw,
    description: 'If you make a mistake, you may be able to undo a response you already submitted.',
    bullets: [
      'Open the task you already submitted.',
      "Use the Undo option if it's available for that response.",
    ],
    important: [
      'Not every submission can be undone. Undo is only available for eligible responses.',
    ],
  },
  {
    id: 'emp-history',
    title: 'History',
    icon: HistoryIcon,
    description: 'Review your own past submissions.',
    bullets: [
      'View your previously submitted responses.',
      'See if a response was corrected by an Admin, including the reason given.',
    ],
    important: [
      'You can view corrections made to your own responses, but you cannot make corrections yourself.',
    ],
  },
  {
    id: 'emp-issues',
    title: 'Issues',
    icon: MessageSquareWarning,
    description: 'Raise and track issues for your assigned store.',
    bullets: [
      'Select Raise Issue, describe the issue, and select Send to Owner.',
      "View the issues you've raised and any response from your Owner/Admin.",
      'Track each issue’s status: Open, Acknowledged (being looked into), or Resolved.',
    ],
    important: [
      'Resolved issues are cleared from your list 7 days after they are resolved.',
    ],
  },
  {
    id: 'emp-stock-check',
    title: 'Stock Check',
    icon: Boxes,
    description: 'Record a Start of Day and an End of Day count for each stock item in your store.',
    steps: [
      'Open Stock Check → Daily Stock Entry.',
      'Open an item and enter the Start of Day Total Stock and Damaged / Spoilage, then select Save Check.',
      'At the end of the day, enter the End of Day count for the same item and select Save Check.',
    ],
    bullets: [
      'Each item shows today’s target, the available stock, and whether more is Needed or stock is Sufficient.',
      'Filter items by Shortage or Sufficient, or search by name.',
      'After End of Day, the item shows how much was used and how much needs ordering for tomorrow.',
      'Use Update Count to change a count you saved, while it is still editable.',
    ],
    important: [
      'Start of Day must be saved before End of Day.',
      'Damaged / spoilage cannot be more than total stock.',
      'Only the person who first saved a count can edit it.',
      'Start of Day locks once End of Day is saved or an order is based on it. End of Day locks once your admin approves it.',
      'A count that does not match the previous count (and any stock received) may need a reason and your admin’s approval before it is saved.',
    ],
  },
  {
    id: 'emp-missed-eod',
    title: 'Missed End of Day Counts',
    icon: AlertTriangle,
    description: "If an item was counted at Start of Day yesterday but not at End of Day, you'll get a notification asking about it.",
    steps: [
      'Open the missed End of Day notification.',
      'For each item, choose Counted this item and enter the available and damaged / spoiled stock, then Save End of Day.',
      "Or choose Couldn't count it and explain why (at least 5 words), then Submit reason.",
    ],
    important: [
      "You cannot save today's Start of Day for an item until yesterday's missed End of Day for it is answered.",
      'Your Owner/Admin can answer too. Only the first answer is kept.',
    ],
  },
  {
    id: 'emp-report-shortage',
    title: 'Reporting a Shortage',
    icon: ShoppingCart,
    description: 'Let your Owner/Admin know during the day when an item is running short.',
    steps: [
      'On Stock Check, select Report Shortage.',
      'Choose the item and enter its current stock, with an optional note.',
      'Select Report Shortage to notify your Owner/Admin.',
    ],
    important: [
      'You can report a shortage for an item only after its Start of Day is saved and before its End of Day.',
      'The current stock you enter must be below what is expected on hand and below today’s minimum.',
    ],
  },
  {
    id: 'emp-stock-history',
    title: 'Stock Check History',
    icon: HistoryIcon,
    description: 'Review past stock counts for your store.',
    bullets: [
      'Open Stock Check → Stock Check History and choose a date range.',
      'Filter by Shortage, Sufficient, or Not Counted, or search by item.',
      'Export the history to Excel or PDF.',
    ],
    important: [
      'History is view-only. Ask your Owner/Admin if a past count needs correcting.',
    ],
  },
  {
    id: 'emp-switch-store',
    title: 'Switching Stores',
    icon: StoreIcon,
    description: 'If you are assigned to more than one store, you can switch between them.',
    bullets: [
      'Use Switch Store to change which assigned store you are currently working in.',
      'Only the stores assigned to you are available to choose from.',
    ],
  },
];

const ROLE_GROUP_TITLES: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER_ADMIN: 'Owner / Admin',
  EMPLOYEE: 'Employee',
};

const ROLE_SECTIONS: Record<Role, HelpSection[]> = {
  SUPER_ADMIN: SUPER_ADMIN_SECTIONS,
  OWNER_ADMIN: OWNER_ADMIN_SECTIONS,
  EMPLOYEE: EMPLOYEE_SECTIONS,
};

// Role-aware content selection. An unrecognized/missing role fails safe:
// only the Getting Started section is shown, never administrative content.
export function getHelpGroupsForRole(role: Role | null | undefined): HelpGroup[] {
  if (role !== 'SUPER_ADMIN' && role !== 'OWNER_ADMIN' && role !== 'EMPLOYEE') {
    return [
      {
        id: 'fallback',
        title: 'Getting Started',
        sections: [GETTING_STARTED_SECTION],
      },
    ];
  }

  return [
    { id: 'common', title: 'Getting Started & Account', sections: COMMON_SECTIONS },
    { id: `role-${role}`, title: ROLE_GROUP_TITLES[role], sections: ROLE_SECTIONS[role] },
  ];
}
