# 18: Settings and account

**What to build:** the gear next to the compass opens Settings: sound (the one mute control, kept for the ambience in
`slice1-alive`), quality (Low, Medium, High), controls (trackpad or mouse), the account with the username as typed and
change password, and log out. User stories 58 to 60.

**Blocked by:** 06, 10, 11.

**Status:** ready-for-agent

- [ ] Quality and controls change the view state set by tickets 07 and 10, and are remembered on the device.
- [ ] Change password uses `/api/password` and says it signed out the other devices; errors in plain words.
- [ ] Log out ends only this device's session.
- [ ] Plain words, big toggles, no nested menus.
- [ ] Testing Library tests for each setting and the password flow; no-emoji.
