import type { LucideIcon } from 'lucide-react';
import './PlaceholderPage.css';

interface PlaceholderPageProps {
  title: string;
  message?: string;
  icon?: LucideIcon;
}

function PlaceholderPage({ title, message = 'This page is coming soon.', icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <div className="card placeholder-page__card">
        {Icon && (
          <div className="placeholder-page__icon">
            <Icon size={32} />
          </div>
        )}
        <h2 className="placeholder-page__title">{title}</h2>
        <p className="placeholder-page__message">{message}</p>
      </div>
    </div>
  );
}

export default PlaceholderPage;
