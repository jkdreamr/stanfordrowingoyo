import { Activity } from 'lucide-react';
import { EmptyState, PageHeader } from '../ui';
import { HeaderActions } from './HeaderActions';
import type { ReactNode } from 'react';
export function Placeholder({
  title,
  actions = false,
  settings = false,
  children,
  back,
}: {
  title: string;
  actions?: boolean;
  settings?: boolean;
  children?: ReactNode;
  back?: string;
}) {
  return (
    <>
      <PageHeader
        title={title}
        back={back}
        trailing={actions ? <HeaderActions settings={settings} /> : undefined}
      />
      <div className="px-4">
        <EmptyState icon={<Activity size={20} strokeWidth={1.75} />} title={`${title} Is Coming`} />
        {children}
      </div>
    </>
  );
}
