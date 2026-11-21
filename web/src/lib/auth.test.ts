import { describe, expect, it } from "vitest";
import { findUser, hashPassword, login, schoolForEmail, validateSignUp } from "./auth";
import type { User } from "./types";

const mk = async (over: Partial<User> = {}): Promise<User> => ({
  id: "u1",
  username: "tester",
  email: "test@example.com",
  phone: "(617) 555-0100",
  passHash: await hashPassword("tester", "secret1"),
  displayName: "Test",
  region: "Boston, MA",
  friendIds: [],
  ...over,
});

describe("auth", () => {
  it("finds users by email, username or phone", async () => {
    const users = [await mk()];
    expect(findUser(users, "TEST@example.com")?.id).toBe("u1");
    expect(findUser(users, "@tester")?.id).toBe("u1");
    expect(findUser(users, "617-555-0100")?.id).toBe("u1");
    expect(findUser(users, "nobody")).toBeUndefined();
  });
  it("checks the password", async () => {
    const users = [await mk()];
    expect(await login(users, "tester", "secret1")).not.toBeNull();
    expect(await login(users, "tester", "wrong")).toBeNull();
  });
  it("validates sign up and uniqueness", async () => {
    const users = [await mk()];
    const errs = validateSignUp(users, {
      email: "test@example.com",
      username: "Tester",
      password: "123",
      displayName: "",
      phone: "555",
      region: "",
    });
    expect(Object.keys(errs).sort()).toEqual(["displayName", "email", "password", "phone", "region", "username"]);
  });
  it("verifies schools by .edu domain", () => {
    expect(schoolForEmail("x@bu.edu")).toBe("Boston University");
    expect(schoolForEmail("x@cs.mit.edu")).toBe("MIT");
    expect(schoolForEmail("x@gmail.com")).toBeNull();
  });
});
