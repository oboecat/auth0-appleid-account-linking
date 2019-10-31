export function ensureProvider(provider) {
  return function providerChecker(req, res, next) {
    const { user } = req;
    if (!req.isAuthenticated() || !user) {
      return next(new Error("Unauthorized"));
    }
    if (user.provider !== provider) {
      return next(new Error("Provider not found"));
    }
    next();
  };
}
