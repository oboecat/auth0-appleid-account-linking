export function ensureAuthState(req, res, next) {
    if (!req.session.auth0State) {
        return next(new Error("Invalid session"));
    }
    next()
}
