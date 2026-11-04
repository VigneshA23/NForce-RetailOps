import { forwardRef } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import SpecularButton from './SpecularButton';
import './ExportButton.css';

interface ExportButtonProps {
  isOpen: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

// The dark Export dropdown trigger shared by every export menu (Stock Check
// History, Supplier Purchase Report, Inventory Items), so they all render at
// the same size and style.
const ExportButton = forwardRef<HTMLButtonElement, ExportButtonProps>(({ isOpen, onClick, disabled, title }, ref) => (
  <SpecularButton
    ref={ref}
    size="sm"
    radius={10}
    tint="#14141a"
    tintOpacity={0.85}
    textColor="#f5f5f5"
    lineColor="#ffffff"
    baseColor="#525252"
    followMouse
    proximity={180}
    disabled={disabled}
    title={title}
    onClick={onClick}
    aria-expanded={isOpen}
    aria-haspopup="menu"
  >
    <span className="export-button__label">
      <Download size={14} /> Export <ChevronDown size={13} />
    </span>
  </SpecularButton>
));

ExportButton.displayName = 'ExportButton';

export default ExportButton;
