import type { ReactNode } from 'react';
export function TaskHeader({
  title,
  leading,
  trailing,
}: {
  title: string;
  leading: ReactNode;
  trailing: ReactNode;
}) {
  return (
    <header className="ui-task-header">
      <div>{leading}</div>
      <h1 className="text-headline">{title}</h1>
      <div>{trailing}</div>
    </header>
  );
}
