const fetch = require("node-fetch");

/**
 * Normalize base server URL so it works with `new URL()`.
 * Accepts:
 *  - "example.com"
 *  - "example.com:8080"
 *  - "http://example.com"
 *  - "https://example.com/"
 */
function normalizeServerURL(serverURL) {
  let base = String(serverURL || "").trim();

  // If stored without protocol, default to https://
  if (!/^https?:\/\//i.test(base)) {
    base = "https://" + base;
  }

  // Remove trailing slash to avoid double slashes when joining
  base = base.replace(/\/+$/, "");
  return base;
}

async function callAPI(serverURL, path, params = {}) {
  const base = normalizeServerURL(serverURL);

  // Ensure path starts with /
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path}`;

  const url = new URL(base + cleanPath);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
  });

  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

const Api = {
  ping: (server) => callAPI(server, "/ping"),

  users: (server) => callAPI(server, "/users"),

  info: (server) => callAPI(server, "/info"),

  addUser: (server, user, pass, days) =>
    callAPI(server, "/add", { user, pass, days }),

  trialUser: (server, minutes) =>
    callAPI(server, "/trial", { minutes }),

  deleteUser: (server, user) =>
    callAPI(server, "/delete", { user }),

  renewUser: (server, user, days) =>
    callAPI(server, "/renew", { user, days }),

  changePass: (server, user, pass) =>
    callAPI(server, "/changepass", { user, pass }),

  backup: (server) => callAPI(server, "/backup"),

  restore: (server, id) => callAPI(server, "/restore", { id }),
};

module.exports = { Api, normalizeServerURL };
