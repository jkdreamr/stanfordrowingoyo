import { useToast } from '../components/ui';
import type { ToastOptions } from '../components/ui/Toast';

export async function shareResult(
  title: string,
  text: string,
  toast: (options: ToastOptions) => void,
) {
  const linked = `${text}\nhttps://stanford-oyo.joskoo.workers.dev`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text: linked });
      return;
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
        return;
    }
  }
  try {
    await navigator.clipboard.writeText(linked);
    toast({ title: 'Result Copied' });
  } catch {
    toast({ title: 'Could Not Copy Result', tone: 'error' });
  }
}

export function useShareResult() {
  const toast = useToast();
  return (title: string, text: string) => shareResult(title, text, toast.show);
}
