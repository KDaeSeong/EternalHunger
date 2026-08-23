const { validatePassword } = require('../utils/authPolicy');

function passwordPolicyGuard(req, res, next) {
  if (req.method !== 'PUT' || req.path !== '/password') return next();
  const result = validatePassword(req.body?.newPassword);
  if (result.ok) return next();
  return res.status(400).json({
    error: result.error,
    code: 'PASSWORD_POLICY',
  });
}

module.exports = passwordPolicyGuard;
