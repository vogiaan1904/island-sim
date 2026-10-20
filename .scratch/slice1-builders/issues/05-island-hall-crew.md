# 05: The Island Hall's crew

**What to build:** the Island Hall's crew of 8 comes on the morning boat when its wood is on site or arriving on that
morning's ferry, so buying the wood never costs a day; calling builders for it is refused while its wood is not all
on site, and the card says why. Spec: "Sim: the rules" (morning boat, landmark readiness, the `call-builders`
refusals), "Client: UI".

**Blocked by:** 01, 03.

**Status:** ready-for-agent

- [ ] Sim, tests first: at 06:45 a landmark counts as ready when its materials on site plus that morning's ferry cargo
      for it cover them; with the crew on site it builds only once the wood is in (no progress at 06:45 to 07:00 with
      wood still on the ferry); a landmark short of materials gets no crew; `call-builders` refused with
      `missing-materials` while the wood is not all on site; the Island Hall finishes in one shift with its crew, and
      the stage change and celebration follow as before.
- [ ] Client: the card of an Island Hall site short of wood says the builders come once the wood is there, and the
      refusal reads in words.
- [ ] `pnpm check` passes.
