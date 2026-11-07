import { useState } from 'react';
import { useConfig, useMe, useSetTarget, useTarget } from '../lib/queries';
import { formatEMeters } from '../lib/format';
import { authError } from '../lib/auth';
import {
  Button,
  Card,
  NumberField,
  PageHeader,
  SegmentedControl,
  useToast,
} from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { FormErrors } from '../components/auth/FormErrors';
export default function WeeklyTarget() {
  const config = useConfig();
  const me = useMe();
  const target = useTarget();
  if (!config.data || !me.data || !target.data)
    return (
      <>
        <PageHeader title="Weekly Target" back="/me" />
        <LoadState
          error={config.isError || me.isError || target.isError}
          retry={() => {
            void config.refetch();
            void me.refetch();
            void target.refetch();
          }}
        />
      </>
    );
  return (
    <TargetForm
      key={`${target.data.target_m}:${target.data.source}`}
      current={target.data.target_m}
      source={target.data.source}
      group={me.data.group_key}
      groupDefault={config.data.group_targets[me.data.group_key]}
    />
  );
}
function TargetForm({
  current,
  source,
  group,
  groupDefault,
}: {
  current: number;
  source: string;
  group: string;
  groupDefault: number;
}) {
  const [value, setValue] = useState(String(current));
  const [message, setMessage] = useState<string>();
  const mutation = useSetTarget();
  const toast = useToast();
  const valid = Number.isInteger(Number(value)) && Number(value) > 0;
  return (
    <>
      <PageHeader title="Weekly Target" back="/me" />
      <form
        className="screen-stack"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid || mutation.isPending) return;
          setMessage(undefined);
          try {
            await mutation.mutateAsync({ body: { target_m: Number(value) } });
            toast.show({ title: 'Weekly target saved' });
          } catch (error) {
            setMessage(authError(error));
          }
        }}
      >
        <Card>
          <p className="text-subhead text-muted">
            {source === 'group' ? 'Group Default' : 'Personal Target'}
          </p>
          <p className="mt-3 text-title1 tabular-nums">{formatEMeters(current)}</p>
          <p className="mt-3 text-footnote text-muted">
            <span className="capitalize">{group}</span> Group Default {formatEMeters(groupDefault)}
          </p>
        </Card>
        <FormErrors message={message} />
        <SegmentedControl
          label="Quick Target"
          value={['60000', '80000', '100000'].includes(value) ? value : 'custom'}
          onChange={(value) => {
            if (value === 'custom') {
              setValue('');
              requestAnimationFrame(() => document.getElementById('target')?.focus());
            } else setValue(value);
          }}
          options={[
            { value: '60000', label: '60k' },
            { value: '80000', label: '80k' },
            { value: '100000', label: '100k' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        <NumberField
          id="target"
          label="Personal Target"
          suffix="E-m"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={!valid && value ? 'Enter a positive whole number of E-meters' : undefined}
          hint="Applies from this week. The group default is saved as a personal target."
        />
        <Button variant="secondary" onClick={() => setValue(String(groupDefault))}>
          Use Group Default
        </Button>
        <Button type="submit" fullWidth disabled={!valid} loading={mutation.isPending}>
          Save Target
        </Button>
      </form>
    </>
  );
}
