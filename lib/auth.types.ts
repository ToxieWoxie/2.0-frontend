// lib/auth.types.ts

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type SignUpInput = {
  email: string;
  password: string;
  username: string;
};

export type LoginInput = {
  email: string;
  password: string;
};
