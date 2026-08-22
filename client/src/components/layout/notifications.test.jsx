import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../api/planning", () => ({ getRecurring: vi.fn() }));
vi.mock("../../hooks/usePush", () => ({ default: vi.fn() }));

const { getRecurring } = await import("../../api/planning");
const usePush = (await import("../../hooks/usePush")).default;
const NotificationBell = (await import("./NotificationBell")).default;
const PushOptInStrip = (await import("./PushOptInStrip")).default;

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY_MS).toISOString();

const rule = (overrides = {}) => ({
  _id: "r1",
  template: { amount: 950, type: "expense", note: "Rent" },
  interval: "monthly",
  nextRun: inDays(2),
  active: true,
  ...overrides,
});

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );

const pushState = (overrides = {}) => ({
  supported: true,
  permission: "default",
  isSubscribed: false,
  isReady: true,
  isBusy: false,
  error: null,
  enable: vi.fn(),
  disable: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  getRecurring.mockResolvedValue([]);
  usePush.mockReturnValue(pushState());
});

describe("NotificationBell", () => {
  test("renders a bell button", async () => {
    renderBell();

    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  test("shows no badge when nothing is due", async () => {
    renderBell();

    await waitFor(() => expect(getRecurring).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  test("badges the count and announces it in the label", async () => {
    getRecurring.mockResolvedValue([rule(), rule({ _id: "r2", nextRun: inDays(4) })]);

    renderBell();

    const button = await screen.findByRole("button", { name: "Notifications, 2 due soon" });
    expect(button).toHaveTextContent("2");
  });

  test("caps the badge at 9+", async () => {
    getRecurring.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => rule({ _id: `r${i}`, nextRun: inDays(1) })),
    );

    renderBell();

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  test("counts only what the shared selector considers due", async () => {
    getRecurring.mockResolvedValue([
      rule({ _id: "in", nextRun: inDays(3) }),
      rule({ _id: "far", nextRun: inDays(30) }),
      rule({ _id: "paused", nextRun: inDays(1), active: false }),
    ]);

    renderBell();

    expect(await screen.findByRole("button", { name: "Notifications, 1 due soon" })).toBeInTheDocument();
  });

  test("the menu is closed until the bell is clicked", async () => {
    renderBell();

    await waitFor(() => expect(getRecurring).toHaveBeenCalled());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("opens and closes on click", async () => {
    renderBell();
    const button = await screen.findByRole("button", { name: "Notifications" });

    await userEvent.click(button);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(button);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("lists each due item with its amount and due label", async () => {
    getRecurring.mockResolvedValue([rule()]);

    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: /Notifications/ }));

    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("$950")).toBeInTheDocument();
    expect(screen.getByText(/Due in 2 days/)).toBeInTheDocument();
  });

  test("shows the caught-up state when nothing is due", async () => {
    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));

    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  test("shows an error state when the request fails", async () => {
    getRecurring.mockRejectedValue({ response: { data: { error: "Server error" } } });

    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Couldn't load notifications")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });

  test("falls back to a generic label when a rule has no note", async () => {
    getRecurring.mockResolvedValue([rule({ template: { amount: 10, type: "income" } })]);

    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: /Notifications/ }));

    expect(screen.getByText("Recurring income")).toBeInTheDocument();
  });

  test("marks an overdue item differently from an upcoming one", async () => {
    getRecurring.mockResolvedValue([rule({ nextRun: inDays(-3) })]);

    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: /Notifications/ }));

    expect(screen.getByText(/Overdue by 3d/)).toBeInTheDocument();
  });

  test("Escape closes the menu", async () => {
    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("clicking outside closes the menu", async () => {
    render(
      <MemoryRouter>
        <div data-testid="outside">elsewhere</div>
        <NotificationBell />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("outside"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("clicking inside the menu keeps it open", async () => {
    getRecurring.mockResolvedValue([rule()]);

    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: /Notifications/ }));

    await userEvent.click(screen.getByText("Rent"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  test("links to Planning and closes on the way", async () => {
    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));

    const link = screen.getByRole("link", { name: "Manage in Planning" });
    expect(link).toHaveAttribute("href", "/planning");

    await userEvent.click(link);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("fetches the rules only once, not on every open", async () => {
    renderBell();
    const button = await screen.findByRole("button", { name: "Notifications" });

    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.click(button);

    expect(getRecurring).toHaveBeenCalledTimes(1);
  });
});

describe("PushOptInStrip", () => {
  test("renders nothing until the subscription state is known", () => {
    usePush.mockReturnValue(pushState({ isReady: false }));

    const { container } = render(<PushOptInStrip />);

    // Otherwise the banner flashes on every load for opted-in users.
    expect(container.firstChild).toBe(null);
  });

  test("offers the opt-in when supported and not yet subscribed", () => {
    render(<PushOptInStrip />);

    expect(screen.getByText("Enable Push Notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setup Notifications" })).toBeEnabled();
  });

  test("the button actually calls enable", async () => {
    const enable = vi.fn();
    usePush.mockReturnValue(pushState({ enable }));

    render(<PushOptInStrip />);
    await userEvent.click(screen.getByRole("button", { name: "Setup Notifications" }));

    expect(enable).toHaveBeenCalledTimes(1);
  });

  test("shows a busy label while setting up", () => {
    usePush.mockReturnValue(pushState({ isBusy: true }));

    render(<PushOptInStrip />);

    expect(screen.getByRole("button", { name: /Setting up/ })).toBeDisabled();
  });

  test("explains and disables the button when notifications are blocked", () => {
    usePush.mockReturnValue(pushState({ permission: "denied" }));

    render(<PushOptInStrip />);

    expect(screen.getByText(/blocked for this site/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setup Notifications" })).toBeDisabled();
  });

  test("surfaces an error from the enable flow", () => {
    usePush.mockReturnValue(pushState({ error: "The server has no VAPID key configured." }));

    render(<PushOptInStrip />);

    expect(
      screen.getByText("The server has no VAPID key configured."),
    ).toBeInTheDocument();
  });

  test("switches to a confirmation with a turn-off control once subscribed", () => {
    render(<PushOptInStrip />);
    expect(screen.getByRole("button", { name: "Setup Notifications" })).toBeInTheDocument();

    usePush.mockReturnValue(pushState({ isSubscribed: true, permission: "granted" }));
    render(<PushOptInStrip />);

    expect(screen.getByText("Push notifications are on for this device.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn off" })).toBeInTheDocument();
  });

  test("turn off calls disable", async () => {
    const disable = vi.fn();
    usePush.mockReturnValue(pushState({ isSubscribed: true, disable }));

    render(<PushOptInStrip />);
    await userEvent.click(screen.getByRole("button", { name: "Turn off" }));

    expect(disable).toHaveBeenCalledTimes(1);
  });

  test("explains itself on a browser without push, offering no button", () => {
    usePush.mockReturnValue(pushState({ supported: false, permission: "unsupported" }));

    render(<PushOptInStrip />);

    expect(screen.getByText(/doesn't support push notifications/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
