import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../api/push", () => ({
  getVapidPublicKey: vi.fn(),
  savePushSubscription: vi.fn(),
  removePushSubscription: vi.fn(),
}));

const push = await import("../api/push");
const { default: usePush, urlBase64ToUint8Array, isPushSupported } = await import("./usePush");

const VAPID_KEY =
  "BCXFcLsM9WlTppBypeLWIxPaVT7tGnYSBC5gBCMvlr91anangVnHNvOY7xyff-w3W2pyiZhqvnpHmgOnS6MSjgg";

const makeSubscription = (endpoint = "https://push.test/abc") => ({
  endpoint,
  toJSON: () => ({ endpoint, keys: { p256dh: "k", auth: "a" } }),
  unsubscribe: vi.fn(() => Promise.resolve(true)),
});

let pushManager;
let registration;

const installBrowserPush = ({ existingSubscription = null } = {}) => {
  pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(existingSubscription)),
    subscribe: vi.fn(() => Promise.resolve(makeSubscription())),
  };
  registration = { pushManager };

  globalThis.navigator.serviceWorker = {
    register: vi.fn(() => Promise.resolve(registration)),
    ready: Promise.resolve(registration),
  };
  globalThis.PushManager = function PushManager() {};
  globalThis.Notification = { permission: "default", requestPermission: vi.fn() };
};

const removeBrowserPush = () => {
  delete globalThis.navigator.serviceWorker;
  delete globalThis.PushManager;
  delete globalThis.Notification;
};

beforeEach(() => {
  vi.clearAllMocks();
  push.getVapidPublicKey.mockResolvedValue(VAPID_KEY);
  push.savePushSubscription.mockResolvedValue({});
  push.removePushSubscription.mockResolvedValue({});
  installBrowserPush();
});

afterEach(() => {
  removeBrowserPush();
});

describe("urlBase64ToUint8Array", () => {
  test("decodes a base64url key to bytes", () => {
    const bytes = urlBase64ToUint8Array(VAPID_KEY);

    expect(bytes).toBeInstanceOf(Uint8Array);
    // An uncompressed P-256 point is 65 bytes and starts with 0x04.
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });

  test("re-adds the padding base64url strips", () => {
    expect(() => urlBase64ToUint8Array("QQ")).not.toThrow();
    expect(urlBase64ToUint8Array("QQ")[0]).toBe(65); // "A"
  });

  test("translates the base64url alphabet back to standard base64", () => {
    // '-' and '_' must become '+' and '/' or atob throws.
    expect(() => urlBase64ToUint8Array("a-_b")).not.toThrow();
  });
});

describe("isPushSupported", () => {
  test("true when the browser has all three APIs", () => {
    expect(isPushSupported()).toBe(true);
  });

  test("false when any one of them is missing", () => {
    delete globalThis.PushManager;
    expect(isPushSupported()).toBe(false);

    installBrowserPush();
    delete globalThis.Notification;
    expect(isPushSupported()).toBe(false);

    installBrowserPush();
    delete globalThis.navigator.serviceWorker;
    expect(isPushSupported()).toBe(false);
  });
});

describe("usePush — initial state", () => {
  test("registers the service worker on mount", async () => {
    const { result } = renderHook(() => usePush());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });

  test("reports not subscribed when the browser holds no subscription", async () => {
    const { result } = renderHook(() => usePush());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.supported).toBe(true);
  });

  test("reports subscribed when the browser already holds one", async () => {
    installBrowserPush({ existingSubscription: makeSubscription() });

    const { result } = renderHook(() => usePush());

    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
  });

  test("reports unsupported without touching the service worker", async () => {
    removeBrowserPush();

    const { result } = renderHook(() => usePush());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.supported).toBe(false);
    expect(result.current.permission).toBe("unsupported");
  });

  test("survives a service worker registration failure", async () => {
    navigator.serviceWorker.register.mockRejectedValue(new Error("no SW"));

    const { result } = renderHook(() => usePush());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isSubscribed).toBe(false);
  });

  test("mirrors an already-granted permission", async () => {
    globalThis.Notification.permission = "granted";

    const { result } = renderHook(() => usePush());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.permission).toBe("granted");
  });
});

describe("usePush — enable", () => {
  test("asks permission, subscribes and stores it on the server", async () => {
    globalThis.Notification.requestPermission.mockResolvedValue("granted");

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let outcome;
    await act(async () => {
      outcome = await result.current.enable();
    });

    expect(outcome).toBe(true);
    expect(Notification.requestPermission).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(push.savePushSubscription).toHaveBeenCalledWith({
      endpoint: "https://push.test/abc",
      keys: { p256dh: "k", auth: "a" },
    });
    expect(result.current.isSubscribed).toBe(true);
  });

  test("reuses an existing browser subscription rather than making a second", async () => {
    // Re-subscribing would orphan the old endpoint server-side.
    const existing = makeSubscription("https://push.test/existing");
    installBrowserPush({ existingSubscription: existing });
    globalThis.Notification.requestPermission.mockResolvedValue("granted");

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(push.savePushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push.test/existing" }),
    );
  });

  test("stops and explains when permission is denied", async () => {
    globalThis.Notification.requestPermission.mockResolvedValue("denied");

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let outcome;
    await act(async () => {
      outcome = await result.current.enable();
    });

    expect(outcome).toBe(false);
    expect(result.current.permission).toBe("denied");
    expect(result.current.error).toMatch(/blocked/i);
    expect(push.savePushSubscription).not.toHaveBeenCalled();
  });

  test("handles the prompt being dismissed", async () => {
    globalThis.Notification.requestPermission.mockResolvedValue("default");

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.error).toMatch(/dismissed/i);
    expect(result.current.isSubscribed).toBe(false);
  });

  test("reports a server with no VAPID key configured", async () => {
    globalThis.Notification.requestPermission.mockResolvedValue("granted");
    push.getVapidPublicKey.mockResolvedValue("");

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let outcome;
    await act(async () => {
      outcome = await result.current.enable();
    });

    expect(outcome).toBe(false);
    expect(result.current.error).toMatch(/VAPID/);
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  test("surfaces a failed save and leaves the state unsubscribed", async () => {
    globalThis.Notification.requestPermission.mockResolvedValue("granted");
    push.savePushSubscription.mockRejectedValue({
      response: { data: { error: "Invalid subscription object" } },
    });

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.error).toBe("Invalid subscription object");
    expect(result.current.isSubscribed).toBe(false);
  });

  test("clears isBusy even when the flow fails", async () => {
    globalThis.Notification.requestPermission.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.isBusy).toBe(false);
  });

  test("does nothing on an unsupported browser", async () => {
    removeBrowserPush();

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let outcome;
    await act(async () => {
      outcome = await result.current.enable();
    });

    expect(outcome).toBe(false);
    expect(push.savePushSubscription).not.toHaveBeenCalled();
  });
});

describe("usePush — disable", () => {
  test("removes the server record before unsubscribing the browser", async () => {
    // Order matters: a browser-side unsubscribe the server never hears about
    // leaves it pushing at a dead endpoint until the 410 purge catches up.
    const existing = makeSubscription("https://push.test/live");
    installBrowserPush({ existingSubscription: existing });

    const order = [];
    push.removePushSubscription.mockImplementation(async () => order.push("server"));
    existing.unsubscribe.mockImplementation(async () => {
      order.push("browser");
      return true;
    });

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    await act(async () => {
      await result.current.disable();
    });

    expect(order).toEqual(["server", "browser"]);
    expect(push.removePushSubscription).toHaveBeenCalledWith("https://push.test/live");
    expect(result.current.isSubscribed).toBe(false);
  });

  test("still unsubscribes the browser when the server call fails", async () => {
    const existing = makeSubscription();
    installBrowserPush({ existingSubscription: existing });
    push.removePushSubscription.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    await act(async () => {
      await result.current.disable();
    });

    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(false);
  });

  test("is a no-op when there is nothing subscribed", async () => {
    const { result } = renderHook(() => usePush());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let outcome;
    await act(async () => {
      outcome = await result.current.disable();
    });

    expect(outcome).toBe(true);
    expect(push.removePushSubscription).not.toHaveBeenCalled();
  });
});
