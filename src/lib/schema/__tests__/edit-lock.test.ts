import { checkSchemaEditPassword, SCHEMA_EDIT_PASSWORD } from "../edit-lock";

describe("checkSchemaEditPassword", () => {
  it("accepts the hardcoded edit password", () => {
    expect(checkSchemaEditPassword(SCHEMA_EDIT_PASSWORD)).toBe(true);
    expect(checkSchemaEditPassword("editonly")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(checkSchemaEditPassword("")).toBe(false);
    expect(checkSchemaEditPassword("editonly ")).toBe(false);
    expect(checkSchemaEditPassword("Editonly")).toBe(false);
  });
});
