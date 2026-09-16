import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  ClipboardList,
  Compass,
  History as HistoryIcon,
  LogOut,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  Store as StoreIcon,
  Tags,
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
      'Not every submission can be undone — Undo is only available for eligible responses.',
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
      'Raise a new issue for your assigned store.',
      "View the issues you've raised.",
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
