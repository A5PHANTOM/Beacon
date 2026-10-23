const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relativePath, mocks) {
  const source = fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    module,
    module.exports,
  );
  return module.exports;
}

async function main() {
  const gate = load("src/lib/access-gate.ts", {});
  const restrictedEmail = "bijokbinoy2005@gmail.com";
  let session = { user: { id: "restricted", email: restrictedEmail, role: "MEMBER" } };
  let validPassword = true;
  const auth = load("src/lib/auth.ts", {
    "next-auth": { getServerSession: async () => session },
    "next-auth/providers/credentials": { __esModule: true, default: (config) => config },
    bcryptjs: { __esModule: true, default: { compare: async () => validPassword } },
    "./db": { prisma: { user: { findUnique: async () => ({
      ...session.user, passwordHash: "test-hash", name: "Test member",
    }) } } },
    "./access-gate": gate,
  });

  const authorize = auth.authOptions.providers[0].authorize;
  assert.equal((await authorize({ email: restrictedEmail, password: "correct-value" })).email, restrictedEmail);
  validPassword = false;
  assert.equal(await authorize({ email: restrictedEmail, password: "incorrect-value" }), null);
  assert.equal(await auth.getLoginSession(), session);
  assert.equal(await auth.getServerAuthSession(), null);
  await assert.rejects(auth.requireAuth, /UNAUTHORIZED/);
  session.user.role = "ADMIN";
  await assert.rejects(auth.requireAdmin, /UNAUTHORIZED/);

  const middleware = load("src/middleware.ts", {
    "next-auth/middleware": { withAuth: (handler) => handler },
    "@/lib/access-gate": gate,
  }).default;
  for (const route of ["/projects", "/projects/private-project", "/admin/users", "/analytics", "/timesheets"]) {
    const response = middleware({
      url: `https://beacon.test${route}`,
      nextauth: { token: { email: restrictedEmail, role: "ADMIN" } },
    });
    assert.equal(response.headers.get("location"), "https://beacon.test/payment-required");
  }
  assert.equal(middleware({
    url: "https://beacon.test/projects",
    nextauth: { token: { email: "other@example.com" } },
  }), undefined);

  session = { user: { id: "other", email: "other@example.com", role: "MEMBER" } };
  assert.equal(await auth.getServerAuthSession(), session);
  assert.equal(await auth.requireAuth(), session);
  session = null;
  assert.equal(await auth.getServerAuthSession(), null);
  await assert.rejects(auth.requireAuth, /UNAUTHORIZED/);
  assert(gate.requiresPayment(` ${restrictedEmail.toUpperCase()} `));
  assert(!gate.requiresPayment(undefined));

  const { renderToStaticMarkup } = require("react-dom/server");
  const { createElement } = require("react");
  const screen = load("src/components/navigation/payment-required-screen.tsx", {
    "@/lib/access-gate": gate,
    "./payment-required-screen.module.css": { __esModule: true, default: {} },
  });
  const html = renderToStaticMarkup(createElement(screen.PaymentRequiredScreen));
  assert(html.includes("Pay ₹300 to continue"));
  assert(html.includes('aria-modal="true"'));
  assert(html.includes('inert=""'));
  assert(!/<button|<a\s|<form/.test(html), "Locked screen must have no dismiss or navigation controls");
  console.log("Access gate checks passed: login, existing sessions, role bypass, protected routes, server access, other users, and locked screen.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
