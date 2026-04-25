import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'users.json');

export type User = {
  username: string;
  password: string;
  createdAt: string;
};

export function readUsers(): User[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeUsers(users: User[]) {
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export function findUser(username: string): User | null {
  return readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export function createUser(username: string, password: string): User {
  const users = readUsers();
  const user: User = { username, password, createdAt: new Date().toISOString() };
  writeUsers([...users, user]);
  return user;
}
