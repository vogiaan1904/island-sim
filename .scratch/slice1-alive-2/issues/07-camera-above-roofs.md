# 07: The camera stays above roofs

**What to build:** the closest zoom never puts the camera inside a building. Spec: "Client: camera".

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] A pure height lookup of building tops (instances and model heights); the controller keeps the eye above it plus
      a margin, as it keeps it above the ground.
- [ ] Unit tests in `camera/controller.test.ts`: zooming in over a cottage stops above its roof; open ground is
      unchanged.

## Comments
