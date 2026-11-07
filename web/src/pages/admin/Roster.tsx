import { useState } from 'react';
import { Users, SlidersHorizontal, Plus } from 'lucide-react';
import type { GroupKey, Role, RosterInput } from '../../../../shared/types';
import {
  useAdminUsers,
  useRoster,
  useMe,
  useCreateRoster,
  useUpdateRoster,
  useUpdateUser,
  useResetPassword,
  useUnlinkRoster,
  useDeleteRoster,
  useImportRoster,
} from '../../lib/queries';
import { authError } from '../../lib/auth';
import { formatNumber } from '../../lib/format';
import {
  Avatar,
  Button,
  ConfirmSheet,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  NumberField,
  PageHeader,
  Select,
  Sheet,
  TextArea,
  TextField,
  Toggle,
  useToast,
} from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { FormErrors } from '../../components/auth/FormErrors';
import {
  groups,
  groupLabels,
  mergePeople,
  previewRoster,
  roles,
  roleLabels,
  rosterErrors,
  type Person,
} from './roster';

export default function Roster() {
  const roster = useRoster(),
    users = useAdminUsers(),
    me = useMe();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all'),
    [group, setGroup] = useState('all');
  const [status, setStatus] = useState('active'),
    [claimed, setClaimed] = useState('all');
  const [filters, setFilters] = useState(false),
    [add, setAdd] = useState(false),
    [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Person>();
  const people = mergePeople(roster.data ?? [], users.data ?? []);
  const filtered = people.filter((person) => {
    const row = person.user ?? person.roster!;
    return (
      `${row.name} ${person.user?.email ?? ''} ${person.roster?.email ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (role === 'all' || row.role === role) &&
      (group === 'all' || row.group_key === group) &&
      (status === 'all' ||
        (status === 'inactive' ? person.user?.active === false : person.user?.active !== false)) &&
      (claimed === 'all' || (claimed === 'claimed' ? !!person.user : !person.user))
    );
  });
  const filterCount = [
    role !== 'all',
    group !== 'all',
    status !== 'active',
    claimed !== 'all',
  ].filter(Boolean).length;
  return (
    <>
      <PageHeader
        title="Roster"
        back="/admin"
        trailing={
          <IconButton aria-label="Add Name" onClick={() => setAdd(true)}>
            <Plus size={20} strokeWidth={1.75} />
          </IconButton>
        }
      />
      <div className="screen-stack">
        <div className="space-y-3">
          <TextField
            label="Search People"
            type="search"
            placeholder="Name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="secondary"
              leading={<SlidersHorizontal size={20} strokeWidth={1.75} />}
              onClick={() => setFilters(true)}
            >
              Filters{filterCount ? ` (${formatNumber(filterCount)})` : ''}
            </Button>
            <Button variant="plain" onClick={() => setImporting(true)}>
              Import CSV
            </Button>
          </div>
        </div>
        {roster.isPending || users.isPending || roster.isError || users.isError ? (
          <LoadState
            error={roster.isError || users.isError}
            retry={() => {
              void roster.refetch();
              void users.refetch();
            }}
          />
        ) : filtered.length ? (
          <ListGroup
            header={`${formatNumber(filtered.length)} ${filtered.length === 1 ? 'Person' : 'People'}`}
          >
            {filtered.map((person) => {
              const row = person.user ?? person.roster!;
              return (
                <ListRow
                  key={person.key}
                  title={row.name}
                  avatar={<Avatar name={row.name} imageId={person.user?.avatar_image_id} />}
                  subtitle={
                    <span className="block truncate">
                      {[
                        roleLabels[row.role],
                        row.group_key && groupLabels[row.group_key],
                        person.user ? (person.user.active ? 'Claimed' : 'Inactive') : 'Unclaimed',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  }
                  chevron
                  onClick={() => setSelected(person)}
                />
              );
            })}
          </ListGroup>
        ) : (
          <EmptyState
            icon={<Users size={20} strokeWidth={1.75} />}
            title={people.length ? 'No Matching People' : 'No Names Yet'}
            body={
              people.length
                ? 'Try another name or change your filters.'
                : 'Add a name or import the team roster to get started.'
            }
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setRole('all');
                  setGroup('all');
                  setStatus('all');
                  setClaimed('all');
                }}
              >
                Show Everyone
              </Button>
            }
          />
        )}
      </div>
      <Sheet
        open={filters}
        onClose={() => setFilters(false)}
        title="Roster Filters"
        footer={
          <Button fullWidth onClick={() => setFilters(false)}>
            Show {formatNumber(filtered.length)} {filtered.length === 1 ? 'Person' : 'People'}
          </Button>
        }
      >
        <div className="space-y-4">
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </Select>
          <Select label="Group" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">All Groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {groupLabels[g]}
              </option>
            ))}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </Select>
          <Select label="Claimed" value={claimed} onChange={(e) => setClaimed(e.target.value)}>
            <option value="all">All</option>
            <option value="claimed">Claimed</option>
            <option value="unclaimed">Unclaimed</option>
          </Select>
        </div>
      </Sheet>
      {selected && me.data && (
        <EditPerson
          key={selected.key}
          person={selected}
          viewerRole={me.data.role}
          viewerId={me.data.id}
          close={() => setSelected(undefined)}
        />
      )}
      {add && <AddName isAdmin={me.data?.role === 'admin'} close={() => setAdd(false)} />}
      {importing && (
        <ImportRoster isAdmin={me.data?.role === 'admin'} close={() => setImporting(false)} />
      )}
    </>
  );
}

function RoleGroup({
  role,
  group,
  setRole,
  setGroup,
  isAdmin,
  locked = false,
}: {
  role: Role;
  group: GroupKey | '';
  setRole: (role: Role) => void;
  setGroup: (group: GroupKey | '') => void;
  isAdmin: boolean;
  locked?: boolean;
}) {
  return (
    <>
      <Select
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        disabled={locked}
        hint={locked ? 'Only an admin can change this account.' : undefined}
      >
        {roles.map((r) => (
          <option key={r} value={r} disabled={r === 'admin' && !isAdmin}>
            {roleLabels[r]}
          </option>
        ))}
      </Select>
      <Select
        label="Group"
        value={group}
        disabled={locked}
        onChange={(e) => setGroup(e.target.value as GroupKey | '')}
      >
        <option value="">No Group</option>
        {groups.map((g) => (
          <option key={g} value={g}>
            {groupLabels[g]}
          </option>
        ))}
      </Select>
    </>
  );
}

function EditPerson({
  person,
  viewerRole,
  viewerId,
  close,
}: {
  person: Person;
  viewerRole: Role;
  viewerId: string;
  close: () => void;
}) {
  const row = person.roster,
    user = person.user,
    source = user ?? row!;
  const [name, setName] = useState(source.name),
    [role, setRole] = useState(source.role),
    [group, setGroup] = useState<GroupKey | ''>(source.group_key ?? '');
  const [active, setActive] = useState(user?.active ?? true),
    [leaderboard, setLeaderboard] = useState(user?.on_leaderboard ?? true);
  const [message, setMessage] = useState<string>(),
    [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'unlink' | 'delete' | 'deactivate'>(),
    [password, setPassword] = useState<string>();
  const patchRoster = useUpdateRoster(),
    patchUser = useUpdateUser(),
    reset = useResetPassword(),
    unlink = useUnlinkRoster(),
    remove = useDeleteRoster();
  const toast = useToast();
  const locked = viewerRole !== 'admin' && (source.role === 'admin' || row?.role === 'admin');
  async function save() {
    if (row && !locked && (!name.trim() || name.trim().length > 80)) {
      setMessage('Name must be 1–80 characters.');
      return;
    }
    if (!row && user && !group) {
      setMessage('Choose a group for this account.');
      return;
    }
    setMessage(undefined);
    setBusy(true);
    try {
      if (row && !locked) {
        const body: Partial<RosterInput> = {};
        if (name.trim() !== row.name) body.name = name.trim();
        if (role !== source.role) body.role = role;
        if (group !== (source.group_key ?? '')) body.group_key = group || null;
        if (Object.keys(body).length)
          await patchRoster.mutateAsync({ params: { id: row.id }, body });
      }
      if (user) {
        const body: {
          role?: Role;
          group_key?: GroupKey;
          active?: boolean;
          on_leaderboard?: boolean;
        } = {};
        if (!row && !locked && role !== user.role) body.role = role;
        if (!row && !locked && group && group !== user.group_key) body.group_key = group;
        if (!locked && active !== user.active) body.active = active;
        if (leaderboard !== user.on_leaderboard) body.on_leaderboard = leaderboard;
        if (Object.keys(body).length)
          await patchUser.mutateAsync({ params: { id: user.id }, body });
      }
      toast.show({ title: 'Changes saved' });
      close();
    } catch (error) {
      setMessage(
        `${authError(error)}. Review the current roster before retrying; some changes may have been saved.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function action() {
    setBusy(true);
    setMessage(undefined);
    try {
      if (confirm === 'reset' && user) {
        const result = await reset.mutateAsync({ params: { id: user.id } });
        setConfirm(undefined);
        setPassword(result.temporary_password);
      } else if (confirm === 'deactivate') {
        setConfirm(undefined);
        await save();
      } else {
        if (confirm === 'unlink' && row) await unlink.mutateAsync({ params: { id: row.id } });
        if (confirm === 'delete' && row) await remove.mutateAsync({ params: { id: row.id } });
        toast.show({ title: confirm === 'unlink' ? 'Account unlinked' : 'Name deleted' });
        close();
      }
    } catch (error) {
      setConfirm(undefined);
      setMessage(authError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Sheet
        open
        onClose={() => {
          if (!busy) close();
        }}
        title="Edit Person"
        footer={
          !password && (
            <Button
              fullWidth
              loading={busy}
              onClick={() => {
                if (user?.active && !active) setConfirm('deactivate');
                else void save();
              }}
            >
              Save
            </Button>
          )
        }
      >
        <div className="space-y-5">
          <FormErrors message={message} />
          {password ? (
            <>
              <h3 className="text-headline">Temporary Password</h3>
              <p className="text-subhead text-muted">
                Shown only once. Share it securely with {source.name}. They must change it when they
                next log in. All existing sessions have ended.
              </p>
              <TextField label="Temporary Password" value={password} readOnly autoComplete="off" />
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  void navigator.clipboard
                    .writeText(password)
                    .then(() => toast.show({ title: 'Password copied' }))
                    .catch(() =>
                      toast.show({
                        title: 'Could not copy. Select the password to copy it.',
                        tone: 'error',
                      }),
                    );
                }}
              >
                Copy
              </Button>
              <Button fullWidth onClick={close}>
                Done
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={source.name} imageId={user?.avatar_image_id} />
                <div>
                  <p className="text-headline">{source.name}</p>
                  <p className="break-all text-footnote text-muted">
                    {user?.email ?? 'Unclaimed name'}
                  </p>
                </div>
              </div>
              <TextField
                label="Name"
                value={name}
                maxLength={80}
                required
                disabled={!row || locked}
                hint={!row ? 'This account has no roster name to rename.' : undefined}
                onChange={(e) => setName(e.target.value)}
              />
              <RoleGroup
                {...{ role, group, setRole, setGroup, locked }}
                isAdmin={viewerRole === 'admin'}
              />
              {user && (
                <ListGroup>
                  <div className="space-y-5 p-4">
                    <Toggle
                      label="On Leaderboard"
                      checked={leaderboard}
                      onChange={setLeaderboard}
                    />
                    <Toggle
                      label="Active"
                      checked={active}
                      onChange={setActive}
                      disabled={locked}
                    />
                  </div>
                </ListGroup>
              )}
              <ListGroup header="Account Actions">
                {user && !locked && user.id !== viewerId && (
                  <ListRow
                    title="Reset Password"
                    subtitle="Ends all sessions and requires a new password"
                    onClick={() => setConfirm('reset')}
                    chevron
                  />
                )}
                {user?.id === viewerId && (
                  <ListRow
                    title="Change Your Password"
                    subtitle="Use Settings to change your own password"
                    to="/settings"
                  />
                )}
                {row && user && !locked && user.id !== viewerId && (
                  <ListRow
                    title="Unlink Account"
                    tone="destructive"
                    subtitle="Deactivate the account and free this name"
                    onClick={() => setConfirm('unlink')}
                    chevron
                  />
                )}
                {row && !user && !locked && (
                  <ListRow
                    title="Delete Name"
                    tone="destructive"
                    onClick={() => setConfirm('delete')}
                    chevron
                  />
                )}
                {locked && (
                  <div className="p-4 text-subhead text-muted">
                    Only an admin can manage this account. Leaderboard visibility can still be
                    changed.
                  </div>
                )}
              </ListGroup>
            </>
          )}
        </div>
      </Sheet>
      <ConfirmSheet
        open={!!confirm}
        onClose={() => setConfirm(undefined)}
        onConfirm={() => void action()}
        loading={busy}
        cancelLabel="Cancel"
        title={
          confirm === 'reset'
            ? 'Reset Password?'
            : confirm === 'unlink'
              ? 'Unlink Account?'
              : confirm === 'deactivate'
                ? 'Deactivate Account?'
                : 'Delete Name?'
        }
        confirmLabel={
          confirm === 'reset'
            ? 'Reset Password'
            : confirm === 'unlink'
              ? 'Unlink Account'
              : confirm === 'deactivate'
                ? 'Save And Deactivate'
                : 'Delete Name'
        }
        body={
          confirm === 'reset'
            ? 'All sessions will end. A temporary password will be shown once, and the person must change it at their next login.'
            : confirm === 'unlink'
              ? 'This deactivates the linked account, ends its sessions and frees the roster name for signup. Existing training records are kept.'
              : confirm === 'deactivate'
                ? 'This ends all sessions and blocks login. Training records are kept. You can reactivate the account later.'
                : `Remove ${source.name} from the roster? This cannot be undone.`
        }
      />
    </>
  );
}

function AddName({ isAdmin, close }: { isAdmin: boolean; close: () => void }) {
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [role, setRole] = useState<Role>('rower'),
    [group, setGroup] = useState<GroupKey | ''>('normal'),
    [side, setSide] = useState(''),
    [year, setYear] = useState('');
  const [message, setMessage] = useState<string>();
  const create = useCreateRoster(),
    toast = useToast();
  const submit = () => {
    const input: RosterInput = {
      name: name.trim(),
      email: email.trim() || null,
      role,
      group_key: group || null,
      side: (side as RosterInput['side']) || null,
      class_year: year.trim() ? Number(year) : null,
    };
    const errors = rosterErrors(input, isAdmin);
    if (errors.length) {
      setMessage(errors.join(' '));
      return;
    }
    setMessage(undefined);
    create.mutate(
      { body: input },
      {
        onSuccess: () => {
          toast.show({ title: 'Name added' });
          close();
        },
        onError: (error) => setMessage(authError(error)),
      },
    );
  };
  return (
    <Sheet
      open
      onClose={() => {
        if (!create.isPending) close();
      }}
      title="Add Name"
      footer={
        <Button fullWidth loading={create.isPending} onClick={submit}>
          Add Name
        </Button>
      }
    >
      <div className="space-y-4">
        <FormErrors message={message} />
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <RoleGroup {...{ role, group, setRole, setGroup, isAdmin }} />
        <Select label="Side" value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="">Not Specified</option>
          <option value="port">Port</option>
          <option value="starboard">Starboard</option>
          <option value="both">Both</option>
          <option value="cox">Cox</option>
        </Select>
        <NumberField
          label="Class Year"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          hint="Optional, between 1950 and 2100"
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Optional. Binds this name to an email for signup."
        />
      </div>
    </Sheet>
  );
}

function ImportRoster({ isAdmin, close }: { isAdmin: boolean; close: () => void }) {
  const [csv, setCsv] = useState(''),
    [message, setMessage] = useState<string>(),
    [result, setResult] = useState<{
      imported: number;
      errors: { row: number; message: string }[];
    }>();
  const preview = previewRoster(csv, isAdmin),
    mutation = useImportRoster(),
    toast = useToast();
  const invalid =
    !!preview.headerError || !!preview.error || preview.rows.some((row) => row.errors.length > 0);
  return (
    <Sheet
      open
      onClose={() => {
        if (!mutation.isPending) close();
      }}
      title="Import CSV"
      footer={
        <Button
          fullWidth
          disabled={!preview.rows.length || invalid || !!result}
          loading={mutation.isPending}
          onClick={() => {
            setMessage(undefined);
            mutation.mutate(
              { body: { csv } },
              {
                onSuccess: (value) => {
                  setResult(value);
                  toast.show({ title: `${formatNumber(value.imported)} names imported` });
                },
                onError: (error) => setMessage(authError(error)),
              },
            );
          }}
        >
          Import {formatNumber(preview.rows.length)} {preview.rows.length === 1 ? 'Name' : 'Names'}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-subhead text-muted">
          Columns: name, email, role, group, side, class_year. Email may be omitted. Matching email
          (or name when no email is given) updates an existing row. Other rows are added. Claimed
          accounts are updated too.
        </p>
        <TextField
          label="CSV File"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 240000) {
              setMessage('Choose a CSV of at most 60,000 characters.');
              return;
            }
            void file
              .text()
              .then((value) => {
                setCsv(value);
                setResult(undefined);
                setMessage(undefined);
              })
              .catch(() => setMessage('Could not read this file. Paste the CSV instead.'));
          }}
        />
        <TextArea
          label="CSV"
          value={csv}
          rows={6}
          onChange={(e) => {
            setCsv(e.target.value);
            setResult(undefined);
          }}
          placeholder="name,email,role,group,side,class_year"
        />
        <FormErrors message={message ?? preview.headerError ?? preview.error} />
        {result && (
          <div role="status" className="space-y-2">
            <p className="text-headline">
              Imported {formatNumber(result.imported)} {result.imported === 1 ? 'Name' : 'Names'}
            </p>
            {result.errors.map((error) => (
              <p key={error.row} className="text-subhead">
                Row {formatNumber(error.row)}: {error.message}
              </p>
            ))}
          </div>
        )}
        {preview.rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-divider">
            <table className="w-full text-left text-footnote">
              <caption className="p-3 text-left text-subhead">
                Preview · {formatNumber(preview.rows.length)} rows
              </caption>
              <thead className="border-y border-divider bg-surface-2">
                <tr>
                  <th className="p-3">Row</th>
                  <th className="p-3">Name / Email</th>
                  <th className="p-3">Role / Group</th>
                  <th className="p-3">Side / Class Year</th>
                  <th className="p-3">Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row} className="border-b border-divider">
                    <td className="p-3 tabular-nums">{formatNumber(row.row)}</td>
                    <td className="p-3">
                      {row.input.name}
                      <span className="block text-muted">{row.input.email}</span>
                    </td>
                    <td className="p-3">
                      {row.input.role}
                      <span className="block text-muted">{row.input.group_key || 'No group'}</span>
                    </td>
                    <td className="p-3">
                      {row.input.side || 'Not specified'}
                      <span className="block text-muted">
                        {row.input.class_year !== null && Number.isFinite(row.input.class_year)
                          ? formatNumber(row.input.class_year).replaceAll(',', '')
                          : 'Not specified'}
                      </span>
                    </td>
                    <td className="min-w-32 p-3">{row.errors.join(' ') || 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sheet>
  );
}
