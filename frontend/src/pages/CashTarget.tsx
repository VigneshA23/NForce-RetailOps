import CashTargetForm from '../components/CashTargetForm';
import './CashTarget.css';

interface CashTargetProps {
  // The Owner/Admin's store; null while stores load or when none is assigned.
  storeId: number | null;
  storesLoading: boolean;
}

// Owner/Admin's Cash Drawer Target tab (RTS-294): their own store's target.
// Super Admin edits any store's target from the Stores page instead.
function CashTarget({ storeId, storesLoading }: CashTargetProps) {
  return (
    <div className="cash-target-page">
      <section className="card cash-target-page__card" aria-label="Cash drawer target">
        <p className="cash-target-page__intro">
          The amount of cash your drawer should hold at the start of each day.
        </p>
        {storeId === null ? (
          <p className="cash-target-page__intro">
            {storesLoading ? 'Loading your store…' : 'No store is assigned to your account yet, so there is no target to set.'}
          </p>
        ) : (
          <CashTargetForm scope="owner" />
        )}
      </section>
    </div>
  );
}

export default CashTarget;
