import type { NavItem, NavTabKey } from '../types/navigation';
import './BottomNav.css';

interface BottomNavProps<Key extends string = NavTabKey> {
  items: NavItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
}

function BottomNav<Key extends string = NavTabKey>({ items, activeKey, onSelect }: BottomNavProps<Key>) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            onClick={() => onSelect(item.key)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="bottom-nav__icon">
              <Icon size={22} strokeWidth={isActive ? 2.25 : 1.75} />
            </span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNav;
