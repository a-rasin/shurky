export const authFetch = async (url, params) => {
  const res = await fetch(url, params);

  // Delete local user
  if (res.status === 401) {
    localStorage.setItem('user', '{}');
    console.log('Delete local user');
  }

  return res;
}
