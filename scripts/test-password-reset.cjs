const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const bcrypt = require("bcryptjs");

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
  let session;
  let user;
  let writes = 0;
  const prisma = { user: {
    findUnique: async ({ where }) => where.id === user.id || where.email === user.email ? { ...user } : null,
    update: async ({ where, data }) => {
      assert.equal(where.id, user.id);
      writes++;
      Object.assign(user, data);
      return { ...user };
    },
  } };
  const auth = load("src/lib/auth.ts", {
    "next-auth": { getServerSession: async () => session },
    "next-auth/providers/credentials": { __esModule: true, default: (config) => config },
    "./db": { prisma },
    "./access-gate": load("src/lib/access-gate.ts", {}),
  });
  const actions = load("src/app/(dashboard)/admin/users/actions.ts", {
    "@/lib/db": { prisma },
    "@/lib/auth": { requireAdmin: auth.requireAdmin },
    "next/cache": { revalidatePath: () => {} },
  });
  const authorize = auth.authOptions.providers[0].authorize;
  for (const role of ["ADMIN", "MEMBER"]) {
    user = { id: "target", email: role === "ADMIN" ? "admin@gmail.com" : "member@example.com", name: "Test", role, passwordHash: await bcrypt.hash("1234", 4) };
    session = { user: { id: "actor", email: "admin@example.com", role: "ADMIN" } };
    assert.equal((await authorize({ email: user.email, password: "1234" })).id, user.id);
    const nextPassword = "Changed-password-2026!";
    assert.equal((await actions.resetUserPasswordAction({ userId: user.id, newPassword: nextPassword })).success, true);
    assert.notEqual(user.passwordHash, nextPassword);
    assert(await bcrypt.compare(nextPassword, user.passwordHash));
    for (const password of ["1234", "password", "password123", "admin", "admin123", "pass", "root", "test", "123456", "beacon", "random-invalid", ` ${nextPassword} `]) {
      assert.equal(await authorize({ email: user.email, password }), null, `${role} accepted invalid password`);
    }
    assert.equal((await authorize({ email: ` ${user.email.toUpperCase()} `, password: nextPassword })).id, user.id);
  }
  const before = writes;
  session.user.role = "MEMBER";
  assert.equal((await actions.resetUserPasswordAction({ userId: user.id, newPassword: "Forbidden-value" })).success, false);
  session = null;
  assert.equal((await actions.resetUserPasswordAction({ userId: user.id, newPassword: "Forbidden-value" })).success, false);
  session = { user: { id: "actor", email: "admin@example.com", role: "ADMIN" } };
  assert.equal((await actions.resetUserPasswordAction({ userId: user.id, newPassword: "x" })).success, false);
  assert.equal(writes, before);
  console.log("Password reset checks passed for admins and members: new password accepted; old, fallback, arbitrary, and whitespace-modified passwords rejected; unauthorized resets denied.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
