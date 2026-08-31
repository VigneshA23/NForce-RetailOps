import type { OwnerSummary } from '../types/owner';
import './OwnerTable.css';

interface OwnerTableProps {
  owners: OwnerSummary[];
  isLoading?: boolean;
  onToggleStatus: (owner: OwnerSummary) => void;
}

function OwnerTable({ owners, isLoading = false, onToggleStatus }: OwnerTableProps) {
  return (
    <div className="owner-table__card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Owner</th>
              <th scope="col">Email</th>
              <th scope="col">Store</th>
              <th scope="col">Location</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={`${owner.ownerId}-${owner.storeId}`}>
                <td className="owner-table__name">{owner.ownerName}</td>
                <td>
                  <a className="owner-table__link" href={`mailto:${owner.ownerEmail}`}>
                    {owner.ownerEmail}
                  </a>
                </td>
                <td>{owner.storeName}</td>
                <td>{owner.storeLocation}</td>
                <td>
                  <span className={`badge ${owner.active ? 'badge--solid' : 'badge--outline'}`}>
                    {owner.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="owner-table__actions-cell">
                  <button
                    type="button"
                    className={`btn owner-table__status-btn ${owner.active ? 'btn--danger' : 'btn--primary'}`}
                    onClick={() => onToggleStatus(owner)}
                  >
                    {owner.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && owners.length === 0 && (
        <div className="owner-table__empty">No owners yet. Add one to get started.</div>
      )}
      {isLoading && <div className="owner-table__empty">Loading owners...</div>}
    </div>
  );
}

export default OwnerTable;
