export const token = {
  get: () => sessionStorage.getItem('token'),
  set: (t: string) => sessionStorage.setItem('token', t),
  clear: () => sessionStorage.removeItem('token'),
};
