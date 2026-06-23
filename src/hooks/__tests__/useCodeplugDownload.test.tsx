import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCodeplugDownload } from "../useCodeplugDownload";
import { DEFAULT_SETTINGS } from "@/lib/codeplug/defaults";
import { makeChannel } from "@/lib/codeplug/__tests__/helpers";
import "@/lib/codeplug/targets";

describe("useCodeplugDownload", () => {
  const captured: { content: string }[] = [];
  let clickSpy: ReturnType<typeof vi.fn>;
  let originalCreate: typeof URL.createObjectURL;
  let originalRevoke: typeof URL.revokeObjectURL;
  let originalClick: typeof HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    captured.length = 0;
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = vi.fn(async (blob: Blob) => {
      // Fånga innehåll synkront i en sidoeffekt via blob.text().
      blob.text().then((t) => captured.push({ content: t }));
      return "blob:mock";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    clickSpy = vi.fn();
    HTMLAnchorElement.prototype.click = clickSpy as unknown as () => void;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  });

  it("exporterar de kanaler som hooken får, utan dolda filter", async () => {
    const exportChannels = [
      makeChannel({
        source_row: 2,
        source_id: "SK6RFI",
        mode_effective: "FM",
        generated_name_final: "6-2M-SK6RFI",
        rx_frequency: 145.6,
      }),
      makeChannel({
        source_row: 3,
        source_id: "SK6BA",
        mode_effective: "FM",
        generated_name_final: "6-2M-SK6BA",
        rx_frequency: 145.625,
      }),
    ];

    const { result } = renderHook(() =>
      useCodeplugDownload({ settings: DEFAULT_SETTINGS, exportChannels }),
    );
    await act(async () => {
      await result.current.exportFiles();
    });
    // Vänta in async blob.text()
    await new Promise((r) => setTimeout(r, 10));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(captured.length).toBeGreaterThan(0);
    const csv = captured.map((c) => c.content).join("\n");
    expect(csv).toContain("6-2M-SK6RFI");
    expect(csv).toContain("6-2M-SK6BA");
  });

  it("respekterar caller-sidans filter: bara skickade kanaler exporteras", async () => {
    const exportChannels = [
      makeChannel({
        source_row: 2,
        source_id: "ONLY-ME",
        generated_name_final: "ONLY-ME",
        rx_frequency: 145.6,
      }),
    ];
    // En kanal som NOT skickas in (representerar en RX-only-rad som caller
    // redan exkluderat). Hooken ska aldrig se den.
    const hiddenName = "SHOULD-NOT-EXPORT";

    const { result } = renderHook(() =>
      useCodeplugDownload({ settings: DEFAULT_SETTINGS, exportChannels }),
    );
    await act(async () => {
      await result.current.exportFiles();
    });
    await new Promise((r) => setTimeout(r, 10));

    const csv = captured.map((c) => c.content).join("\n");
    expect(csv).toContain("ONLY-ME");
    expect(csv).not.toContain(hiddenName);
  });
});
