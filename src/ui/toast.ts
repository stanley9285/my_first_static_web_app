/**
 * toast.ts — minimal, non-blocking status/error notifier.
 *
 * Used for graceful-failure messaging (e.g. a data file or tile source being
 * unreachable) without ever crashing or blocking the map.
 */

let timer: number | undefined;

export function toast(message: string, kind: "info" | "error" = "info", ms = 6000): void {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = false;
  window.clearTimeout(timer);
  if (ms > 0) {
    timer = window.setTimeout(() => {
      el.hidden = true;
    }, ms);
  }
}
