import { useState } from 'react';
import { api } from '../lib/api';
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
export default function Settings() {
  const logout = useLogout();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>();
  const [password, setPassword] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  async function download() {
    if (downloading) return;
    setDownloading(true);
    setMessage(undefined);
    try {
      const data = await api('GET /api/me/export', {});
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'oyo-my-data.json';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show({ title: 'Download started' });
    } catch (error) {
      setMessage(authError(error));
    } finally {
      setDownloading(false);
    }
  }
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
          <ListRow
            title={downloading ? 'Downloading…' : 'Download My Data'}
            subtitle="JSON · Profile, training and plans"
            onClick={() => void download()}
            disabled={downloading}
          />
        </ListGroup>
        <ListGroup header="Help And Privacy">
          <ListRow title="Quick Intro" to="/intro?next=%2Fsettings" />
          <ListRow title="Privacy" to="/privacy" />
        </ListGroup>
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
