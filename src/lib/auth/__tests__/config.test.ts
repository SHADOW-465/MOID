import {
  findUser,
  getAuthSecret,
  getAuthUsers,
  isAuthEnabled,
  listLoginOptions,
  passwordForRole,
  DEFAULT_AUTH_SECRET,
  DEFAULT_PRESET_PASSWORDS,
} from "../config";

describe("preset role logins", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("always requires sign-in with a session secret", () => {
    delete process.env.MOID_AUTH_SECRET;
    expect(isAuthEnabled()).toBe(true);
    expect(getAuthSecret()).toBe(DEFAULT_AUTH_SECRET);
  });

  it("uses MOID_AUTH_SECRET when long enough", () => {
    process.env.MOID_AUTH_SECRET = "plant-override-secret-32chars!!";
    expect(getAuthSecret()).toBe("plant-override-secret-32chars!!");
  });

  it("exposes exactly gm, owner, operator", () => {
    const users = getAuthUsers();
    expect(users.map((u) => u.role)).toEqual(["gm", "owner", "operator"]);
    expect(listLoginOptions()).toHaveLength(3);
  });

  it("accepts role id + default password", () => {
    delete process.env.MOID_AUTH_PASSWORD_GM;
    delete process.env.MOID_AUTH_PASSWORD;
    const u = findUser("gm", DEFAULT_PRESET_PASSWORDS.gm);
    expect(u?.role).toBe("gm");
    expect(findUser("gm", "wrong")).toBeNull();
  });

  it("honours MOID_AUTH_PASSWORD_OPERATOR override", () => {
    process.env.MOID_AUTH_PASSWORD_OPERATOR = "plant-op-secret";
    expect(passwordForRole("operator")).toBe("plant-op-secret");
    expect(findUser("operator", "plant-op-secret")?.role).toBe("operator");
  });

  it("accepts shared MOID_AUTH_PASSWORD for all roles", () => {
    process.env.MOID_AUTH_PASSWORD = "shared-plant";
    delete process.env.MOID_AUTH_PASSWORD_GM;
    expect(findUser("owner", "shared-plant")?.role).toBe("owner");
  });
});
