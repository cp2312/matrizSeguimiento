export const token = {
  get: () => sessionStorage.getItem('token'),
  set: (t: string) => sessionStorage.setItem('token', t),
  clear: () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('token_expiry');
  },
  getExpiry: (): number => {
    const raw = sessionStorage.getItem('token_expiry');
    return raw ? parseInt(raw, 10) : 0;
  },
  setExpiry: (seconds: number) => {
    sessionStorage.setItem('token_expiry', String(Date.now() + seconds * 1000));
  },
};
