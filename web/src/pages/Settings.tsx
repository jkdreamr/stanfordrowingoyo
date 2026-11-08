import { useEffect, useId, useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useLogout, useMe, usePushConfig, useUpdateMe } from '../lib/queries';
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
import { fadeTheme, useTheme } from '../lib/theme';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';
import {
  ConfirmSheet,
  ListGroup,
  ListRow,
  PageHeader,
  Sheet,
  ThemeSwitch,
  Toggle,
  useToast,
} from '../components/ui';
import { FormErrors } from '../components/auth/FormErrors';
import { PasskeySettings } from '../components/auth/PasskeySettings';
const pushFooter: Record<PushSupport, string | undefined> = {
  ready: undefined,
  'needs-install': 'Add OYO to your Home Screen first.',
  denied: 'Blocked in browser settings.',
  unsupported: 'Not supported in this browser.',
};
function NotificationSettings() {
  const { data: me } = useMe();
  const update = useUpdateMe();
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
      {enabled && me?.role === 'rower' && (
        <div className="px-4 py-2">
          <Toggle
            label="Evening Reminder"
            checked={me.evening_reminder}
            disabled={update.isPending}
            onChange={(next) => update.mutate({ body: { evening_reminder: next } })}
          />
          <p className="text-footnote text-muted">7:30 pm if you haven't logged.</p>
        </div>
      )}
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
  const [downloading, setDownloading] = useState(false);
  const { theme, setTheme, dark } = useTheme();
  const themeSwitch = useId();
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
          <div className="ui-row [&>div]:flex-1">
            <Toggle
              label="Match System"
              checked={theme === 'system'}
              onChange={(follow) =>
                fadeTheme(() => setTheme(follow ? 'system' : dark ? 'dark' : 'light'))
              }
            />
          </div>
          <div className="ui-row">
            <span className="min-w-0 flex-1">
              <label htmlFor={themeSwitch} className="block">
                Dark Mode
              </label>
              {theme === 'system' && (
                <span id={`${themeSwitch}-note`} className="block text-footnote text-muted">
                  Following this device
                </span>
              )}
            </span>
            <ThemeSwitch
              id={themeSwitch}
              dark={dark}
              disabled={theme === 'system'}
              aria-describedby={theme === 'system' ? `${themeSwitch}-note` : undefined}
              onChange={(next) => fadeTheme(() => setTheme(next ? 'dark' : 'light'))}
            />
          </div>
        </ListGroup>
        <NotificationSettings />
        <InstallSettings />
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
