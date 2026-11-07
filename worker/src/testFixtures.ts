export function insertRosterFixture(
  storage: DurableObjectStorage,
  name: string,
  role = 'rower',
  email: string | null = null,
): string {
  const id = crypto.randomUUID();
  storage.sql.exec(
    "INSERT INTO roster (id,name,email,role,group_key,side,class_year,claimed_by_user_id,added_by,created_at) VALUES (?,?,?,?,'normal',NULL,NULL,NULL,NULL,?)",
    id,
    name,
    email,
    role,
    '2026-03-08T08:00:00Z',
  );
  return id;
}
