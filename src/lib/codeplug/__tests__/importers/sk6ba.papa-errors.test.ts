import { describe, it, expect } from "vitest";
import { parseSk6baCsv, loadSk6baCsv } from "../../importers/sk6ba";

const HEADER =
  "id,updated,type,band,mode,network,network_id,district,call,city,channel," +
  "output,tx_shift,access,status,lat,lng,locator,masl,magl,watt_pep,dir,ant,backup";

describe("parseSk6baCsv parse error surfacing", () => {
  it("rapporterar Papa-fel som strukturerade parseErrors men returnerar rader", () => {
    const csv = `${HEADER}\nSK1AB,2025,Repeater,2,FM`;
    const r = parseSk6baCsv(csv);
    expect(r.parseErrors.length).toBeGreaterThan(0);
    const e = r.parseErrors[0];
    expect(e.source).toBe("papa");
    expect(typeof e.code).toBe("string");
    expect(typeof e.message).toBe("string");
    expect(r.rows.length).toBe(1);
  });

  it("loadSk6baCsv exponerar tom parseWarnings för ren CSV", () => {
    const csv = `${HEADER}\n1,2025,Repeater,2,FM,SVX,1,6,SK6AB,Göteborg,GBG,145.6,-0.6,1750,QRV,57.7,11.97,JO67BP,10,5,25,N,Y,Y`;
    const state = loadSk6baCsv(csv);
    expect(state.status).toBe("loaded");
    if (state.status !== "loaded") return;
    expect(state.parseWarnings).toEqual([]);
  });

  it("loadSk6baCsv returnerar loaded med strukturerade warnings", () => {
    const csv = `${HEADER}\n1,2025,Repeater,2,FM\n2,2025,Repeater,2,FM,SVX,1,6,SK6AB,Göteborg,GBG,145.6,-0.6,1750,QRV,57.7,11.97,JO67BP,10,5,25,N,Y,Y`;
    const state = loadSk6baCsv(csv);
    expect(state.status).toBe("loaded");
    if (state.status !== "loaded") return;
    expect(state.parseWarnings.length).toBeGreaterThan(0);
    const w = state.parseWarnings[0];
    expect(w.source === "papa" || w.source === "schema").toBe(true);
    expect(typeof w.code).toBe("string");
  });
});
