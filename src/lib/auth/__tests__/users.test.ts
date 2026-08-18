// Named users replace shared role logins — the point being attribution.
//
// With three operators sharing one password the ledger records "operator" as
// the author of everything, which no password rotation can fix. These cover the
// two things that make the migration safe: a preset login retires itself the
// moment a real person holds that role, and you cannot strand yourself.
process.env.MOID_STORE = "memory";

import {
  __resetUserStoreForTests,
  authenticateNamedUser,
  companyId,
  createUser,
  getUserStore,
  hashPassword,
  normalizeUsername,
  presetLoginAllowed,
  validatePassword,
  validateUsername,
  verifyPassword,
  authenticate,
} from "../users";


beforeEach(() => {
  __resetUserStoreForTests();
  process.env.MOID_AUTH_PASSWORD_GM = "moid-gm";
  process.env.MOID_AUTH_PASSWORD_OPERATOR = "moid-operator";
});

const addOperator = (username = "r.kumar", password = "shopfloor-1") =>
  createUser({
    username,
    displayName: "R. Kumar",
    role: "operator",
    password,
    createdBy: "gm",
  });

describe("password hashing", () => {
  it("never stores the plaintext", async () => {
    const hash = await hashPassword("shopfloor-1");
    expect(hash).not.toContain("shopfloor-1");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("salts, so the same password hashes differently every time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("verifies the right password and rejects near misses", async () => {
    const hash = await hashPassword("shopfloor-1");
    expect(await verifyPassword("shopfloor-1", hash)).toBe(true);
    expect(await verifyPassword("shopfloor-2", hash)).toBe(false);
    expect(await verifyPassword("shopfloor-", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("treats a malformed or empty stored hash as a failure, never a pass", async () => {
    for (const bad of ["", "notahash", "scrypt$1$$", "scrypt$32768$aa", "$$$"]) {
      expect(await verifyPassword("anything", bad)).toBe(false);
    }
  });
});

describe("validation", () => {
  it("normalises usernames typed on a shop-floor terminal", () => {
    expect(normalizeUsername("  R. Kumar ")).toBe("r..kumar");
    expect(normalizeUsername("A Patel")).toBe("a.patel");
  });

  it("refuses names that would shadow a preset role login", () => {
    for (const reserved of ["gm", "GM", "owner", "operator"]) {
      expect(validateUsername(reserved)).toMatch(/reserved/);
    }
  });

  it("refuses junk usernames and short passwords", () => {
    expect(validateUsername("a")).toBeTruthy();
    expect(validateUsername("-nope")).toBeTruthy();
    // A space is normalised to a dot rather than rejected — "R Kumar" is what
    // a supervisor actually types when creating the account.
    expect(validateUsername("has space")).toBeNull();
    expect(normalizeUsername("has space")).toBe("has.space");
    expect(validateUsername("r.kumar")).toBeNull();
    expect(validatePassword("short")).toBeTruthy();
    expect(validatePassword("longenough1")).toBeNull();
  });
});

describe("named authentication", () => {
  it("signs in a created user and reports their role", async () => {
    expect(await addOperator()).toBeNull();
    const u = await authenticateNamedUser("r.kumar", "shopfloor-1");
    expect(u).toEqual({ username: "r.kumar", displayName: "R. Kumar", role: "operator" });
  });

  it("is case-insensitive on the username", async () => {
    await addOperator();
    expect(await authenticateNamedUser("R.Kumar", "shopfloor-1")).not.toBeNull();
  });

  it("rejects the wrong password", async () => {
    await addOperator();
    expect(await authenticateNamedUser("r.kumar", "wrong")).toBeNull();
  });

  it("rejects a deactivated account — this is how a leaver is revoked", async () => {
    await addOperator();
    await getUserStore().setActive(companyId(), "r.kumar", false);
    expect(await authenticateNamedUser("r.kumar", "shopfloor-1")).toBeNull();
  });

  it("refuses a duplicate username", async () => {
    await addOperator();
    expect(await addOperator()).toMatch(/already exists/);
  });
});

describe("the shared preset login retires itself", () => {
  it("answers while nobody real holds the role", async () => {
    expect(await presetLoginAllowed("operator")).toBe(true);
    const shared = await authenticate("operator", "moid-operator");
    expect(shared?.role).toBe("operator");
    // …and is visibly marked as shared, so audit screens do not read it as a person.
    expect(shared?.displayName).toMatch(/shared login/i);
  });

  it("stops answering once an active named user holds that role", async () => {
    await addOperator();
    expect(await presetLoginAllowed("operator")).toBe(false);
    expect(await authenticate("operator", "moid-operator")).toBeNull();
    // The real person still gets in.
    expect((await authenticate("r.kumar", "shopfloor-1"))?.username).toBe("r.kumar");
  });

  it("retires per role, not globally", async () => {
    await addOperator();
    // No named GM yet, so the GM bootstrap must survive — otherwise creating
    // the first operator would lock the plant out of administration.
    expect(await presetLoginAllowed("gm")).toBe(true);
    expect((await authenticate("gm", "moid-gm"))?.role).toBe("gm");
  });

  it("comes back if every named user for the role is deactivated (break glass)", async () => {
    await addOperator();
    expect(await presetLoginAllowed("operator")).toBe(false);
    await getUserStore().setActive(companyId(), "r.kumar", false);
    expect(await presetLoginAllowed("operator")).toBe(true);
    expect(await authenticate("operator", "moid-operator")).not.toBeNull();
  });
});

describe("what the session carries", () => {
  it("is a person, so the ledger can attribute an entry to one", async () => {
    await addOperator();
    const a = await authenticate("r.kumar", "shopfloor-1");
    const b = await authenticate("s.devi", "shopfloor-2");
    await createUser({
      username: "s.devi",
      displayName: "S. Devi",
      role: "operator",
      password: "shopfloor-2",
      createdBy: "gm",
    });
    const c = await authenticate("s.devi", "shopfloor-2");

    expect(a?.username).toBe("r.kumar");
    expect(b).toBeNull(); // did not exist yet
    expect(c?.username).toBe("s.devi");
    // Two operators, two identities — the thing a shared password cannot do.
    expect(a?.username).not.toBe(c?.username);
  });
});
