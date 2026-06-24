import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewTable, channelKey } from "../PreviewTable";
import { makeChannel } from "@/lib/codeplug/__tests__/helpers";

describe("PreviewTable", () => {
  it("visar exakt det getExportMode returnerar i Export-kolumnen, inte mode_effective", () => {
    const channels = [
      makeChannel({ source_row: 2, source_id: "A", mode_effective: "C4FM" }),
      makeChannel({ source_row: 3, source_id: "B", mode_effective: "FM" }),
    ];
    const getExportMode = vi.fn((c) => (c.mode_effective === "C4FM" ? "DN" : "FM"));

    render(
      <PreviewTable
        channels={channels}
        excludedKeys={new Set()}
        onToggleExclude={() => {}}
        getExportMode={getExportMode}
        getExportLocation={() => null}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getAllByRole("cell")[10]).toHaveTextContent("DN");
    expect(within(rows[1]).getAllByRole("cell")[10]).toHaveTextContent("FM");
    expect(within(rows[0]).getAllByRole("cell")[9]).toHaveTextContent("C4FM");
  });

  it("anropar onToggleExclude med exakt channelKey för raden", async () => {
    const user = userEvent.setup();
    const channels = [
      makeChannel({ source_row: 2, source_id: "A", mode_effective: "C4FM" }),
      makeChannel({ source_row: 3, source_id: "B", mode_effective: "FM" }),
    ];
    const onToggleExclude = vi.fn();

    render(
      <PreviewTable
        channels={channels}
        excludedKeys={new Set()}
        onToggleExclude={onToggleExclude}
        getExportMode={(c) => c.mode_effective}
        getExportLocation={() => null}
      />,
    );

    await user.click(screen.getByRole("switch", { name: "Exkludera rad 2 från export" }));
    expect(onToggleExclude).toHaveBeenCalledTimes(1);
    expect(onToggleExclude).toHaveBeenCalledWith(channelKey(channels[0]));
  });

  it("visar verklig exportposition från getExportLocation, inte radindex i filtrerad vy", () => {
    const a = makeChannel({ source_row: 2, source_id: "A" });
    const b = makeChannel({ source_row: 3, source_id: "B" });
    const c = makeChannel({ source_row: 4, source_id: "C" });
    const locs = new Map<string, number>([
      [channelKey(a), 1],
      [channelKey(b), 2],
      [channelKey(c), 3],
    ]);
    // Filtrerad preview: bara C visas.
    render(
      <PreviewTable
        channels={[c]}
        excludedKeys={new Set()}
        onToggleExclude={() => {}}
        getExportMode={() => "FM"}
        getExportLocation={(ch) => locs.get(channelKey(ch)) ?? null}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    // Loc är kolumnindex 2 (Exkl., #, Loc, ...).
    expect(within(rows[0]).getAllByRole("cell")[2]).toHaveTextContent("3");
  });

  it("visar — för exkluderad rad även om getExportLocation returnerar nummer", () => {
    const c = makeChannel({ source_row: 2, source_id: "A" });
    const key = channelKey(c);
    render(
      <PreviewTable
        channels={[c]}
        excludedKeys={new Set([key])}
        onToggleExclude={() => {}}
        getExportMode={() => "FM"}
        getExportLocation={() => 42}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getAllByRole("cell")[2]).toHaveTextContent("—");
  });

  it("visar RX-badge även när tx_allowed=false (utan rx_only)", () => {
    const c = makeChannel({
      source_type: "channel_pack",
      source_row: 2,
      source_id: "A",
      pack_id: "p1",
      rx_only: false,
      tx_allowed: false,
    });
    render(
      <PreviewTable
        channels={[c]}
        excludedKeys={new Set()}
        onToggleExclude={() => {}}
        getExportMode={() => "FM"}
        getExportLocation={() => 1}
      />,
    );
    expect(screen.getByText("RX")).toBeInTheDocument();
  });
});
