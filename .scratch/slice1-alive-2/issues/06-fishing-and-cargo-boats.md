# 06: Fishing and cargo boats

**What to build:** a fishing boat per staffed fishing hut, and a cargo boat from the pier for each sale. Spec:
"Client: boats"; ADR 0002.

**Blocked by:** 01, 02.

**Status:** ready-for-agent

- [ ] Fishing boat: moored at the hut's water side; the rower walks to it, rows 3 to 5 tiles out (hashed direction, on
      water, off the ferry lane), sits until the return, rows back by the shift's end, carries a basket in.
- [ ] Cargo boat: moored along the pier's side, clear of the ferry berth; per sale manifest entry it sails south
      (offset from the ferry lane) over 20 game minutes with props of the sold good, and back over the next 20. The
      mooring is empty while a trip is out; overlapping trips are separate boats.
- [ ] Both sit at `marker_waterline` and bob with `render/waves.ts`; visitors see the same.
- [ ] Tests: out and back within the shift; one boat per entry, two overlapping entries give two boats; never in the
      ferry's berth.

## Comments
