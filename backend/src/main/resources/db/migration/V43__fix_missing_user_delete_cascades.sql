-- user_roles: cascade-delete with the user (roles are identity data)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS "FKhfh9dx7w3ubf1co1vdev94g3f";
ALTER TABLE user_roles ADD CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- categories: survive owner deletion; clear owner attribution
ALTER TABLE categories ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS fk_categories_owner;
ALTER TABLE categories ADD CONSTRAINT fk_categories_owner
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- tasks: survive owner deletion; clear owner attribution
ALTER TABLE tasks ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_owner;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_owner
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
