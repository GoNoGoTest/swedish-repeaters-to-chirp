import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TargetPickerPanel } from "../TargetPickerPanel";
import { DEFAULT_SETTINGS } from "@/lib/codeplug/defaults";
// Säkerställ att alla targets registreras innan vi renderar.
import "@/lib/codeplug/targets";
import type { Settings } from "@/lib/codeplug/models";

describe("TargetPickerPanel", () => {
  it("byter targetId till RT Systems Yaesu och initierar dess perTarget-defaults", async () => {
    const user = userEvent.setup();
    const setSettings = vi.fn();
    // Starta med ett perTarget för vgc-n76 ifyllt så vi kan verifiera att det
    // inte rensas när vi byter target.
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      export: {
        ...DEFAULT_SETTINGS.export,
        perTarget: {
          ...DEFAULT_SETTINGS.export.perTarget,
          "vgc-n76": { foo: "bar" } as unknown as Settings["export"]["perTarget"]["vgc-n76"],
        },
      },
    };

    render(<TargetPickerPanel settings={settings} setSettings={setSettings} />);

    await user.selectOptions(screen.getByRole("combobox"), "rt-systems-yaesu-generic");

    expect(setSettings).toHaveBeenCalledTimes(1);
    const next = setSettings.mock.calls[0][0] as Settings;
    expect(next.export.targetId).toBe("rt-systems-yaesu-generic");
    // Existerande perTarget-poster bevarade — ingen regression som nollställer.
    expect(next.export.perTarget["chirp-generic"]).toEqual(
      settings.export.perTarget["chirp-generic"],
    );
    expect(next.export.perTarget["vgc-n76"]).toEqual({ foo: "bar" });
    // Nytt target får sina defaults inlagda.
    expect(next.export.perTarget["rt-systems-yaesu-generic"]).toBeTruthy();
  });
});
