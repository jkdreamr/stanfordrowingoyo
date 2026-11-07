import { PlusSquare, Share, X } from 'lucide-react';
import { Button, IconButton, Sheet } from './ui';
import { useInstall } from '../lib/install';

export function IosInstallSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add to Home Screen">
      <ol className="ui-install-steps">
        <li>
          <Share size={20} aria-hidden="true" />
          <span>Tap Share</span>
        </li>
        <li>
          <PlusSquare size={20} aria-hidden="true" />
          <span>Tap Add to Home Screen</span>
        </li>
        <li>
          <span className="ui-install-step-number" aria-hidden="true">
            3
          </span>
          <span>Tap Add</span>
        </li>
      </ol>
    </Sheet>
  );
}

export function InstallBanner() {
  const install = useInstall();
  if (!install.mode) return null;
  return (
    <>
      {!install.dismissed && (
        <section aria-label="Install App" className="ui-card ui-install-banner">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} />
          <span className="min-w-0 flex-1 text-headline">Install OYO</span>
          <Button onClick={() => void install.install()}>Install</Button>
          <IconButton aria-label="Dismiss" onClick={install.dismiss}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </section>
      )}
      <IosInstallSteps open={install.steps} onClose={install.closeSteps} />
    </>
  );
}
