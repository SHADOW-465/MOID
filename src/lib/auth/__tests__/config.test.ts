import {
  findUser,
  getAuthUsers,
  listLoginOptions,
  passwordForRole,
  DEFAULT_PRESET_PASSWORDS,
} from "../config";

describe("preset role logins", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
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
