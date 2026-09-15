import { requestToPromise, withStore } from "./database.js";

const DEFAULTS = {
  memoryEnabled: true,
  theme: null,
  appUrl: "",
};

export async function getSetting(key, fallback) {
  const row = await withStore("settings", "readonly", (store) => requestToPromise(store.get(key)));
  if (!row) return fallback ?? DEFAULTS[key];
  return row.value;
}

export async function setSetting(key, value) {
  await withStore("settings", "readwrite", (store) => store.put({ key, value }));
  return value;
}

export async function getAllSettings() {
  const rows = await withStore("settings", "readonly", (store) => requestToPromise(store.getAll()));
  const result = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function replaceSettings(settings) {
  await withStore("settings", "readwrite", (store) => {
    for (const [key, value] of Object.entries(settings || {})) {
      store.put({ key, value });
    }
  });
}
