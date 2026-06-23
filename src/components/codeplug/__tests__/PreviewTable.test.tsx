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
    // Stubba en target-specifik resolver — chirp skulle exportera C4FM som "DN".
    const getExportMode = vi.fn((c) => (c.mode_effective === "C4FM" ? "DN" : "FM"));

    render(
      <PreviewTable
        channels={channels}
        excludedKeys={new Set()}
        onToggleExclude={() => {}}
        getExportMode={getExportMode}
        startLoc={1}
      />,
    );

    // Två datarader; ta tabellens body-celler i kolumnordning. Export är index 10
    // (Exkl., #, Loc, Källa, Namn, Freq, Dpx, Off, Tone, Signal, Export, ...).
    const rows = screen.getAllByRole("row").slice(1); // strip header
    expect(within(rows[0]).getAllByRole("cell")[10]).toHaveTextContent("DN");
    expect(within(rows[1]).getAllByRole("cell")[10]).toHaveTextContent("FM");
    // Signal-kolumnen (index 9) ska fortsatt visa mode_effective.
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
        startLoc={1}
      />,
    );

    await user.click(screen.getAllByLabelText("Exkludera rad 2 från export")[0]);
    expect(onToggleExclude).toHaveBeenCalledTimes(1);
    expect(onToggleExclude).toHaveBeenCalledWith(channelKey(channels[0]));
  });
});
