export function ensureProvider(provider) {
    return function providerChecker(req, res, next) {
        const { user } = req.openid;
        if (!user) {
            return next(new Error("Unauthorized"));
        }
        if (user.provider !== provider) {
            return next(new Error("Wrong provider"));
        }
        next();
    };
}
