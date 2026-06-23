import { describe, it, expect } from "vitest";
import { parseSk6baCsv, loadSk6baCsv } from "../../importers/sk6ba";

const HEADER =
  "id,updated,type,band,mode,network,network_id,district,call,city,channel," +
  "output,tx_shift,access,status,lat,lng,locator,masl,magl,watt_pep,dir,ant,backup";

describe("parseSk6baCsv parse error surfacing", () => {
  it("rapporterar Papa-fel som parseErrors men returnerar fortfarande rader", () => {
    // Rad med för få fält (FieldMismatch hos PapaParse).
    const csv = `${HEADER}\nSK1AB,2025,Repeater,2,FM`;
    const r = parseSk6baCsv(csv);
    expect(r.parseErrors.length).toBeGreaterThan(0);
    expect(r.rows.length).toBe(1);
  });

  it("loadSk6baCsv exponerar parseWarnings i loaded-tillståndet", () => {
    // Giltig CSV med en rad som har "öppen" citattecken som Papa flaggar.
    const csv = `${HEADER}\n1,2025,Repeater,2,FM,SVX,1,6,SK6AB,Göteborg,GBG,145.6,-0.6,1750,QRV,57.7,11.97,JO67BP,10,5,25,N,Y,Y`;
    const state = loadSk6baCsv(csv);
    expect(state.status).toBe("loaded");
    if (state.status !== "loaded") return;
    // Ren CSV → inga warnings.
    expect(state.parseWarnings).toEqual([]);
  });

  it("loadSk6baCsv returnerar loaded även när enstaka rader har Papa-fel", () => {
    const csv = `${HEADER}\n1,2025,Repeater,2,FM\n2,2025,Repeater,2,FM,SVX,1,6,SK6AB,Göteborg,GBG,145.6,-0.6,1750,QRV,57.7,11.97,JO67BP,10,5,25,N,Y,Y`;
    const state = loadSk6baCsv(csv);
    expect(state.status).toBe("loaded");
    if (state.status !== "loaded") return;
    expect(state.parseWarnings.length).toBeGreaterThan(0);
  });
});
