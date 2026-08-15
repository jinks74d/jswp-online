/**
 * Tests for hooks/use-server-action.ts.
 *
 * This hook is worth pinning tightly because 17 client components delegate
 * their error handling to it. The critical rule is the NEXT_REDIRECT swallow:
 * a server action that ends in redirect() signals success by throwing, so
 * treating that throw as a failure shows the user the literal string
 * "NEXT_REDIRECT" in an error banner while the navigation happens anyway.
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useServerAction } from "@/hooks/use-server-action";

/** The control-flow error Next.js throws out of a redirecting server action. */
function redirectError(): Error {
  return new Error("NEXT_REDIRECT");
}

describe("useServerAction — initial state", () => {
  it("starts idle with no error", () => {
    const { result } = renderHook(() => useServerAction());
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe("useServerAction — the NEXT_REDIRECT swallow", () => {
  it("does NOT surface a redirect as an error", async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(async () => {
        throw redirectError();
      });
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("does not call onError for a redirect either", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(
        async () => {
          throw redirectError();
        },
        { onError }
      );
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(onError).not.toHaveBeenCalled();
  });

  it("matches the redirect message exactly, not as a substring", async () => {
    // A real failure whose message merely mentions the token must still be
    // reported, or a genuine error could hide behind the swallow.
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(async () => {
        throw new Error("NEXT_REDIRECT failed to apply");
      });
    });

    await waitFor(() =>
      expect(result.current.error).toBe("NEXT_REDIRECT failed to apply")
    );
  });
});

describe("useServerAction — failure reporting", () => {
  it("surfaces the action's own message when it has one", async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(async () => {
        throw new Error("You can't edit a submitted writing.");
      });
    });

    await waitFor(() =>
      expect(result.current.error).toBe("You can't edit a submitted writing.")
    );
  });

  it('defaults to "Could not continue." when the error has no message', async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(async () => {
        throw new Error("");
      });
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Could not continue.")
    );
  });

  it("uses a caller-supplied fallback instead of the default", async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(
        async () => {
          throw new Error("");
        },
        { fallback: "Could not submit this step." }
      );
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Could not submit this step.")
    );
  });

  it("prefers the thrown message over the fallback", async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(
        async () => {
          throw new Error("Real reason");
        },
        { fallback: "Generic reason" }
      );
    });

    await waitFor(() => expect(result.current.error).toBe("Real reason"));
  });

  it("handles a non-Error rejection without crashing", async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "a bare string";
      });
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Could not continue.")
    );
  });
});

describe("useServerAction — onError escape hatch", () => {
  it("routes failures to onError and leaves error state untouched", async () => {
    // The two fire-and-forget call sites (skip-step, placeholder-step) only
    // console.error; they must not start rendering a banner they never had.
    const onError = vi.fn();
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(
        async () => {
          throw new Error("boom");
        },
        { onError }
      );
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(result.current.error).toBeNull();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe("useServerAction — success and state hygiene", () => {
  it("leaves error null when the action resolves", async () => {
    const action = vi.fn(async () => undefined);
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(action);
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("clears a previous error at the start of the next run", async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.run(async () => {
        throw new Error("first failure");
      });
    });
    await waitFor(() => expect(result.current.error).toBe("first failure"));

    act(() => {
      result.current.run(async () => undefined);
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it("lets a caller set an error directly, for client-side validation", async () => {
    const { result } = renderHook(() => useServerAction());

    act(() => {
      result.current.setError("Pick at least one class period.");
    });
    expect(result.current.error).toBe("Pick at least one class period.");

    act(() => {
      result.current.setError(null);
    });
    expect(result.current.error).toBeNull();
  });

  it("keeps a stable run identity across renders so effects don't re-fire", () => {
    const { result, rerender } = renderHook(() => useServerAction());
    const first = result.current.run;
    rerender();
    expect(result.current.run).toBe(first);
  });
});
