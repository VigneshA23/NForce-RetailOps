import { useEffect, useMemo, useState } from 'react';
import { Plus, Tags, CircleCheck, CircleSlash } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { createCategory, updateCategory, updateCategoryStatus, deleteCategory } from '../api/categories';
import { getOwners } from '../api/owners';
import { useSuperAdminCategories } from '../hooks/useSuperAdminCategories';
import type { Category, CategoryFormValues, CategoryStoreOption } from '../types/category';
import CategoryTable from '../components/CategoryTable';
import CategoryFormModal from '../components/CategoryFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import '../pages/Categories.css';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type FormModalState = { mode: 'create' } | { mode: 'edit'; category: Category } | null;

function SuperAdminCategories() {
  const { categories, setCategories, isLoading, error: loadError, reload } = useSuperAdminCategories();
  const [allStores, setAllStores] = useState<CategoryStoreOption[]>([]);

  useEffect(() => {
    getOwners()
      .then((owners) => {
        const byId = new Map<number, CategoryStoreOption>();
        owners.forEach((owner) => {
          if (owner.storeId != null && owner.storeName != null) {
            byId.set(owner.storeId, { id: owner.storeId, name: owner.storeName });
          }
        });
        setAllStores(Array.from(byId.values()));
      })
      .catch(() => setAllStores([]));
  }, []);

  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  async function handleFormSubmit(values: CategoryFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formModalState?.mode === 'edit') {
        const updated = await updateCategory(formModalState.category.id, values);
        setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
        nfToast.success(`"${updated.name}" category updated.`);
      } else {
        const created = await createCategory(values);
        setCategories((current) => [...current, created]);
        nfToast.success(`"${created.name}" category added.`);
      }
      setFormModalState(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(category: Category, active: boolean) {
    setStatusError(null);
    setCategories((current) => current.map((c) => (c.id === category.id ? { ...c, active } : c)));
    try {
      const updated = await updateCategoryStatus(category.id, active);
      setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
      nfToast.success(`"${category.name}" category ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setCategories((current) => current.map((c) => (c.id === category.id ? category : c)));
      const msg = error instanceof Error ? error.message : 'Failed to update category status';
      setStatusError(msg);
      nfToast.error(msg);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteCategory(deleteTarget.id);
      setCategories((current) => current.filter((c) => c.id !== deleteTarget.id));
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      nfToast.success(`"${deletedName}" category deleted.`);
    } catch (error) {
      setDeleteTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to delete category';
      setDeleteError(msg);
      nfToast.error(msg);
    }
  }

  const activeCount = useMemo(() => categories.filter((category) => category.active).length, [categories]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (normalizedSearch && !category.name.toLowerCase().includes(normalizedSearch)) return false;
      if (statusFilter === 'ACTIVE' && !category.active) return false;
      if (statusFilter === 'INACTIVE' && category.active) return false;
      return true;
    });
  }, [categories, search, statusFilter]);

  return (
    <div className="categories-page">
      <div className="stat-card-row">
        <StatCard icon={Tags} label="Total Categories" value={categories.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active" value={activeCount} tone="success" />
        <StatCard icon={CircleSlash} label="Inactive" value={categories.length - activeCount} tone="warning" />
      </div>

      {deleteError && <div className="categories-page__error">{deleteError}</div>}
      {statusError && <div className="categories-page__error">{statusError}</div>}

      <div className="categories-page__header">
        <p className="categories-page__summary">
          {isLoading
            ? 'Loading categories...'
            : `${activeCount} active categor${activeCount === 1 ? 'y' : 'ies'} of ${categories.length} total`}
        </p>
        <SpecularButton
          size="sm"
          radius={999}
          tint="var(--color-badge-solid-bg)"
          tintOpacity={1}
          textColor="var(--color-badge-solid-text)"
          lineColor="#e11d33"
          baseColor="#e4e4e7"
          followMouse
          proximity={180}
          onClick={() => {
            setFormError(null);
            setFormModalState({ mode: 'create' });
          }}
        >
          <span className="categories-page__add-label">
            <Plus size={16} />
            Add Category
          </span>
        </SpecularButton>
      </div>

      {loadError ? (
        <div className="categories-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={reload}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <div className="filter filter--search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search categories" variant="filter" />
            </div>
            <Select
              className="filter filter--narrow"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              ariaLabel="Filter by status"
            />
          </div>

          <CategoryTable
            categories={filteredCategories}
            canManage
            isLoading={isLoading}
            onEdit={(category) => {
              setFormError(null);
              setFormModalState({ mode: 'edit', category });
            }}
            onDelete={(category) => {
              setDeleteError(null);
              setDeleteTarget(category);
            }}
            onToggleStatus={handleToggleStatus}
          />
        </>
      )}

      <CategoryFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialValues={
          formModalState?.mode === 'edit'
            ? {
                name: formModalState.category.name,
                appliesToAllStores: formModalState.category.appliesToAllStores,
                storeIds: formModalState.category.stores.map((s) => s.id),
              }
            : undefined
        }
        availableStores={allStores}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Category"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.name}? This cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default SuperAdminCategories;
