import type { OwnerStore } from '../types/ownerStore';
import RowActionsMenu from './RowActionsMenu';
import './StoreTable.css';

interface StoreTableProps {
  stores: OwnerStore[];
  isLoading?: boolean;
  onEdit: (store: OwnerStore) => void;
}

function StoreTable({ stores, isLoading = false, onEdit }: StoreTableProps) {
  return (
    <div className="store-table__card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Store Name</th>
              <th scope="col">Employees</th>
              <th scope="col">Tasks</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id}>
                <td className="store-table__name">{store.name}</td>
                <td>{store.employeeCount}</td>
                <td>{store.taskCount}</td>
                <td>
                  <span className={`badge ${store.active ? 'badge--solid' : 'badge--outline'}`}>
                    {store.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="store-table__actions-cell">
                  <RowActionsMenu onEdit={() => onEdit(store)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && stores.length === 0 && (
        <div className="store-table__empty">No stores yet. Add one to get started.</div>
      )}
      {isLoading && <div className="store-table__empty">Loading stores...</div>}
    </div>
  );
}

export default StoreTable;
