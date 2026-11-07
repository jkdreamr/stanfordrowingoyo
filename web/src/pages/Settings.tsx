import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogout, useMe, usePushConfig } from '../lib/queries';
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  type PushSupport,
} from '../lib/push';
import { setAppBadge } from '../lib/badge';
import { useInstall } from '../lib/install';
import { IosInstallSteps } from '../components/InstallBanner';
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
  Toggle,
  useToast,
} from '../components/ui';
import { FormErrors } from '../components/auth/FormErrors';
const pushFooter: Record<PushSupport, string | undefined> = {
  ready: undefined,
  'needs-install': 'Add OYO to your Home Screen first.',
  denied: 'Blocked in browser settings.',
  unsupported: 'Not supported in this browser.',
};
function NotificationSettings() {
  const { data: config } = usePushConfig();
  const install = useInstall();
  const toast = useToast();
  const [support, setSupport] = useState<PushSupport>(() => pushSupport());
  const [enabled, setEnabled] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState(false);
  useEffect(() => {
    let live = true;
    void currentSubscription()
      .then((subscription) => live && setEnabled(!!subscription))
      .catch(() => live && setEnabled(false));
    return () => {
      live = false;
    };
  }, []);
  if (!config?.public_key) return null;
  const publicKey = config.public_key;
  const change = async (next: boolean) => {
    setBusy(true);
    try {
      if (!next) {
        await disablePush();
        setEnabled(false);
      } else if ((await enablePush(publicKey)) === 'enabled') setEnabled(true);
      else setSupport(pushSupport());
    } catch {
      toast.show({ title: 'Couldn’t update notifications', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ListGroup header="Notifications" footer={pushFooter[support]}>
      <div className="px-4 py-2">
        <Toggle
          label="Push Notifications"
          checked={!!enabled && support === 'ready'}
          disabled={busy || enabled === undefined || support !== 'ready'}
          onChange={(next) => void change(next)}
        />
      </div>
      {support === 'needs-install' && install.mode === 'ios' && (
        <>
          <ListRow title="Add to Home Screen" chevron onClick={() => setSteps(true)} />
          <IosInstallSteps open={steps} onClose={() => setSteps(false)} />
        </>
      )}
    </ListGroup>
  );
}
function InstallSettings() {
  const install = useInstall();
  if (install.mode !== 'prompt') return null;
  return (
    <ListGroup header="App">
      <ListRow title="Install App" chevron onClick={() => void install.install()} />
    </ListGroup>
  );
}
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
        <NotificationSettings />
        <InstallSettings />
        <ListGroup header="Account">
          <ListRow title="Edit Profile" to="/me/edit" />
          <ListRow title="Weekly Target" to="/me/target" />
          <ListRow title="Change Password" chevron onClick={() => setPassword(true)} />
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
        onConfirm={async () => {
          setMessage(undefined);
          await Promise.race([
            disablePush().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ]);
          setAppBadge(0);
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
