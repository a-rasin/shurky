const isAuthed = (req, res, next) => {
  if (req.session.user_id) {
    next();
    return;
  }
  console.log('logout: ' + req.session.user_id)

  return res.status(401).json({ message: 'Not logged it' });
}

module.exports = { isAuthed };
