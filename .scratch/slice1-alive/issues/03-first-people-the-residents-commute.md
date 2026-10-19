# 03: First people: the residents' commute

**What to build:** the tracer bullet for people. Residents walk from home to their workplace when the day shift starts
and back when it ends, drawn as animated Mini Characters. Spec: "Client: movers", "Client: drawing people".

**Blocked by:** 01.

**Status:** done

- [x] A pure movers module (no React, no three): (mirror island, content, gliding game time, camera target) to movers
      with position, heading, legs and arms clips and phases, character, scale and accessory; nothing stored between
      frames; seeds from stable ids through a stateless hash.
- [x] Residents' commute from the worker assignment: at shift start each home's workers walk to their workplace along
      the road path, at one tile per game minute, phase from distance, hashed stagger and sideways offset; at shift end
      they walk back. Movers appear at and vanish into a building's door (middle of the front edge on its access side).
      Children never commute; nobody walks at night.
- [x] Looks: character from a hash of (home id, person index), so the same people come back every day; about 3% in a
      wheelchair (wheelchair clips and accessory); no tints.
- [x] Detail by zoom: people only below 0.6 of the farthest camera distance, reappearing below 0.55; at most 200,
      nearest to the camera target first.
- [x] Drawing: one instanced mesh per character file and per accessory on the palette material; the vertex shader
      reads the joint-animation texture (single joint per vertex, legs layer, arm joints = legs torso x arms arm,
      two frames fetched and blended, looping and held clips). The frame loop fills instance buffers without
      allocations or React state. Shadows on Medium and High with the same vertex animation.
- [x] Unit tests: same inputs give the same output; residents leave home at shift start and arrive after their path's
      travel time; later time moves walkers forward; frame rate changes nothing; adding residents adds walkers
      without moving existing ones; none above the zoom switch and the band holds; the cap keeps the nearest 200.
- [x] Only the chosen clips are referenced; draw calls stay within the budget on the worst view (count noted in the
      commit).

## Comments

- Done: `render/clips.ts` (the manifest), `render/crowd.ts` (`crowdPlan`, `moversAt`, `peopleShown`), and
  `scene/characterMaterial.ts` plus `scene/People.tsx` (12 character meshes and the wheelchair, posed in the vertex
  shader, with a matching depth material for shadows).
- People add at most 13 draw calls (12 characters and the wheelchair), and the same again in the shadow pass on Medium and High.
- Checked in headless Chrome (SwiftShader) against the real server with a prepared village (a scratch preview
  script): the shader compiles, eight commuters walk the roads at 07:00 with walking legs and varied characters, feet
  on the road. The look itself is for ticket 13.
- Noticed for ticket 13: a door is the footprint's edge nearest the road, so someone whose road is behind a cottage
  steps out of its back wall.
- `world.test.ts` "many seeds" got its own 20 s timeout: 2.3 s alone, over the 5 s default once this ticket's test
  file joined the parallel run.
