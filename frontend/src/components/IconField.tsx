import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import './IconField.css';

interface IconFieldProps {
  // Any lucide icon -- reuse the ones already used for the same concept
  // elsewhere in the app (Store, MapPin, Tags, Truck, User, Mail, Phone...).
  icon: LucideIcon;
  // 'top' pins the icon to the first line (textareas); default centres it.
  align?: 'center' | 'top';
  children: ReactNode;
}

// Leading icon inside a form control (input, select trigger, combobox or
// textarea) -- the shared version of the icon-in-field look used by the
// Supplier/Category/Employee forms.
function IconField({ icon: Icon, align = 'center', children }: IconFieldProps) {
  return (
    <div className={`icon-field${align === 'top' ? ' icon-field--top' : ''}`}>
      <Icon size={15} className="icon-field__icon" aria-hidden="true" />
      {children}
    </div>
  );
}

export default IconField;
