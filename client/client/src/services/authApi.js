/**
 * services/authApi.js
 * -------------------
 * All authentication-related API calls.
 */
import api from "./api";

export async function register(name, email, password) {
  const res = await api.post("/auth/register", { name, email, password }, {
    headers: { "Content-Type": "application/json" }
  });
  return res.data; // { token, user, message }
}

export async function login(email, password) {
  const res = await api.post("/auth/login", { email, password }, {
    headers: { "Content-Type": "application/json" }
  });
  return res.data; // { token, user }
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data.user;
}
