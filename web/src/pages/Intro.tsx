import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { equivalentMeters } from '../../../shared/math';
import { useCompleteIntro, useConfig, useTarget } from '../lib/queries';
import { authError, safeNext } from '../lib/auth';
import { formatNumber } from '../lib/format';
import { AuthFrame } from '../components/auth/AuthLayout';
import { FormErrors } from '../components/auth/FormErrors';
import { Button } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';

const steps = [
  ['E-meters', 'Erg, bike and run share one training total.'],
  ['Training Zones', 'Choose the zone you trained in. Intensity changes your E-meters.'],
  ['Your Weekly Target', 'Build toward your target, Monday through Sunday.'],
] as const;

export default function Intro() {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLDivElement>(null);
  const config = useConfig();
  const target = useTarget();
  const complete = useCompleteIntro();
  const navigate = useNavigate();
  const next = safeNext(useLocation().search);
  const destination = next.startsWith('/intro') ? '/' : next;
  const content = step === 2 ? target : config;
  useEffect(() => {
    const title = heading.current?.closest('main')?.querySelector('h1');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }, [step]);
  function finish() {
    complete.mutate(undefined, { onSuccess: () => navigate(destination, { replace: true }) });
  }
  const value = (distance: number, modality: 'bike' | 'erg', zone: 'E' | 'D') =>
    formatNumber(
      equivalentMeters(
        distance,
        modality,
        zone,
        config.data?.mode_factors,
        config.data?.zone_factors,
      ),
    );
  return (
    <AuthFrame
      title={steps[step][0]}
      subtitle={steps[step][1]}
      leading={
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button
              variant="plain"
              leading={<ChevronLeft size={20} />}
              onClick={() => setStep(step - 1)}
              disabled={complete.isPending}
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button variant="plain" onClick={finish} disabled={complete.isPending}>
            Skip
          </Button>
        </div>
      }
      action={
        <Button
          fullWidth
          loading={complete.isPending}
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
        >
          {step === 2 ? 'Get Started' : 'Continue'}
        </Button>
      }
    >
      <div ref={heading} className="space-y-6">
        <p className="text-footnote text-muted" aria-live="polite">
          {step + 1} of 3
        </p>
        <FormErrors message={complete.error ? authError(complete.error) : undefined} />
        {!content.data ? (
          <LoadState error={content.isError} retry={() => void content.refetch()} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-divider bg-surface">
            {step === 0 && (
              <dl className="divide-y divide-divider">
                <div className="flex items-center justify-between gap-4 p-5">
                  <dt>30,000 m Bike · E</dt>
                  <dd className="text-headline tabular-nums">{value(30000, 'bike', 'E')} E-m</dd>
                </div>
                <div className="flex items-center justify-between gap-4 p-5">
                  <dt>10,000 m Erg · E</dt>
                  <dd className="text-headline tabular-nums">{value(10000, 'erg', 'E')} E-m</dd>
                </div>
              </dl>
            )}
            {step === 1 && (
              <dl className="divide-y divide-divider">
                <div className="flex items-center justify-between gap-4 p-5">
                  <dt>10,000 m Erg · E</dt>
                  <dd className="text-headline tabular-nums">{value(10000, 'erg', 'E')} E-m</dd>
                </div>
                <div className="flex items-center justify-between gap-4 p-5">
                  <dt>10,000 m Erg · D</dt>
                  <dd className="text-headline tabular-nums">{value(10000, 'erg', 'D')} E-m</dd>
                </div>
              </dl>
            )}
            {step === 2 && target.data && (
              <div className="space-y-3 p-6">
                <p className="text-title1 tabular-nums">{formatNumber(target.data.target_m)} E-m</p>
                <p className="text-subhead text-muted">
                  {target.data.source === 'group' ? 'Your group target' : 'Your personal target'}
                </p>
                <p className="text-subhead">Change it anytime in Settings.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthFrame>
  );
}
