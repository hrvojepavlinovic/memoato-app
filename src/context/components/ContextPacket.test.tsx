import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ContextPacket, formatContextPacket } from "./ContextPacket";
import type { ContextPacketView } from "../viewTypes";

let packet: ContextPacketView;
let write: ReturnType<typeof vi.fn>;
beforeEach(() => {
  write = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: write },
  });
  packet = {
    id: "packet-one",
    traceId: "trace-one",
    packetHash: "packet-hash",
    permissionSnapshotHash: "permission-hash",
    content: {
      query: "release",
      workspace: { id: "workspace-one", name: "Example project" },
      claims: [
        {
          id: "claim-one",
          claimKey: "release",
          kind: "release_decision",
          statement: "Keep the release small.",
          confidence: 0.9,
          freshUntil: null,
          score: 1,
          evidence: [
            {
              sourceVersionId: "version-one",
              sourceKey: "example/repo#12",
              provider: "github",
              objectType: "issue",
              canonicalUrl: "https://github.com/example/repo/issues/12",
              contentHash: "exact-evidence-hash",
              sourceUpdatedAt: null,
              role: "supports",
              locator: null,
              excerpt: "Ship a small first version.",
            },
          ],
        },
      ],
      freshness: {
        generatedAt: "2026-10-19T10:00:00Z",
        freshUntil: "2099-01-01T00:00:00Z",
      },
      exclusions: { stale: 0, permission: 0 },
    },
    diff: {
      added: [{ claimId: "claim-one", claimKey: "release" }],
      changed: [],
      removed: [],
      unchangedCount: 0,
    },
  };
});
afterEach(cleanup);
function mount() {
  render(
    <MemoryRouter>
      <ContextPacket
        packet={packet}
        disabled={false}
        busy={false}
        onBuild={vi.fn()}
        onInvalidate={vi.fn()}
      />
    </MemoryRouter>,
  );
}
describe("Context packet output", () => {
  it("copies reviewed context with exact evidence versions and retrieval provenance", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Copy context" }));
    await screen.findByText("Context copied with source versions.");
    expect(write).toHaveBeenCalledTimes(1);
    const text = write.mock.calls[0][0] as string;
    for (const evidence of [
      "Keep the release small.",
      "exact-evidence-hash",
      "example/repo#12",
      "https://github.com/example/repo/issues/12",
      "trace-one",
      "permission-hash",
    ])
      expect(text).toContain(evidence);
  });
  it("offers selectable output when clipboard access fails", async () => {
    write.mockRejectedValue(new Error("Clipboard denied"));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Copy context" }));
    await screen.findByRole("alert");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Context to copy",
        }) as HTMLTextAreaElement
      ).value,
    ).toContain("exact-evidence-hash");
    expect(
      screen.queryByText("Context copied with source versions."),
    ).toBeNull();
  });
  it("prevents copying expired evidence and asks for a rebuild", () => {
    packet.content.freshness.freshUntil = "2000-01-01T00:00:00Z";
    mount();
    const copy = screen.getByRole("button", {
      name: "Copy context",
    }) as HTMLButtonElement;
    expect(copy.disabled).toBe(true);
    fireEvent.click(copy);
    expect(write).not.toHaveBeenCalled();
    expect(screen.getByText(/This packet’s evidence has expired/)).toBeTruthy();
  });
  it("keeps unsafe source URLs out of links and copied text", () => {
    packet.content.claims[0].evidence[0].canonicalUrl = "javascript:alert(1)";
    mount();
    expect(screen.queryByRole("link", { name: /example\/repo#12/ })).toBeNull();
    expect(formatContextPacket(packet)).not.toContain("javascript:");
    expect(formatContextPacket(packet)).toContain("exact-evidence-hash");
  });
});
