import { Banknote } from 'lucide-react';
import type { SuperAdminStore } from '../types/superAdminStore';
import Modal from './Modal';
import CashTargetForm from './CashTargetForm';

interface CashTargetModalProps {
  // The store whose target is being viewed; null keeps the modal closed.
  store: SuperAdminStore | null;
  onClose: () => void;
}

// Super Admin's view/edit of one store's cash-drawer target, opened from a
// row on the Stores page (RTS-294).
function CashTargetModal({ store, onClose }: CashTargetModalProps) {
  return (
    <Modal
      isOpen={store !== null}
      onClose={onClose}
      title="Cash Drawer Target"
      subtitle={store ? `${store.storeName} · #${store.storeCode}` : undefined}
      titleIcon={<Banknote size={18} />}
      centered
    >
      {store && <CashTargetForm key={store.storeId} scope="super-admin" storeId={store.storeId} />}
    </Modal>
  );
}

export default CashTargetModal;
