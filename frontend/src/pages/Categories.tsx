import { useEffect, useMemo, useState } from 'react';
import { Plus, Tags, CircleCheck, CircleSlash } from 'lucide-react';
import { getCategories, createCategory, updateCategory, updateCategoryStatus, deleteCategory } from '../api/categories';
import type { Category, CategoryFormValues } from '../types/category';
import CategoryTable from '../components/CategoryTable';
import CategoryFormModal from '../components/CategoryFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import './Categories.css';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type FormModalState = { mode: 'create' } | { mode: 'edit'; category: Category } | null;

function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  function loadCategories() {
    setIsLoading(true);
    setLoadError(null);
    getCategories()
      .then(setCategories)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleFormSubmit(values: CategoryFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formModalState?.mode === 'edit') {
        const updated = await updateCategory(formModalState.category.id, values);
        setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createCategory(values);
        setCategories((current) => [...current, created]);
      }
      setFormModalState(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(category: Category, active: boolean) {
    setStatusError(null);
    // Optimistic: the toggle should feel instant, and reverting on failure is
    // cheap since we still have the prior value in closure.
    setCategories((current) => current.map((c) => (c.id === category.id ? { ...c, active } : c)));
    try {
      const updated = await updateCategoryStatus(category.id, active);
      setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
    } catch (error) {
      setCategories((current) => current.map((c) => (c.id === category.id ? category : c)));
      setStatusError(error instanceof Error ? error.message : 'Failed to update category status');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteCategory(deleteTarget.id);
      setCategories((current) => current.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteTarget(null);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete category');
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

      {loadError ? (
        <div className="categories-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={loadCategories}>
            Retry
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card__header">
            <h2 className="card__title">All Categories</h2>
            <div className="card__toolbar">
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
          </div>

          <div className="categories-page__filter-bar">
            <div className="categories-page__filter categories-page__filter--search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search categories" variant="card" />
            </div>

            <select
              className="select categories-page__filter categories-page__filter--status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <CategoryTable
            categories={filteredCategories}
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
        </div>
      )}

      <CategoryFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialValues={formModalState?.mode === 'edit' ? { name: formModalState.category.name } : undefined}
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

export default Categories;
