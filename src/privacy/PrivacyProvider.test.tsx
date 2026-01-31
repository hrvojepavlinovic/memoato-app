import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PrivacyProvider, usePrivacy } from "./PrivacyProvider";

vi.mock("wasp/client/auth", () => {
  return {
    useAuth: () => ({ data: { id: "user_1" }, isLoading: false }),
  };
});

function Probe() {
  const p = usePrivacy();
  return (
    <div>
      <div data-testid="mode">{p.mode}</div>
      <div data-testid="unlocked">{p.isUnlocked ? "yes" : "no"}</div>
      <button onClick={() => p.setMode("encrypted")}>encrypted</button>
      <button onClick={() => p.setMode("cloud")}>cloud</button>
    </div>
  );
}

function ProbeUnlock() {
  const p = usePrivacy();
  const [pass, setPass] = React.useState("test passphrase");
  return (
    <div>
      <div data-testid="mode">{p.mode}</div>
      <div data-testid="unlocked">{p.isUnlocked ? "yes" : "no"}</div>
      <input aria-label="pass" value={pass} onChange={(e) => setPass(e.target.value)} />
      <button onClick={() => p.setMode("encrypted")}>encrypted</button>
      <button
        onClick={async () => {
          await p.unlockWithPassphrase(pass);
        }}
      >
        unlock
      </button>
    </div>
  );
}

describe("PrivacyProvider", () => {
  afterEach(() => cleanup());

  it("defaults to cloud and persists mode by user", async () => {
    localStorage.clear();
    sessionStorage.clear();
    render(
      <PrivacyProvider>
        <Probe />
      </PrivacyProvider>,
    );

    expect(screen.getByTestId("mode").textContent).toBe("cloud");

    fireEvent.click(screen.getByText("encrypted"));
    expect(screen.getByTestId("mode").textContent).toBe("encrypted");
    expect(localStorage.getItem("memoato.privacy.v1:user_1:mode")).toBe("encrypted");

    fireEvent.click(screen.getByText("cloud"));
    expect(screen.getByTestId("mode").textContent).toBe("cloud");
    expect(localStorage.getItem("memoato.privacy.v1:user_1:mode")).toBe("cloud");
  });

  it("unlockWithPassphrase sets a session key in encrypted mode", async () => {
    localStorage.clear();
    sessionStorage.clear();
    render(
      <PrivacyProvider>
        <ProbeUnlock />
      </PrivacyProvider>,
    );

    fireEvent.click(screen.getByText("encrypted"));
    fireEvent.click(screen.getByText("unlock"));
    await waitFor(() => expect(screen.getByTestId("unlocked").textContent).toBe("yes"));
    expect(sessionStorage.getItem("memoato.cryptoKeyB64.v1:user_1")).toBeTruthy();
  });
});
