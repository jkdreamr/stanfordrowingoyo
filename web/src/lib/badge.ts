type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};
/** Badging API: shows the unread count on the installed app icon where supported. */
export function setAppBadge(count: number, nav: BadgeNavigator = navigator) {
  try {
    const result =
      count > 0
        ? nav.setAppBadge?.(Math.min(count, 99))
        : nav.clearAppBadge
          ? nav.clearAppBadge()
          : nav.setAppBadge?.(0);
    void result?.catch(() => {});
  } catch {
    // Unsupported or not permitted (for example, not installed).
  }
}
