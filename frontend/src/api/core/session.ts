// The access token lives in sessionStorage: it survives a page reload but is gone when the
// tab closes, which suits shared computers at reception.
const TOKEN_KEY = "rafael.token";

export const session = {
  getToken(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  start(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  end(): void {
    sessionStorage.removeItem(TOKEN_KEY);
  },
};
