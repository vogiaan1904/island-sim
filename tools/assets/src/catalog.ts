/**
 * Every file the game ships in apps/client/public/models and .../icons. A file is added here in the same commit
 * that adds it, and the shipped-files test requires the folders to hold exactly this list.
 */
export const catalog: { models: readonly string[]; icons: readonly string[] } = {
  models: ['palette.png'],
  icons: [],
};
