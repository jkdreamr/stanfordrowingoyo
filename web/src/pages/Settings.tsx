import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../lib/queries';
import { authError } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';
import {
  ConfirmSheet,
  ListGroup,
  ListRow,
  PageHeader,
  SegmentedControl,
  Sheet,
  useToast,
} from '../components/ui';
import { FormErrors } from '../components/auth/FormErrors';
import { PasskeySettings } from '../components/auth/PasskeySettings';
export default function Settings() {
  const logout = useLogout();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>();
  const [password, setPassword] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  return (
    <>
      <PageHeader title="Settings" back="/me" />
      <div className="screen-stack">
        <FormErrors message={message} />
        <ListGroup header="Appearance">
          <div className="p-4">
            <SegmentedControl
              label="Appearance"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </ListGroup>
        <ListGroup header="Account">
          <ListRow title="Edit Profile" to="/me/edit" />
          <ListRow title="Weekly Target" to="/me/target" />
          <ListRow title="Change Password" chevron onClick={() => setPassword(true)} />
        </ListGroup>
        <PasskeySettings onError={setMessage} />
        <ListGroup>
          {me && me.role !== 'rower' && <ListRow title="Admin" to="/admin" />}
          <ListRow title="Log Out" tone="destructive" onClick={() => setConfirm(true)} />
        </ListGroup>
        <p className="text-center text-caption text-muted">Stanford OYO · Version 0.1.0</p>
      </div>
      <Sheet open={password} onClose={() => setPassword(false)} title="Change Password">
        <ChangePasswordForm
          onSuccess={() => {
            setPassword(false);
            toast.show({ title: 'Password changed' });
          }}
        />
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Log Out?"
        body="You'll need to log in again."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        loading={logout.isPending}
        onConfirm={() => {
          setMessage(undefined);
          logout.mutate(
            {},
            {
              onSuccess: () => navigate('/login', { replace: true }),
              onError: (error) => {
                setConfirm(false);
                setMessage(authError(error));
              },
            },
          );
        }}
      />
    </>
  );
}
