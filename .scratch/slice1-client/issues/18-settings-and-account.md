# 18: Settings and account

**What to build:** the gear next to the compass opens Settings: sound (the one mute control, kept for the ambience in
`slice1-alive`), quality (Low, Medium, High), controls (trackpad or mouse), the account with the username as typed and
change password, and log out. User stories 58 to 60.

**Blocked by:** 06, 10, 11.

**Status:** done

- [x] Quality and controls change the view state set by tickets 07 and 10, and are remembered on the device.
- [x] Change password uses `/api/password` and says it signed out the other devices; errors in plain words.
- [x] Log out ends only this device's session.
- [x] Plain words, big toggles, no nested menus.
- [x] Testing Library tests for each setting and the password flow; no-emoji.

Also: Settings' account section has a "My worlds" button that leaves the island for the world screen (`showWorlds()`), so a creator with one world can see and renew the invite code (gap from ticket 06).
