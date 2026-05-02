const USERS_KEY = "site_users";
const AUTH_KEY = "auth";
const CURRENT_USER_KEY = "current_user";

const DEFAULT_USERS = [
  {
    username: "gmelebanon",
    password: "Asdfasdf1!",
  },
];

export function getUsers() {
  if (typeof window === "undefined") return [];

  const savedUsers = localStorage.getItem(USERS_KEY);

  if (!savedUsers) {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }

  return JSON.parse(savedUsers);
}

export function loginUser(username, password, remember) {
  const users = getUsers();

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) return false;

  if (remember) {
    localStorage.setItem(AUTH_KEY, "true");
  } else {
    sessionStorage.setItem(AUTH_KEY, "true");
  }

  localStorage.setItem(CURRENT_USER_KEY, username);

  return true;
}

export function isLoggedIn() {
  if (typeof window === "undefined") return false;

  return (
    localStorage.getItem(AUTH_KEY) === "true" ||
    sessionStorage.getItem(AUTH_KEY) === "true"
  );
}

export function getCurrentUser() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CURRENT_USER_KEY) || "";
}

export function logoutUser() {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function addUser(username, password) {
  const users = getUsers();

  const exists = users.some((u) => u.username === username);

  if (exists) {
    return {
      success: false,
      message: "Username already exists.",
    };
  }

  const updatedUsers = [...users, { username, password }];
  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));

  return {
    success: true,
    message: "User added successfully.",
  };
}

export function changePassword(username, currentPassword, newPassword) {
  const users = getUsers();

  const userIndex = users.findIndex(
    (u) => u.username === username && u.password === currentPassword
  );

  if (userIndex === -1) {
    return {
      success: false,
      message: "Current password is wrong.",
    };
  }

  users[userIndex].password = newPassword;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  return {
    success: true,
    message: "Password changed successfully.",
  };
}