import { describe, expect, it } from "vitest";
import { schoolForEmail, validateSignUp } from "./auth";
import type { User } from "./types";

const mk = (over: Partial<User> = {}): User => ({
  id: "u1",
  username: "tester",
  email: "test@example.com",
  phone: "(617) 555-0100",
  displayName: "Test",
  region: "Boston, MA",
  friendIds: [],
  ...over,
});

describe("auth", () => {
  it("validates sign up and uniqueness", () => {
    const users = [mk()];
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
