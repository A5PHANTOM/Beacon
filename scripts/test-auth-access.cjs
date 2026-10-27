const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports,
  );
  return module.exports;
}

async function main() {
  let session = { user: { id: "bijo", email: "bijokbinoy2005@gmail.com", role: "MEMBER" } };
  const auth = load("src/lib/auth.ts", {
    "next-auth": { getServerSession: async () => session },
    "next-auth/providers/credentials": { __esModule: true, default: (config) => config },
    "./github-login": { resolveGitHubLogin: async () => { throw new Error("Unexpected OAuth callback"); }, GitHubLoginFailure: class extends Error {} },
    "./db": { prisma: {} },
  });
  const middleware = load("src/middleware.ts", {
    "next-auth/middleware": { withAuth: (config) => config },
  }).default;
  assert.equal(await auth.getServerAuthSession(), session);
  assert.equal(await auth.requireAuth(), session);
  assert.equal(middleware.callbacks.authorized({ token: { email: session.user.email } }), true);
  await assert.rejects(auth.requireAdmin, /FORBIDDEN/);

  const redirects = { "@/lib/auth": auth, "next/navigation": { redirect: (url) => { throw new Error(`REDIRECT:${url}`); } } };
  const home = load("src/app/page.tsx", redirects).default;
  const formerGate = load("src/app/payment-required/page.tsx", redirects).default;
  await assert.rejects(home, /REDIRECT:\/projects/);
  await assert.rejects(formerGate, /REDIRECT:\/projects/);

  session.user.role = "ADMIN";
  assert.equal(await auth.requireAdmin(), session);
  session = null;
  assert.equal(await auth.getServerAuthSession(), null);
  await assert.rejects(auth.requireAuth, /UNAUTHORIZED/);
  await assert.rejects(formerGate, /REDIRECT:\/login/);
  assert.equal(middleware.callbacks.authorized({ token: null }), false);
  console.log("Auth checks passed: Bijo has normal member access, previous payment URL redirects to projects, admin permissions and anonymous restrictions remain enforced.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
