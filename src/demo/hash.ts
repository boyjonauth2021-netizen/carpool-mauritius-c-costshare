export type Route =
  | { name: "home" }
  | { name: "login" }
  | { name: "register" }
  | { name: "rides" }
  | { name: "new-ride" }
  | { name: "ride"; id: string }
  | { name: "trips" }
  | { name: "verify" }
  | { name: "inbox" }
  | { name: "account" }
  | { name: "admin" }
  | { name: "settings" }
  | { name: "audit" }
  | { name: "legal" }
  | { name: "privacy" };

export function parseHash(hash: string): Route {
  const path = (hash.replace(/^#/, "") || "/").split("?")[0] ?? "/";
  const parts = path.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const head = parts[0];
  if (!head) return { name: "home" };
  if (head === "login") return { name: "login" };
  if (head === "register") return { name: "register" };
  if (head === "rides" && parts[1] === "new") return { name: "new-ride" };
  if (head === "rides" && parts[1]) return { name: "ride", id: parts[1] };
  if (head === "rides") return { name: "rides" };
  if (head === "trips") return { name: "trips" };
  if (head === "verify") return { name: "verify" };
  if (head === "inbox") return { name: "inbox" };
  if (head === "account") return { name: "account" };
  if (head === "admin" && parts[1] === "settings") return { name: "settings" };
  if (head === "admin" && parts[1] === "audit") return { name: "audit" };
  if (head === "admin") return { name: "admin" };
  if (head === "legal") return { name: "legal" };
  if (head === "privacy") return { name: "privacy" };
  return { name: "home" };
}

export function go(hash: string) {
  const next = hash.startsWith("#") ? hash : `#${hash}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = next;
}
